import type { WatchlistModel } from '@/generated/prisma/models';
import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';

/**
 * One movie a user has saved to watch.
 *
 * The field list is explicit so a new column cannot silently widen the DTO;
 * the types come from the generated model, except the two normalized below.
 */
export type Watchlist = Omit<
  Pick<WatchlistModel, 'id' | 'movieId' | 'userId' | 'createdAt' | 'updatedAt'>,
  'movieId' | 'userId'
> & {
  /**
   * Normalized from bigint. `watchlists.movie_id` and `user_id` are bigint
   * while `movies.id` and `users.id` are integer, and there are no foreign
   * keys tying them together. Left as bigint the DTO would throw on
   * `JSON.stringify` the first time it crossed the RSC boundary, and every
   * caller would have to convert before comparing against a movie id.
   *
   * Nullable because the columns are: a row may point at nothing.
   */
  movieId: number | null;
  userId: number | null;
};

/**
 * The columns the watchlist may be sorted by — a closed union, deliberately.
 *
 * The source route took `:columnName` straight off the URL and handed it to
 * Sequelize's `order`, so `/watchlist/1/title/asc` reached Postgres as an
 * unknown column and raised 42703 — which the error handler then echoed to
 * the client complete with the failing SQL, the column list and Postgres
 * internals. Making the union closed turns that from a runtime schema
 * disclosure into a compile error, and `ORDER_BY` below is the only place a
 * column name is ever spelled.
 */
export type WatchlistSortColumn = 'createdAt' | 'releaseDate';

export type SortDirection = 'asc' | 'desc';

/** What `server/utils/search.js` used, and what `pageCount` is computed from. */
export const WATCHLIST_PAGE_SIZE = 25;

export type WatchlistPage = {
  entries: Watchlist[];
  pagination: { count: number; page: number; pageCount: number };
};

/**
 * A film as the three progress views need it: enough to draw a row, plus
 * whether this reader has seen it.
 *
 * `watched` is computed per row against the caller's own id. It is an
 * `exists` subquery rather than a join because `watchlists` has no unique
 * constraint on `(user_id, movie_id)` — see `add` — so a duplicate pair would
 * otherwise multiply the nominee rows it touched.
 */
export type WatchlistProgressFilm = {
  movieId: number;
  tmdbId: string | null;
  title: string | null;
  sortTitle: string | null;
  releaseDate: Date | null;
  poster: string | null;
  watched: boolean;
};

/** One nomination, for "how much of this show have I seen". */
export type NomineeProgressRow = WatchlistProgressFilm & {
  nominationId: number;
  showName: string;
  awardName: string;
};

/** One nominated film and how many nominations it earned that year. */
export type NominatedFilmRow = WatchlistProgressFilm & { nominations: number };

/** One film a league drafted, in a league the caller has a seat in. */
export type DraftedFilmRow = WatchlistProgressFilm & {
  leagueId: number;
  leagueName: string;
};

const SELECT = {
  id: true,
  movieId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** The shape `findMany` returns before the bigints are narrowed. */
type Row = {
  id: number;
  movieId: bigint | null;
  userId: bigint | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

function toDto(row: Row): Watchlist {
  return {
    id: row.id,
    movieId: row.movieId === null ? null : Number(row.movieId),
    userId: row.userId === null ? null : Number(row.userId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Sorting by release date means ordering by a column on `movies`, and this
 * schema declares no relations for Prisma to traverse — there are no foreign
 * keys to infer them from — so the paged read is raw SQL with a LEFT JOIN.
 *
 * LEFT, not INNER: a watchlist row whose movie was deleted still belongs to
 * the user and must still appear, at the null end of the ordering.
 */
const ORDER_BY: Record<WatchlistSortColumn, string> = {
  createdAt: 'w.created_at',
  releaseDate: 'm.release_date',
};

const DIRECTIONS: Record<SortDirection, string> = { asc: 'asc', desc: 'desc' };

/** Shared by `countByUser` and the paged read, without going through `this`. */
async function countByUser(userId: number | bigint): Promise<number> {
  return db.watchlist.count({ where: { userId: BigInt(userId) } });
}

export const watchlistRepository = {
  /** Throws NotFoundError rather than returning null — callers would forget to check. */
  async findById(id: number): Promise<Watchlist> {
    const entry = await db.watchlist.findUnique({ where: { id }, select: SELECT });
    if (!entry) throw new NotFoundError('watchlist', id);
    return toDto(entry);
  },

  /** Total rows for the user, which is what drives `pageCount`. */
  countByUser,

  /**
   * One page of a user's watchlist, sorted across the whole list.
   *
   * 🔴 Deviates from `fixtures/watchlist-paged.json` on purpose. Sequelize's
   * `findAndCountAll` switched to a subquery once the hasMany `reviews`
   * include was present, so LIMIT/OFFSET applied to `watchlists` alone and the
   * ORDER BY only reordered the 25 rows that had already been chosen. Every
   * page came back sorted within itself, the sequence across pages was
   * meaningless, and changing the sort could not move a movie between pages.
   * Sorting before paging is the fix; `watchlists.test.ts` reproduces the old
   * shape in SQL so the difference is documented rather than asserted.
   *
   * `w.id` breaks ties so a row cannot appear on two pages, or on none —
   * release dates in particular repeat heavily.
   *
   * Movies are not joined into the result. The caller composes them with
   * `movieRepository.findManyByIds`, preserving the order returned here.
   */
  async findPageByUser(
    userId: number | bigint,
    options: {
      page?: number;
      sortBy?: WatchlistSortColumn;
      direction?: SortDirection;
    } = {},
  ): Promise<WatchlistPage> {
    const page = Math.max(1, Math.trunc(options.page ?? 1));
    // The `??` fallbacks are belt and braces: the union already makes an
    // unknown column unspellable, but this file must never interpolate a
    // string it did not choose itself.
    const column = ORDER_BY[options.sortBy as WatchlistSortColumn] ?? ORDER_BY.createdAt;
    const direction = DIRECTIONS[options.direction as SortDirection] ?? DIRECTIONS.desc;

    const count = await countByUser(userId);

    const rows = await db.$queryRawUnsafe<Row[]>(
      `select w.id             as "id",
              w.movie_id       as "movieId",
              w.user_id        as "userId",
              w.created_at     as "createdAt",
              w.updated_at     as "updatedAt"
         from watchlists w
         left join movies m on m.id = w.movie_id
        where w.user_id = $1
        order by ${column} ${direction}, w.id asc
        limit $2 offset $3`,
      Number(userId),
      WATCHLIST_PAGE_SIZE,
      WATCHLIST_PAGE_SIZE * (page - 1),
    );

    return {
      entries: rows.map(toDto),
      pagination: {
        count,
        page,
        pageCount: Math.ceil(count / WATCHLIST_PAGE_SIZE),
      },
    };
  },

  /**
   * Every movie id on a user's watchlist.
   *
   * The awards, nominations and drafts views each mark the nominees a user has
   * already saved. They need membership, not rows, and the largest watchlist
   * in production is 486 ids — cheaper to hold as a set than to ask per movie.
   */
  async findMovieIdsByUser(userId: number | bigint): Promise<number[]> {
    const rows = await db.watchlist.findMany({
      where: { userId: BigInt(userId), movieId: { not: null } },
      select: { movieId: true },
      orderBy: { id: 'asc' },
    });
    return rows.flatMap((row) => (row.movieId === null ? [] : [Number(row.movieId)]));
  },

  /**
   * The user's entries for specific movies, skipping the ones they have not
   * saved.
   *
   * Accepts bigint because callers hold ids from tables that store them that
   * way, and a dangling id must not throw — this schema has no foreign keys.
   */
  async findByUserAndMovieIds(
    userId: number | bigint,
    movieIds: readonly (number | bigint)[],
  ): Promise<Watchlist[]> {
    if (movieIds.length === 0) return [];
    const rows = await db.watchlist.findMany({
      where: { userId: BigInt(userId), movieId: { in: movieIds.map(BigInt) } },
      select: SELECT,
      orderBy: { id: 'asc' },
    });
    return rows.map(toDto);
  },

  /**
   * This year's nominees, every one of them, marked with what the caller has
   * seen.
   *
   * One query. The naive shape — nominations, then awards, then events, then
   * movies, then a watchlist lookup per film — is five round trips plus 526
   * more for a single season, and the page groups the whole set anyway.
   *
   * Rows come back in id order; the display ordering is the service's, because
   * sorting film titles is a locale question and Postgres would answer it with
   * whatever collation the cluster was created with.
   */
  async findNomineeProgressByUser(
    userId: number | bigint,
    year: number,
  ): Promise<NomineeProgressRow[]> {
    return db.$queryRaw<NomineeProgressRow[]>`
      select n.id           as "nominationId",
             e.name         as "showName",
             a.name         as "awardName",
             m.id           as "movieId",
             m.tmdb_id      as "tmdbId",
             m.title        as "title",
             m.sort_title   as "sortTitle",
             m.release_date as "releaseDate",
             m.poster       as "poster",
             exists (
               select 1 from watchlists w
                where w.movie_id = m.id and w.user_id = ${Number(userId)}
             )              as "watched"
        from nominations n
        join awards a on a.id = n.award_id
        join events e on e.id = a.event_id
        join movies m on m.id = n.movie_id
       where n.year = ${year}
       order by n.id asc`;
  },

  /**
   * The year's nominated films, each with its nomination count.
   *
   * Counting is not scoring — no point value is involved — which is why this
   * counts rows rather than going through `lib/services/scoring.ts`.
   */
  async findNominatedFilmProgressByUser(
    userId: number | bigint,
    year: number,
  ): Promise<NominatedFilmRow[]> {
    return db.$queryRaw<NominatedFilmRow[]>`
      select m.id           as "movieId",
             m.tmdb_id      as "tmdbId",
             m.title        as "title",
             m.sort_title   as "sortTitle",
             m.release_date as "releaseDate",
             m.poster       as "poster",
             count(*)::int  as "nominations",
             exists (
               select 1 from watchlists w
                where w.movie_id = m.id and w.user_id = ${Number(userId)}
             )              as "watched"
        from nominations n
        join movies m on m.id = n.movie_id
       where n.year = ${year}
       group by m.id
       order by count(*) desc, m.id asc`;
  },

  /**
   * What the caller's leagues drafted this year, marked with what they have
   * seen.
   *
   * 🔴 Scoped twice over, and both scopes matter. The leagues are the ones the
   * caller holds a seat in — membership is a `drafts` row, this schema has no
   * members table — and the seen mark is their own. The source's equivalent
   * (`Watchlist.getByAwards`) checked that *a* user was signed in and then
   * filtered by none, so it answered with every user's rows.
   *
   * Grouped by `(league, movie)` so a film two seats in the same league both
   * took appears once, which is the `uniqBy` the source did in JavaScript.
   */
  async findDraftedFilmProgressByUser(
    userId: number | bigint,
    year: number,
  ): Promise<DraftedFilmRow[]> {
    return db.$queryRaw<DraftedFilmRow[]>`
      select l.id           as "leagueId",
             l.name         as "leagueName",
             m.id           as "movieId",
             m.tmdb_id      as "tmdbId",
             m.title        as "title",
             m.sort_title   as "sortTitle",
             m.release_date as "releaseDate",
             m.poster       as "poster",
             exists (
               select 1 from watchlists w
                where w.movie_id = m.id and w.user_id = ${Number(userId)}
             )              as "watched"
        from drafts d
        join leagues l on l.id = d.league_id
        join draft_picks p on p.draft_id = d.id
        join movies m on m.id = p.movie_id
       where d.year = ${year}
         and d.league_id in (
           select s.league_id from drafts s
            where s.user_id = ${Number(userId)} and s.league_id is not null
         )
       group by l.id, m.id
       order by l.id asc, m.id asc`;
  },

  /**
   * Mark a film watched, once.
   *
   * 🔴 **Keyed on `(userId, movieId)`, not on the row id.** The source app wrote
   * with `POST /watchlist/item` and removed with `DELETE /watchlist/item/:id` —
   * a row id off the URL. The pair is what a caller actually knows, and the
   * difference is a security property: another person's row id is a perfectly
   * valid integer, whereas this pair cannot address their row at all.
   *
   * Idempotent, because marking a film watched twice is not an error — a member
   * double-taps the badge on a browse grid, or has two tabs open. The table has
   * no unique constraint to lean on (the schema declares none, and adding one
   * would need the restored rows checked for existing duplicates first), so the
   * check is explicit.
   */
  async add(userId: number | bigint, movieId: number | bigint): Promise<Watchlist> {
    const existing = await db.watchlist.findFirst({
      where: { userId: BigInt(userId), movieId: BigInt(movieId) },
      select: SELECT,
    });
    if (existing) return toDto(existing);

    const now = new Date();
    const row = await db.watchlist.create({
      data: {
        userId: BigInt(userId),
        movieId: BigInt(movieId),
        createdAt: now,
        updatedAt: now,
      },
      select: SELECT,
    });
    return toDto(row);
  },

  /**
   * Unmark a film, for this user only.
   *
   * `deleteMany` rather than `delete`: unmarking a film that was never marked is
   * a no-op rather than a failure — an optimistic badge and the database can
   * disagree for a moment when two tabs are open — and `delete` throws on a
   * miss. It also clears a duplicate pair if one ever existed, which `delete`
   * could not.
   */
  async deleteByUserAndMovie(
    userId: number | bigint,
    movieId: number | bigint,
  ): Promise<void> {
    await db.watchlist.deleteMany({
      where: { userId: BigInt(userId), movieId: BigInt(movieId) },
    });
  },
};

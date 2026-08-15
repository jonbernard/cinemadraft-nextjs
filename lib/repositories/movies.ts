import type { MovieModel } from '@/generated/prisma/models';
import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';

/**
 * A movie, shaped as the source API returned it.
 *
 * Picked from the generated model rather than retyped by hand. The field list
 * stays explicit, so adding a column to the database still cannot silently
 * widen what every component receives — but the field *types* come from the
 * schema and cannot drift out of sync with it.
 *
 * The import is `import type`, which TypeScript erases at compile time. No
 * Prisma runtime crosses this boundary; a value import would drag the client
 * into every component that touches a Movie.
 *
 * `poster` and `backdrop` are bare TMDB paths, e.g.
 * `/4Iu5f2nv7huqvuYkmZvSPOtbFjs.jpg` — NOT full URLs. The source API returned
 * absolute URLs, built per request by prepending a base fetched from TMDB's
 * /configuration endpoint (see `server/config/movieImages.js`). That base and
 * the chosen size can change without our data changing, so it is a
 * presentation concern and lives in `lib/external/tmdb.ts`, not here.
 * Repositories return database truth.
 *
 * `accentHex` is a poster-derived accent, populated lazily. It is ours; the
 * source API had no such field.
 */
export type Movie = Pick<
  MovieModel,
  | 'id'
  | 'title'
  | 'sortTitle'
  | 'fbId'
  | 'imdbId'
  | 'tmdbId'
  | 'poster'
  | 'backdrop'
  | 'releaseDate'
  | 'createdAt'
  | 'updatedAt'
  | 'accentHex'
>;

const SELECT = {
  id: true,
  title: true,
  sortTitle: true,
  fbId: true,
  imdbId: true,
  tmdbId: true,
  poster: true,
  backdrop: true,
  releaseDate: true,
  createdAt: true,
  updatedAt: true,
  accentHex: true,
} as const;

export const movieRepository = {
  /** Throws NotFoundError rather than returning null — callers would forget to check. */
  async findById(id: number): Promise<Movie> {
    const movie = await db.movie.findUnique({ where: { id }, select: SELECT });
    if (!movie) throw new NotFoundError('movie', id);
    return movie;
  },

  /** Returns null on a miss: asking whether a TMDB movie is known locally is a legitimate question. */
  async findByTmdbId(tmdbId: string): Promise<Movie | null> {
    return db.movie.findFirst({ where: { tmdbId }, select: SELECT });
  },

  /**
   * Batch-load by id, skipping ids that do not resolve.
   *
   * Accepts bigint because this schema has no foreign keys and the referencing
   * columns disagree on width: movies.id is integer, but draft_picks.movie_id,
   * nominations.movie_id, watchlists.movie_id and winners.movie_id are all
   * bigint. A dangling reference is therefore possible, and must not take down
   * a page render.
   */
  async findManyByIds(ids: readonly (number | bigint)[]): Promise<Movie[]> {
    if (ids.length === 0) return [];
    return db.movie.findMany({
      where: { id: { in: ids.map(Number) } },
      select: SELECT,
      orderBy: { id: 'asc' },
    });
  },

  /** Local-first title search, ordered for display (D20). */
  async search(query: string, limit = 20): Promise<Movie[]> {
    return db.movie.findMany({
      where: { title: { contains: query, mode: 'insensitive' } },
      select: SELECT,
      orderBy: { sortTitle: 'asc' },
      take: limit,
    });
  },

  /**
   * Title search that tolerates a typo (§10).
   *
   * Two clauses, both served by the `movies_title_trgm` GIN index:
   *
   * - `ILIKE '%q%'` — the substring the person actually typed. This is the
   *   common case and it is exact.
   * - `word_similarity(q, title) >= 0.5` — the mistyped case. `word_similarity`
   *   rather than `similarity` because the query is a fragment and the title is
   *   long; comparing whole strings scores every real match near zero.
   *
   * The 0.5 threshold is measured, not guessed — see the migration. Postgres
   * defaults to 0.6, which rejects transposed letters ("battel" scores 0.571),
   * and transposition is the typo people make when typing at speed. It is
   * written into the predicate rather than set as a session GUC because a
   * pooled connection may not carry the SET.
   *
   * Raw SQL because Prisma has no `word_similarity`. The query is
   * parameterised — `$queryRaw` is a tagged template and interpolations become
   * bind parameters, so a film called `'; drop table movies; --` is searched
   * for rather than executed.
   *
   * Ordering here is a *tiebreak for the LIMIT*, not the final order — the
   * service ranks by context afterwards (`search-ranking.ts`). Without it the
   * limit would truncate arbitrarily and the best match could be the row that
   * fell off the end.
   */
  async searchFuzzy(query: string, limit = 20): Promise<Movie[]> {
    const trimmed = query.trim();
    if (trimmed === '') return [];

    const rows = await db.$queryRaw<{ id: number }[]>`
      SELECT id
        FROM movies
       WHERE title ILIKE '%' || ${trimmed} || '%'
          OR word_similarity(${trimmed}, title) >= 0.5
       ORDER BY word_similarity(${trimmed}, title) DESC, sort_title ASC
       LIMIT ${limit}
    `;
    if (rows.length === 0) return [];

    // A second round trip rather than selecting the columns in the raw query:
    // `$queryRaw` returns snake_case straight from Postgres and bypasses
    // Prisma's field mapping, so the DTO would have to be rebuilt by hand here
    // and would drift from SELECT the moment a column is added.
    const movies = await db.movie.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      select: SELECT,
    });

    // findMany does not preserve the IN order, and the order is the point.
    const byId = new Map(movies.map((movie) => [movie.id, movie]));
    return rows.flatMap((row) => {
      const movie = byId.get(row.id);
      return movie ? [movie] : [];
    });
  },
};

// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { loadFixture } from '@/test/fixtures';

import { WATCHLIST_PAGE_SIZE, watchlistRepository } from './watchlists';

afterAll(async () => {
  await db.$disconnect();
});

/** `GET /watchlist/1/releaseDate/asc`, captured as user 3. */
type FixturePage = {
  data: { watchlistId: number; movieId: number; releaseDate: string }[];
  pagination: { count: number; page: number; pageCount: number };
};

const page = loadFixture<FixturePage>('watchlist-paged');

const USER = 3;

describe('watchlistRepository.findById', () => {
  it('returns the entry', async () => {
    const entry = await watchlistRepository.findById(3040);
    expect(entry.userId).toBe(USER);
    expect(entry.movieId).toBe(1084);
  });

  it('throws NotFoundError for an id that does not exist', async () => {
    await expect(watchlistRepository.findById(999_999)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(watchlistRepository.findById(999_999)).rejects.toThrow(
      'watchlist 999999 not found',
    );
  });
});

describe('watchlistRepository.countByUser', () => {
  it('matches the count the source API reported', async () => {
    expect(await watchlistRepository.countByUser(USER)).toBe(page.pagination.count);
  });

  it('returns 0 rather than throwing for a user with no watchlist', async () => {
    expect(await watchlistRepository.countByUser(999_999)).toBe(0);
  });
});

describe('watchlistRepository.findPageByUser', () => {
  it('reports the same pagination the source API did', async () => {
    const result = await watchlistRepository.findPageByUser(USER, {
      page: 1,
      sortBy: 'releaseDate',
      direction: 'asc',
    });

    expect(result.pagination).toEqual(page.pagination);
    expect(result.entries).toHaveLength(WATCHLIST_PAGE_SIZE);
  });

  it('sorts the whole watchlist before paging it — the source app did not', async () => {
    // 🔴 Deliberate deviation from the fixture.
    //
    // Sequelize's findAndCountAll used a subquery once a hasMany include was
    // present, so LIMIT/OFFSET were applied to `watchlists` alone and the
    // ORDER BY on the joined movie only reordered the 25 rows that survived.
    // Page 1 was therefore the 25 lowest watchlist ids sorted by release date
    // among themselves — every page independently sorted, the overall sequence
    // meaningless, and paging past the first page skipped rows that belonged
    // earlier. The check below reproduces that shape from SQL to prove the
    // diagnosis rather than assert it.
    const reproduced = await db.$queryRaw<{ id: number }[]>`
      select w.id
      from watchlists w
      left join movies m on m.id = w.movie_id
      where w.id in (
        select id from watchlists where user_id = ${USER} order by id asc limit ${WATCHLIST_PAGE_SIZE}
      )
      order by m.release_date asc
    `;
    expect(reproduced.map((r) => r.id)).toEqual(page.data.map((d) => d.watchlistId));

    // What the port returns instead: the global ordering, paged.
    const result = await watchlistRepository.findPageByUser(USER, {
      page: 1,
      sortBy: 'releaseDate',
      direction: 'asc',
    });

    const ordered = await db.$queryRaw<{ id: number }[]>`
      select w.id
      from watchlists w
      left join movies m on m.id = w.movie_id
      where w.user_id = ${USER}
      order by m.release_date asc, w.id asc
      limit ${WATCHLIST_PAGE_SIZE}
    `;

    expect(result.entries.map((e) => e.id)).toEqual(ordered.map((r) => r.id));
    expect(result.entries.map((e) => e.id)).not.toEqual(
      page.data.map((d) => d.watchlistId),
    );
  });

  it('orders by createdAt descending by default, using the database ordering', async () => {
    const result = await watchlistRepository.findPageByUser(USER);

    const ordered = await db.$queryRaw<{ id: number }[]>`
      select id from watchlists
      where user_id = ${USER}
      order by created_at desc, id asc
      limit ${WATCHLIST_PAGE_SIZE}
    `;

    expect(result.entries.map((e) => e.id)).toEqual(ordered.map((r) => r.id));
  });

  it('honours the direction', async () => {
    const asc = await watchlistRepository.findPageByUser(USER, {
      sortBy: 'createdAt',
      direction: 'asc',
    });
    const desc = await watchlistRepository.findPageByUser(USER, {
      sortBy: 'createdAt',
      direction: 'desc',
    });

    expect(asc.entries[0]?.id).not.toBe(desc.entries[0]?.id);
  });

  it('pages without overlapping or dropping rows', async () => {
    const first = await watchlistRepository.findPageByUser(USER, { page: 1 });
    const second = await watchlistRepository.findPageByUser(USER, { page: 2 });

    const overlap = new Set(first.entries.map((e) => e.id));
    expect(second.entries.some((e) => overlap.has(e.id))).toBe(false);
    expect(second.pagination.page).toBe(2);
  });

  it('returns an empty page past the end rather than throwing', async () => {
    const result = await watchlistRepository.findPageByUser(USER, { page: 999 });
    expect(result.entries).toEqual([]);
    expect(result.pagination.count).toBe(page.pagination.count);
  });

  it('rejects an unsortable column at compile time, not in Postgres', async () => {
    // The source route passed `:columnName` straight into the Sequelize order
    // array, so `/watchlist/1/title/asc` raised Postgres 42703 — and the error
    // handler returned the failing SQL, the column list and Postgres internals
    // to the client. A closed union is the fix: an unsupported column cannot
    // be spelled, so it can never reach the database.
    await watchlistRepository.findPageByUser(USER, {
      // @ts-expect-error — 'title' is not a sortable column
      sortBy: 'title',
    });
  });
});

describe('watchlistRepository.findMovieIdsByUser', () => {
  it('returns every movie the user has watchlisted', async () => {
    const movieIds = await watchlistRepository.findMovieIdsByUser(USER);
    expect(movieIds).toHaveLength(page.pagination.count);
    expect(movieIds.every((id) => typeof id === 'number')).toBe(true);
  });

  it('covers the movies the awards and noms views flagged as watchlisted', async () => {
    // Those views mark a nominee when the viewing user already has the movie.
    // The captured markers are the contract for what this method must return.
    const noms = loadFixture<{ movies: { movieId: number; watchlistId?: number }[] }>(
      'watchlist-noms',
    );
    const flagged = noms.movies.filter((m) => m.watchlistId !== undefined);
    expect(flagged.length).toBeGreaterThan(0);

    const movieIds = new Set(await watchlistRepository.findMovieIdsByUser(USER));
    for (const movie of flagged) expect(movieIds.has(movie.movieId)).toBe(true);
  });

  it('returns an empty array for a user with no watchlist', async () => {
    expect(await watchlistRepository.findMovieIdsByUser(999_999)).toEqual([]);
  });
});

describe('watchlistRepository.findByUserAndMovieIds', () => {
  it('returns the entries for the movies asked about', async () => {
    const entries = await watchlistRepository.findByUserAndMovieIds(USER, [1084, 1055]);
    expect(entries.map((e) => e.id).sort((a, b) => a - b)).toEqual([3040, 3041]);
  });

  it('accepts the bigint ids other tables store', async () => {
    // watchlists.movie_id is bigint while movies.id is integer, and there are
    // no foreign keys, so callers hold both widths.
    const entries = await watchlistRepository.findByUserAndMovieIds(USER, [1084n]);
    expect(entries).toHaveLength(1);
  });

  it('silently skips movie ids the user has not watchlisted', async () => {
    const entries = await watchlistRepository.findByUserAndMovieIds(
      USER,
      [1084, 999_999],
    );
    expect(entries).toHaveLength(1);
  });

  it('returns an empty array for an empty request', async () => {
    expect(await watchlistRepository.findByUserAndMovieIds(USER, [])).toEqual([]);
  });
});

describe('the DTO matches the captured contract', () => {
  it('normalizes the bigint columns to number', async () => {
    // movie_id and user_id are bigint. Left as bigint they would take down
    // every JSON.stringify on the way to the client, which is exactly what
    // happens when a DTO crosses the RSC boundary.
    const entry = await watchlistRepository.findById(3040);

    expect(typeof entry.movieId).toBe('number');
    expect(typeof entry.userId).toBe('number');
    expect(() => JSON.stringify(entry)).not.toThrow();
  });

  it('normalizes the bigints on the paged path too', async () => {
    const result = await watchlistRepository.findPageByUser(USER, { page: 1 });
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(result.entries.every((e) => typeof e.movieId === 'number')).toBe(true);
  });

  it('exposes the movie ids the captured page reported', async () => {
    const entries = await watchlistRepository.findByUserAndMovieIds(
      USER,
      page.data.map((d) => d.movieId),
    );
    expect(entries).toHaveLength(page.data.length);
  });

  it('returns Date objects, not the formatted strings the API sent', async () => {
    // The API ran every date through moment's 'L' format ("01/24/2017").
    // Formatting is a presentation concern and belongs above this layer.
    const entry = await watchlistRepository.findById(3040);
    expect(entry.createdAt).toBeInstanceOf(Date);
  });

  it('returns no Prisma internals', async () => {
    const entry = await watchlistRepository.findById(3040);
    expect(Object.getPrototypeOf(entry)).toBe(Object.prototype);
  });

  it('carries exactly the table columns', async () => {
    const entry = await watchlistRepository.findById(3040);
    expect(Object.keys(entry).sort()).toEqual(
      ['id', 'movieId', 'userId', 'createdAt', 'updatedAt'].sort(),
    );
  });
});

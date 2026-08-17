// @vitest-environment node

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/lib/db';
import { clearCacheForTests } from '@/lib/external/cache';
import { countQueries } from '@/test/query-count';
import { loadBrowse } from './browse';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * The browse shelf: the grouping, its order, and the query count.
 *
 * TMDB is stubbed; the database is real, because the watched marks are the one
 * thing here that could turn into an N+1 and a stub of the database would hide
 * exactly that.
 */
const KEY = 'test-tmdb-key';

/** A TMDB discover result, with the fields the mapper needs. */
function result(id: number, title: string, releaseDate: string | null) {
  return {
    id,
    title,
    poster_path: `/${id}.jpg`,
    popularity: 90,
    ...(releaseDate ? { release_date: releaseDate } : {}),
  };
}

function mockDiscover(results: unknown[], totalPages = 3) {
  const fetchMock = vi.fn(
    async () =>
      ({
        ok: true,
        json: async () => ({ page: 1, total_pages: totalPages, results }),
      }) as Response,
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Three months, deliberately out of order in the response. */
const ACROSS_MONTHS = [
  result(1, 'July film', '2026-07-15'),
  result(2, 'August film', '2026-08-04'),
  result(3, 'Another August film', '2026-08-20'),
  result(4, 'June film', '2026-06-02'),
];

beforeEach(() => {
  clearCacheForTests();
  process.env.TMDB_API_KEY = KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TMDB_API_KEY;
});

describe('grouping by month', () => {
  it('groups the films and labels each group MM/YYYY', async () => {
    mockDiscover(ACROSS_MONTHS);

    const page = await loadBrowse({ when: 'past', page: 1, userId: null });

    expect(page.months.map((month) => month.label)).toEqual([
      '08/2026',
      '07/2026',
      '06/2026',
    ]);
    expect(page.months.at(0)?.films.map((film) => film.title)).toEqual([
      'August film',
      'Another August film',
    ]);
  });

  it('🔴 orders newest first when looking back', async () => {
    // The direction the reader is looking is the order of the page. Looking
    // back, the newest month is the top.
    mockDiscover(ACROSS_MONTHS);

    const page = await loadBrowse({ when: 'past', page: 1, userId: null });

    expect(page.months.at(0)?.label).toBe('08/2026');
  });

  it('🔴 orders soonest first when looking forward', async () => {
    // And looking forward it is the other way round. A single sort would have
    // put next year's releases above next month's.
    mockDiscover(ACROSS_MONTHS);

    const page = await loadBrowse({ when: 'future', page: 1, userId: null });

    expect(page.months.at(0)?.label).toBe('06/2026');
  });

  it('🔴 labels months in UTC', async () => {
    // A film released on the 1st would otherwise fall into the previous month for
    // every reader west of UTC — so the page would group differently depending on
    // who was looking, and disagree with the date on the film's own page.
    mockDiscover([result(9, 'First of the month', '2026-08-01')]);

    const page = await loadBrowse({ when: 'past', page: 1, userId: null });

    expect(page.months.at(0)?.label).toBe('08/2026');
  });
});

describe('films with no release date', () => {
  it('🔴 keeps them in their own group rather than dropping them', async () => {
    // An announced film with no date is still a film, and TMDB has plenty.
    mockDiscover([...ACROSS_MONTHS, result(5, 'Announced only', null)]);

    const page = await loadBrowse({ when: 'future', page: 1, userId: null });

    expect(page.months.map((month) => month.label)).toContain('Undated');
  });

  it('🔴 sorts them last on both sides', async () => {
    // Not simply reversed with everything else: the label has no month, so an
    // order value of Infinity multiplied by -1 would put it *first* when looking
    // back. Both directions are asserted because only one of them catches that.
    mockDiscover([result(5, 'Announced only', null), ...ACROSS_MONTHS]);

    for (const when of ['past', 'future'] as const) {
      const page = await loadBrowse({ when, page: 1, userId: null });
      expect(page.months.at(-1)?.label).toBe('Undated');
    }
  });
});

describe('the watched marks', () => {
  it('marks nothing for an anonymous reader', async () => {
    mockDiscover(ACROSS_MONTHS);

    const page = await loadBrowse({ when: 'past', page: 1, userId: null });

    expect(
      page.months.flatMap((month) => month.films).every((film) => !film.watched),
    ).toBe(true);
  });

  it('🔴 asks the database nothing at all for an anonymous reader', async () => {
    // Browse is public, so this is the common case. A logged-out reader should
    // cost zero queries.
    mockDiscover(ACROSS_MONTHS);

    const { queries } = await countQueries(() =>
      loadBrowse({ when: 'past', page: 1, userId: null }),
    );

    expect(queries).toBe(0);
  });

  it('marks a film the reader has watched, and leaves the rest unmarked', async () => {
    const now = new Date();
    const user = await db.user.create({
      data: {
        uuid: crypto.randomUUID(),
        email: `browse-${crypto.randomUUID().slice(0, 8)}@example.test`,
        createdAt: now,
        updatedAt: now,
      },
      select: { id: true },
    });
    const movie = await db.movie.create({
      data: {
        title: 'browse-test August film',
        tmdbId: '2',
        createdAt: now,
        updatedAt: now,
      },
      select: { id: true },
    });
    await db.watchlist.create({
      data: {
        userId: BigInt(user.id),
        movieId: BigInt(movie.id),
        createdAt: now,
        updatedAt: now,
      },
    });

    try {
      mockDiscover(ACROSS_MONTHS);

      const page = await loadBrowse({ when: 'past', page: 1, userId: user.id });
      const films = page.months.flatMap((month) => month.films);

      expect(films.find((film) => film.tmdbId === '2')?.watched).toBe(true);
      expect(films.filter((film) => film.watched)).toHaveLength(1);
    } finally {
      await db.watchlist.deleteMany({ where: { userId: BigInt(user.id) } });
      await db.movie.delete({ where: { id: movie.id } });
      await db.user.delete({ where: { id: user.id } });
    }
  });

  it('🔴 costs the same number of queries for forty films as for four', async () => {
    // The N+1 this is guarding (D59). `isFilmWatched` per poster would be forty
    // round trips for one shelf, and nothing about that code would look wrong.
    const now = new Date();
    const user = await db.user.create({
      data: {
        uuid: crypto.randomUUID(),
        email: `browse-${crypto.randomUUID().slice(0, 8)}@example.test`,
        createdAt: now,
        updatedAt: now,
      },
      select: { id: true },
    });

    try {
      mockDiscover(ACROSS_MONTHS);
      const few = await countQueries(() =>
        loadBrowse({ when: 'past', page: 1, userId: user.id }),
      );

      clearCacheForTests();
      mockDiscover(
        Array.from({ length: 40 }, (_, index) =>
          result(1000 + index, `Film ${index}`, '2026-08-04'),
        ),
      );
      const many = await countQueries(() =>
        loadBrowse({ when: 'past', page: 1, userId: user.id }),
      );

      expect(few.queries).toBeGreaterThan(0);
      expect(many.queries).toBe(few.queries);
      expect(many.queries).toBeLessThanOrEqual(2);
    } finally {
      await db.user.delete({ where: { id: user.id } });
    }
  });
});

describe('what the shelf carries', () => {
  it('builds poster URLs at this boundary', async () => {
    mockDiscover(ACROSS_MONTHS);

    const page = await loadBrowse({ when: 'past', page: 1, userId: null });

    expect(page.months.at(0)?.films.at(0)?.posterUrl).toMatch(
      /^https:\/\/image\.tmdb\.org\/t\/p\/w342\//,
    );
  });

  it('reports the page and page count, for the load-more link', async () => {
    mockDiscover(ACROSS_MONTHS, 21);

    const page = await loadBrowse({ when: 'past', page: 1, userId: null });

    expect(page).toMatchObject({ page: 1, pageCount: 21, when: 'past' });
  });

  it('returns no months rather than throwing when TMDB is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    const page = await loadBrowse({ when: 'past', page: 1, userId: null });

    expect(page.months).toEqual([]);
  });
});

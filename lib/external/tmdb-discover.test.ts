// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearCacheForTests } from './cache';
import { discoverFilms } from './tmdb-discover';

/**
 * 🔴 The subject here is that the two sides of the browse control are two
 * different **queries**, not one sort reversed. The source's control looks like a
 * switch, and copying only the sort would have shipped an empty page on the
 * future side — an unreleased film has no votes, so the past side's vote floor
 * excludes everything.
 */
const KEY = 'test-tmdb-key';

function mockDiscover(body: unknown, ok = true) {
  const fetchMock = vi.fn(async () => ({ ok, json: async () => body }) as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function lastQuery(fetchMock: ReturnType<typeof mockDiscover>): URLSearchParams {
  return new URL(String(fetchMock.mock.calls.at(-1)?.at(0))).searchParams;
}

const EMPTY = { page: 1, total_pages: 0, results: [] };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-27T12:00:00Z'));
  clearCacheForTests();
  process.env.TMDB_API_KEY = KEY;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.TMDB_API_KEY;
});

describe('the past side', () => {
  it('asks for the most notable films in the current partial month', async () => {
    const fetchMock = mockDiscover(EMPTY);

    await discoverFilms({ when: 'past', page: 1 });
    const query = lastQuery(fetchMock);

    expect(query.get('sort_by')).toBe('popularity.desc');
    expect(query.get('release_date.gte')).toBe('2026-09-01');
    expect(query.get('release_date.lte')).toBe('2026-09-27');
  });

  it('keeps the source’s vote floors', async () => {
    // Without them "recent releases" is a wall of unrated obscurities, because
    // TMDB's catalogue is mostly long tail.
    const fetchMock = mockDiscover(EMPTY);

    await discoverFilms({ when: 'past', page: 1 });
    const query = lastQuery(fetchMock);

    expect(query.get('vote_average.gte')).toBe('4');
    expect(query.get('vote_count.gte')).toBe('200');
  });

  it('keeps asking by any release date, which is right looking back', async () => {
    // Only the future side moved to `primary_release_date` (P15.T9). Looking
    // back, a re-release really did play in a cinema on that date, and the
    // vote floors already keep the page to films anybody has heard of.
    const fetchMock = mockDiscover(EMPTY);

    await discoverFilms({ when: 'past', page: 1 });
    const query = lastQuery(fetchMock);

    expect(query.get('release_date.lte')).toBe(new Date().toISOString().slice(0, 10));
    expect(query.has('primary_release_date.gte')).toBe(false);
  });
});

describe('the future side', () => {
  it('bounds the displayed release date to the current partial month', async () => {
    const fetchMock = mockDiscover(EMPTY);

    await discoverFilms({ when: 'future', page: 1 });
    const query = lastQuery(fetchMock);

    expect(query.get('release_date.gte')).toBe('2026-09-27');
    expect(query.get('release_date.lte')).toBe('2026-09-30');
    expect(query.has('primary_release_date.gte')).toBe(false);
  });

  it('asks for the most notable upcoming films, not the soonest', async () => {
    // Measured against the live API on 2026-09-12: sorted by date, pages 1 and
    // 3 held twenty films apiece of which none cleared any usable quality floor
    // — on any given day the obscure releases outnumber the ones anybody will
    // see, so "soonest first" is "junk first". That is why this page rendered
    // "Nothing is scheduled" while the counter claimed 71 pages.
    const fetchMock = mockDiscover(EMPTY);

    await discoverFilms({ when: 'future', page: 1 });

    expect(lastQuery(fetchMock).get('sort_by')).toBe('popularity.desc');
  });

  it('drops a film whose displayed release date is outside the page month', async () => {
    // A re-release can satisfy TMDB's theatrical window while the primary date
    // returned on the card belongs elsewhere. It must not leak across pages.
    mockDiscover({
      page: 1,
      total_pages: 1,
      results: [
        {
          id: 1,
          title: 'A 2006 film re-issued this year',
          poster_path: '/a.jpg',
          popularity: 90,
          release_date: '2006-07-14',
        },
        {
          id: 2,
          title: 'Actually unreleased',
          poster_path: '/b.jpg',
          popularity: 90,
          release_date: '2026-09-28',
        },
      ],
    });

    const page = await discoverFilms({ when: 'future', page: 1 });

    expect(page.films.map((film) => film.title)).toEqual(['Actually unreleased']);
  });

  it('holds unreleased films to a LOWER popularity floor than released ones', async () => {
    // Backwards-looking at first glance, and measured rather than guessed.
    // TMDB's popularity numbers for unreleased films are an order of magnitude
    // below released ones — on 2026-09-12 the entire upcoming slate ran 236,
    // 42, 42, 26, … and was under 8 by rank 21, with real studio releases
    // sitting there. The future side's sort does the ranking now, so its floor
    // only has to trim the 0.x noise; the past side still uses its floor to
    // sweep up the unrated tail its vote floors let through.
    const middling = (releaseDate: string) => ({
      page: 1,
      total_pages: 1,
      results: [
        {
          id: 1,
          title: 'Middling',
          poster_path: '/a.jpg',
          popularity: 8,
          release_date: releaseDate,
        },
      ],
    });

    mockDiscover(middling('2026-09-28'));
    expect((await discoverFilms({ when: 'future', page: 1 })).films).toHaveLength(1);

    clearCacheForTests();
    mockDiscover(middling('2026-09-01'));
    expect((await discoverFilms({ when: 'past', page: 1 })).films).toHaveLength(0);
  });

  it('sends no vote floor at all', async () => {
    // An unreleased film has no votes, so carrying the past side's floors here
    // returns an empty page — which is exactly what "just flip the sort" would
    // have shipped, and it would have read as a broken feature rather than a
    // wrong query.
    const fetchMock = mockDiscover(EMPTY);

    await discoverFilms({ when: 'future', page: 1 });
    const query = lastQuery(fetchMock);

    expect(query.has('vote_count.gte')).toBe(false);
    expect(query.has('vote_average.gte')).toBe(false);
    expect(query.get('release_date.lte')).toBe('2026-09-30');
  });
});

describe('both sides', () => {
  it.each(['past', 'future'] as const)(
    'scope %s to US theatrical releases',
    async (when) => {
      // The league is scored on US theatrical seasons, which is why the source
      // sent both. A film's international date can fall in a different eligibility
      // year.
      const fetchMock = mockDiscover(EMPTY);

      await discoverFilms({ when, page: 1 });
      const query = lastQuery(fetchMock);

      expect(query.get('region')).toBe('US');
      // 🔴 `2|3`, not `3`. Limited *and* wide: awards contenders routinely open
      // in a qualifying limited run, and a wide-only query misses or mis-dates
      // exactly the films this app exists to score.
      expect(query.get('with_release_type')).toBe('2|3');
    },
  );

  it.each(['past', 'future'] as const)(
    'asks TMDB to exclude shorts on the %s side',
    async (when) => {
      // Server-side, so it costs nothing and removes catalogue filler before
      // TMDB paginates rather than after.
      const fetchMock = mockDiscover(EMPTY);

      await discoverFilms({ when, page: 1 });

      expect(lastQuery(fetchMock).get('with_runtime.gte')).toBe('40');
    },
  );
});

describe('what gets dropped, and where', () => {
  it('drops posterless and unpopular films before the caller sees them', async () => {
    // The source filtered popularity on the server and posters in the browser,
    // so its page counter counted rows the reader never saw — and a "load more"
    // that appeared to do nothing was the visible symptom.
    const fetchMock = mockDiscover({
      page: 1,
      total_pages: 1,
      results: [
        {
          id: 1,
          title: 'No poster',
          poster_path: null,
          popularity: 90,
          release_date: '2026-09-20',
        },
        {
          id: 2,
          title: 'Unpopular',
          poster_path: '/b.jpg',
          popularity: 3,
          release_date: '2026-09-20',
        },
        {
          id: 3,
          title: 'Exactly at the floor',
          poster_path: '/c.jpg',
          popularity: 10,
          release_date: '2026-09-20',
        },
        {
          id: 4,
          title: 'Keeper',
          poster_path: '/d.jpg',
          popularity: 90,
          release_date: '2026-09-20',
        },
      ],
    });

    const result = await discoverFilms({ when: 'past', page: 1 });

    expect(result.films.map((film) => film.title)).toEqual(['Keeper']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('drops a row with no id or title rather than rendering "undefined"', async () => {
    mockDiscover({
      page: 1,
      total_pages: 1,
      results: [
        { id: 5, poster_path: '/a.jpg', popularity: 90 },
        { title: 'No id', poster_path: '/b.jpg', popularity: 90 },
      ],
    });

    expect((await discoverFilms({ when: 'past', page: 1 })).films).toEqual([]);
  });

  it('drops a film whose release date cannot belong to the calendar page', async () => {
    mockDiscover({
      page: 1,
      total_pages: 1,
      results: [
        { id: 6, title: 'Undated', poster_path: '/a.jpg', popularity: 90 },
        {
          id: 7,
          title: 'Nonsense date',
          poster_path: '/b.jpg',
          popularity: 90,
          release_date: 'soon',
        },
      ],
    });

    const films = (await discoverFilms({ when: 'future', page: 1 })).films;

    expect(films).toEqual([]);
  });
});

describe('paging', () => {
  it.each([
    {
      when: 'future' as const,
      page: 2,
      gte: '2026-10-01',
      lte: '2026-10-31',
    },
    {
      when: 'past' as const,
      page: 2,
      gte: '2026-08-01',
      lte: '2026-08-31',
    },
  ])(
    'maps a direct $when page $page load to exactly $gte through $lte',
    async ({ when, page, gte, lte }) => {
      const fetchMock = mockDiscover(EMPTY);

      const result = await discoverFilms({ when, page });
      const query = lastQuery(fetchMock);

      expect(result.page).toBe(page);
      expect(query.get('release_date.gte')).toBe(gte);
      expect(query.get('release_date.lte')).toBe(lte);
    },
  );

  it('finishes a future month before exposing it as an app page', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const tmdbPage = new URL(String(input)).searchParams.get('page');
      const results =
        tmdbPage === '1'
          ? [
              {
                id: 1,
                title: 'Early October',
                poster_path: '/a.jpg',
                popularity: 20,
                release_date: '2026-10-02',
              },
            ]
          : [
              {
                id: 2,
                title: 'Late October',
                poster_path: '/b.jpg',
                popularity: 10,
                release_date: '2026-10-29',
              },
              {
                id: 3,
                title: 'Wrong month',
                poster_path: '/c.jpg',
                popularity: 9,
                release_date: '2026-11-01',
              },
            ];
      return {
        ok: true,
        json: async () => ({ page: Number(tmdbPage), total_pages: 2, results }),
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverFilms({ when: 'future', page: 2 });

    expect(result.films.map((film) => film.title)).toEqual([
      'Early October',
      'Late October',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports the app month cursor rather than TMDB’s private sub-page', async () => {
    mockDiscover({ page: 3, total_pages: 21, results: [] });

    const result = await discoverFilms({ when: 'past', page: 3 });

    expect(result).toMatchObject({ page: 3, pageCount: 500 });
  });

  it('clamps the public month cursor to 500', async () => {
    mockDiscover(EMPTY);

    const result = await discoverFilms({ when: 'past', page: 99_999 });

    expect(result.page).toBe(500);
  });

  it('clamps a zero or negative page to the first', async () => {
    const fetchMock = mockDiscover(EMPTY);

    await discoverFilms({ when: 'past', page: 0 });

    expect(lastQuery(fetchMock).get('page')).toBe('1');
  });
});

describe('caching', () => {
  it('asks TMDB once for the same page', async () => {
    const fetchMock = mockDiscover(EMPTY);

    await discoverFilms({ when: 'past', page: 1 });
    await discoverFilms({ when: 'past', page: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches the two sides separately', async () => {
    // They are different queries against the same endpoint, so a key that
    // omitted the side would serve past results on the future page.
    const fetchMock = mockDiscover(EMPTY);

    await discoverFilms({ when: 'past', page: 1 });
    await discoverFilms({ when: 'future', page: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('failure leaves the page usable', () => {
  it('returns an empty page rather than throwing when TMDB refuses', async () => {
    // Browse has no local fallback, so a reader arriving while TMDB is
    // unreachable should get an empty shelf with the controls still working, not
    // an error page for a page that exists.
    mockDiscover({}, false);

    expect(await discoverFilms({ when: 'past', page: 1 })).toEqual({
      page: 1,
      pageCount: 0,
      films: [],
    });
  });

  it('returns an empty page when there is no key', async () => {
    delete process.env.TMDB_API_KEY;

    expect((await discoverFilms({ when: 'past', page: 1 })).films).toEqual([]);
  });
});

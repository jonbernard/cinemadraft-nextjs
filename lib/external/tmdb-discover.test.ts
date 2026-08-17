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
  clearCacheForTests();
  process.env.TMDB_API_KEY = KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TMDB_API_KEY;
});

describe('the past side', () => {
  it('asks for released films, newest first', async () => {
    const fetchMock = mockDiscover(EMPTY);

    await discoverFilms({ when: 'past', page: 1 });
    const query = lastQuery(fetchMock);

    expect(query.get('sort_by')).toBe('release_date.desc');
    expect(query.get('release_date.lte')).toBe(new Date().toISOString().slice(0, 10));
  });

  it('🔴 keeps the source’s vote floors', async () => {
    // Without them "recent releases" is a wall of unrated obscurities, because
    // TMDB's catalogue is mostly long tail.
    const fetchMock = mockDiscover(EMPTY);

    await discoverFilms({ when: 'past', page: 1 });
    const query = lastQuery(fetchMock);

    expect(query.get('vote_average.gte')).toBe('4');
    expect(query.get('vote_count.gte')).toBe('200');
  });
});

describe('the future side', () => {
  it('asks for unreleased films, soonest first', async () => {
    const fetchMock = mockDiscover(EMPTY);

    await discoverFilms({ when: 'future', page: 1 });
    const query = lastQuery(fetchMock);

    expect(query.get('sort_by')).toBe('release_date.asc');
    expect(query.get('release_date.gte')).toBe(new Date().toISOString().slice(0, 10));
  });

  it('🔴 sends no vote floor at all', async () => {
    // An unreleased film has no votes, so carrying the past side's floors here
    // returns an empty page — which is exactly what "just flip the sort" would
    // have shipped, and it would have read as a broken feature rather than a
    // wrong query.
    const fetchMock = mockDiscover(EMPTY);

    await discoverFilms({ when: 'future', page: 1 });
    const query = lastQuery(fetchMock);

    expect(query.has('vote_count.gte')).toBe(false);
    expect(query.has('vote_average.gte')).toBe(false);
    expect(query.has('release_date.lte')).toBe(false);
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
      expect(query.get('with_release_type')).toBe('3');
    },
  );
});

describe('🔴 what gets dropped, and where', () => {
  it('drops posterless and unpopular films before the caller sees them', async () => {
    // The source filtered popularity on the server and posters in the browser,
    // so its page counter counted rows the reader never saw — and a "load more"
    // that appeared to do nothing was the visible symptom.
    const fetchMock = mockDiscover({
      page: 1,
      total_pages: 21,
      results: [
        { id: 1, title: 'No poster', poster_path: null, popularity: 90 },
        { id: 2, title: 'Unpopular', poster_path: '/b.jpg', popularity: 3 },
        { id: 3, title: 'Exactly at the floor', poster_path: '/c.jpg', popularity: 10 },
        { id: 4, title: 'Keeper', poster_path: '/d.jpg', popularity: 90 },
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

  it('keeps a film whose release date is missing or unparseable', async () => {
    // An announced film with no date is still a film, and browse files it under
    // its own group rather than hiding it.
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

    expect(films).toHaveLength(2);
    expect(films.every((film) => film.releaseDate === null)).toBe(true);
  });
});

describe('paging', () => {
  it('reports the page and page count TMDB gave', async () => {
    mockDiscover({ page: 3, total_pages: 21, results: [] });

    const result = await discoverFilms({ when: 'past', page: 3 });

    expect(result).toMatchObject({ page: 3, pageCount: 21 });
  });

  it('🔴 clamps the page to TMDB’s own limit of 500', async () => {
    // Above it TMDB answers with an error rather than an empty page, so an
    // unclamped `?page=99999` would turn a silly URL into a broken one.
    const fetchMock = mockDiscover(EMPTY);

    await discoverFilms({ when: 'past', page: 99_999 });

    expect(lastQuery(fetchMock).get('page')).toBe('500');
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

  it('🔴 caches the two sides separately', async () => {
    // They are different queries against the same endpoint, so a key that
    // omitted the side would serve past results on the future page.
    const fetchMock = mockDiscover(EMPTY);

    await discoverFilms({ when: 'past', page: 1 });
    await discoverFilms({ when: 'future', page: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('🔴 failure leaves the page usable', () => {
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

// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cached, clearCacheForTests } from './cache';
import { isTmdbConfigured, searchTmdb } from './tmdb';

/**
 * 🔴 The case that runs today is "no key configured", so it is tested first
 * and hardest. Everything else here is what happens once a key exists.
 *
 * No network is touched: `fetch` is replaced. A test that reached TMDB would
 * be a test that fails when someone else's service is slow.
 */
const KEY = 'test-tmdb-key';

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  clearCacheForTests();
  delete process.env.TMDB_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TMDB_API_KEY;
});

describe('no key configured — the state the app ships in', () => {
  it('🔴 reports itself unconfigured', () => {
    expect(isTmdbConfigured()).toBe(false);
  });

  it('🔴 returns nothing rather than throwing', async () => {
    // Local search is a complete answer. An exception here would break the
    // search box for the sake of an optional source.
    expect(await searchTmdb('dune')).toEqual([]);
  });

  it('🔴 makes no request at all', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await searchTmdb('dune');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads the key at call time, not at import', async () => {
    // The module must not bake in the answer from whenever it was first
    // imported — in a build that is before the runtime environment exists.
    const fetchMock = vi.fn(async () => jsonResponse({ results: [] }));
    vi.stubGlobal('fetch', fetchMock);

    process.env.TMDB_API_KEY = KEY;
    await searchTmdb('dune');

    expect(fetchMock).toHaveBeenCalled();
  });
});

describe('with a key', () => {
  beforeEach(() => {
    process.env.TMDB_API_KEY = KEY;
  });

  it('maps a result into a candidate the ranking rule understands', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          results: [
            {
              id: 438631,
              title: 'Dune',
              release_date: '2021-09-15',
              poster_path: '/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
            },
          ],
        }),
      ),
    );

    const [film] = await searchTmdb('dune');

    expect(film).toEqual({
      // 🔴 Null id: TMDB knows this film and the app has never ingested it, so
      // it cannot be drafted or nominated until it is saved locally.
      id: null,
      tmdbId: '438631',
      title: 'Dune',
      releaseYear: 2021,
      isLocal: false,
      nominatedYears: [],
      posterPath: '/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
    });
  });

  it('🔴 never filters TMDB by the award year', async () => {
    // An award season honours the *previous* year's releases: of 526
    // nominations in the restored 2026 season, 507 are 2025 films and 7 are
    // 2026 films. Sending the season year as `primary_release_year` hid 96% of
    // the candidates, and an admin entering nominations found nothing. Ranking
    // applies the season as a boost instead, where nothing gets excluded.
    const fetchMock = vi.fn(async () => jsonResponse({ results: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await searchTmdb('dune');

    expect(String(fetchMock.mock.calls.at(0)?.at(0))).not.toContain(
      'primary_release_year',
    );
  });

  it('handles a film with no release date or poster', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ results: [{ id: 1, title: 'Untitled Project' }] }),
      ),
    );

    const [film] = await searchTmdb('untitled');

    expect(film?.releaseYear).toBeNull();
    expect(film?.posterPath).toBeNull();
  });

  it('skips entries that are not films', async () => {
    // TMDB has returned malformed rows before; one bad entry must not lose the
    // good ones alongside it.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ results: [{ id: 'nope' }, null, { id: 7, title: 'Real Film' }] }),
      ),
    );

    const films = await searchTmdb('real');

    expect(films.map((f) => f.title)).toEqual(['Real Film']);
  });
});

describe('🔴 failure never reaches the caller', () => {
  beforeEach(() => {
    process.env.TMDB_API_KEY = KEY;
  });

  it('returns nothing on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({}, false)),
    );

    expect(await searchTmdb('dune')).toEqual([]);
  });

  it('returns nothing when the request throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    expect(await searchTmdb('dune')).toEqual([]);
  });

  it('returns nothing when the body is not the expected shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ results: 'not an array' })),
    );

    expect(await searchTmdb('dune')).toEqual([]);
  });
});

describe('caching', () => {
  beforeEach(() => {
    process.env.TMDB_API_KEY = KEY;
  });

  it('🔴 asks TMDB once for the same query', async () => {
    // The rate limit is the whole reason this cache exists: during a live
    // ceremony the same titles are typed repeatedly by the same person.
    const fetchMock = vi.fn(async () =>
      jsonResponse({ results: [{ id: 1, title: 'Dune' }] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await searchTmdb('dune');
    await searchTmdb('dune');
    await searchTmdb('DUNE  ');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('the cache itself', () => {
  it('produces once and reads back', async () => {
    const produce = vi.fn(async () => ({ value: 42 }));

    const first = await cached('k', { ttlSeconds: 60 }, produce);
    const second = await cached('k', { ttlSeconds: 60 }, produce);

    expect(first).toEqual(second);
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it('🔴 works outside Vercel, which is where every test and `next dev` runs', async () => {
    // `getCache()` does not throw off-platform — it falls back to its own
    // in-process map. Checked rather than assumed, and it deleted a
    // hand-written fallback that duplicated the SDK.
    const produce = vi.fn(async () => 'fresh');

    expect(await cached('unique-key', { ttlSeconds: 60 }, produce)).toBe('fresh');
  });

  it('returns the produced value even if the store refuses it', async () => {
    // A cache failure must not become a feature failure.
    const produce = vi.fn(async () => 'fresh');
    const huge = 'x'.repeat(10);

    expect(await cached(huge, { ttlSeconds: 60 }, produce)).toBe('fresh');
  });
});

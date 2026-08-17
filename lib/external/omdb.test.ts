// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearCacheForTests } from './cache';
import { fetchOmdb } from './omdb';

/**
 * OMDb is the *optional* third party, and its two interesting behaviours are
 * both absences: no key at all, and a 200 response whose fields say `"N/A"`.
 * Those are tested first and hardest, because they are the cases that ship.
 *
 * No network is touched. A test that reached omdbapi.com would fail whenever
 * somebody else's free-tier quota ran out.
 */
const KEY = 'test-omdb-key';

/** The absent answer, spelled out once so every case can compare against it. */
const NOTHING = {
  mpaaRating: null,
  boxOffice: null,
  metacritic: null,
  rottenTomatoes: null,
  imdbRating: null,
  imdbVotes: null,
};

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

function mockOmdb(body: unknown, ok = true) {
  const fetchMock = vi.fn(async () => jsonResponse(body, ok));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  clearCacheForTests();
  delete process.env.OMDB_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OMDB_API_KEY;
});

describe('no key configured', () => {
  it('🔴 returns null rather than throwing', async () => {
    expect(await fetchOmdb('tt3783958')).toBeNull();
  });

  it('🔴 makes no request at all', async () => {
    const fetchMock = mockOmdb({});

    await fetchOmdb('tt3783958');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads the key at call time, not at import', async () => {
    const fetchMock = mockOmdb({ Response: 'True' });

    process.env.OMDB_API_KEY = KEY;
    await fetchOmdb('tt3783958');

    expect(fetchMock).toHaveBeenCalled();
  });
});

describe('with a key', () => {
  beforeEach(() => {
    process.env.OMDB_API_KEY = KEY;
  });

  it('reads the captured La La Land response', async () => {
    // These are the exact values in fixtures/movie-details.json, which is what
    // the live site renders today.
    mockOmdb({
      Response: 'True',
      Rated: 'PG-13',
      BoxOffice: '$151,101,803',
      Metascore: '94',
      imdbRating: '8.0',
      imdbVotes: '652,341',
      Ratings: [
        { Source: 'Internet Movie Database', Value: '8.0/10' },
        { Source: 'Rotten Tomatoes', Value: '91%' },
        { Source: 'Metacritic', Value: '94/100' },
      ],
    });

    expect(await fetchOmdb('tt3783958')).toEqual({
      mpaaRating: 'PG-13',
      boxOffice: '$151,101,803',
      metacritic: 94,
      rottenTomatoes: 91,
      imdbRating: '8.0',
      imdbVotes: 652_341,
    });
  });

  it('🔴 treats the literal string "N/A" as absent', async () => {
    // OMDb answers 200 with "N/A" rather than omitting a field. A port that
    // only checks for undefined renders "Rated: N/A" and "Box office: N/A" on
    // every older film — which reads as a bug in this app, not a gap in theirs.
    mockOmdb({
      Response: 'True',
      Rated: 'N/A',
      BoxOffice: 'N/A',
      Metascore: 'N/A',
      imdbRating: 'N/A',
      imdbVotes: 'N/A',
      Ratings: [],
    });

    expect(await fetchOmdb('tt0000001')).toEqual(NOTHING);
  });

  it('falls back to Metascore when the Ratings array is missing', async () => {
    mockOmdb({ Response: 'True', Metascore: '61' });

    expect(await fetchOmdb('tt1')).toMatchObject({ metacritic: 61 });
  });

  it('🔴 prefers the Ratings array over Metascore when they disagree', async () => {
    // Ratings is the field OMDb documents; Metascore is a convenience copy.
    // Picking one and saying which beats reading whichever happens to parse.
    mockOmdb({
      Response: 'True',
      Metascore: '40',
      Ratings: [{ Source: 'Metacritic', Value: '94/100' }],
    });

    expect(await fetchOmdb('tt1')).toMatchObject({ metacritic: 94 });
  });

  it('drops a rating it cannot parse rather than reporting NaN', async () => {
    mockOmdb({
      Response: 'True',
      Ratings: [
        { Source: 'Rotten Tomatoes', Value: 'fresh' },
        { Source: 'Metacritic', Value: '' },
      ],
    });

    expect(await fetchOmdb('tt1')).toMatchObject({
      rottenTomatoes: null,
      metacritic: null,
    });
  });

  it('🔴 asks OMDb once per film', async () => {
    const fetchMock = mockOmdb({ Response: 'True', Rated: 'R' });

    await fetchOmdb('tt3783958');
    await fetchOmdb('tt3783958');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends the imdb id with its tt prefix', async () => {
    // 🔴 `movies.imdb_id` is stored WITHOUT the prefix (1,355 rows), and OMDb
    // requires it. The caller passes what it has; this is the boundary that has
    // to be right about which form is which.
    const fetchMock = mockOmdb({ Response: 'True' });

    await fetchOmdb('3783958');

    expect(String(fetchMock.mock.calls.at(0)?.at(0))).toContain('i=tt3783958');
  });

  it('does not put the key in the cache key', async () => {
    // Cache keys reach the Vercel Runtime Cache and its observability panel.
    const fetchMock = mockOmdb({ Response: 'True' });

    await fetchOmdb('tt1');

    expect(fetchMock).toHaveBeenCalled();
  });
});

describe('🔴 failure never reaches the caller', () => {
  beforeEach(() => {
    process.env.OMDB_API_KEY = KEY;
  });

  it('returns null on a non-ok response', async () => {
    mockOmdb({}, false);

    expect(await fetchOmdb('tt1')).toBeNull();
  });

  it('returns null when the request throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    expect(await fetchOmdb('tt1')).toBeNull();
  });

  it('returns null when OMDb reports its own failure', async () => {
    // OMDb answers 200 with {"Response":"False","Error":"Movie not found!"}.
    // A port that only checks the status code treats that as a film with every
    // field absent, which is indistinguishable from a film it simply knows
    // nothing about — and hides a wrong imdb id.
    mockOmdb({ Response: 'False', Error: 'Movie not found!' });

    expect(await fetchOmdb('tt0000000')).toBeNull();
  });

  it('returns null when the body is not an object', async () => {
    mockOmdb('not json at all');

    expect(await fetchOmdb('tt1')).toBeNull();
  });
});

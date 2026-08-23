// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearCacheForTests } from './cache';
import { getNowPlaying } from './tmdb-now-playing';

const KEY = 'test-tmdb-key';

function mockNowPlaying(body: unknown, ok = true) {
  const fetchMock = vi.fn(async () => ({ ok, json: async () => body }) as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function result(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    title: 'A Film',
    poster_path: '/a.jpg',
    release_date: '2026-08-01',
    ...over,
  };
}

beforeEach(() => {
  clearCacheForTests();
  process.env.TMDB_API_KEY = KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TMDB_API_KEY;
});

describe('getNowPlaying', () => {
  it('maps TMDB results into the shared DTO', async () => {
    mockNowPlaying({ page: 1, results: [result()] });

    const films = await getNowPlaying();

    expect(films).toEqual([
      {
        tmdbId: '1',
        title: 'A Film',
        posterPath: '/a.jpg',
        releaseDate: new Date('2026-08-01'),
      },
    ]);
  });

  it('🔴 drops results with no poster — a shelf built entirely of artwork', async () => {
    mockNowPlaying({
      page: 1,
      results: [result({ id: 1, poster_path: null }), result({ id: 2 })],
    });

    const films = await getNowPlaying();

    expect(films.map((film) => film.tmdbId)).toEqual(['2']);
  });

  it('🔴 renders nothing at all when TMDB is unconfigured, rather than an error', async () => {
    delete process.env.TMDB_API_KEY;
    const fetchMock = mockNowPlaying({ page: 1, results: [result()] });

    const films = await getNowPlaying();

    expect(films).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('🔴 renders nothing at all when the request fails, rather than an error', async () => {
    mockNowPlaying({}, false);

    const films = await getNowPlaying();

    expect(films).toEqual([]);
  });

  it('caches by the day, so the key does not change within a day', async () => {
    const fetchMock = mockNowPlaying({ page: 1, results: [result()] });

    await getNowPlaying();
    await getNowPlaying();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

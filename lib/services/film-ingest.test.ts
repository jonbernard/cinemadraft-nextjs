// @vitest-environment node

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { clearCacheForTests } from '@/lib/external/cache';
import { ensureFilm, resolveFilm } from './film-ingest';

/**
 * 🔴 The step that makes a TMDB search result usable.
 *
 * `movies` is a cache of TMDB — a film enters it the first time somebody
 * drafts or nominates it — so every id the rest of the app deals in is a
 * *local* id, and a search result carrying only a `tmdbId` is not yet
 * something anyone can act on. This is what converts one.
 *
 * Ported from the source app's `saveFilm`, and the field mapping is asserted
 * against it rather than reinvented: 1,355 existing rows follow those rules,
 * and a new row that broke one would be the only row in the table that did.
 */
const KEY = 'test-tmdb-key';
const TMDB_ID = '999000111';

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

const DETAIL = {
  id: Number(TMDB_ID),
  title: 'The Brutalist',
  imdb_id: 'tt8999762',
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  release_date: '2025-01-20',
  release_dates: {
    results: [
      { iso_3166_1: 'FR', release_dates: [{ release_date: '2024-12-01T00:00:00.000Z' }] },
      { iso_3166_1: 'US', release_dates: [{ release_date: '2025-02-14T00:00:00.000Z' }] },
    ],
  },
};

async function cleanup() {
  await db.movie.deleteMany({ where: { tmdbId: TMDB_ID } });
}

beforeEach(async () => {
  clearCacheForTests();
  process.env.TMDB_API_KEY = KEY;
  await cleanup();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  delete process.env.TMDB_API_KEY;
  await cleanup();
});

afterAll(async () => {
  await db.$disconnect();
});

describe('ensureFilm', () => {
  it('🔴 caches a film TMDB knows and this app has never seen', async () => {
    // The whole point: a brand-new release, nominated for the first time.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(DETAIL)),
    );

    const film = await ensureFilm(TMDB_ID);

    expect(film.id).toBeGreaterThan(0);
    expect(film.title).toBe('The Brutalist');

    const stored = await db.movie.findFirst({ where: { tmdbId: TMDB_ID } });
    expect(stored).not.toBeNull();
  });

  it('🔴 stores imdbId without its tt prefix, as every other row does', async () => {
    // 1,355 rows are stored this way. A new row keeping the prefix would be
    // the only one that did — invisible until something compared or linked
    // them.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(DETAIL)),
    );

    const film = await ensureFilm(TMDB_ID);

    expect(film.imdbId).toBe('8999762');
  });

  it('🔴 prefers the US release date', async () => {
    // The league is scored on US award seasons, and an international date can
    // fall in a different eligibility year.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(DETAIL)),
    );

    const film = await ensureFilm(TMDB_ID);

    expect(film.releaseDate?.toISOString()).toContain('2025-02-14');
  });

  it('falls back to the primary release date when there is no US entry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ ...DETAIL, release_dates: { results: [] } })),
    );

    const film = await ensureFilm(TMDB_ID);

    expect(film.releaseDate?.toISOString()).toContain('2025-01-20');
  });

  it('🔴 drops a leading article from the sort title', async () => {
    // sortTitle is what alphabetical ordering uses; without this the film
    // files under T.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(DETAIL)),
    );

    const film = await ensureFilm(TMDB_ID);

    expect(film.sortTitle).toBe('Brutalist');
  });

  it('🔴 asks TMDB once per film, ever', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(DETAIL));
    vi.stubGlobal('fetch', fetchMock);

    const first = await ensureFilm(TMDB_ID);
    const second = await ensureFilm(TMDB_ID);

    expect(second.id).toBe(first.id);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('🔴 never creates a second row for the same film', async () => {
    // Two admins entering the same nomination during a live ceremony. A
    // duplicate film is two films as far as scoring is concerned.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(DETAIL)),
    );

    await Promise.all([ensureFilm(TMDB_ID), ensureFilm(TMDB_ID)]);

    const rows = await db.movie.findMany({ where: { tmdbId: TMDB_ID } });
    expect(rows).toHaveLength(1);
  });

  it('refuses when TMDB cannot supply the film', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({}, false)),
    );

    await expect(ensureFilm(TMDB_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('🔴 refuses when no key is configured rather than writing a half-film', async () => {
    // From the caller's side "no key" and "TMDB is down" are the same
    // situation: the film cannot be obtained, so the action must refuse.
    delete process.env.TMDB_API_KEY;

    await expect(ensureFilm(TMDB_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(await db.movie.findFirst({ where: { tmdbId: TMDB_ID } })).toBeNull();
  });
});

describe('resolveFilm', () => {
  it('returns a cached film by its local id without asking TMDB', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // Film 1 in the restored data.
    const film = await resolveFilm({ movieId: 1 });

    expect(film.id).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ingests by tmdbId when there is no local id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(DETAIL)),
    );

    const film = await resolveFilm({ tmdbId: TMDB_ID });

    expect(film.tmdbId).toBe(TMDB_ID);
  });

  it('refuses when given neither', async () => {
    await expect(resolveFilm({})).rejects.toBeInstanceOf(NotFoundError);
  });
});

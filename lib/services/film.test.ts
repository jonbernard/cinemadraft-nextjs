// @vitest-environment node

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import fixture from '@/fixtures/movie-by-id.json';
import { db } from '@/lib/db';
import { clearCacheForTests } from '@/lib/external/cache';
import { loadFilmPage } from './film';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * The film page composes three sources — TMDB, OMDb and the local database —
 * and the interesting cases are all about what happens when one of them has
 * nothing to say. Those are tested first, because they are the ones that ship:
 * most films the page renders have never been drafted, and OMDb may have no key
 * at all.
 *
 * TMDB and OMDb are stubbed; the database is real, because the numbers being
 * asserted (335 points, 170 from the Oscars) come out of the restored data and
 * a stub of that would only prove the stub.
 */

/** La La Land: local movie id 3, TMDB 313369, nominated in 2017, drafted five times. */
const LA_LA_LAND = '313369';

function bareImagePaths(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/^https:\/\/image\.tmdb\.org\/t\/p\/[^/]+/, '');
  }
  if (Array.isArray(value)) return value.map(bareImagePaths);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, bareImagePaths(entry)]),
    );
  }
  return value;
}

/** The captured response, put back into the shape TMDB actually sends. */
function tmdbBody(): Record<string, unknown> {
  const body = bareImagePaths(JSON.parse(JSON.stringify(fixture))) as Record<
    string,
    unknown
  >;
  const credits = body.credits as { cast: unknown[]; crew: Record<string, unknown[]> };
  body.credits = { cast: credits.cast, crew: Object.values(credits.crew).flat() };
  body.similar = { results: body.similar };
  return body;
}

/**
 * One `fetch` stub answering for both third parties.
 *
 * Routing on the host rather than on call order: the service issues them
 * concurrently, so an order-based stub would pass or fail depending on which
 * promise settled first.
 */
function mockRemotes(options: { omdb?: unknown; tmdb?: unknown } = {}) {
  const fetchMock = vi.fn(async (url: string | URL) => {
    const target = String(url);
    const body = target.includes('omdbapi.com')
      ? (options.omdb ?? { Response: 'True', Rated: 'PG-13', Metascore: '94' })
      : (options.tmdb ?? tmdbBody());
    return { ok: true, json: async () => body } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  clearCacheForTests();
  process.env.TMDB_API_KEY = 'test-tmdb-key';
  process.env.OMDB_API_KEY = 'test-omdb-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TMDB_API_KEY;
  delete process.env.OMDB_API_KEY;
});

describe('a film the app has never ingested', () => {
  it('🔴 renders, and writes nothing', async () => {
    // The whole reason the route is keyed by TMDB id (D63). The straight port of
    // `server/routes/movie/movie.js:38` calls `Movies.update` on a GET, and
    // reaching for `ensureFilm` would create a row — on a public page, that is
    // unbounded insert traffic from crawlers and it fills `movies` with films
    // nobody drafted, breaking the invariant that a row means somebody used it.
    const body = { ...tmdbBody(), id: 1_185_806, title: 'PAW Patrol: The Dino Movie' };
    mockRemotes({ tmdb: body });
    const before = await db.movie.count();

    const page = await loadFilmPage('1185806');

    expect(page?.title).toBe('PAW Patrol: The Dino Movie');
    expect(page?.scoring).toBeNull();
    expect(await db.movie.count()).toBe(before);
  });
});

describe('OMDb', () => {
  it('🔴 omits the ratings panel entirely when there is no key', async () => {
    delete process.env.OMDB_API_KEY;
    mockRemotes();

    expect((await loadFilmPage(LA_LA_LAND))?.facts).toBeNull();
  });

  it('🔴 renders the page when OMDb refuses', async () => {
    // OMDb's free tier is 1,000 requests a day against one person's key, so
    // running out is a normal Tuesday, not an outage. The rest of the page must
    // not depend on it.
    mockRemotes({ omdb: { Response: 'False', Error: 'Request limit reached!' } });

    const page = await loadFilmPage(LA_LA_LAND);

    expect(page?.title).toBe('La La Land');
    expect(page?.facts).toBeNull();
  });

  it('reads the MPAA rating and box office when it answers', async () => {
    mockRemotes({
      omdb: {
        Response: 'True',
        Rated: 'PG-13',
        BoxOffice: '$151,101,803',
        Ratings: [{ Source: 'Metacritic', Value: '94/100' }],
      },
    });

    expect((await loadFilmPage(LA_LA_LAND))?.facts).toMatchObject({
      mpaaRating: 'PG-13',
      boxOffice: '$151,101,803',
      metacritic: 94,
    });
  });

  it('🔴 does not ask OMDb at all for a film with no imdb id', async () => {
    // OMDb is keyed on the imdb id. Asking without one is a guaranteed miss and
    // a wasted request against a 1,000-a-day quota.
    const fetchMock = mockRemotes({ tmdb: { ...tmdbBody(), imdb_id: null } });

    await loadFilmPage(LA_LA_LAND);

    const hosts = fetchMock.mock.calls.map((call) => String(call.at(0)));
    expect(hosts.some((url) => url.includes('omdbapi.com'))).toBe(false);
  });
});

describe('TMDB', () => {
  it('🔴 returns null for an id TMDB does not know, so the route can 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({}) }) as Response),
    );

    expect(await loadFilmPage('999999999')).toBeNull();
  });

  it('returns null when TMDB has no key, rather than a page of local scraps', async () => {
    delete process.env.TMDB_API_KEY;

    expect(await loadFilmPage(LA_LA_LAND)).toBeNull();
  });

  it('builds image URLs at this boundary, not in the repository', async () => {
    mockRemotes();

    const page = await loadFilmPage(LA_LA_LAND);

    expect(page?.backdropUrl).toMatch(/^https:\/\/image\.tmdb\.org\/t\/p\//);
    expect(page?.posterUrls.at(0)).toMatch(/^https:\/\/image\.tmdb\.org\/t\/p\//);
    expect(page?.similar.at(0)?.posterUrl).toMatch(/^https:\/\/image\.tmdb\.org\/t\/p\//);
  });
});

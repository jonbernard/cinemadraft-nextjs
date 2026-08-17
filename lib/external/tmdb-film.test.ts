// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import fixture from '@/fixtures/movie-by-id.json';
import { clearCacheForTests } from './cache';
import { fetchTmdbFilmPage } from './tmdb-film';

/**
 * The contract here is `fixtures/movie-by-id.json` — La La Land, captured from
 * the live site on 2026-08-14. Asserting against the real response rather than
 * a hand-written stub is the only way to catch the fields the source app
 * fetched and never rendered, and the ones it rendered wrongly.
 *
 * 🔴 **The fixture holds absolute image URLs; the live API does not.** The old
 * Express server rewrote every path through `req.tmdb.transformArray` before
 * responding. Asserting against the fixture as captured would produce a mapper
 * written to expect `https://image.tmdb.org/t/p/w780/x.jpg` that breaks the
 * first time it meets TMDB directly, and nothing in this suite would notice.
 * `asTmdbWouldRespond` undoes the rewrite, so what these tests feed the mapper
 * is what TMDB actually sends.
 */
const KEY = 'test-tmdb-key';

/** Strip the host and size bucket the old server prepended. */
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

/**
 * The captured response, put back into the shape TMDB sends.
 *
 * The crew is the other rewrite: the old server grouped it by department before
 * responding (`movie.js:141`), so the fixture holds an object where TMDB sends
 * a flat array. Grouping is this module's job, so the test has to un-group it
 * or it would assert that a pass-through works.
 */
function asTmdbWouldRespond(): Record<string, unknown> {
  const body = bareImagePaths(JSON.parse(JSON.stringify(fixture))) as Record<
    string,
    unknown
  >;

  const credits = body.credits as { cast: unknown[]; crew: Record<string, unknown[]> };
  body.credits = {
    cast: credits.cast,
    crew: Object.values(credits.crew).flat(),
  };

  // TMDB returns `similar` as a paged object; the old server unwrapped it.
  body.similar = { results: body.similar };

  return body;
}

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

function mockTmdb(body: unknown, ok = true) {
  const fetchMock = vi.fn(async () => jsonResponse(body, ok));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  clearCacheForTests();
  delete process.env.TMDB_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TMDB_API_KEY;
});

describe('no key configured', () => {
  it('🔴 returns null, not an empty film', async () => {
    // Search returns [] because "no remote results" is a complete answer beside
    // the local ones. A film page has no local half to fall back to, so an
    // empty object here would render a page about nothing.
    expect(await fetchTmdbFilmPage('313369')).toBeNull();
  });
});

describe('the captured La La Land response', () => {
  beforeEach(() => {
    process.env.TMDB_API_KEY = KEY;
    mockTmdb(asTmdbWouldRespond());
  });

  it('maps the facts the page shows', async () => {
    const film = await fetchTmdbFilmPage('313369');

    expect(film).toMatchObject({
      tmdbId: '313369',
      imdbId: '3783958',
      title: 'La La Land',
      year: 2016,
      tagline: "Here's to the fools who dream.",
      // 🔴 129, not 101. The source app hard-coded
      // `moment.duration(101, 'minutes')` and never read `runtime`, so every
      // film on the live site claims 1 hour 41 minutes (PARITY bug 12).
      runtimeMinutes: 129,
      language: 'English',
      genres: ['Comedy', 'Drama', 'Romance'],
      budget: 30_000_000,
      revenue: 509_183_536,
    });
  });

  it('stores the imdb id without its tt prefix, as every other row does', async () => {
    // 1,355 restored rows are stored this way, and `fetchTmdbFilm` matches.
    // A page-only exception would be invisible until something compared them.
    expect((await fetchTmdbFilmPage('313369'))?.imdbId).toBe('3783958');
  });

  it('prefers the US release date for the release-date fact', async () => {
    // The league is scored on US award seasons, so this is a domain rule and
    // not a formatting preference — the same rule `fetchTmdbFilm` follows.
    const film = await fetchTmdbFilmPage('313369');

    expect(film?.releaseDate?.getUTCFullYear()).toBe(2016);
  });

  it('names the production companies in order', async () => {
    expect((await fetchTmdbFilmPage('313369'))?.productionCompanies).toEqual([
      'Summit Entertainment',
      'Gilbert Films',
      'Impostor Pictures',
      'Marc Platt Productions',
    ]);
  });

  it('returns bare image paths, not URLs', async () => {
    // The host and the size bucket belong to the renderer (`lib/utils/poster.ts`),
    // and TMDB has changed its image host before.
    const film = await fetchTmdbFilmPage('313369');

    expect(film?.backdropPath).toMatch(/^\/[\w-]+\.jpg$/);
    expect(film?.posterPaths.every((path) => path.startsWith('/'))).toBe(true);
  });

  it('keeps all 68 English posters the fixture holds', async () => {
    // 🔴 The fixture cannot prove the language filter works: the old server had
    // already applied the same filter before responding (`movie.js:65`), so all
    // 68 of these are English. What it *does* prove is that filtering does not
    // throw the whole gallery away — the counter in the screenshot reads
    // `1/112`, so a mapper that returned two posters would be visibly wrong.
    // The filter itself is proven against a mixed list below.
    const film = await fetchTmdbFilmPage('313369');

    expect(film?.posterPaths).toHaveLength(68);
  });

  it('🔴 keeps only YouTube trailers, official ones first', async () => {
    // 32 videos came back. Anything that is not a YouTube key cannot be
    // embedded by the player this app uses, so it would render a dead frame.
    const film = await fetchTmdbFilmPage('313369');

    expect(film?.trailers.length).toBeGreaterThan(0);
    expect(film?.trailers.every((video) => /^[\w-]+$/.test(video.key))).toBe(true);
  });

  it('takes at most seven similar films, as the source did', async () => {
    const film = await fetchTmdbFilmPage('313369');

    expect(film?.similar.length).toBeLessThanOrEqual(7);
    expect(film?.similar.at(0)).toMatchObject({ title: 'Open' });
  });

  it('🔴 groups crew by department and keeps each exact job', async () => {
    // "Second Unit Director" and "Script Supervisor" are what the screenshot
    // shows beside the names. Flattening to a department name loses the reason
    // the panel is worth reading.
    const film = await fetchTmdbFilmPage('313369');
    const departments = film?.crew.map((group) => group.department) ?? [];

    expect(departments.at(0)).toBe('Directing');
    expect(departments.at(1)).toBe('Writing');
    // The rest alphabetically, so the order does not depend on TMDB's.
    expect(departments.slice(2)).toEqual([...departments.slice(2)].sort());

    const directing = film?.crew.find((group) => group.department === 'Directing');
    expect(directing?.people.some((person) => person.job === 'Director')).toBe(true);
  });

  it('lists cast with photos first, in billing order within', async () => {
    // The grid shows six faces. A photoless name taking one of those slots is
    // a hole in the grid, which is why the source sorted this way.
    const film = await fetchTmdbFilmPage('313369');
    const firstPhotoless = film?.cast.findIndex((person) => person.profilePath === null);
    const lastWithPhoto = film?.cast.findLastIndex(
      (person) => person.profilePath !== null,
    );

    if (firstPhotoless != null && firstPhotoless >= 0 && lastWithPhoto != null) {
      expect(firstPhotoless).toBeGreaterThan(lastWithPhoto);
    }
    expect(film?.cast.at(0)).toMatchObject({
      name: 'Ryan Gosling',
      character: 'Sebastian',
    });
  });

  it('🔴 asks for every section in one request', async () => {
    // Six separate calls per page view against a rate-limited third party is the
    // difference between a page and an outage.
    const fetchMock = mockTmdb(asTmdbWouldRespond());

    await fetchTmdbFilmPage('313369');

    const url = String(fetchMock.mock.calls.at(0)?.at(0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    for (const section of [
      'release_dates',
      'videos',
      'images',
      'credits',
      'similar',
      'recommendations',
    ]) {
      expect(url).toContain(section);
    }
  });
});

describe('🔴 absences that would otherwise render as facts', () => {
  beforeEach(() => {
    process.env.TMDB_API_KEY = KEY;
  });

  it('🔴 drops posters in other languages, and untagged ones', async () => {
    // What the fixture could not show, because the old server had already
    // filtered it. TMDB returns every localised one-sheet it holds; a carousel
    // that mixes alphabets is a gallery of TMDB's contributors, not of the
    // film's artwork.
    mockTmdb({
      id: 1,
      title: 'Untitled',
      images: {
        posters: [
          { file_path: '/en.jpg', iso_639_1: 'en' },
          { file_path: '/ja.jpg', iso_639_1: 'ja' },
          { file_path: '/ru.jpg', iso_639_1: 'ru' },
          { file_path: '/none.jpg', iso_639_1: null },
        ],
      },
    });

    expect((await fetchTmdbFilmPage('1'))?.posterPaths).toEqual(['/en.jpg']);
  });

  it('🔴 prefers recommendations over similar, which is close to useless', async () => {
    // Measured against the live API on 2026-08-17: for La La Land, `/similar`
    // returns The Tigger Movie, Mommie Dearest, Xanadu and A Goofy Movie, while
    // `/recommendations` returns Pretty Woman, Burlesque and (500) Days of
    // Summer. The source used `similar`.
    mockTmdb({
      id: 1,
      title: 'Untitled',
      similar: { results: [{ id: 10, title: 'The Tigger Movie' }] },
      recommendations: { results: [{ id: 20, title: 'Pretty Woman' }] },
    });

    expect((await fetchTmdbFilmPage('1'))?.similar).toEqual([
      { tmdbId: '20', title: 'Pretty Woman', posterPath: null },
    ]);
  });

  it('falls back to similar when there are no recommendations', async () => {
    // `recommendations` is empty for obscure titles, where TMDB's keyword
    // matching is all it has.
    mockTmdb({
      id: 1,
      title: 'Untitled',
      similar: { results: [{ id: 10, title: 'Keyword Match' }] },
      recommendations: { results: [] },
    });

    expect((await fetchTmdbFilmPage('1'))?.similar.at(0)?.title).toBe('Keyword Match');
  });

  it('🔴 drops videos that are not on YouTube', async () => {
    // The embed this app renders is a YouTube frame. A Vimeo key in the
    // carousel is a dead panel the reader has to page past.
    mockTmdb({
      id: 1,
      title: 'Untitled',
      videos: {
        results: [
          { key: 'vimeo1', name: 'Elsewhere', site: 'Vimeo' },
          { key: 'fan', name: 'Fan cut', site: 'YouTube', official: false },
          { key: 'real', name: 'Official Trailer', site: 'YouTube', official: true },
        ],
      },
    });

    expect((await fetchTmdbFilmPage('1'))?.trailers).toEqual([
      { key: 'real', name: 'Official Trailer' },
      { key: 'fan', name: 'Fan cut' },
    ]);
  });

  it('treats a budget or revenue of 0 as unknown', async () => {
    // TMDB stores 0 for "we do not know". The source formatted it, so every
    // unreleased film's page claimed a budget of $0.
    mockTmdb({ id: 1, title: 'Untitled', budget: 0, revenue: 0 });

    const film = await fetchTmdbFilmPage('1');

    expect(film?.budget).toBeNull();
    expect(film?.revenue).toBeNull();
  });

  it('leaves runtime null rather than reporting 0 minutes', async () => {
    mockTmdb({ id: 1, title: 'Untitled', runtime: 0 });

    expect((await fetchTmdbFilmPage('1'))?.runtimeMinutes).toBeNull();
  });

  it('falls back to the raw language code when it cannot be resolved', async () => {
    // Rather than shipping the source's 732-line iso table: TMDB already
    // returns english_name in spoken_languages, and the code is better than
    // nothing when it does not.
    mockTmdb({ id: 1, title: 'Untitled', original_language: 'qq', spoken_languages: [] });

    expect((await fetchTmdbFilmPage('1'))?.language).toBe('qq');
  });

  it('renders a film with no credits, images, videos or similar films', async () => {
    // Every appended section can be absent, and a brand-new TMDB entry has
    // none of them. Nothing here may throw.
    mockTmdb({ id: 1, title: 'Announced Only' });

    const film = await fetchTmdbFilmPage('1');

    expect(film).toMatchObject({
      title: 'Announced Only',
      genres: [],
      productionCompanies: [],
      posterPaths: [],
      trailers: [],
      cast: [],
      crew: [],
      similar: [],
      releaseDate: null,
      year: null,
    });
  });
});

describe('🔴 failure never reaches the caller', () => {
  beforeEach(() => {
    process.env.TMDB_API_KEY = KEY;
  });

  it('returns null for an id TMDB does not know', async () => {
    mockTmdb({ success: false, status_code: 34 }, false);

    expect(await fetchTmdbFilmPage('999999999')).toBeNull();
  });

  it('returns null when the request throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    expect(await fetchTmdbFilmPage('313369')).toBeNull();
  });

  it('returns null when the body is not a film', async () => {
    mockTmdb({ results: [] });

    expect(await fetchTmdbFilmPage('313369')).toBeNull();
  });
});

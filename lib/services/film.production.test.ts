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
 * The film page's scoring panel, read against the restored production data.
 *
 * TMDB and OMDb are stubbed; the database is real, because the numbers being
 * asserted (335 points, 170 from the Oscars, five picks all at position 1) come
 * out of the restored data and a stub of that would only prove the stub. That
 * is why this file is excluded from `vitest.ci.config.mts` — CI has the schema
 * but not the rows, and every assertion here would read null.
 *
 * `film.test.ts` holds the cases that need no data: an un-ingested film, and
 * every way OMDb and TMDB can fail.
 */

/** La La Land: local movie id 3, TMDB 313369, nominated in 2017, drafted five times. */
const LA_LA_LAND = '313369';

/**
 * *The Salesman*: local movie id 63, nominated in both 2017 and 2018, and never
 * drafted. It carries two cases at once — the two-season film and the undrafted
 * nominee — and it is a real row rather than a fixture, so neither case can be
 * satisfied by a stub.
 */
const SALESMAN = '375315';

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

describe('scoring', () => {
  beforeEach(() => {
    mockRemotes();
  });

  it('scores the most recent season the film was nominated in', async () => {
    const page = await loadFilmPage(LA_LA_LAND);

    expect(page?.scoring).toMatchObject({ year: 2017, total: 335 });
  });

  it('agrees with the captured per-event totals', async () => {
    // From `fixtures/points-by-movie.json`, captured from the live site. These
    // are the numbers a member would notice changing.
    const page = await loadFilmPage(LA_LA_LAND);
    const byEvent = new Map(
      (page?.scoring?.byEvent ?? []).map((event) => [event.abbreviation, event.total]),
    );

    expect(byEvent.get('oscars')).toBe(170);
    expect(byEvent.get('gg')).toBe(65);
    expect(byEvent.get('bafta')).toBe(55);
    expect(byEvent.get('sag')).toBe(10);
    expect(byEvent.get('ace')).toBe(5);
  });

  it('🔴 sums byEvent to exactly the ledger total', async () => {
    // The same guarantee `MovieLedger.total` makes, for the same reason: two
    // numbers on one page that disagree make the app look like it is guessing.
    // byEvent is a regrouping of `ledger.lines`, never a second query.
    const scoring = (await loadFilmPage(LA_LA_LAND))?.scoring;
    const summed = (scoring?.byEvent ?? []).reduce((sum, event) => sum + event.total, 0);

    expect(summed).toBe(scoring?.ledger.total);
    expect(summed).toBe(scoring?.total);
  });

  it('orders events by what they contributed, descending', async () => {
    // The question behind opening this panel is "where did most of it come
    // from". The source sorted alphabetically, which answers a different one.
    const byEvent = (await loadFilmPage(LA_LA_LAND))?.scoring?.byEvent ?? [];

    expect(byEvent.map((event) => event.total)).toEqual(
      [...byEvent.map((event) => event.total)].sort((a, b) => b - a),
    );
  });

  it('averages the draft position across every league that took it', async () => {
    // Five picks, all at position 1, so the average is 1 — matching the
    // captured `avgDraftPos`.
    expect((await loadFilmPage(LA_LA_LAND))?.scoring?.averageDraftPosition).toBe(1);
  });

  it('🔴 leaves the average null, not zero, when nobody drafted it', async () => {
    // The source's `average([])` returned 0, and "average draft position: 0"
    // reads as *first overall in every league* — the exact opposite of never
    // picked. *The Salesman* (tmdb 375315, local id 63) is nominated twice and
    // has never been drafted, which is the ordinary case for a
    // foreign-language contender.
    mockRemotes({ tmdb: { ...tmdbBody(), id: 375_315, title: 'The Salesman' } });

    const scoring = (await loadFilmPage(SALESMAN))?.scoring;

    expect(scoring).not.toBeNull();
    expect(scoring?.total).toBeGreaterThan(0);
    expect(scoring?.averageDraftPosition).toBeNull();
  });

  it('🔴 scores the later season for a film nominated in two', async () => {
    // *The Salesman* was nominated in 2017 and 2018. The source read the year
    // off whichever nomination row the database returned first, so a film like
    // this scored for an arbitrary season and its total could move between
    // page loads.
    mockRemotes({ tmdb: { ...tmdbBody(), id: 375_315, title: 'The Salesman' } });

    expect((await loadFilmPage(SALESMAN))?.scoring?.year).toBe(2018);
  });

  it('renders without a scoring panel for a drafted but never nominated film', async () => {
    // A local row exists, so the naive implementation reaches for a ledger and
    // gets an empty map. Null rather than a zero: a panel reading "Total points
    // 0" states something false about a film nobody has had the chance to score.
    const undrafted = await db.$queryRaw<{ tmdb_id: string }[]>`
      SELECT m.tmdb_id FROM movies m
       WHERE m.tmdb_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM nominations n WHERE n.movie_id = m.id)
       LIMIT 1
    `;
    const tmdbId = undrafted.at(0)?.tmdb_id;
    expect(tmdbId).toBeDefined();
    mockRemotes({ tmdb: { ...tmdbBody(), id: Number(tmdbId) } });

    expect((await loadFilmPage(tmdbId as string))?.scoring).toBeNull();
  });
});

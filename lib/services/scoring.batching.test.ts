// @vitest-environment node

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import fixture from '@/fixtures/movie-by-id.json';
import { db } from '@/lib/db';
import { clearCacheForTests } from '@/lib/external/cache';
import { denseRank } from '@/lib/utils/rank';
import { loadFixture } from '@/test/fixtures';
import { countQueries } from '@/test/query-count';
import { getDashboard } from './dashboard';
import { getLeagueBoard } from './draft';
import { loadFilmPage } from './film';
import { getLeaderboard } from './leaderboard';
import { pointsForMovieIds } from './scoring';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * 🔴 The guard that lets scores stay unmaterialized (D59).
 *
 * Computing on read is cheap only because it is batched. Measured: one film
 * costs 2.3 ms and all 1,355 cost 14.2 ms, because the expense is round trips
 * rather than arithmetic. An N+1 would invert that — 123 films at one query
 * each — and it would not look like a bug in review, just a page that got
 * slow on a cold connection during a ceremony.
 *
 * So the assertion is on the *number of queries*, not the duration. A timing
 * test passes at 280 ms on a fast laptop; this one states the actual intent.
 */
describe('scoring is batched', () => {
  it('🔴 costs the same number of queries for one film as for a whole season', async () => {
    const season = loadFixture<{ points: { movieId: string }[] }>('points-by-year');
    const many = season.points.map((entry) => Number(entry.movieId));
    expect(many.length).toBeGreaterThan(100);

    const one = await countQueries(() => pointsForMovieIds([many[0] as number], 2025));
    const all = await countQueries(() => pointsForMovieIds(many, 2025));

    // 🔴 Greater than zero as well as equal. Both being zero would satisfy the
    // equality and prove nothing — which is exactly what happened when this
    // guard listened to its own throwaway client instead of the shared one.
    expect(one.queries).toBeGreaterThan(0);
    expect(all.queries).toBe(one.queries);
  });

  it('🔴 scores an entire season in a handful of queries', async () => {
    // A specific ceiling rather than "not many": a regression that doubled the
    // query count would otherwise pass a vaguer assertion.
    const season = loadFixture<{ points: { movieId: string }[] }>('points-by-year');
    const ids = season.points.map((entry) => Number(entry.movieId));

    const { queries } = await countQueries(() => pointsForMovieIds(ids, 2025));

    expect(queries).toBeLessThanOrEqual(5);
    expect(queries).toBeGreaterThan(0);
  });

  it('issues no queries at all for an empty request', async () => {
    const { queries } = await countQueries(() => pointsForMovieIds([], 2025));

    expect(queries).toBe(0);
  });
});

/**
 * 🔴 The same guard on every page that shows a score.
 *
 * The service being batched is not enough — a page can still call it once per
 * film. These pin the two surfaces that exist today; every surface Phase 10
 * adds (the movie page, the season leaderboard, league standings) must arrive
 * with a case here.
 *
 * The bound is a *constant*, deliberately. It is not "queries grow slowly with
 * seats"; it is "queries do not grow with seats at all", which is the property
 * that makes computing on read safe as leagues get bigger.
 */
describe('every page that shows a score loads them in bulk', () => {
  it('🔴 a 16-seat league board costs a fixed number of queries', async () => {
    const { queries } = await countQueries(() => getLeagueBoard(1, 2026));

    // 16 seats, 144 picks, and it costs 10 queries. An N+1 would be 144.
    // The bound is close to the real number on purpose: a loose ceiling is how
    // a guard keeps passing while the thing it guards gets worse.
    expect(queries).toBeLessThanOrEqual(12);
    expect(queries).toBeGreaterThan(0);
  });

  it('🔴 the board costs no more for a bigger league-year than a smaller one', async () => {
    // The actual property under test. League 1's 2026 season has 16 seats;
    // 2017 has fewer. If the count moves with the number of seats or picks,
    // something is querying per row.
    const big = await countQueries(() => getLeagueBoard(1, 2026));
    const small = await countQueries(() => getLeagueBoard(1, 2017));

    expect(big.queries).toBe(small.queries);
  });

  it('the signed-in dashboard costs a fixed number of queries', async () => {
    const { queries } = await countQueries(() => getDashboard(6));

    expect(queries).toBeLessThanOrEqual(15);
    expect(queries).toBeGreaterThan(0);
  });

  it('🔴 the season leaderboard (P10.T4) costs a fixed number of queries', async () => {
    // 2025 has 529 nominations across ~123 films. An N+1 over nominations, or
    // over the films they resolve to, would dwarf this bound.
    const { queries } = await countQueries(() => getLeaderboard(2025));

    expect(queries).toBeLessThanOrEqual(8);
    expect(queries).toBeGreaterThan(0);
  });

  it('🔴 the leaderboard costs no more for a big season than a small one', async () => {
    // 2025 has 529 nominations; 2022 has 110. If the count moves with the
    // number of nominations or films, something is querying per row.
    const big = await countQueries(() => getLeaderboard(2025));
    const small = await countQueries(() => getLeaderboard(2022));

    expect(big.queries).toBe(small.queries);
  });

  it('🔴 the league page’s standings section (P10.T10) adds no query beyond the board itself', async () => {
    // The board's own seats and totals already carry everything the standings
    // need; only a pure in-memory sort and dense-rank should sit on top.
    const boardOnly = await countQueries(() => getLeagueBoard(1, 2026));
    const withStandings = await countQueries(async () => {
      const board = await getLeagueBoard(1, 2026);
      const seats = [...board.groups.flatMap((group) => group.seats)].sort(
        (a, b) => b.total - a.total,
      );
      denseRank(seats);
      return board;
    });

    expect(withStandings.queries).toBe(boardOnly.queries);
  });
});

/**
 * The film page's own case (D59).
 *
 * Its shape is different from the board's: one film rather than 144, but three
 * sources instead of one, and it is the app's **most-visited page and its most
 * shared URL**. The number that matters here is not how it scales with films —
 * there is only ever one — but that reaching for a score does not turn into a
 * query per nomination. La La Land has 46 of them.
 */
describe('the film page', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TMDB_API_KEY;
    delete process.env.OMDB_API_KEY;
  });

  /** The captured response, put back into the shape TMDB actually sends. */
  function stubTmdb() {
    clearCacheForTests();
    process.env.TMDB_API_KEY = 'test-tmdb-key';
    // No OMDb key: it is stubbed out entirely, because a third party's latency
    // is not what this is measuring and it issues no queries either way.
    delete process.env.OMDB_API_KEY;

    const body = JSON.parse(JSON.stringify(fixture)) as Record<string, unknown>;
    const credits = body.credits as { cast: unknown[]; crew: Record<string, unknown[]> };
    body.credits = { cast: credits.cast, crew: Object.values(credits.crew).flat() };
    body.similar = { results: body.similar };

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => body }) as Response),
    );
  }

  it('🔴 costs a fixed number of queries for a film with 46 nominations', async () => {
    stubTmdb();

    const { queries } = await countQueries(() => loadFilmPage('313369'));

    // The lookup, the years, the ledger's batch loads and the draft picks.
    // An N+1 over nominations would be 46 on its own.
    expect(queries).toBeLessThanOrEqual(10);
    expect(queries).toBeGreaterThan(0);
  });

  it('🔴 costs no more for a heavily nominated film than a lightly nominated one', async () => {
    // The property, rather than a ceiling: La La Land earned 335 points across
    // eleven award shows; *Kubo and the Two Strings* (tmdb 313297) was nominated
    // in one season by far fewer. If the count moves with the number of
    // nominations, something is querying per row.
    stubTmdb();
    const heavy = await countQueries(() => loadFilmPage('313369'));
    stubTmdb();
    const light = await countQueries(() => loadFilmPage('313297'));

    expect(heavy.queries).toBe(light.queries);
  });

  it('asks the database nothing beyond the lookup for a film it has never seen', async () => {
    // The common case on a public page: a TMDB id nobody has drafted. One
    // query — findByTmdbId — and no scoring work at all.
    stubTmdb();

    const { queries } = await countQueries(() => loadFilmPage('1185806'));

    expect(queries).toBe(1);
  });
});

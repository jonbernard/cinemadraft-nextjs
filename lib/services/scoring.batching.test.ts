// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { loadFixture } from '@/test/fixtures';
import { countQueries } from '@/test/query-count';
import { getDashboard } from './dashboard';
import { getLeagueBoard } from './draft';
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
});

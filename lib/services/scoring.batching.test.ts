// @vitest-environment node

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import fixture from '@/fixtures/movie-by-id.json';
import { db } from '@/lib/db';
import { clearCacheForTests } from '@/lib/external/cache';
import { eventRepository } from '@/lib/repositories/events';
import { denseRank } from '@/lib/utils/rank';
import { loadFixture } from '@/test/fixtures';
import { countQueries } from '@/test/query-count';
import { getAwardShow } from './award-show';
import { getDashboard } from './dashboard';
import { getLeagueBoard } from './draft';
import { loadFilmPage } from './film';
import { getLeaderboard } from './leaderboard';
import { getLiveShow } from './live';
import { pointsForMovieIds } from './scoring';
import { findFilms } from './search';

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
  it('costs the same number of queries for one film as for a whole season', async () => {
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

  it('scores an entire season in a handful of queries', async () => {
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
  it('a 16-seat league board costs a fixed number of queries', async () => {
    const { queries } = await countQueries(() => getLeagueBoard(1, 2026));

    // 16 seats, 144 picks, and it costs 10 queries. An N+1 would be 144.
    // The bound is close to the real number on purpose: a loose ceiling is how
    // a guard keeps passing while the thing it guards gets worse.
    expect(queries).toBeLessThanOrEqual(12);
    expect(queries).toBeGreaterThan(0);
  });

  it('the board costs no more for a bigger league-year than a smaller one', async () => {
    // The actual property under test. League 1's 2026 season has 16 seats;
    // 2017 has fewer. If the count moves with the number of seats or picks,
    // something is querying per row.
    const big = await countQueries(() => getLeagueBoard(1, 2026));
    const small = await countQueries(() => getLeagueBoard(1, 2017));

    expect(big.queries).toBe(small.queries);
  });

  it('the signed-in dashboard costs a fixed number of queries', async () => {
    const { queries } = await countQueries(() => getDashboard(6));

    // P17.T15 swapped pointsForMovieIds for ledgerForMovies so the roster can
    // mark winners. The ledger additionally names the shows, which is one more
    // batched call: measured 12 before the swap and 13 after, on the restored
    // data. Bound at 14 rather than left at the 15 it inherited — a loose
    // ceiling is how a guard keeps passing while the thing it guards gets
    // worse, and at 15 this one would not have noticed the swap at all.
    expect(queries).toBeLessThanOrEqual(14);
    expect(queries).toBeGreaterThan(0);
  });

  it('the dashboard costs no more for a 91-pick league than a 1-pick one', async () => {
    // 🔴 The property, and unlike a ceiling it says what "batched" means here.
    //
    // The restored data gives two very different leagues. League 1's 2026
    // season has 13 seats and 91 picks; league 70 has one seat and one pick.
    // User 6 plays only league 1; user 3 plays both. So the difference between
    // their counts is what league 70 costs, and user 6's count above the
    // no-league baseline is what league 1 costs — the same work over ninety
    // more picks.
    //
    // The count is ALLOWED to grow with leagues: each is a separate board.
    // It is not allowed to grow with the seats or picks inside one, and that
    // is the only thing asserted. An N+1 over picks would put ~90 queries on
    // one side of this subtraction and none on the other.
    const none = await countQueries(() => getDashboard(999_999));
    const oneLeague = await countQueries(() => getDashboard(6));
    const twoLeagues = await countQueries(() => getDashboard(3));

    const bigLeague = oneLeague.queries - none.queries;
    const smallLeague = twoLeagues.queries - oneLeague.queries;

    expect(smallLeague).toBeGreaterThan(0);
    expect(bigLeague - smallLeague).toBeLessThanOrEqual(2);
  });

  it('the season leaderboard (P10.T4) costs a fixed number of queries', async () => {
    // 2025 has 529 nominations across ~123 films. An N+1 over nominations, or
    // over the films they resolve to, would dwarf this bound.
    const { queries } = await countQueries(() => getLeaderboard(2025));

    expect(queries).toBeLessThanOrEqual(8);
    expect(queries).toBeGreaterThan(0);
  });

  it('the leaderboard costs no more for a big season than a small one', async () => {
    // 2025 has 529 nominations; 2022 has 110. If the count moves with the
    // number of nominations or films, something is querying per row.
    const big = await countQueries(() => getLeaderboard(2025));
    const small = await countQueries(() => getLeaderboard(2022));

    expect(big.queries).toBe(small.queries);
  });

  it('the live show page (P17.T16) costs a fixed number of queries', async () => {
    // Every surface that shows a score arrives with a case here — the standing
    // rule since Phase 9. This one composes getAwardShow and getLeagueBoard and
    // filters their ledgers in memory; it must never query per film, per seat or
    // per category.
    const { queries } = await countQueries(() => getLiveShow('oscars', 2026, 6));

    // Measured on the restored data: 18 for user 6, who plays one league.
    // Bound at 19 rather than a round number — a loose ceiling is how a guard
    // keeps passing while the thing it guards gets worse, and the dashboard's
    // own bound was just tightened 15 → 14 for exactly that reason.
    expect(queries).toBeLessThanOrEqual(19);
    expect(queries).toBeGreaterThan(0);
  });

  it('the live page costs no more for a big show than a small one', async () => {
    // The actual property. The Oscars carry 25 categories and 125 nominations
    // in 2026; the Golden Globes 15 and 92; AFI one and ten. If the count moves
    // with any of those, something is querying per row — which is what would
    // make this page fall over during the one hour a year it matters.
    const big = await countQueries(() => getLiveShow('oscars', 2026, 6));
    const small = await countQueries(() => getLiveShow('gg', 2026, 6));
    const tiny = await countQueries(() => getLiveShow('afi', 2026, 6));

    expect(big.queries).toBe(small.queries);
    expect(big.queries).toBe(tiny.queries);
  });

  it('the live page asks nothing at all about leagues for a signed-out reader', async () => {
    // The load-bearing property of a PUBLIC page (P17.T16, amending D40):
    // `getLiveShow(abbr, year, null)` does not query leagues rather than
    // querying with a sentinel — the same shape D44 gives `getDashboard(null)`.
    //
    // 🔴 Written as an equality against the show's own cost, not as a ceiling,
    // and the difference is not academic. The first version of this case bound
    // the anonymous path at "measured + 1" (7 → 8) and `<` the signed-in path.
    // Both stayed green against the exact defect they existed to catch:
    // replacing the null check with `seatsForReader(..., userId ?? -1)` costs
    // one query, lands on 8, and returns an empty list — so every other test in
    // the suite passes too. The equality below goes red on it, because the
    // signed-out path is then doing something the show alone does not.
    const anonymous = await countQueries(() => getLiveShow('oscars', 2026, null));
    const showOnly = await countQueries(async () => {
      await eventRepository.findByAbbreviation('oscars');
      return getAwardShow('oscars', 2026);
    });

    expect(showOnly.queries).toBeGreaterThan(0);
    expect(anonymous.queries).toBe(showOnly.queries);
  });

  it('the league page’s standings section (P10.T10) adds no query beyond the board itself', async () => {
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

  it('costs a fixed number of queries for a film with 46 nominations', async () => {
    stubTmdb();

    const { queries } = await countQueries(() => loadFilmPage('313369'));

    // The lookup, the years, the ledger's batch loads and the draft picks.
    // An N+1 over nominations would be 46 on its own.
    expect(queries).toBeLessThanOrEqual(10);
    expect(queries).toBeGreaterThan(0);
  });

  it('costs no more for a heavily nominated film than a lightly nominated one', async () => {
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

/**
 * 🔴 Added by P12.T4, and the load test is why.
 *
 * Draft-day search is the one path that gets hammered: the owner types a title
 * per pick, live, and the typeahead fires `findFilmsAction` on every debounce.
 * `scripts/load-search.mjs` put four concurrent owners on it for two minutes
 * against a local production build and found p95 = 22 ms against a 400 ms
 * budget — comfortably inside it, and comfortably inside it *because* the
 * nomination years for all 25 candidates are fetched in one query rather than
 * one per film.
 *
 * That is exactly the property nothing was guarding. A load test is not a
 * guard: it runs when somebody remembers, on a machine with a warm local
 * Postgres, and 25 extra round trips would still finish in well under 400 ms
 * there while costing real time on a cold Neon connection mid-draft. So the
 * property gets pinned here, as an equality, next to the others.
 */
describe('draft-day search is batched', () => {
  const noRemote = async () => [];

  it('costs the same number of queries for one local match as for a page of them', async () => {
    const one = await countQueries(() =>
      findFilms('oppenheim', { kind: 'browse' }, noRemote),
    );
    const many = await countQueries(() => findFilms('the', { kind: 'browse' }, noRemote));

    // 🔴 The equality proves nothing unless the second query really did return
    // more films — two empty result sets cost the same and say nothing about
    // batching. Both halves are asserted before the counts are compared.
    expect(one.result.length).toBeGreaterThan(0);
    expect(many.result.length).toBeGreaterThan(one.result.length);

    expect(one.queries).toBeGreaterThan(0);
    expect(many.queries).toBe(one.queries);
  });

  it('costs three queries, whatever the query and however many films match', async () => {
    // A number rather than "not many", and the three are named so a fourth has
    // to be argued for: `searchFuzzy`'s `$queryRaw` for the ranked ids, its
    // `findMany` for the columns (a second trip on purpose — see the comment
    // in `lib/repositories/movies.ts`), and `findManyByMovieIds` for every
    // candidate's nomination years at once.
    const { queries } = await countQueries(() =>
      findFilms('the', { kind: 'browse' }, noRemote),
    );

    expect(queries).toBe(3);
  });
});

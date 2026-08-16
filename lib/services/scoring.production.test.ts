// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { draftPickRepository } from '@/lib/repositories/draft-picks';
import { loadFixture } from '@/test/fixtures';
import { getLeagueBoard } from './draft';
import { ledgerForMovies, pointsForMovieIds } from './scoring';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * The loader, against restored production data — excluded from `test:ci`.
 *
 * Split from the pure rule deliberately. `scoring.test.ts` pins the
 * arithmetic and needs no database, so it runs on every push; this file pins
 * the *port* by reproducing the source API's own answer for a real draft, and
 * that evidence only exists where the data does.
 */
describe('pointsForMovieIds', () => {
  it('🔴 reproduces the source API totals for draft 124', async () => {
    // `fixtures/points-by-draft.json` is the old app's own answer for this
    // draft, captured from production. Matching it is the evidence that the
    // rule was ported rather than reinvented — and it is what would catch the
    // awards.points foreign-key trap, since summing that column instead
    // produces small, plausible-looking numbers that are all wrong.
    const expected = loadFixture<Record<string, number>>('points-by-draft');
    const picks = await draftPickRepository.findByDraftId(124);
    const movieIds = picks.flatMap((pick) =>
      pick.movieId == null ? [] : [pick.movieId],
    );

    const totals = await pointsForMovieIds(movieIds, 2025);

    expect(Object.keys(expected).length).toBeGreaterThan(0);
    for (const [movieId, points] of Object.entries(expected)) {
      expect(totals.get(Number(movieId)) ?? 0).toBe(points);
    }
  });

  it('🔴 reproduces the source API totals for an entire season', async () => {
    // `fixtures/points-by-year.json` is the old app's answer for every film
    // nominated in 2025 — 123 independently captured totals. One draft can
    // agree by luck; a whole season agreeing is the port being right.
    const fixture = loadFixture<{
      points: { movieId: string; title: string; total: number }[];
    }>('points-by-year');

    // 🔴 Assert the fixture has content before looping over it. A loop that
    // silently iterates nothing passes and proves nothing.
    expect(fixture.points.length).toBeGreaterThan(100);

    const movieIds = fixture.points.map((entry) => Number(entry.movieId));
    const totals = await pointsForMovieIds(movieIds, 2025);

    const wrong = fixture.points.filter(
      (entry) => (totals.get(Number(entry.movieId)) ?? 0) !== entry.total,
    );

    // Named rather than counted: a bare count tells you something broke, this
    // tells you which film to go and look at.
    expect(
      wrong.map((entry) => ({
        title: entry.title,
        expected: entry.total,
        actual: totals.get(Number(entry.movieId)) ?? 0,
      })),
    ).toEqual([]);
  });

  it('🔴 reproduces the source API team totals for a whole league', async () => {
    // `fixtures/points-league-total.json` is league 1's 2025 standings as the
    // old app computed them. This checks the *roll-up*: every per-film total
    // can be right while the sum onto a seat is wrong, and that is the number
    // people actually argue about.
    const fixture =
      loadFixture<{ displayName: string; total: number }[]>('points-league-total');
    expect(fixture.length).toBe(12);

    const board = await getLeagueBoard(1, 2025);
    const ours = board.groups
      .flatMap((group) => group.seats)
      .map((seat) => seat.total)
      .sort((a, b) => b - a);

    // Compared as a sorted multiset of totals, not by name: the fixture's
    // display names were scrubbed when it was captured, so the names in it are
    // not the names in the database. The totals are the real evidence.
    expect(ours).toEqual(fixture.map((team) => team.total).sort((a, b) => b - a));
  });

  it('returns an empty map for no movies rather than querying', async () => {
    expect((await pointsForMovieIds([], 2025)).size).toBe(0);
  });

  it('scopes to the season — a film scores nothing in a year it was not nominated', async () => {
    const picks = await draftPickRepository.findByDraftId(124);
    const movieIds = picks.flatMap((pick) =>
      pick.movieId == null ? [] : [pick.movieId],
    );

    // 1999 predates the data entirely.
    expect((await pointsForMovieIds(movieIds, 1999)).size).toBe(0);
  });
});

/**
 * 🔴 The ledger, against the source API's own per-event breakdown.
 *
 * `fixtures/points-by-movie.json` is La La Land's 2017 scoring as the old app
 * reported it: 11 award shows, 335 points. Verifying the ledger against it
 * checks the grouping the UI is about to render, before any of it is built.
 */
describe('ledgerForMovies', () => {
  it('🔴 reproduces the source API per-event breakdown', async () => {
    const fixture = loadFixture<{
      // 🔴 A **string**. `nominations.year` is TEXT — the one year column in
      // the schema that is — and the source API passed it through untouched.
      // Typing this as a number and handing it straight to the service
      // silently matched nothing, because `2017 === '2017'` is false. The same
      // trap that is recorded in `PARITY.md`, met again in a fixture.
      year: string;
      total: number;
      events: { abbreviation: string; total: number }[];
    }>('points-by-movie');
    const year = Number(fixture.year);

    // tmdbId 313369 is La La Land, movie 3 in the restored data.
    const ledgers = await ledgerForMovies([3], year);
    const ledger = ledgers.get(3);

    expect(fixture.events.length).toBeGreaterThan(0);
    expect(ledger).toBeDefined();

    const byEvent = new Map<string, number>();
    for (const line of ledger?.lines ?? []) {
      byEvent.set(
        line.eventAbbreviation,
        (byEvent.get(line.eventAbbreviation) ?? 0) + line.earned,
      );
    }

    const wrong = fixture.events.filter(
      (event) => (byEvent.get(event.abbreviation) ?? 0) !== event.total,
    );
    expect(
      wrong.map((event) => ({
        event: event.abbreviation,
        expected: event.total,
        actual: byEvent.get(event.abbreviation) ?? 0,
      })),
    ).toEqual([]);

    expect(ledger?.total).toBe(fixture.total);
  });

  it('🔴 always adds up to the total the rest of the app shows', async () => {
    // The property that makes a ledger trustworthy. Checked across a whole
    // season rather than one film: if the lines and the total could ever
    // disagree, the app would look like it was guessing.
    const season = loadFixture<{ points: { movieId: string }[] }>('points-by-year');
    const ids = season.points.map((entry) => Number(entry.movieId));

    const [ledgers, totals] = await Promise.all([
      ledgerForMovies(ids, 2025),
      pointsForMovieIds(ids, 2025),
    ]);

    expect(ledgers.size).toBeGreaterThan(100);
    for (const [movieId, ledger] of ledgers) {
      const summed = ledger.lines.reduce((sum, line) => sum + line.earned, 0);
      expect({ movieId, total: ledger.total }).toEqual({ movieId, total: summed });
      expect({ movieId, total: ledger.total }).toEqual({
        movieId,
        total: totals.get(movieId) ?? 0,
      });
    }
  });

  it('marks a win as twice the award value', async () => {
    // 2025 rather than La La Land's 2017: the restored `winners` table holds
    // no rows for movie 3 at all, so a win assertion there would be testing
    // the fixture's gaps rather than the rule.
    const season = loadFixture<{ points: { movieId: string }[] }>('points-by-year');
    const ids = season.points.map((entry) => Number(entry.movieId));
    const ledgers = await ledgerForMovies(ids, 2025);

    const won = [...ledgers.values()].flatMap((ledger) =>
      ledger.lines.filter((line) => line.won),
    );

    expect(won.length).toBeGreaterThan(0);
    for (const line of won) expect(line.earned).toBe(line.points * 2);
  });

  it('returns nothing for a film with no nominations that season', async () => {
    expect((await ledgerForMovies([3], 1999)).size).toBe(0);
  });
});

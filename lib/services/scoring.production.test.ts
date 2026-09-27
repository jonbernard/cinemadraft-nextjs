// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { draftPickRepository } from '@/lib/repositories/draft-picks';
import { winnerRepository } from '@/lib/repositories/winners';
import { loadFixture } from '@/test/fixtures';
import { ledgerForMovies, pointsForMovieIds } from './scoring';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * 🔴 Deliberate deviations from the pinned 2025 fixtures (D125).
 *
 * The source app paid a win on every nomination of the winning film, so a film
 * nominated twice in one category with one win earned 4P. The owner ruled that
 * the win belongs to the nomination that won: P + P + P = 3P. These are the
 * only 2025 films that held such a pair, with the source's figure and ours.
 * Every other film must still match the fixture exactly.
 */
const FILM_DEVIATIONS = [
  // Four pairs, one win each: Oscars and Globes Original Song, Globes and
  // BAFTA Supporting Actress. −(10 + 5 + 10 + 5).
  { movieId: 1056, title: 'Emilia Pérez', source: 445, ours: 415 },
  // Razzies Worst Supporting Actor, worth −15: two nominations, one "win".
  { movieId: 1048, title: 'Megalopolis', source: -140, ours: -125 },
] as const;

/**
 * The loader, against restored production data — excluded from `test:ci`.
 *
 * Split from the pure rule deliberately. `scoring.test.ts` pins the
 * arithmetic and needs no database, so it runs on every push; this file pins
 * the *port* by reproducing the source API's own answer for a real draft, and
 * that evidence only exists where the data does.
 */
describe('pointsForMovieIds', () => {
  it('reproduces the source API totals for draft 124', async () => {
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

  it('reproduces the source API totals for an entire season', async () => {
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

    // Each deviation must name a film the fixture holds at exactly its source
    // figure — otherwise the list could drift away from what it documents.
    const byId = new Map(fixture.points.map((entry) => [Number(entry.movieId), entry]));
    for (const deviation of FILM_DEVIATIONS) {
      expect({
        title: deviation.title,
        total: byId.get(deviation.movieId)?.total,
      }).toEqual({
        title: deviation.title,
        total: deviation.source,
      });
    }

    const expectedTotal = (entry: { movieId: string; total: number }) =>
      FILM_DEVIATIONS.find((d) => d.movieId === Number(entry.movieId))?.ours ??
      entry.total;
    const wrong = fixture.points.filter(
      (entry) => (totals.get(Number(entry.movieId)) ?? 0) !== expectedTotal(entry),
    );

    // Named rather than counted: a bare count tells you something broke, this
    // tells you which film to go and look at.
    expect(
      wrong.map((entry) => ({
        title: entry.title,
        expected: expectedTotal(entry),
        actual: totals.get(Number(entry.movieId)) ?? 0,
      })),
    ).toEqual([]);
  });

  // League 1's 2025 table, seat by seat and in order, is in
  // scoring.differential.test.ts with the other 19 league-seasons. It used to
  // be here as a sorted multiset of totals, which two seats swapping totals
  // could not fail — the scrubbed live capture has no seat identity to key on.

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
  it('reproduces the source API per-event breakdown', async () => {
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

  it('always adds up to the total the rest of the app shows', async () => {
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
    // Against `pointsForMovieIds`, not against the ledger's own lines: `total`
    // is defined as their sum, so comparing the two could not fail.
    for (const [movieId, ledger] of ledgers) {
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

    // 🔴 D125: the lines marked won are exactly the nominations the winners
    // table names — one line per win, never every nomination of the film.
    // Emilia Pérez and Megalopolis hold pairs where only one line may say won.
    const winners = await winnerRepository.findManyByMovieIds(ids, 2025);
    expect(won.map((line) => line.nominationId).sort((a, b) => a - b)).toEqual(
      winners.map((winner) => winner.nominationId).sort((a, b) => a - b),
    );
  });

  it('returns nothing for a film with no nominations that season', async () => {
    expect((await ledgerForMovies([3], 1999)).size).toBe(0);
  });
});

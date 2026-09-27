import { describe, expect, it, vi } from 'vitest';

import { ledgerForMovies, scoreMovies, sumTotals } from './scoring';

// Every repository the loader reads, replaced wholesale, so the ledger's pair
// case below runs the real `loadScoringInputs` with no database.
const rows = vi.hoisted(() => ({
  nominations: [] as { id: number; movieId: number; awardId: number; year: number }[],
  awards: [] as { id: number; name: string; eventId: number; pointsId: number }[],
  points: [] as { id: number; points: number }[],
  winners: [] as {
    nominationId: number;
    movieId: number;
    awardId: number;
    year: number;
  }[],
}));
vi.mock('@/lib/repositories/nominations', () => ({
  nominationRepository: { findManyByMovieIds: async () => rows.nominations },
}));
vi.mock('@/lib/repositories/awards', () => ({
  awardRepository: { findManyByIds: async () => rows.awards },
}));
vi.mock('@/lib/repositories/points', () => ({
  pointRepository: { findManyByIds: async () => rows.points },
}));
vi.mock('@/lib/repositories/winners', () => ({
  winnerRepository: { findManyByAwardIds: async () => rows.winners },
}));
vi.mock('@/lib/repositories/events', () => ({
  eventRepository: {
    findManyByIds: async () => [
      { id: 1, abbreviation: 'oscars', name: 'Academy Awards' },
    ],
  },
}));

/**
 * 🔴 The rule every number in this product depends on (D19, D41).
 *
 * These pin the arithmetic and touch no database, so they run on every CI
 * push. `scoring.production.test.ts` pins the *port* — it reproduces the
 * source API's own answer for a real draft — and needs the restored data, so
 * it runs locally.
 */
/**
 * One nomination.
 *
 * The `id` is generated rather than passed in: these cases are about the scoring
 * rule, which does not read it, and every nomination needs a distinct one because
 * a film can hold two in the same category — the ledger keys its rows on this
 * (see `LedgerLine`).
 */
let nextNominationId = 1;
const award = (id: number, movieId: number) => ({
  id: nextNominationId++,
  movieId,
  awardId: id,
});

describe('scoreMovies', () => {
  it('a nomination is worth P', () => {
    const totals = scoreMovies({
      nominations: [award(1, 100)],
      pointsByAward: new Map([[1, 20]]),
      winningNominationIds: new Set(),
    });

    expect(totals.get(100)).toBe(20);
  });

  it('a win is worth 2P, not P', () => {
    // The single most consequential line in the rule. A winner was
    // necessarily also nominated, so the win adds P on top of the nomination.
    const nomination = award(1, 100);
    const totals = scoreMovies({
      nominations: [nomination],
      pointsByAward: new Map([[1, 20]]),
      winningNominationIds: new Set([nomination.id]),
    });

    expect(totals.get(100)).toBe(40);
  });

  it('sums a movie across its awards', () => {
    const won = award(2, 100);
    const totals = scoreMovies({
      nominations: [award(1, 100), won],
      pointsByAward: new Map([
        [1, 20],
        [2, 5],
      ]),
      winningNominationIds: new Set([won.id]),
    });

    expect(totals.get(100)).toBe(20 + 5 + 5);
  });

  it('credits a win only to the movie that won', () => {
    // Both films were nominated; one won. Crediting the win to the category
    // rather than the film would hand every nominee the winner's points.
    const won = award(1, 100);
    const totals = scoreMovies({
      nominations: [won, award(1, 200)],
      pointsByAward: new Map([[1, 20]]),
      winningNominationIds: new Set([won.id]),
    });

    expect(totals.get(100)).toBe(40);
    expect(totals.get(200)).toBe(20);
  });

  it('pays a win once, on the nomination that won — two nominations and one win is 3P', () => {
    // 🔴 D125. A film nominated twice in one category (Emilia Pérez's two
    // Original Song slots) earns P for each nomination and P for the one win:
    // 3P. Matching the win by film paid it on both nominations, 4P.
    const won = award(1, 100);
    const totals = scoreMovies({
      nominations: [won, award(1, 100)],
      pointsByAward: new Map([[1, 20]]),
      winningNominationIds: new Set([won.id]),
    });

    expect(totals.get(100)).toBe(60);
  });

  it('ignores a win in an award the movie was not nominated for', () => {
    // Nothing to score against: the rule iterates nominations, so a stray
    // winner row cannot invent points out of nowhere.
    const totals = scoreMovies({
      nominations: [],
      pointsByAward: new Map([[1, 20]]),
      winningNominationIds: new Set([nextNominationId++]),
    });

    expect(totals.size).toBe(0);
  });

  it('scores an award with no resolvable points as nothing, never NaN', () => {
    // One unresolvable row must not poison a whole team's total, and a silent
    // zero is far easier to spot than a standings column reading "NaN".
    const totals = scoreMovies({
      nominations: [award(1, 100), award(2, 100)],
      pointsByAward: new Map([[1, 20]]),
      winningNominationIds: new Set(),
    });

    expect(totals.get(100)).toBe(20);
  });

  it('returns nothing for a movie with no nominations', () => {
    const totals = scoreMovies({
      nominations: [],
      pointsByAward: new Map(),
      winningNominationIds: new Set(),
    });

    expect(totals.size).toBe(0);
  });
});

describe('sumTotals', () => {
  it('adds up a team', () => {
    const totals = new Map([
      [1, 40],
      [2, 20],
      [3, 0],
    ]);

    expect(sumTotals(totals, [1, 2, 3])).toBe(60);
  });

  it('treats an unscored movie as zero rather than dropping the team', () => {
    expect(sumTotals(new Map([[1, 40]]), [1, 999])).toBe(40);
  });
});

describe('ledgerForMovies', () => {
  it('shows a pair with one win as Won on the winning line only, and 3P in total', async () => {
    // 🔴 D125, through the real loader. Nomination 11 won; 12 is the same film
    // in the same category and did not. The ledger has to say which one won,
    // and its total is still the sum of its lines.
    rows.nominations = [
      { id: 11, movieId: 100, awardId: 1, year: 2025 },
      { id: 12, movieId: 100, awardId: 1, year: 2025 },
    ];
    rows.awards = [{ id: 1, name: 'Music - Original Song', eventId: 1, pointsId: 5 }];
    rows.points = [{ id: 5, points: 20 }];
    rows.winners = [{ nominationId: 11, movieId: 100, awardId: 1, year: 2025 }];

    const ledger = (await ledgerForMovies([100], 2025)).get(100);

    expect(
      ledger?.lines.map(({ nominationId, won, earned }) => ({
        nominationId,
        won,
        earned,
      })),
    ).toEqual([
      { nominationId: 11, won: true, earned: 40 },
      { nominationId: 12, won: false, earned: 20 },
    ]);
    expect(ledger?.total).toBe(60);
  });
});

import { describe, expect, it } from 'vitest';

import { scoreMovies, sumTotals } from './scoring';

/**
 * 🔴 The rule every number in this product depends on (D19, D41).
 *
 * These pin the arithmetic and touch no database, so they run on every CI
 * push. `scoring.production.test.ts` pins the *port* — it reproduces the
 * source API's own answer for a real draft — and needs the restored data, so
 * it runs locally.
 */
const award = (id: number, movieId: number) => ({ movieId, awardId: id });

describe('scoreMovies', () => {
  it('a nomination is worth P', () => {
    const totals = scoreMovies({
      nominations: [award(1, 100)],
      pointsByAward: new Map([[1, 20]]),
      winnersByAward: new Map(),
    });

    expect(totals.get(100)).toBe(20);
  });

  it('🔴 a win is worth 2P, not P', () => {
    // The single most consequential line in the rule. A winner was
    // necessarily also nominated, so the win adds P on top of the nomination.
    const totals = scoreMovies({
      nominations: [award(1, 100)],
      pointsByAward: new Map([[1, 20]]),
      winnersByAward: new Map([[1, new Set([100])]]),
    });

    expect(totals.get(100)).toBe(40);
  });

  it('sums a movie across its awards', () => {
    const totals = scoreMovies({
      nominations: [award(1, 100), award(2, 100)],
      pointsByAward: new Map([
        [1, 20],
        [2, 5],
      ]),
      winnersByAward: new Map([[2, new Set([100])]]),
    });

    expect(totals.get(100)).toBe(20 + 5 + 5);
  });

  it('🔴 credits a win only to the movie that won', () => {
    // Both films were nominated; one won. Crediting the win to the category
    // rather than the film would hand every nominee the winner's points.
    const totals = scoreMovies({
      nominations: [award(1, 100), award(1, 200)],
      pointsByAward: new Map([[1, 20]]),
      winnersByAward: new Map([[1, new Set([100])]]),
    });

    expect(totals.get(100)).toBe(40);
    expect(totals.get(200)).toBe(20);
  });

  it('ignores a win in an award the movie was not nominated for', () => {
    // Nothing to score against: the rule iterates nominations, so a stray
    // winner row cannot invent points out of nowhere.
    const totals = scoreMovies({
      nominations: [],
      pointsByAward: new Map([[1, 20]]),
      winnersByAward: new Map([[1, new Set([100])]]),
    });

    expect(totals.size).toBe(0);
  });

  it('scores an award with no resolvable points as nothing, never NaN', () => {
    // One unresolvable row must not poison a whole team's total, and a silent
    // zero is far easier to spot than a standings column reading "NaN".
    const totals = scoreMovies({
      nominations: [award(1, 100), award(2, 100)],
      pointsByAward: new Map([[1, 20]]),
      winnersByAward: new Map(),
    });

    expect(totals.get(100)).toBe(20);
  });

  it('returns nothing for a movie with no nominations', () => {
    const totals = scoreMovies({
      nominations: [],
      pointsByAward: new Map(),
      winnersByAward: new Map(),
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

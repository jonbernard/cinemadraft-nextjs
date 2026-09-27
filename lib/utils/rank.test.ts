import { describe, expect, it } from 'vitest';

import { denseRank, rankSeats } from './rank';

/**
 * Dense ranking, shared by the dashboard's league standings and the league
 * board's own standings section (P10.T10). Assumes its input is already
 * sorted by total descending.
 */
describe('denseRank', () => {
  it('assigns 1, 2, 3 when nothing is tied', () => {
    const rows = [{ total: 30 }, { total: 20 }, { total: 10 }];
    expect(denseRank(rows)).toEqual([1, 2, 3]);
  });

  it('a tie shares a position and the next distinct total skips (1, 1, 3)', () => {
    // The case a naive `index + 1` cannot distinguish itself from: two tied
    // rows, then a third, strictly lower, row. `index + 1` would print 1, 2, 3;
    // dense ranking prints 1, 1, 3.
    const rows = [{ total: 20 }, { total: 20 }, { total: 10 }];
    expect(denseRank(rows)).toEqual([1, 1, 3]);
  });

  it('the common case: everyone tied at zero before anything is awarded', () => {
    const rows = [{ total: 0 }, { total: 0 }, { total: 0 }];
    expect(denseRank(rows)).toEqual([1, 1, 1]);
  });

  it('handles a longer run of ties in the middle', () => {
    const rows = [
      { total: 40 },
      { total: 20 },
      { total: 20 },
      { total: 20 },
      { total: 5 },
    ];
    expect(denseRank(rows)).toEqual([1, 2, 2, 2, 5]);
  });

  it('returns an empty list for no rows', () => {
    expect(denseRank([])).toEqual([]);
  });
});

/**
 * The league table — `/leagues/[id]`, `/live` and the dashboard all build it
 * here. Seats go in in draft order, as `getLeagueBoard` returns them.
 */
describe('rankSeats', () => {
  const seat = (draftId: number, userId: number | null, name: string, total: number) => ({
    draftId,
    userId,
    name,
    total,
  });

  it('ranks placeholder and character seats alongside members, and keys them by -draftId', () => {
    // An unnamed placeholder reaches here as 'Unclaimed seat' (draft.ts); a
    // character seat carries its dummy name. Both draft real films, so both
    // must take a place — leaving them out moves everyone below them up one.
    const rows = rankSeats(
      [
        seat(10, 1, 'Ada Lovelace', 100),
        seat(11, null, 'Unclaimed seat', 300),
        seat(12, 2, 'Grace Hopper', 50),
        seat(13, null, 'Hannibal Lecter', 200),
      ],
      2,
    );

    expect(rows).toEqual([
      { userId: -11, name: 'Unclaimed seat', total: 300, position: 1, isViewer: false },
      { userId: -13, name: 'Hannibal Lecter', total: 200, position: 2, isViewer: false },
      { userId: 1, name: 'Ada Lovelace', total: 100, position: 3, isViewer: false },
      { userId: 2, name: 'Grace Hopper', total: 50, position: 4, isViewer: true },
    ]);
  });

  it('keeps tied seats in draft order and gives them one number', () => {
    // Kept by the owner on 2026-09-27 (D126): ties list in draft order (the
    // source listed them in reverse) and share a rank. Any swap fails here.
    const rows = rankSeats(
      [
        seat(1, 1, 'First', 865),
        seat(2, 2, 'Second', 900),
        seat(3, 3, 'Third', 865),
        seat(4, null, 'Fourth', 865),
      ],
      null,
    );

    expect(rows.map((row) => [row.userId, row.position])).toEqual([
      [2, 1],
      [1, 2],
      [3, 2],
      [-4, 2],
    ]);
  });

  it('never marks a placeholder as a signed-out reader’s own seat', () => {
    const rows = rankSeats([seat(5, null, 'Unclaimed seat', 0)], null);
    expect(rows[0]?.isViewer).toBe(false);
  });

  it('ranks negative totals below zero, not as absent', () => {
    // A seat that drafted a Razzie winner can finish below nothing.
    const rows = rankSeats([seat(1, 1, 'A', -40), seat(2, 2, 'B', 0)], null);
    expect(rows.map((row) => [row.userId, row.position])).toEqual([
      [2, 1],
      [1, 2],
    ]);
  });
});

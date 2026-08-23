import { describe, expect, it } from 'vitest';

import { denseRank } from './rank';

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

  it('🔴 a tie shares a position and the next distinct total skips (1, 1, 3)', () => {
    // The case a naive `index + 1` cannot distinguish itself from: two tied
    // rows, then a third, strictly lower, row. `index + 1` would print 1, 2, 3;
    // dense ranking prints 1, 1, 3.
    const rows = [{ total: 20 }, { total: 20 }, { total: 10 }];
    expect(denseRank(rows)).toEqual([1, 1, 3]);
  });

  it('🔴 the common case: everyone tied at zero before anything is awarded', () => {
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

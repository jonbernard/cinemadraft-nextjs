import { describe, expect, it } from 'vitest';

import { isCurrentSeason, seasonStatus } from './season';

describe('seasonStatus', () => {
  const opened = { activeYear: 2027, draftingStatus: 'pending' as const };

  it('gives the league status to its current season only', () => {
    expect(seasonStatus(opened, 2027)).toBe('pending');
  });

  it('keeps a finished season finished after the next one is opened', () => {
    expect(seasonStatus(opened, 2026)).toBe('complete');
  });

  it('calls a season not yet opened neither pending nor complete', () => {
    expect(seasonStatus(opened, 2028)).toBeNull();
  });

  it('gives a league with no active year its status for every season', () => {
    expect(seasonStatus({ activeYear: null, draftingStatus: 'active' }, 2019)).toBe(
      'active',
    );
  });
});

describe('isCurrentSeason', () => {
  it('is the active year, or any year for a league that has none', () => {
    expect(isCurrentSeason({ activeYear: 2027 }, 2027)).toBe(true);
    expect(isCurrentSeason({ activeYear: 2027 }, 2026)).toBe(false);
    expect(isCurrentSeason({ activeYear: null }, 2026)).toBe(true);
  });
});

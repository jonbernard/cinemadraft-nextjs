import { describe, expect, it } from 'vitest';

import { inSeason, seasonOffset, seasonStart } from './season-window';

describe('season window', () => {
  it('puts December nominations in the next year’s season', () => {
    expect(inSeason(Date.UTC(2025, 11, 8), 2026)).toBe(true);
    expect(inSeason(Date.UTC(2025, 11, 8), 2025)).toBe(false);
  });

  it('runs 1 August to 31 July, with no gap and no overlap', () => {
    expect(seasonStart(2027)).toBe(Date.UTC(2026, 7, 1));
    expect(inSeason(Date.UTC(2026, 7, 1), 2027)).toBe(true);
    expect(inSeason(Date.UTC(2026, 7, 1) - 1, 2027)).toBe(false);
    expect(inSeason(Date.UTC(2026, 7, 1) - 1, 2026)).toBe(true);
    expect(inSeason(Date.UTC(2026, 7, 1), 2026)).toBe(false);
  });

  it('orders a date by its place in its own season, whatever the year', () => {
    expect(seasonOffset(Date.UTC(2025, 7, 1))).toBe(0);
    expect(seasonOffset(Date.UTC(2025, 6, 31))).toBe(
      Date.UTC(2025, 6, 31) - Date.UTC(2024, 7, 1),
    );
    expect(seasonOffset(Date.UTC(2019, 0, 22))).toBe(seasonOffset(Date.UTC(2026, 0, 22)));
    expect(seasonOffset(Date.UTC(2025, 11, 8))).toBeLessThan(
      seasonOffset(Date.UTC(2026, 0, 8)),
    );
  });
});

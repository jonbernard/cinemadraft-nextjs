import { describe, expect, it } from 'vitest';

import { canOpenSeason } from './open-season';

describe('canOpenSeason', () => {
  it('offers the active year when it is the season after the newest', () => {
    expect(canOpenSeason({ activeYear: 2027, seasons: [2026, 2025] })).toBe(2027);
  });
  it('offers nothing while the site is still on the newest season', () => {
    expect(canOpenSeason({ activeYear: 2026, seasons: [2026] })).toBeNull();
  });
  it('offers nothing two seasons ahead: only one beyond the newest may open', () => {
    expect(canOpenSeason({ activeYear: 2027, seasons: [2025] })).toBeNull();
  });
  it('offers nothing to a league with no season at all: that is league creation', () => {
    expect(canOpenSeason({ activeYear: 2027, seasons: [] })).toBeNull();
  });
});

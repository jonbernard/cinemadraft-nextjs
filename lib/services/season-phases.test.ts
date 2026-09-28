import { describe, expect, it } from 'vitest';

import { toSeasonPhases } from './season';

const NOW = Date.UTC(2026, 8, 27);
const show = (
  id: number,
  over: Partial<Parameters<typeof toSeasonPhases>[0][number]> = {},
) => ({
  id,
  name: `Show ${id}`,
  abbreviation: `s${id}`,
  hasCeremony: true,
  nomDate: Date.UTC(2026, 0, 8),
  awardsDate: Date.UTC(2026, 2, 1),
  ...over,
});

describe('toSeasonPhases', () => {
  it('gives a show with no ceremony one moment, not a ceremony that never comes', () => {
    const phases = toSeasonPhases(
      [show(1), show(2, { hasCeremony: false, awardsDate: null })],
      2026,
      NOW,
    );
    expect(phases.map((p) => p.key)).toEqual([
      '1-nominations',
      '2-nominations',
      '1-ceremony',
    ]);
  });

  it('leaves an undated ceremony that does exist in place, as Date TBA', () => {
    const phases = toSeasonPhases([show(1, { awardsDate: null })], 2026, NOW);
    expect(phases.find((p) => p.key === '1-ceremony')).toMatchObject({
      date: null,
      complete: false,
    });
  });

  it('reads only its own season’s dates: 2026’s are not 2027’s', () => {
    // 🔴 The trap the owner's flip to 2027 springs. `events` holds one row of
    // dates per show, overwritten each season, so until the award-entry skill
    // sets 2027's every show still carries 2026's — all past. Without the
    // window the rail would call 2027 finished on the day it opens.
    const phases = toSeasonPhases([show(1)], 2027, NOW);
    expect(phases.map(({ date, complete }) => ({ date, complete }))).toEqual([
      { date: null, complete: false },
      { date: null, complete: false },
    ]);
  });
});

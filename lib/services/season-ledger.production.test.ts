// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { getLeagueBoard } from './draft';
import { getSeasonLedger } from './season-ledger';

/**
 * 🔴 Restored data: league 1's 2025 and 2026 boards, as the proposal measured
 * them. Excluded on CI (`vitest.ci.config.mts`), which has no league 1.
 */
afterAll(async () => {
  await db.$disconnect();
});

/**
 * The proposal's measure: each step where the set of seats sharing first
 * place differs from the step before, the first lead included.
 */
function leaderSets(
  steps: { standings: { userId: number; position: number }[] }[],
): number {
  const leaders = steps.map((step) =>
    step.standings
      .filter((row) => row.position === 1)
      .map((row) => row.userId)
      .join(),
  );
  return leaders.filter((set, i) => set !== leaders[i - 1]).length;
}

/** P16.T22's measure: `standings[0]` changes seat; a tie ordered by draft order is not a change. */
function topChanges(steps: { standings: { userId: number }[] }[]): number {
  return steps.filter(
    (step, i) =>
      i > 0 && step.standings[0]?.userId !== steps[i - 1]?.standings[0]?.userId,
  ).length;
}

describe('getSeasonLedger on league 1', () => {
  it('ends 2026 on D125’s measured pair: Sasha Downey 1190, Jacob 1130', async () => {
    const ledger = await getSeasonLedger(1, 2026, null);
    const last = ledger.steps.at(-1)?.standings ?? [];
    expect(last[0]).toMatchObject({ name: 'Sasha Downey', total: 1190, position: 1 });
    expect(last.find((row) => row.name.startsWith('Jacob'))?.total).toBe(1130);
  });

  it('sums to the board for every seat, both ways', async () => {
    const [ledger, board] = await Promise.all([
      getSeasonLedger(1, 2026, null),
      getLeagueBoard(1, 2026),
    ]);
    const seats = board.groups.flatMap((group) => group.seats);
    expect(seats).toHaveLength(16);
    for (const seat of seats) {
      const season = ledger.seats.find((entry) => entry.draftId === seat.draftId);
      const deltas = ledger.steps.reduce(
        (sum, step) => sum + (step.delta.get(seat.draftId) ?? 0),
        0,
      );
      const shows = [...(season?.byShow.values() ?? [])].reduce(
        (sum, v) => sum + v.nom + v.win,
        0,
      );
      expect([deltas, shows]).toEqual([seat.total, seat.total]);
    }
  });

  it('changed leader as the proposal measured: 3 in 2026, 6 in 2025', async () => {
    const [y2026, y2025] = await Promise.all([
      getSeasonLedger(1, 2026, null),
      getSeasonLedger(1, 2025, null),
    ]);
    expect([y2026.steps.length, y2025.steps.length]).toEqual([23, 22]);
    expect([leaderSets(y2026.steps), leaderSets(y2025.steps)]).toEqual([3, 6]);
    // The race's own rule counts fewer: the first lead is not a change, nor
    // is a tie the draft order breaks.
    expect([topChanges(y2026.steps), topChanges(y2025.steps)]).toEqual([2, 2]);
  });
});

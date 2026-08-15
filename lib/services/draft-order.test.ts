import { describe, expect, it } from 'vitest';

import { currentRound, nextSeatId, type OrderedSeat } from './draft-order';

/** Four seats, each holding the given number of picks. */
function group(counts: readonly number[]): OrderedSeat[] {
  return counts.map((pickCount, index) => ({
    draftId: 100 + index,
    order: index + 1,
    pickCount,
  }));
}

describe('currentRound', () => {
  it('starts at one', () => {
    expect(currentRound(group([0, 0, 0, 0]))).toBe(1);
  });

  it('advances only when every seat has picked', () => {
    expect(currentRound(group([1, 1, 1, 0]))).toBe(1);
    expect(currentRound(group([1, 1, 1, 1]))).toBe(2);
  });

  it('answers one for a group with no seats rather than throwing', () => {
    expect(currentRound([])).toBe(1);
  });

  it('imposes no ceiling — a league may draft six or thirty (D34)', () => {
    expect(currentRound(group([30, 30, 30, 30]))).toBe(31);
  });
});

describe('nextSeatId', () => {
  it('opens with the first seat', () => {
    expect(nextSeatId(group([0, 0, 0, 0]))).toBe(100);
  });

  it('runs up the order through an odd round', () => {
    expect(nextSeatId(group([1, 0, 0, 0]))).toBe(101);
    expect(nextSeatId(group([1, 1, 0, 0]))).toBe(102);
  });

  it('🔴 turns back at the end of the round', () => {
    // The snake. Measured across the three seasons drafted under the current
    // live-call workflow: 308 of 309 picks follow it.
    expect(nextSeatId(group([1, 1, 1, 1]))).toBe(103);
    expect(nextSeatId(group([1, 1, 1, 2]))).toBe(102);
  });

  it('turns again for the next odd round', () => {
    expect(nextSeatId(group([2, 2, 2, 2]))).toBe(100);
  });

  it('🔴 comes back for a seat that missed its turn', () => {
    // The 2026 exception, and the reason the owner can override at all:
    // someone was away from the call and the draft carried on without them.
    // Seat 2 is a round behind, so it is the only candidate.
    expect(nextSeatId(group([3, 2, 3, 3]))).toBe(101);
  });

  it('returns null when no seats exist', () => {
    expect(nextSeatId([])).toBeNull();
  });

  it('reads the order field, not array position', () => {
    // Seats arrive from the service sorted, but the rule must not depend on
    // that — a group whose seats were created out of order still drafts by
    // its own numbering.
    const seats: OrderedSeat[] = [
      { draftId: 1, order: 3, pickCount: 0 },
      { draftId: 2, order: 1, pickCount: 0 },
      { draftId: 3, order: 2, pickCount: 0 },
    ];

    expect(nextSeatId(seats)).toBe(2);
  });
});

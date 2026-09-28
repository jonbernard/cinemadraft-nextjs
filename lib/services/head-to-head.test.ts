import { describe, expect, it } from 'vitest';

import { rankSeats } from '@/lib/utils/rank';
import {
  compareSeats,
  type H2HSeat,
  headToHeadHeadline,
  headToHeadSentence,
  pointsDisagreements,
  seatAbove,
} from './head-to-head';

/** A pick worth `points`, of film `movieId`. */
function pick(movieId: number, points: number, round = 1) {
  return {
    movieId,
    tmdbId: String(1000 + movieId),
    title: `Film ${movieId}`,
    posterUrl: null,
    round,
    points,
    ledger: points > 0 ? [{ won: points >= 20 }] : [],
  };
}

/** A seat whose total is its picks' sum, as the ledger's is (D125). */
function seat(
  draftId: number,
  group: number,
  picks: ReturnType<typeof pick>[],
  isDummy = false,
): H2HSeat {
  return {
    draftId,
    name: `Seat ${draftId}`,
    uuid: isDummy ? null : `uuid-${draftId}`,
    isDummy,
    group,
    picks,
    total: picks.reduce((sum, entry) => sum + entry.points, 0),
  };
}

/**
 * Two groups of two. Films 1 and 2 are held across groups by seats 1 and 3;
 * everything else is held once. Totals: 1 → 60, 2 → 25, 3 → 45, 4 → 5.
 */
const CROSS_GROUP: H2HSeat[] = [
  seat(1, 1, [pick(1, 20, 1), pick(2, 10, 2), pick(5, 30, 3)]),
  seat(2, 1, [pick(6, 25, 1), pick(7, 0, 2)]),
  seat(3, 2, [pick(1, 20, 2), pick(2, 10, 1), pick(8, 15, 3)]),
  seat(4, 2, [pick(9, 5, 1)], true),
];

const standings = (seats: readonly H2HSeat[]) =>
  rankSeats(
    seats.map((entry) => ({ ...entry, userId: entry.isDummy ? null : entry.draftId })),
    null,
  );

describe('compareSeats', () => {
  // 🔴 The "cancels out" pin; the production test runs it on league 1.
  it('scores a shared film the same for every holder', () => {
    expect(pointsDisagreements(CROSS_GROUP)).toEqual([]);
  });

  it('splits a cross-group pair and the shared films cancel', () => {
    const h2h = compareSeats(CROSS_GROUP, standings(CROSS_GROUP), 1, 3);
    expect(h2h).not.toBeNull();
    if (!h2h) return;
    expect(h2h.sameGroup).toBe(false);
    expect(h2h.shared.map((film) => film.movieId)).toEqual([1, 2]);
    expect(h2h.shared[0]).toMatchObject({ roundA: 1, roundB: 2, status: 'won' });
    expect(h2h.onlyA.map((film) => film.movieId)).toEqual([5]);
    expect(h2h.onlyB.map((film) => film.movieId)).toEqual([8]);
    expect(h2h.sharedPoints).toBe(30);
    expect([h2h.uniqueA, h2h.uniqueB]).toEqual([30, 15]);
    expect(h2h.margin).toBe(15);
    expect(h2h.margin).toBe(h2h.uniqueA - h2h.uniqueB);
    expect(h2h.uniqueA + h2h.sharedPoints).toBe(h2h.a.total);
    expect(h2h.uniqueB + h2h.sharedPoints).toBe(h2h.b.total);
    expect(h2h.gap.map((film) => [film.side, film.movieId])).toEqual([
      ['a', 5],
      ['b', 8],
    ]);
  });

  it('a same-group pair shares nothing, and says it is the same group', () => {
    const h2h = compareSeats(CROSS_GROUP, standings(CROSS_GROUP), 1, 2);
    expect(h2h?.sameGroup).toBe(true);
    expect(h2h?.shared).toEqual([]);
    expect(h2h?.margin).toBe(35);
  });

  it('with no reader, a is the leader', () => {
    const h2h = compareSeats(CROSS_GROUP, standings(CROSS_GROUP), null, 4);
    expect(h2h?.a).toMatchObject({ draftId: 1, position: 1, isViewer: false });
    expect(h2h?.b).toMatchObject({ draftId: 4, position: 4, isDummy: true });
  });

  it('the reader is a, whoever vs names', () => {
    const h2h = compareSeats(CROSS_GROUP, standings(CROSS_GROUP), 2, 1);
    expect(h2h?.a).toMatchObject({ draftId: 2, isViewer: true, position: 3 });
    expect(h2h?.b.draftId).toBe(1);
  });

  it('vs naming the leader, for a follower, compares the leader with second', () => {
    const h2h = compareSeats(CROSS_GROUP, standings(CROSS_GROUP), null, 1);
    expect([h2h?.a.draftId, h2h?.b.draftId]).toEqual([1, 3]);
  });

  it('an unknown vs gives the default pair', () => {
    const table = standings(CROSS_GROUP);
    expect(compareSeats(CROSS_GROUP, table, 2, 999)).toEqual(
      compareSeats(CROSS_GROUP, table, 2, null),
    );
    // The reader's default is the seat directly above: 2 (25) is under 3 (45).
    expect(compareSeats(CROSS_GROUP, table, 2, null)?.b.draftId).toBe(3);
  });

  it('needs two seats', () => {
    const one = CROSS_GROUP.slice(0, 1);
    expect(compareSeats(one, standings(one), null, null)).toBeNull();
  });
});

describe('seatAbove', () => {
  const table = standings(CROSS_GROUP);
  it('is the row above, and second for the leader', () => {
    expect(seatAbove(table, 1)).toBe(3);
    expect(seatAbove(table, 3)).toBe(1);
    expect(seatAbove(table, 4)).toBe(2);
    expect(seatAbove(table, 999)).toBeNull();
  });
});

describe('the words', () => {
  const table = standings(CROSS_GROUP);
  it('reads from a’s side, and says "you" for the reader', () => {
    const follower = compareSeats(CROSS_GROUP, table, null, 3);
    const reader = compareSeats(CROSS_GROUP, table, 3, 1);
    if (!follower || !reader) throw new Error('no pair');
    expect(headToHeadHeadline(follower)).toBe('Seat 1 leads Seat 3 by 15');
    expect(headToHeadHeadline(reader)).toBe('You’re 15 behind Seat 1');
    // First names collide ("Seat"), so the sentence spells both in full.
    expect(headToHeadSentence(follower)).toBe(
      '30 of Seat 1’s 60 points are films Seat 3 also holds. The gap is the other one pick each.',
    );
  });

  it('a same-group pair says so rather than showing an empty band', () => {
    const h2h = compareSeats(CROSS_GROUP, table, 2, 1);
    if (!h2h) throw new Error('no pair');
    expect(headToHeadSentence(h2h)).toBe(
      'Same group, so no film is on both teams. The gap is your two against Seat 1’s three.',
    );
  });
});

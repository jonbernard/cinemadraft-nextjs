// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { getLeagueBoard } from './draft';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * Against the real restored data. League 1's 2026 season is 4 groups of 4
 * seats, 3 of which are dummies — the shape the board has to survive.
 */
describe('getLeagueBoard', () => {
  it('groups the seats the way the league actually drafts', async () => {
    const board = await getLeagueBoard(1, 2026);

    expect(board.groups.map((group) => group.group)).toEqual([1, 2, 3, 4]);
    for (const group of board.groups) {
      expect(group.seats).toHaveLength(4);
    }
  });

  it('carries the league name, status and parsed owners', async () => {
    const board = await getLeagueBoard(1, 2026);

    expect(board.leagueName).toBe('Racso award');
    // Parsed to numbers, never the raw "[3]" text (D47).
    expect(board.ownerIds).toEqual([3]);
    expect(board.status).toBeTruthy();
  });

  it('🔴 keeps dummy seats — they are real seats in a real league', async () => {
    // 3 of league 1's 16 seats for 2026 are dummies. Dropping them would
    // silently remove members from the board and the standings.
    const board = await getLeagueBoard(1, 2026);
    const dummies = board.groups.flatMap((group) =>
      group.seats.filter((seat) => seat.isDummy),
    );

    expect(dummies).toHaveLength(3);
    for (const seat of dummies) {
      expect(seat.name).not.toBe('');
      expect(seat.userId).toBeNull();
    }
  });

  it('🔴 pads each group to its longest seat, never to a constant (D34)', async () => {
    const board = await getLeagueBoard(1, 2026);

    for (const group of board.groups) {
      const longest = Math.max(...group.seats.map((seat) => seat.picks.length));
      expect(group.rounds).toBe(longest);
    }
  });

  it('orders seats by their draft order', async () => {
    const board = await getLeagueBoard(1, 2026);

    for (const group of board.groups) {
      const orders = group.seats.map((seat) => seat.order);
      expect([...orders]).toEqual([...orders].sort((a, b) => a - b));
    }
  });

  it('orders each seat’s picks by round', async () => {
    const board = await getLeagueBoard(1, 2026);
    const seat = board.groups[0]?.seats.find((entry) => entry.picks.length > 0);

    const rounds = seat?.picks.map((pick) => pick.round) ?? [];
    expect(rounds.length).toBeGreaterThan(0);
    expect([...rounds]).toEqual([...rounds].sort((a, b) => a - b));
  });

  it('scores each seat as the sum of its picks', async () => {
    const board = await getLeagueBoard(1, 2026);

    for (const group of board.groups) {
      for (const seat of group.seats) {
        const summed = seat.picks.reduce((sum, pick) => sum + pick.points, 0);
        expect(seat.total).toBe(summed);
      }
    }
  });

  it('returns an empty board for a league-year that never drafted', async () => {
    // Not an error: a league created and abandoned, or a season not started.
    const board = await getLeagueBoard(1, 1999);

    expect(board.groups).toEqual([]);
    expect(board.leagueName).toBe('Racso award');
  });

  it('🔴 throws for a league that does not exist rather than faking an empty one', async () => {
    // The page turns this into a 404. Returning an empty board would render
    // as a real league nobody has drafted in yet — a state that genuinely
    // occurs (see the 1999 case above), so the two must not look alike.
    await expect(getLeagueBoard(999_999, 2026)).rejects.toBeInstanceOf(NotFoundError);
  });
});

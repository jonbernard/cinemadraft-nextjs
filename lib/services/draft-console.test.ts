// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { getDraftConsole } from './draft-console';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * Against the real restored data. League 1's 2026 season drafted 4 groups of 4
 * seats and is the season the current live-call workflow produced, so it is
 * the shape the console has to be right about.
 */
describe('getDraftConsole', () => {
  it('defaults to the first group and lists the rest', async () => {
    const view = await getDraftConsole(1, 2026);

    expect(view.group).toBe(1);
    expect(view.groups).toEqual([1, 2, 3, 4]);
    expect(view.seats).toHaveLength(4);
  });

  it('opens the group the owner asked for', async () => {
    const view = await getDraftConsole(1, 2026, 3);

    expect(view.group).toBe(3);
  });

  it('carries the parsed owners so the page can gate on them (D47)', async () => {
    const view = await getDraftConsole(1, 2026);

    expect(view.ownerIds).toEqual([3]);
  });

  it('names the seat that should pick next', async () => {
    const view = await getDraftConsole(1, 2026);

    // Either a real seat in this group, or null once the group is level.
    if (view.suggestedSeatId !== null) {
      expect(view.seats.map((seat) => seat.draftId)).toContain(view.suggestedSeatId);
    }
  });

  it('🔴 lists every film gone in the group, not just in one seat', async () => {
    // The owner must not have to remember what went three seats ago. The list
    // is the group because that is the scope a film is taken in — measured
    // across all 1025 production picks.
    const view = await getDraftConsole(1, 2026);
    const fromSeats = view.seats.flatMap((seat) => seat.picks.length);

    expect(view.takenMovieIds).toHaveLength(fromSeats.reduce((sum, n) => sum + n, 0));
    expect(new Set(view.takenMovieIds).size).toBe(view.takenMovieIds.length);
  });

  it('builds poster urls the board can actually load', async () => {
    const view = await getDraftConsole(1, 2026);
    const withArt = view.seats
      .flatMap((seat) => seat.picks)
      .find((pick) => pick.posterUrl !== null);

    // The phase gate is that a taken film is unmistakable from artwork alone,
    // so a board of placeholders would fail it.
    expect(withArt?.posterUrl).toMatch(/^https:\/\/image\.tmdb\.org\/t\/p\/w185\//);
  });

  it('rounds are the longest seat in the group, never a constant (D34)', async () => {
    const view = await getDraftConsole(1, 2026);

    expect(view.rounds).toBe(Math.max(...view.seats.map((seat) => seat.picks.length)));
  });

  it('404s for a group the league does not have', async () => {
    await expect(getDraftConsole(1, 2026, 99)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('404s for a season the league never drafted', async () => {
    // Distinct from an empty console, which would read as a group nobody has
    // drafted in yet.
    await expect(getDraftConsole(1, 1999)).rejects.toBeInstanceOf(NotFoundError);
  });
});

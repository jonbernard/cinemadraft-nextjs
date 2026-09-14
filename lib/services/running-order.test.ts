// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { getLeagueBoard } from './draft';
import { getDraftConsole } from './draft-console';
import { nextSeatId } from './draft-order';
import { getSeasonSetup } from './season-setup';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * One running order, four surfaces, and nothing allowed to re-derive it.
 *
 * 🔴 **Why this exists.** `drafts.order` is read by four separate things: the
 * season setup list, the ceremony animation that plays a deal, the draft
 * console's "Running order" column, and `nextSeatId`, which snakes through it
 * to say whose turn it is. Each sorts for itself. Nothing today forces them to
 * agree, and the failure is silent: the owner reads one order off the setup
 * page, the console picks a different seat, and the only symptom is that a
 * turn "seems odd" — which is exactly how it was reported on 2026-09-13.
 *
 * 🔴 **Against league 1's 2026 season, deliberately, because its data is
 * adversarial.** Group 1's positions 1–4 are draft ids 315, 318, 307, 314 —
 * so a surface that sorted by id, by insertion, or by name would produce a
 * different sequence and fail here. That property is not assumed: the first
 * case below asserts it, so if the fixture ever becomes id-ordered this file
 * says so loudly instead of quietly becoming a test that cannot fail.
 *
 * 🔴 **The ceremony's link in the chain is not here, and that is deliberate.**
 * `toCeremonyGroups` is local to `components/leagues/SeasonSetup.tsx`, so it is
 * pinned at component level by
 * `SeasonSetup.test.tsx > celebrates the groups the server returned, not a
 * second shuffle` — whose mock assignments deliberately disagree with the order
 * the seats are listed in, for the same anti-vacuity reason as the first case
 * below. Between that test and this file, all four surfaces are covered. If you
 * add a fifth reader of `drafts.order`, add it to one of the two.
 *
 * Read-only. No scratch rows, nothing to clean up, and `lib/db.test.ts`'s row
 * counts are untouched.
 */
const LEAGUE = 1;
const YEAR = 2026;

describe('the running order is one order, everywhere', () => {
  it('🔴 the fixture disagrees with every other plausible sort', async () => {
    // The vacuity guard. Without it, everything below could pass against four
    // surfaces that all sorted by id and never looked at `order` at all.
    const board = await getLeagueBoard(LEAGUE, YEAR);
    const group = board.groups[0];
    if (!group) throw new Error('league 1 2026 should have groups');

    const byOrder = group.seats.map((seat) => seat.draftId);
    const byId = [...byOrder].sort((a, b) => a - b);
    const byName = [...group.seats]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((seat) => seat.draftId);

    expect(byOrder).not.toEqual(byId);
    expect(byOrder).not.toEqual(byName);
  });

  it('the board hands every group back in position order', async () => {
    const board = await getLeagueBoard(LEAGUE, YEAR);

    for (const group of board.groups) {
      expect(group.seats.map((seat) => seat.order)).toEqual(
        group.seats.map((_, index) => index + 1),
      );
    }
  });

  it('the setup page and the board agree, seat for seat', async () => {
    // The setup list is what the owner reads before a draft, and the ceremony
    // animates the same rows (`toCeremonyGroups` sorts on this `order`).
    const [setup, board] = await Promise.all([
      getSeasonSetup(LEAGUE, YEAR),
      getLeagueBoard(LEAGUE, YEAR),
    ]);

    const fromBoard = board.groups.flatMap((group) =>
      group.seats.map((seat) => `${group.group}:${seat.order}:${seat.draftId}`),
    );
    const fromSetup = setup.seats
      .filter((seat) => seat.group != null)
      .map((seat) => `${seat.group}:${seat.order}:${seat.draftId}`);

    expect(fromSetup).toEqual(fromBoard);
  });

  it('the draft console shows the board’s order, unchanged', async () => {
    const board = await getLeagueBoard(LEAGUE, YEAR);

    for (const group of board.groups) {
      const console_ = await getDraftConsole(LEAGUE, YEAR, group.group);
      expect(console_.seats.map((seat) => seat.draftId)).toEqual(
        group.seats.map((seat) => seat.draftId),
      );
      expect(console_.seats.map((seat) => seat.order)).toEqual(
        group.seats.map((seat) => seat.order),
      );
    }
  });

  it('the snake walks that same order, forward then back', async () => {
    // 🔴 The end of the chain: the order the owner READ is the order the
    // console SNAKES through. Simulated from an empty group rather than read
    // off the live picks, so the assertion is about the rule and not about
    // what this league happened to do.
    const board = await getLeagueBoard(LEAGUE, YEAR);
    const group = board.groups[0];
    if (!group) throw new Error('league 1 2026 should have groups');

    const seats = group.seats.map((seat) => ({
      draftId: seat.draftId,
      order: seat.order,
      pickCount: 0,
    }));

    const visited: number[] = [];
    // Two full rounds: the snake's whole shape is only visible across the turn.
    for (let pick = 0; pick < seats.length * 2; pick += 1) {
      const next = nextSeatId(seats);
      if (next == null) throw new Error('the snake ran out of seats');
      visited.push(next);
      const seat = seats.find((entry) => entry.draftId === next);
      if (seat) seat.pickCount += 1;
    }

    const forward = group.seats.map((seat) => seat.draftId);
    expect(visited).toEqual([...forward, ...[...forward].reverse()]);
  });
});

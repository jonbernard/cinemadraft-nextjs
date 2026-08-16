'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { ConflictError } from '@/lib/errors';
import { draftRepository } from '@/lib/repositories/drafts';
import {
  type Assignment,
  dealIntoGroups,
  shuffle,
} from '@/lib/services/group-assignment';
import { type ActionResult, fail, ok, toActionResult } from '../result';
import { authorizeLeague } from './guard';

const AddSeat = z.object({
  leagueId: z.int().positive(),
  year: z.int().positive(),
  /** A placeholder the owner drafts on behalf of. */
  dummyName: z.string().trim().min(1).max(120),
});

/**
 * Seat a placeholder — someone with no account (P10.T15).
 *
 * 🔴 These are real and they are not rare: **17 dummy seats exist in
 * production**, 3 of them in league 1's 2026 season. A league where one person
 * does not use the site still needs a seat for them, and the owner drafts on
 * their behalf.
 *
 * Only placeholders are added this way. A real member joins by invite link,
 * which is what connects their seat to their account.
 */
export async function addDummySeat(
  input: z.infer<typeof AddSeat>,
): Promise<ActionResult<{ draftId: number }>> {
  const parsed = AddSeat.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that seat is not valid');

  try {
    await authorizeLeague(parsed.data.leagueId);

    const seat = await draftRepository.create({
      leagueId: parsed.data.leagueId,
      year: parsed.data.year,
      dummyName: parsed.data.dummyName,
    });

    revalidatePath(`/leagues/${parsed.data.leagueId}`, 'layout');
    return ok({ draftId: seat.id });
  } catch (error) {
    return toActionResult(error);
  }
}

const RenameSeat = z.object({
  leagueId: z.int().positive(),
  draftId: z.int().positive(),
  dummyName: z.string().trim().min(1).max(120),
});

/** Rename a placeholder seat (P10.T16). A real member's name is their own. */
export async function renameDummySeat(
  input: z.infer<typeof RenameSeat>,
): Promise<ActionResult> {
  const parsed = RenameSeat.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that name is not valid');

  try {
    await authorizeLeague(parsed.data.leagueId);

    const seat = await draftRepository.findById(parsed.data.draftId);
    if (seat.dummy !== true) {
      // Renaming a member's seat would rewrite what the league calls a person
      // in one league but not another.
      throw new ConflictError('only a placeholder seat can be renamed');
    }

    await draftRepository.updateSeat(parsed.data.leagueId, parsed.data.draftId, {
      dummyName: parsed.data.dummyName,
    });

    revalidatePath(`/leagues/${parsed.data.leagueId}`, 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

const RemoveSeat = z.object({
  leagueId: z.int().positive(),
  draftId: z.int().positive(),
});

/**
 * Remove a seat (P10.T16).
 *
 * 🔴 The repository refuses once the seat holds picks. `draft_picks` has no
 * foreign key, so nothing cascades — deleting a seat with picks leaves rows
 * belonging to nobody, which the board silently drops and the standings
 * silently keep.
 */
export async function removeSeat(
  input: z.infer<typeof RemoveSeat>,
): Promise<ActionResult> {
  const parsed = RemoveSeat.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that seat is not valid');

  try {
    await authorizeLeague(parsed.data.leagueId);
    await draftRepository.deleteSeat(parsed.data.leagueId, parsed.data.draftId);

    revalidatePath(`/leagues/${parsed.data.leagueId}`, 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

const Assign = z.object({
  leagueId: z.int().positive(),
  assignments: z
    .array(
      z.object({
        draftId: z.int().positive(),
        group: z.int().positive().nullable(),
        order: z.int().positive().nullable(),
      }),
    )
    .max(200),
});

/** Save a group layout the owner arranged by hand (P10.T14). */
export async function assignSeats(input: z.infer<typeof Assign>): Promise<ActionResult> {
  const parsed = Assign.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that arrangement is not valid');

  try {
    await authorizeLeague(parsed.data.leagueId);
    await draftRepository.assignSeats(parsed.data.leagueId, parsed.data.assignments);

    revalidatePath(`/leagues/${parsed.data.leagueId}`, 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

const Randomise = z.object({
  leagueId: z.int().positive(),
  year: z.int().positive(),
  groupCount: z.int().positive().max(20),
});

/**
 * Deal everyone into groups at random (P10.T14).
 *
 * 🔴 Refuses once the draft has started. Reshuffling groups mid-draft would
 * move people away from the picks they already made, and the board reads a
 * seat's group to decide which board it belongs on.
 */
export async function randomiseGroups(
  input: z.infer<typeof Randomise>,
): Promise<ActionResult<{ assigned: number }>> {
  const parsed = Randomise.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that arrangement is not valid');

  try {
    const { league } = await authorizeLeague(parsed.data.leagueId);
    if (league.draftingStatus !== 'pending') {
      throw new ConflictError('groups can only be arranged before the draft starts');
    }

    const seats = await draftRepository.findByLeagueIdAndYear(
      parsed.data.leagueId,
      parsed.data.year,
    );

    const assignments: Assignment[] = dealIntoGroups(
      shuffle(seats.map((seat) => seat.id)),
      parsed.data.groupCount,
    );
    await draftRepository.assignSeats(parsed.data.leagueId, assignments);

    revalidatePath(`/leagues/${parsed.data.leagueId}`, 'layout');
    return ok({ assigned: assignments.length });
  } catch (error) {
    return toActionResult(error);
  }
}

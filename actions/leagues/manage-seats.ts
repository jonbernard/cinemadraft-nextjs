'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ConflictError } from '@/lib/errors';
import { seasonStatus } from '@/lib/leagues/season';
import { draftRepository } from '@/lib/repositories/drafts';
import {
  type Assignment,
  dealIntoGroups,
  shuffle,
} from '@/lib/services/group-assignment';
import { personKey } from '@/lib/services/season-setup';
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
 *
 * Returns the assignments alongside the count. Additive, so the existing
 * callers keep compiling, and it is what lets `GroupCeremony` animate a result
 * that is already saved rather than inventing one.
 */
export async function randomiseGroups(
  input: z.infer<typeof Randomise>,
): Promise<ActionResult<{ assigned: number; assignments: Assignment[] }>> {
  const parsed = Randomise.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that arrangement is not valid');

  try {
    const { league } = await authorizeLeague(parsed.data.leagueId);
    if (seasonStatus(league, parsed.data.year) !== 'pending') {
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
    // 🔴 The groups are decided here and nowhere else. The caller animates
    // these rows (P15.T12); it never rolls its own, so a viewer who reloads
    // mid-animation sees exactly what the page beneath already holds.
    return ok({ assigned: assignments.length, assignments });
  } catch (error) {
    return toActionResult(error);
  }
}

const Returning = z.object({
  leagueId: z.int().positive(),
  year: z.int().positive(),
  /** The person's seat in an earlier season of this league. */
  fromDraftId: z.int().positive(),
});

/**
 * Seat someone from an earlier season in this one (D131). One press seats one
 * person (D121): there is no "add everyone".
 *
 * 🔴 The source seat is read from the database and must belong to this
 * league and to an earlier season, so a caller cannot copy a seat out of
 * somebody else's league. A member comes back as themselves (their account,
 * not a placeholder with their name); everyone else by the name they had.
 *
 * ponytail: check-then-insert, so two presses racing each other could seat
 * one person twice. The row leaves the list on the first press and the
 * button is disabled while it runs; a unique index would need a person
 * column that `drafts` does not have.
 */
export async function seatReturning(
  input: z.infer<typeof Returning>,
): Promise<ActionResult<{ draftId: number }>> {
  const parsed = Returning.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that seat is not valid');

  try {
    const { league } = await authorizeLeague(parsed.data.leagueId);

    const source = await draftRepository.findById(parsed.data.fromDraftId);
    if (
      source.leagueId !== parsed.data.leagueId ||
      source.year == null ||
      source.year >= parsed.data.year
    ) {
      throw new ConflictError('that seat is not from an earlier season of this league');
    }
    if (seasonStatus(league, parsed.data.year) !== 'pending') {
      throw new ConflictError('people can only be added before the draft starts');
    }

    const key = personKey(source);
    const seated = await draftRepository.findByLeagueIdAndYear(
      parsed.data.leagueId,
      parsed.data.year,
    );
    if (key == null || seated.some((seat) => personKey(seat) === key)) {
      throw new ConflictError('they already have a seat this season');
    }

    const seat = await draftRepository.create({
      leagueId: parsed.data.leagueId,
      year: parsed.data.year,
      userId: source.userId,
      dummyName: source.userId == null ? source.dummyName : null,
    });

    revalidatePath(`/leagues/${parsed.data.leagueId}`, 'layout');
    return ok({ draftId: seat.id });
  } catch (error) {
    return toActionResult(error);
  }
}

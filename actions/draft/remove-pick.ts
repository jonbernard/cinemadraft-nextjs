'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { draftPickRepository } from '@/lib/repositories/draft-picks';
import { type ActionResult, fail, ok, toActionResult } from '../result';
import { authorizePick } from './guard';

const Input = z.int().positive();

/**
 * Take a film back off a seat — a mis-heard title on a live call, mostly.
 *
 * The remaining picks are renumbered so the seat's rounds stay 1..N with no
 * hole. The source app deleted the row and left the gap, which is visible on
 * the board as an empty cell mid-roster and is indistinguishable from a seat
 * that simply has fewer picks than the group's longest. Renumbering runs
 * through the same single transaction as an ordinary reorder, so a removal
 * cannot half-apply either.
 */
export async function removePick(pickId: number): Promise<ActionResult> {
  const parsed = Input.safeParse(pickId);
  if (!parsed.success) return fail('INVALID', 'that pick is not valid');

  try {
    const { pick, leagueId } = await authorizePick(parsed.data);

    await draftPickRepository.deleteById(pick.id);

    const remaining = await draftPickRepository.findByDraftId(pick.draftId);
    await draftPickRepository.reorder(
      pick.draftId,
      remaining.map((entry) => entry.id),
    );

    // 'layout' so the owner's console at /leagues/:id/draft refreshes too,
    // not only the public board. A Server Action called from a client
    // component carries the revalidated tree back with its response, which is
    // what makes the console advance without a manual refresh.
    revalidatePath(`/leagues/${leagueId}`, 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { ConflictError } from '@/lib/errors';
import { draftPickRepository } from '@/lib/repositories/draft-picks';
import { type ActionResult, fail, ok, toActionResult } from '../result';
import { authorizeSeat } from './guard';

const Input = z.object({
  draftId: z.int().positive(),
  /** The seat's picks, in the order they should now read. */
  pickIds: z.array(z.int().positive()).min(1),
});

export type ReorderPicksInput = z.infer<typeof Input>;

/**
 * Rewrite one seat's ordering.
 *
 * 🔴 **The list must be a permutation of the seat's picks** — every pick
 * present, exactly once, and nothing from anywhere else. That is checked
 * against the stored rows rather than trusted, because a partial list would
 * renumber some picks and leave the rest at their old positions, which is the
 * duplicate-`order` state the board cannot render honestly. The source route
 * accepted whatever `{id, order}` pairs it was sent and applied them without
 * waiting for any of them.
 *
 * Ordering is expressed as positions in a list rather than as explicit numbers
 * so that duplicate or skipped rounds are not representable at all; the
 * repository assigns 1..N and writes them in one transaction.
 */
export async function reorderPicks(input: ReorderPicksInput): Promise<ActionResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that ordering is not valid');

  try {
    const { seat, leagueId } = await authorizeSeat(parsed.data.draftId);

    const current = await draftPickRepository.findByDraftId(seat.id);
    const wanted = new Set(parsed.data.pickIds);
    const isPermutation =
      wanted.size === parsed.data.pickIds.length &&
      wanted.size === current.length &&
      current.every((pick) => wanted.has(pick.id));

    if (!isPermutation) {
      throw new ConflictError('that ordering does not match this seat’s picks');
    }

    await draftPickRepository.reorder(seat.id, parsed.data.pickIds);

    revalidatePath(`/leagues/${leagueId}`);
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

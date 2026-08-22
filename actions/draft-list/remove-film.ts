'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { removeFromDraftList } from '@/lib/services/draft-list';
import { type ActionResult, fail, ok, toActionResult } from '../result';

const Input = z.object({ entryId: z.int().positive() });

export type RemoveFilmInput = z.infer<typeof Input>;

/**
 * Take a film off the caller's shortlist.
 *
 * An entry id arriving from the client is not proof of ownership, so the
 * caller's id is part of the delete's WHERE clause rather than a check in front
 * of it — somebody else's entry is not addressable, and the answer is the same
 * NOT_FOUND an id that never existed gets.
 */
export async function removeFilmFromList(input: RemoveFilmInput): Promise<ActionResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that entry is not valid');

  try {
    const user = await requireUser();
    await removeFromDraftList(user.id, parsed.data.entryId);

    revalidatePath('/list');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

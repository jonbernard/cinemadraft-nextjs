'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { setDraftListStatus } from '@/lib/services/draft-list';
import { type ActionResult, fail, ok, toActionResult } from '../result';

/**
 * The three states the column allows. Written out rather than derived from the
 * generated enum: `actions/` may not import from `generated/`, and these are
 * the strings the database stores.
 */
const Input = z.object({
  entryId: z.int().positive(),
  status: z.enum(['none', 'selected', 'unavailable']),
});

export type SetListStatusInput = z.infer<typeof Input>;

/**
 * Mark an entry as taken by the caller, gone to somebody else, or neither.
 *
 * Takes the state rather than toggling, so two open tabs converge instead of
 * fighting — and so a member who marked the wrong row can put it back.
 */
export async function setListStatus(input: SetListStatusInput): Promise<ActionResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that status is not valid');

  try {
    const user = await requireUser();
    await setDraftListStatus(user.id, parsed.data.entryId, parsed.data.status);

    revalidatePath('/list');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

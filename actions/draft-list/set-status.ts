'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { setDraftListStatus } from '@/lib/services/draft-list';
import { type ActionResult, fail, ok, toActionResult } from '../result';

/** Written out because `actions/` may not import from `generated/`. */
const Input = z.object({
  entryId: z.int().positive(),
  status: z.enum(['none', 'selected', 'unavailable']),
});

export type SetListStatusInput = z.infer<typeof Input>;

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

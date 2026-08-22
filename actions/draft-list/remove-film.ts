'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { removeFromDraftList } from '@/lib/services/draft-list';
import { type ActionResult, fail, ok, toActionResult } from '../result';

const Input = z.object({ entryId: z.int().positive() });

export type RemoveFilmInput = z.infer<typeof Input>;

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

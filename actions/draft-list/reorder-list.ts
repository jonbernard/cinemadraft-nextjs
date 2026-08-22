'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { reorderDraftList } from '@/lib/services/draft-list';
import { type ActionResult, fail, ok, toActionResult } from '../result';
import { Year } from './year';

const Input = z.object({
  year: Year,
  entryIds: z.array(z.int().positive()).min(1).max(500),
});

export type ReorderListInput = z.infer<typeof Input>;

export async function reorderList(input: ReorderListInput): Promise<ActionResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that ordering is not valid');

  try {
    const user = await requireUser();
    await reorderDraftList({ userId: user.id, ...parsed.data });

    revalidatePath('/list');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

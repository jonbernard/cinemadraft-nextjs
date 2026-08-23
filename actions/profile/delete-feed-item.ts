'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { profileFeedRepository } from '@/lib/repositories/profile-feeds';
import { type ActionResult, fail, ok, toActionResult } from '../result';

const Input = z.object({
  id: z.number().int().positive(),
});

export type DeleteFeedItemInput = z.infer<typeof Input>;

/**
 * Remove one line from your own feed (P10.T42).
 *
 * 🔴 The id arrives from the client, so it is checked against the caller's uuid
 * in the same statement that deletes — `deleteByIdAndUserUuid`, never a
 * `findById` followed by a compare, which leaves a window between the two. A
 * miss is reported as NOT_FOUND rather than FORBIDDEN so that guessing ids
 * cannot be used to discover which ones exist.
 */
export async function deleteFeedItem(
  input: DeleteFeedItemInput,
): Promise<ActionResult<null>> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that post is not valid');

  try {
    const user = await requireUser();
    // `userUuid` is nullable, and `deleteMany({ where: { userUuid: null } })`
    // would match every legacy row that has none — a cross-member delete from
    // one missing column.
    if (!user.uuid) return fail('FORBIDDEN', 'this account has no profile yet');

    const removed = await profileFeedRepository.deleteByIdAndUserUuid(
      parsed.data.id,
      user.uuid,
    );
    if (!removed) return fail('NOT_FOUND', 'that post is not there');

    revalidatePath(`/members/${user.uuid}`);

    return ok(null);
  } catch (error) {
    return toActionResult(error);
  }
}

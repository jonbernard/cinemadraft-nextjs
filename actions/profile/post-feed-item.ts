'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { profileFeedRepository } from '@/lib/repositories/profile-feeds';
import { type ActionResult, fail, ok, toActionResult } from '../result';

const Input = z.object({
  message: z.string().trim().min(1, 'write something first').max(2000),
});

export type PostFeedItemInput = z.infer<typeof Input>;

/**
 * Post a line to your own feed (P10.T41).
 *
 * 🔴 **The feed is resolved from the session, never from the request** (R15).
 * The source read `req.user.uuid` for this too, but its sibling `DELETE` took
 * the row id off the wire — and every write-shaped route in that app took the
 * target from wherever was most convenient. A uuid parameter here would let any
 * member post under any name, on a page other people read.
 *
 * `components` is left empty: attachments are written by the app when it
 * announces a draft or a review, not by a member typing prose.
 */
export async function postFeedItem(
  input: PostFeedItemInput,
): Promise<ActionResult<null>> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'write something first');

  try {
    const user = await requireUser();
    // A legacy row with no uuid has no feed to post to, and `userUuid: null`
    // would write a row nobody's profile can ever show.
    if (!user.uuid) return fail('FORBIDDEN', 'this account has no profile yet');

    await profileFeedRepository.create({
      userUuid: user.uuid,
      message: parsed.data.message,
    });

    revalidatePath(`/members/${user.uuid}`);

    return ok(null);
  } catch (error) {
    return toActionResult(error);
  }
}

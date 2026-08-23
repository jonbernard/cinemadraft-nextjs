'use server';

import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { notificationRepository } from '@/lib/repositories/notifications';
import { type ActionResult, fail, ok, toActionResult } from '../result';

const Input = z.array(z.int().positive()).min(1);

/**
 * Mark some of the caller's own notifications read (T44).
 *
 * 🔴 The scope is the whole security property of this action: `userId` is in
 * the repository's `where`, not a check this function performs first. A
 * check-then-write is something a request racing between the two can get
 * around; a scoped write cannot. Ids arrive from the client and are numbers
 * only because the signature says so — validated below before they reach the
 * repository at all.
 */
export async function markNotificationsRead(
  ids: number[],
): Promise<ActionResult<number>> {
  try {
    const user = await requireUser();

    const parsed = Input.safeParse(ids);
    if (!parsed.success) return fail('INVALID', 'that is not a list of notifications');

    const count = await notificationRepository.markAsRead(parsed.data, user.id);
    return ok(count);
  } catch (error) {
    return toActionResult(error);
  }
}

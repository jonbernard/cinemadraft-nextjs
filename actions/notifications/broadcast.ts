'use server';

import { z } from 'zod';

import { requireAdmin } from '@/lib/auth';
import { notificationRepository } from '@/lib/repositories/notifications';
import { userRepository } from '@/lib/repositories/users';
import { type ActionResult, fail, ok, toActionResult } from '../result';

const Input = z.object({
  message: z.string().trim().min(1, 'a broadcast needs a message'),
  icon: z.string().trim().min(1).nullable().optional(),
  link: z.string().trim().min(1).nullable().optional(),
});

export type BroadcastInput = z.infer<typeof Input>;

/**
 * Admin: send one notification to every member (T45).
 *
 * 🔴 `requireAdmin()` runs before the input is even parsed. Checking
 * authorization after validation would tell a non-admin caller exactly what
 * shape of payload this action wants — reconnaissance a refusal shouldn't
 * hand out.
 *
 * The source's `:type` segment is gone (R9): it was always ignored, and
 * broadcast-to-everyone is the only behaviour that has ever run. There is
 * also no per-recipient targeting to validate, because there is none.
 *
 * One `createMany` for every user id, not a loop — see
 * `notificationRepository.broadcast`. This is permanent for every recipient:
 * deletion was not rebuilt (R8), so nothing here can be taken back. The
 * confirmation step belongs to the form that calls this, not to the action.
 */
export async function broadcastNotification(
  input: BroadcastInput,
): Promise<ActionResult<number>> {
  try {
    const admin = await requireAdmin();

    const parsed = Input.safeParse(input);
    if (!parsed.success) {
      return fail(
        'INVALID',
        parsed.error.issues[0]?.message ?? 'that broadcast is not valid',
      );
    }

    const userIds = await userRepository.findAllIds();
    const count = await notificationRepository.broadcast(userIds, {
      message: parsed.data.message,
      icon: parsed.data.icon ?? null,
      link: parsed.data.link ?? null,
    });

    console.warn('[notifications] admin broadcast', {
      by: admin.id,
      recipients: count,
      message: parsed.data.message,
    });

    return ok(count);
  } catch (error) {
    return toActionResult(error);
  }
}

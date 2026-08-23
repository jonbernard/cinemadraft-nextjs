'use server';

import { z } from 'zod';

import { requireAdmin } from '@/lib/auth';
import { type User, userRepository } from '@/lib/repositories/users';
import { type ActionResult, fail, ok, toActionResult } from '../result';

const Input = z.string().trim().min(1).max(255);

/**
 * Locate the account an admin is about to relink (T49).
 *
 * A read, but admin-gated anyway: it is the first step of the one action in
 * the app that can move an account between people, and it returns a member's
 * name, email and Clerk identity — nothing an ordinary session should be able
 * to fish for by trying addresses.
 *
 * By email, because that is the identifier an admin has in hand — a support
 * message, a ticket — not the internal numeric id `relinkUser` actually
 * takes. The page carries the id forward once this resolves it.
 */
export async function findUserForRelink(email: string): Promise<ActionResult<User>> {
  try {
    await requireAdmin();

    const parsed = Input.safeParse(email);
    if (!parsed.success) return fail('INVALID', 'enter an email address');

    const user = await userRepository.findByEmail(parsed.data);
    if (!user) return fail('NOT_FOUND', `no account uses ${parsed.data}`);

    return ok(user);
  } catch (error) {
    return toActionResult(error);
  }
}

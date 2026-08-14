'use server';

import { requireAdmin } from '@/lib/auth';
import { type User, userRepository } from '@/lib/repositories/users';

/**
 * Repair path for the two cases the claim rules deliberately refuse:
 *
 * - a member whose Clerk email differs from the one on their historical
 *   account, who therefore got a new empty row instead of their history;
 * - a logged collision, where a second Clerk identity was refused.
 *
 * 🔴 This is the only code in the app that can move an account from one
 * identity to another, which is exactly the thing every other guard exists to
 * prevent. It is admin-gated for that reason, and it is separate from `claim`
 * so that no ordinary sign-in path can reach it, even by mistake.
 *
 * Passing null detaches rather than deletes, so a mistaken relink is
 * recoverable: unlink, then link correctly.
 *
 * Every call is logged with the acting admin. An account changing hands should
 * never be something nobody can account for afterwards.
 */
export async function relinkUser(userId: number, clerkId: string | null): Promise<User> {
  const admin = await requireAdmin();

  const before = await userRepository.findById(userId);
  const updated = await userRepository.relink(userId, clerkId);

  console.warn('[auth] admin relink', {
    by: admin.id,
    userId,
    from: before.clerkId,
    to: clerkId,
  });

  return updated;
}

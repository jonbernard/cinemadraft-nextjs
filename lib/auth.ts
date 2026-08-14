import { currentUser } from '@clerk/nextjs/server';

import { type User, userRepository } from '@/lib/repositories/users';
import { syncClerkIdentity } from '@/lib/services/clerk-identity';

/**
 * The session holds a valid Clerk identity, but it cannot be resolved to an
 * account — a collision awaiting admin repair (D25).
 *
 * Distinct from "signed out" because the remedies are opposite: signing in
 * again cannot fix this, and offering that as the next step sends the member
 * round a loop. The UI should say the account needs attention.
 */
export class AccountLinkError extends Error {
  constructor(readonly clerkId: string) {
    super('this Clerk identity cannot be linked to an account');
    this.name = 'AccountLinkError';
  }
}

/**
 * Resolve the Clerk session to a `User`, syncing if the link is not there yet.
 *
 * The lazy sync is not redundant with the webhook. A webhook is asynchronous
 * and independently retried: a member can finish signing in and land on the
 * dashboard before it arrives, and Clerk can delay or drop a delivery
 * outright. Without this, that member sees an account with none of their
 * history — and, worse, whatever "get started" path a new user would see,
 * which is how a duplicate account gets created and a real one abandoned.
 *
 * Both paths call the same `syncClerkIdentity`, so the safety rules hold
 * identically on each and there is no second implementation to keep in step.
 *
 * Returns null rather than throwing when the address is not yet verified:
 * that is a normal intermediate state (the member has a session but no
 * confirmed address), not a failure.
 */
export async function getCurrentUser(): Promise<User | null> {
  const clerk = await currentUser();
  if (!clerk) return null;

  const known = await userRepository.findByClerkId(clerk.id);
  if (known) return known;

  const result = await syncClerkIdentity({
    clerkId: clerk.id,
    emails: clerk.emailAddresses.map((email) => ({
      address: email.emailAddress,
      // Clerk reports verification per address. Reading it defensively — an
      // absent verification object is not a verified one.
      verified: email.verification?.status === 'verified',
    })),
    firstName: clerk.firstName,
    lastName: clerk.lastName,
    image: clerk.imageUrl ?? null,
  });

  if (result.status === 'collision') throw new AccountLinkError(clerk.id);
  return result.user ?? null;
}

/**
 * The signed-in user, or an error.
 *
 * Every page under `(app)` is already behind the proxy, so reaching here
 * without a session means the route escaped the matcher — a bug worth
 * surfacing rather than smoothing over with a redirect.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error('not signed in');
  return user;
}

/**
 * Authorization, not authentication.
 *
 * Throws rather than redirecting: a non-admin reaching an admin action is
 * either a bug or an attempt, and neither deserves a friendly bounce that
 * hides it from logs.
 */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== 'admin') throw new Error('admin only');
  return user;
}

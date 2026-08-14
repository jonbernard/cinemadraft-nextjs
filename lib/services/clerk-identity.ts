import { ConflictError, NotFoundError } from '@/lib/errors';
import { type User, userRepository } from '@/lib/repositories/users';

export type ClerkEmail = { address: string; verified: boolean };

export type ClerkIdentity = {
  clerkId: string;
  emails: ClerkEmail[];
  firstName: string | null;
  lastName: string | null;
  image: string | null;
};

export type SyncResult =
  | { status: 'linked' | 'claimed' | 'created'; user: User }
  | { status: 'unverified' | 'collision'; user?: undefined };

/**
 * Attach a Clerk identity to a `User` row, or create one. The single path (D25).
 *
 * Both the webhook and the session resolver call this, so the safety rules
 * cannot be true on one path and forgotten on the other. It is idempotent,
 * because Clerk redelivers webhooks and a retry must not be an error.
 *
 * 🔴 Two rules, and they are the reason this function exists at all rather
 * than callers using the repository directly:
 *
 * **1. Only a verified address may claim.** Linking on an unverified address
 * would let anyone sign up with another member's email and inherit their
 * leagues, drafts and points. Clerk's two enabled methods are verified by
 * construction (D26) — an email code can only be read by whoever holds the
 * inbox, and Google returns a verified address — so today this is defence in
 * depth. It is enforced explicitly anyway: enabling one more connection must
 * not silently reopen the hole.
 *
 * **2. A claimed row is never reassigned.** One person can hold two Clerk
 * identities (Google once, an email code later). Account linking should merge
 * them, but this must not depend on a dashboard setting staying switched on.
 * Overwriting would transfer a member's entire history to whoever signed in
 * most recently. A collision is refused and logged for admin repair.
 *
 * The order of operations matters: the already-linked check runs first, so the
 * common case — a returning member — costs one indexed lookup and no writes.
 */
export async function syncClerkIdentity(identity: ClerkIdentity): Promise<SyncResult> {
  const known = await userRepository.findByClerkId(identity.clerkId);
  if (known) return { status: 'linked', user: known };

  const verified = identity.emails.filter((email) => email.verified);
  if (verified.length === 0) {
    // Not an error, and not a refusal to remember. Clerk fires `user.created`
    // before verification completes and `user.updated` once it does, so the
    // claim simply happens on that second event.
    return { status: 'unverified' };
  }

  for (const email of verified) {
    const legacy = await userRepository.findByEmail(email.address);
    if (!legacy) continue;

    // Intentionally redundant with `claim`, which refuses the same case via a
    // conditional write and throws below. Verified by mutation: deleting this
    // branch leaves every test green, because the repository still holds the
    // line. It stays for two reasons — it names the collision with both ids
    // for the admin who has to repair it, and it means the guarantee does not
    // rest on a single implementation. Each layer is tested separately
    // (`users.test.ts` covers the write-side refusal).
    if (legacy.clerkId && legacy.clerkId !== identity.clerkId) {
      console.error('[auth] claim collision', {
        userId: legacy.id,
        heldBy: legacy.clerkId,
        attemptedBy: identity.clerkId,
      });
      // Returning here rather than continuing to the next address is
      // deliberate: falling through to the create path would hand this
      // identity a brand-new account on an address that belongs to someone
      // else.
      return { status: 'collision' };
    }

    try {
      return {
        status: 'claimed',
        user: await userRepository.claim(email.address, identity.clerkId),
      };
    } catch (error) {
      if (error instanceof ConflictError) {
        // `claim` re-checks under a conditional write, so it can still refuse
        // after the check above — that is the concurrent sign-in case, and
        // refusing is the correct outcome rather than something to retry.
        console.error('[auth] claim refused', {
          email: email.address,
          clerkId: identity.clerkId,
        });
        return { status: 'collision' };
      }
      // A row can disappear between the lookup and the claim. Try the next
      // verified address rather than failing the whole sign-in.
      if (!(error instanceof NotFoundError)) throw error;
    }
  }

  // No legacy row matched any verified address: a genuinely new member.
  const primary = verified[0] as ClerkEmail;
  return {
    status: 'created',
    user: await userRepository.createFromClerk({
      clerkId: identity.clerkId,
      email: primary.address,
      firstName: identity.firstName,
      lastName: identity.lastName,
      image: identity.image,
    }),
  };
}

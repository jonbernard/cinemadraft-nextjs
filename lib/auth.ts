import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { SIGN_IN_URL } from '@/lib/auth-routes';
import { ForbiddenError } from '@/lib/errors';
import { type User, userRepository } from '@/lib/repositories/users';
import { syncClerkIdentity } from '@/lib/services/clerk-identity';
import { isTestAuthEnabled, testSessionUserId } from '@/lib/test-auth';

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
  // 🔴 Test-only (D82/D84), and a *replacement* for the Clerk path rather than
  // a fallback in front of it. Under the flag the app runs with no Clerk at
  // all — `proxy.ts` installs a pass-through instead of `clerkMiddleware`, and
  // `currentUser()` throws outright when that middleware is absent. So this
  // branch has to answer for every request in a test run, signed in or not;
  // falling through would crash every anonymous page view.
  //
  // `isTestAuthEnabled()` is false in every deployed environment and the module
  // refuses to load at all on Vercel, so this branch does not exist in
  // production — see lib/test-auth.ts.
  if (isTestAuthEnabled()) {
    const testUserId = await testSessionUserId();
    if (testUserId == null) return null;
    // `findById` throws on a miss; `findManyByIds` does not. A cookie that has
    // outlived its row is a signed-out browser, not a 500.
    const [user] = await userRepository.findManyByIds([testUserId]);
    return user ?? null;
  }

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
 * For a Server Action, which is the only caller left: reaching here without a
 * session is an answer the caller has to read, not a page to navigate. Pages
 * use `requirePageUser` below, which bounces to the login form instead.
 *
 * Throws `ForbiddenError` rather than a bare `Error` so that a Server Action
 * can convert it into a failure the caller can read (`actions/result.ts`). A
 * plain Error is re-thrown by that converter — deliberately, since an unknown
 * exception is a bug and belongs in the logs — and "you are not an admin" is
 * not a bug, it is an answer.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError('not signed in');
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
  if (user.role !== 'admin') throw new ForbiddenError('admin only');
  return user;
}

/**
 * The page gate: the signed-in user, or a bounce to the login form.
 *
 * This is what `proxy.ts` used to do for every path its matcher did not call
 * public (D40), moved onto the resource itself as Clerk's migration away from
 * `createRouteMatcher` prescribes. The redirect rather than a throw is the
 * whole difference from `requireUser`: a page render wants the login form and
 * a way in, a Server Action wants a `ForbiddenError` that `actions/result.ts`
 * can turn into `{ ok: false }` for the caller to read. Two callers, opposite
 * answers, so two functions.
 *
 * 🔴 `getCurrentUser()` rather than Clerk's own `auth.protect()`, which is what
 * the guide writes. `auth.protect()` needs `clerkMiddleware` to have run, and
 * under `E2E_TEST_AUTH=1` it has not (D82/D84) — so using it would mean a
 * branch, and the browser suite would then only ever exercise the branch that
 * is not production's. `getCurrentUser()` already answers for both worlds, and
 * routing the gate through it is what lets `e2e/route-protection.spec.ts`
 * observe the real redirect for the first time.
 *
 * 🔴 What is given up: Clerk's redirect carried `?redirect_url=`, so a member
 * landed back on the page they asked for. Next does not expose the request
 * path to a render, so restoring it needs `proxy.ts` to set the pathname as a
 * request header. Left out as the smaller change; the member lands on `/`.
 *
 * `AccountLinkError` is deliberately not caught — a collided account (D25) is
 * not a signed-out one, and sending it to the login form is the loop D25
 * exists to avoid. It reaches `(app)/error.tsx`, as it does today.
 */
export async function requirePageUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(SIGN_IN_URL);
  return user;
}

/**
 * The page gate for the admin pages.
 *
 * Signed out is a redirect, signed in and not an admin is a `ForbiddenError` —
 * which is exactly the pair the proxy and `requireAdmin` produced between them
 * before this moved onto the page, and the split matters: a bounce to login
 * for someone who is already logged in is a loop, and hiding a refusal behind
 * a login form is how an attempt stays out of the logs.
 */
export async function requirePageAdmin(): Promise<User> {
  const user = await requirePageUser();
  if (user.role !== 'admin') throw new ForbiddenError('admin only');
  return user;
}

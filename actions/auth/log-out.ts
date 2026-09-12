'use server';

import { cookies } from 'next/headers';

import { isTestAuthEnabled, TEST_SESSION_COOKIE } from '@/lib/test-auth';

/**
 * Drop the test session (D82/D84).
 *
 * 🔴 Exists only because the e2e run has no Clerk, and therefore no
 * `UserButton` to sign out of. The cookie is `httpOnly`, so nothing on the
 * client can clear it — this is the one path that can.
 *
 * The flag check is not ceremony: this is a Server Action, so it is reachable
 * by POST from anywhere the bundle is served, and the guard is what makes it a
 * no-op rather than a public endpoint that deletes a cookie by name. In a
 * deployed environment `isTestAuthEnabled()` is false and the module it comes
 * from refuses to load on Vercel at all.
 *
 * No redirect: Next re-renders the current route after a Server Action, so the
 * shell comes back signed out where the reader already is.
 */
export async function logOutOfTestSession(): Promise<void> {
  if (!isTestAuthEnabled()) return;
  (await cookies()).delete(TEST_SESSION_COOKIE);
}

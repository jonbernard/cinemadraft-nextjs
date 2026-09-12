import { createHmac, timingSafeEqual } from 'node:crypto';

export const TEST_SESSION_COOKIE = '__cinemadraft_test_session';

/** A test run is hours, not days. Shorter than any real session on purpose. */
const LIFETIME_MS = 24 * 60 * 60 * 1000;
const MIN_SECRET_LENGTH = 32;

const requested = process.env.E2E_TEST_AUTH === '1';

/**
 * 🔴 Two hard failures at import time, not two `if`s at call time.
 *
 * The guard is **deployment**, not build mode. Playwright runs a production
 * build on purpose (`playwright.config.mts` — the cascade-layer assertions are
 * about compiled output), so `NODE_ENV` is `'production'` in exactly the
 * environment where this must work, and a NODE_ENV guard would be wrong in the
 * dangerous direction the first time somebody "fixed" it.
 *
 * On Vercel the flag must not merely be ignored — it must stop the process.
 * A silently-ignored flag is a setting somebody can toggle and believe took
 * effect; a boot failure is one nobody can misread. `VERCEL_ENV` is set by the
 * platform in every environment (production, preview and development), so this
 * covers preview deployments too.
 *
 * Import-time rather than call-time is the other half: this module is imported
 * by `lib/auth.ts` and by `proxy.ts`, both of which are pulled into every
 * build, so a flagged build on Vercel dies at compile rather than serving a
 * single request.
 */
if (requested && process.env.VERCEL_ENV) {
  throw new Error(
    'E2E_TEST_AUTH must never be enabled on Vercel — unset it in this environment',
  );
}

if (requested && (process.env.E2E_TEST_AUTH_SECRET ?? '').length < MIN_SECRET_LENGTH) {
  throw new Error(
    `E2E_TEST_AUTH requires E2E_TEST_AUTH_SECRET of at least ${MIN_SECRET_LENGTH} characters`,
  );
}

/** True only when the test session is both requested and permitted. */
export function isTestAuthEnabled(): boolean {
  return requested;
}

function sign(payload: string): string {
  return createHmac('sha256', process.env.E2E_TEST_AUTH_SECRET ?? '')
    .update(payload)
    .digest('hex');
}

/**
 * `42.1756089600000.<hmac>` — what the Playwright helper writes into the cookie.
 *
 * The issue time is inside the signed payload rather than left to the cookie's
 * own `expires`, which the browser owns and a request can simply not honour.
 */
export function signTestSession(userId: number, now: number = Date.now()): string {
  const payload = `${userId}.${now}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * The user id the request's test cookie carries, or null.
 *
 * Compares with `timingSafeEqual` — this is a MAC check, and a byte-by-byte
 * early return leaks the signature one character at a time to anything that can
 * time it. Cheap to do correctly, so there is no reason to do it the other way
 * even in test-only code.
 *
 * 🔴 `next/headers` is imported here rather than at the top of the file so that
 * this module is safe to import from anywhere. `proxy.ts` needs
 * `isTestAuthEnabled()` and runs outside the request-scope APIs, and
 * `e2e/support/session.ts` needs `signTestSession` from a plain Node process;
 * a top-level import would drag Next's request internals into both for a
 * function neither of them calls.
 */
export async function testSessionUserId(): Promise<number | null> {
  if (!requested) return null;

  const { cookies } = await import('next/headers');
  const raw = (await cookies()).get(TEST_SESSION_COOKIE)?.value;
  if (!raw) return null;

  const [id, issued, mac] = raw.split('.');
  if (!id || !issued || !mac) return null;

  const expected = sign(`${id}.${issued}`);
  const a = Buffer.from(mac, 'hex');
  const b = Buffer.from(expected, 'hex');
  // The length check is not redundant with `timingSafeEqual`: that function
  // throws on mismatched lengths rather than returning false, and a forged
  // cookie carrying four bytes would then be a 500 instead of a rejection.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const issuedAt = Number(issued);
  if (!Number.isSafeInteger(issuedAt) || Date.now() - issuedAt > LIFETIME_MS) return null;

  const userId = Number(id);
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
}

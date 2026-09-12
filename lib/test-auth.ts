import { createHmac, timingSafeEqual } from 'node:crypto';

export const TEST_SESSION_COOKIE = '__cinemadraft_test_session';

/** A test run is hours, not days. Shorter than any real session on purpose. */
const LIFETIME_MS = 24 * 60 * 60 * 1000;
const MIN_SECRET_LENGTH = 32;

/**
 * How far ahead of this clock a cookie may claim to have been issued.
 *
 * Without a lower bound `Date.now() - issuedAt` is negative for a future-dated
 * cookie and can never exceed the lifetime, so one stamped a year out would be
 * accepted for a year. Signer and verifier are the same machine, so the only
 * honest gap is a clock step; a minute covers that without reopening the hole.
 */
const FUTURE_SKEW_MS = 60 * 1000;

/** `localhost`, `127.0.0.1` and `[::1]` — the only hosts a test run answers on. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

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
 *
 * 🔴 It is not the load-bearing guard, though, and must not be read as one:
 * `VERCEL_ENV` is injected only while the project's "Enable access to System
 * Environment Variables" box is ticked, and with it unticked this check sees
 * nothing. `isLoopbackHost` below is the guard no setting can switch off. This
 * one stays because it is louder — a flagged build fails at compile, rather
 * than deploying and refusing every session in silence.
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

/**
 * 🔴 Refuses to sign rather than quietly HMACing with `''`.
 *
 * The floor at the top of this file only runs under `E2E_TEST_AUTH=1`, and the
 * Playwright process — which imports this module for `signTestSession` alone —
 * never sets that flag. An empty `E2E_TEST_AUTH_SECRET` there would have
 * produced a perfectly well-formed cookie signed with a key everybody knows,
 * and the run would have looked fine. A throw is the only outcome that cannot
 * be mistaken for a working suite.
 *
 * Unreachable from `testSessionUserId`: that path requires the flag, and the
 * flag already failed the import if the secret were this short.
 */
function sign(payload: string): string {
  const secret = process.env.E2E_TEST_AUTH_SECRET ?? '';
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `signing a test session requires E2E_TEST_AUTH_SECRET of at least ${MIN_SECRET_LENGTH} characters`,
    );
  }
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * 🔴 The one guard here that no dashboard setting can switch off.
 *
 * Everything else in this file is *negative*: it refuses an environment it
 * recognises as bad, and it only recognises it because the platform volunteers
 * `VERCEL_ENV`. That injection is a project checkbox; turned off, `VERCEL_ENV`,
 * `VERCEL`, `VERCEL_URL` and every sibling are undefined and the import-time
 * throw is inert. Widening it to those siblings buys nothing — same checkbox.
 *
 * A positive check inverts the burden. A request only carries a loopback `Host`
 * if it actually reached a loopback listener; a request that arrived at a
 * deployed hostname says so in the header it cannot omit, and is refused. There
 * is no setting that makes a deployment's own host name read as `localhost`.
 */
function isLoopbackHost(host: string | null | undefined): boolean {
  if (!host) return false;
  // Strip the port. An IPv6 host arrives bracketed (`[::1]:3000`), so this
  // anchored match can never eat part of the address itself.
  return LOOPBACK_HOSTS.has(host.replace(/:\d+$/, '').toLowerCase());
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

  const { cookies, headers } = await import('next/headers');
  // Before the cookie is even read: a request from anywhere but this machine
  // has no test session, whatever it is carrying. See `isLoopbackHost`.
  if (!isLoopbackHost((await headers()).get('host'))) return null;

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
  const age = Date.now() - issuedAt;
  // Bounded at both ends. The upper bound is the lifetime; the lower one is
  // what stops a cookie dated into the future from outliving every run.
  if (!Number.isSafeInteger(issuedAt) || age > LIFETIME_MS || age < -FUTURE_SKEW_MS) {
    return null;
  }

  // A signed payload is still shaped data, and the id has to be an id.
  // `-1` and `1e999` sail through the MAC check — whoever holds the secret
  // decides the payload — and only this line stops them becoming a lookup.
  const userId = Number(id);
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
}

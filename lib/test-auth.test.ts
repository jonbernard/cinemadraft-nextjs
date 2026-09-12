import { afterEach, describe, expect, it, vi } from 'vitest';

const cookies = vi.hoisted(() => vi.fn());
// `testSessionUserId` now reads the request's Host before it reads the cookie,
// so the jar alone is no longer enough to stand in for a request.
const headers = vi.hoisted(() => vi.fn());
vi.mock('next/headers', () => ({ cookies, headers }));

/**
 * 🔴 Every test here imports the module fresh, because the guards under test
 * are module-level. `isTestAuthEnabled` reads its flag once, at import, and
 * the Vercel and secret checks throw from the module body rather than from a
 * function — so a test that imported once and then changed the environment
 * would be asserting against a decision already made.
 */
const ENV = { ...process.env };
afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...ENV };
  cookies.mockReset();
  headers.mockReset();
  vi.resetModules();
});

describe('isTestAuthEnabled', () => {
  it('is off when the flag is absent', async () => {
    process.env.E2E_TEST_AUTH = undefined;
    const { isTestAuthEnabled } = await import('./test-auth');
    expect(isTestAuthEnabled()).toBe(false);
  });

  it('is on for a local production build, which is what Playwright runs', async () => {
    // The regression this guards: a `NODE_ENV !== 'production'` guard. The
    // e2e webServer builds and starts the app for real, so production is
    // exactly the mode the test session has to work in.
    process.env.E2E_TEST_AUTH = '1';
    process.env.E2E_TEST_AUTH_SECRET = 'x'.repeat(32);
    // `vi.stubEnv` rather than a plain assignment: NODE_ENV is typed read-only.
    vi.stubEnv('NODE_ENV', 'production');
    process.env.VERCEL_ENV = undefined;
    const { isTestAuthEnabled } = await import('./test-auth');
    expect(isTestAuthEnabled()).toBe(true);
  });

  it('🔴 throws at import if the flag is ever set on Vercel', async () => {
    process.env.E2E_TEST_AUTH = '1';
    process.env.E2E_TEST_AUTH_SECRET = 'x'.repeat(32);
    process.env.VERCEL_ENV = 'preview';
    await expect(import('./test-auth')).rejects.toThrow(/never be enabled on Vercel/i);
  });

  it('🔴 throws if the flag is set without a long enough secret', async () => {
    process.env.E2E_TEST_AUTH = '1';
    process.env.E2E_TEST_AUTH_SECRET = 'short';
    await expect(import('./test-auth')).rejects.toThrow(/secret/i);
  });
});

describe('testSessionUserId', () => {
  async function withCookie(value: string | undefined, host = 'localhost:3000') {
    process.env.E2E_TEST_AUTH = '1';
    process.env.E2E_TEST_AUTH_SECRET = 'x'.repeat(32);
    cookies.mockResolvedValue({ get: () => (value ? { value } : undefined) });
    headers.mockResolvedValue({ get: (name: string) => (name === 'host' ? host : null) });
    return import('./test-auth');
  }

  it('reads the id from a correctly signed cookie', async () => {
    const module = await withCookie(undefined);
    const signed = module.signTestSession(42);
    const again = await withCookie(signed);
    await expect(again.testSessionUserId()).resolves.toBe(42);
  });

  it('is null when there is no cookie at all', async () => {
    const module = await withCookie(undefined);
    await expect(module.testSessionUserId()).resolves.toBeNull();
  });

  it('🔴 rejects a forged cookie', async () => {
    // 🔴 `Date.now()`, not a fixed timestamp. With an old one this passes even
    // against a build that never checks the signature at all — the lifetime
    // check downstream rejects it instead, and the test reports green while
    // proving nothing. Verified by mutation: strip the MAC comparison and this
    // goes red.
    const module = await withCookie(`42.${Date.now()}.deadbeef`);
    await expect(module.testSessionUserId()).resolves.toBeNull();
  });

  it('🔴 rejects a signature of the right length that is simply wrong', async () => {
    // `deadbeef` above is four bytes, so the length check alone rejects it.
    // This one is a full 32, which is what makes the comparison itself the
    // only thing standing in the way.
    const module = await withCookie(`42.${Date.now()}.${'ab'.repeat(32)}`);
    await expect(module.testSessionUserId()).resolves.toBeNull();
  });

  it('🔴 rejects a cookie whose payload was edited under a stolen signature', async () => {
    const module = await withCookie(undefined);
    const signed = module.signTestSession(42);
    const tampered = signed.replace(/^42\./, '43.');
    const again = await withCookie(tampered);
    await expect(again.testSessionUserId()).resolves.toBeNull();
  });

  it('🔴 rejects a cookie older than its lifetime', async () => {
    const module = await withCookie(undefined);
    const stale = module.signTestSession(42, Date.now() - 25 * 60 * 60 * 1000);
    const again = await withCookie(stale);
    await expect(again.testSessionUserId()).resolves.toBeNull();
  });

  it('🔴 rejects a cookie dated into the future, which would otherwise never expire', async () => {
    // The upper bound alone leaves `Date.now() - issuedAt` negative forever for
    // a forward-dated cookie, so it would be honoured until the clock caught
    // up. Anyone who can set the cookie chooses that date.
    const module = await withCookie(undefined);
    const ahead = module.signTestSession(42, Date.now() + 60 * 60 * 1000);
    const again = await withCookie(ahead);
    await expect(again.testSessionUserId()).resolves.toBeNull();
  });

  it('🔴 refuses a validly signed cookie that names a non-positive user id', async () => {
    // Holding the secret means choosing the payload, so the signature says
    // nothing about the id being an id. `0` and `-1` are what a row lookup
    // must never be handed.
    const module = await withCookie(undefined);
    for (const id of [0, -1]) {
      const signed = module.signTestSession(id);
      const again = await withCookie(signed);
      await expect(again.testSessionUserId()).resolves.toBeNull();
    }
  });

  it.each([
    ['localhost:3000', 42],
    ['127.0.0.1:3000', 42],
    ['[::1]:3000', 42],
    ['localhost', 42],
    ['cinemadraft.vercel.app', null],
    ['cinemadraft.com:443', null],
    ['192.168.1.14:3000', null],
    ['localhost.evil.test', null],
    ['', null],
  ])('🔴 honours a test session on %s and nowhere else', async (host, expected) => {
    // 🔴 The positive half of the Vercel guard. The import-time throw depends
    // on `VERCEL_ENV`, which a project can be configured not to inject; a
    // request's own Host is not a setting. A deployed host is refused here
    // even if every environment check above it went blind.
    const module = await withCookie(undefined);
    const signed = module.signTestSession(42);
    const again = await withCookie(signed, host);
    await expect(again.testSessionUserId()).resolves.toBe(expected);
  });

  it('🔴 is null when the flag is unset, whatever the cookie says', async () => {
    process.env.E2E_TEST_AUTH = undefined;
    cookies.mockResolvedValue({ get: () => ({ value: 'anything' }) });
    const { testSessionUserId } = await import('./test-auth');
    await expect(testSessionUserId()).resolves.toBeNull();
    // Not merely null: the cookie jar is never opened, so no amount of
    // control over the request reaches this code path at all.
    expect(cookies).not.toHaveBeenCalled();
  });
});

describe('signTestSession', () => {
  it('🔴 refuses to sign without a secret of the required length', async () => {
    // The import-time floor only fires under E2E_TEST_AUTH=1, and the process
    // that calls this — Playwright's — never sets that flag. Before this guard
    // an empty secret produced a well-formed cookie signed with a key the whole
    // world holds, and nothing anywhere said so.
    process.env.E2E_TEST_AUTH = undefined;
    process.env.E2E_TEST_AUTH_SECRET = '';
    const { signTestSession } = await import('./test-auth');
    expect(() => signTestSession(42)).toThrow(/at least 32 characters/);
  });

  it('signs when the secret clears the floor', async () => {
    process.env.E2E_TEST_AUTH = undefined;
    process.env.E2E_TEST_AUTH_SECRET = 'x'.repeat(32);
    const { signTestSession } = await import('./test-auth');
    expect(signTestSession(42)).toMatch(/^42\.\d+\.[0-9a-f]{64}$/);
  });
});

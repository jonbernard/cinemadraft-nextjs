import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 🔴 The only test that loads `proxy.ts` at all.
 *
 * Route protection no longer lives in that file — Clerk deprecated
 * `createRouteMatcher` and the checks moved onto the resources, where
 * `test/route-protection.test.ts` and `e2e/route-protection.spec.ts` guard
 * them. What is left here is still consequential: `clerkMiddleware` is what
 * attaches the request context every `auth()` and `currentUser()` call reads,
 * and under `E2E_TEST_AUTH=1` the module exports a pass-through instead. Get
 * that branch wrong in a deployed environment and no session resolves at all.
 *
 * Clerk is mocked down to a sentinel deliberately. What is under test is which
 * branch the module takes, not what Clerk does with a request — and a real
 * `clerkMiddleware` would want a secret key the unit suite does not have.
 */
const CLERK_MIDDLEWARE = Symbol('clerkMiddleware');
const clerkMiddleware = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ clerkMiddleware }));

beforeEach(() => {
  // The module decides its branch at import, from an environment read at
  // import — so each test needs its own copy of both.
  vi.resetModules();
  clerkMiddleware.mockReset();
  clerkMiddleware.mockReturnValue(CLERK_MIDDLEWARE);
  process.env.E2E_TEST_AUTH = undefined;
});

describe('proxy', () => {
  it('installs the real Clerk middleware when the test flag is unset', async () => {
    const proxy = await import('./proxy');

    // Identity against the sentinel rather than `typeof === 'function'`: the
    // pass-through is a function too, so anything weaker stays green against
    // the exact mutation this test exists to catch.
    expect(proxy.default).toBe(CLERK_MIDDLEWARE);
    expect(clerkMiddleware).toHaveBeenCalledOnce();
  });

  it('matches every route except Next internals and static files', async () => {
    // Pinned verbatim because the matcher is shared by both branches, and
    // because it is now the only thing this file decides. Narrow it and
    // `clerkMiddleware` never runs for the paths it dropped — `currentUser()`
    // throws "clerkMiddleware() was not run" there, so every page on them
    // fails rather than opening, which is the right direction and still not a
    // failure anybody wants to ship.
    const { config } = await import('./proxy');

    expect(config.matcher).toEqual([
      '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
      '/(api|trpc)(.*)',
    ]);
  });
});

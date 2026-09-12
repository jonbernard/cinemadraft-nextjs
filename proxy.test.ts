import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 🔴 The only test that loads `proxy.ts` at all.
 *
 * That file is where route protection lives, and its branch is the most
 * consequential `?:` in the app: under `E2E_TEST_AUTH=1` it exports a
 * pass-through with no protection whatsoever. Nothing used to cover it — the
 * unit suite never imported the module, and the e2e suite only ever runs with
 * the flag *on*, so deleting the condition and exporting the pass-through
 * unconditionally would have been green in both.
 *
 * Clerk is mocked down to a sentinel deliberately. What is under test is which
 * branch the module takes, not what Clerk does with a request — and a real
 * `clerkMiddleware` would want a secret key the unit suite does not have.
 */
const CLERK_MIDDLEWARE = Symbol('clerkMiddleware');
const clerkMiddleware = vi.hoisted(() => vi.fn());
const createRouteMatcher = vi.hoisted(() => vi.fn(() => () => false));
vi.mock('@clerk/nextjs/server', () => ({ clerkMiddleware, createRouteMatcher }));

beforeEach(() => {
  // The module decides its branch at import, from an environment read at
  // import — so each test needs its own copy of both.
  vi.resetModules();
  clerkMiddleware.mockReset();
  clerkMiddleware.mockReturnValue(CLERK_MIDDLEWARE);
  process.env.E2E_TEST_AUTH = undefined;
});

describe('proxy', () => {
  it('🔴 protects routes with the real Clerk middleware when the test flag is unset', async () => {
    const proxy = await import('./proxy');

    // Identity against the sentinel rather than `typeof === 'function'`: the
    // pass-through is a function too, so anything weaker stays green against
    // the exact mutation this test exists to catch.
    expect(proxy.default).toBe(CLERK_MIDDLEWARE);
    expect(clerkMiddleware).toHaveBeenCalledOnce();
  });

  it('🔴 matches every route except Next internals and static files', async () => {
    // Pinned verbatim because the matcher is shared by both branches: narrow it
    // and the proxy simply stops seeing a path, which shows up as a protected
    // page rendering perfectly to a stranger.
    const { config } = await import('./proxy');

    expect(config.matcher).toEqual([
      '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
      '/(api|trpc)(.*)',
    ]);
  });

  it('🔴 lists every route a stranger may reach, and no more', async () => {
    // Pinned as a whole list rather than `arrayContaining`. This is the file
    // where "public" is decided; a test that only checks for presence would
    // stay green while somebody added a route that should not be here, which
    // is the failure direction that actually costs something (D45).
    await import('./proxy');

    expect(createRouteMatcher).toHaveBeenCalledWith([
      '/',
      '/tokens',
      '/auth/(.*)',
      '/api/webhooks/(.*)',
      '/api/revalidate',
      '/leagues/(.*)',
      '/award-shows/(.*)',
      '/award-shows',
      '/films/(.*)',
      '/browse',
      '/join/(.*)',
      '/rules-and-scoring',
      '/robots.txt',
      '/sitemap.xml',
      '/opengraph-image',
    ]);
  });
});

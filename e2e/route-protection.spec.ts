import { expect, test } from '@playwright/test';

import { discoverRoutes, PUBLIC_ROUTES } from '../test/route-protection';

/**
 * Every route in the app, asked for by a stranger, against a production build.
 *
 * 🔴 **This spec could not exist before the `createRouteMatcher` migration.**
 * Protection lived in `proxy.ts`, and under `E2E_TEST_AUTH=1` that file
 * installed a pass-through with no protection at all (D82/D84) — so no browser
 * test in this repo could ever observe a protected route refusing anybody. The
 * old `proxy.test.ts` said so in as many words, and it was the only guard on
 * several routes because of it. Moving the checks onto the resources moved them
 * somewhere both branches reach, so what the boundary does is now watchable.
 *
 * `test/route-protection.test.ts` is the other half and the two are not
 * redundant: that one reads source and catches a route with no gate written,
 * this one makes requests and catches a gate that is written and does not work
 * — the `if` that never fires, the check placed after the query it was meant to
 * guard, the redirect that goes nowhere.
 *
 * The route list is the same module both halves import, so a route added
 * tomorrow is requested here too, without anybody adding a line.
 */

/**
 * A value for each dynamic segment, and a throw for one nobody has supplied.
 *
 * 🔴 The throw is the point. A new `/teams/[teamId]` page with no sample here
 * fails this spec rather than being skipped, which is the same fail-closed rule
 * the list itself follows: the cost of a forgotten route is a red run, never a
 * quietly untested one.
 *
 * The values need not exist. A public route that 404s still proves it is
 * public — what is under test is whether the request is turned away at the
 * door, and a 404 from the page is the page having answered. Real ids would
 * mean seeding, and seeding would mean this spec could fail for a data reason.
 */
const SAMPLES: Record<string, string> = {
  '[id]': '999999',
  '[abbr]': 'e2e-clerk-nope',
  '[tmdbId]': '999999999',
  '[uuid]': '00000000-0000-0000-0000-000000000000',
  // Catch-alls need at least one segment; optional ones (`[[...x]]`) need none,
  // and the route's real URL is the path without them.
  '[...slug]': 'e2e-clerk-nope',
  '[...notFound]': 'e2e-clerk-no-such-page',
  '[[...login]]': '',
  '[[...register]]': '',
};

function urlFor(route: string): string {
  const url = route
    .split('/')
    .map((segment) => {
      if (!segment.startsWith('[')) return segment;
      const sample = SAMPLES[segment];
      if (sample === undefined) {
        throw new Error(
          `e2e/route-protection.spec.ts has no sample value for the segment ${segment} ` +
            `in ${route}. Add one to SAMPLES so the route is actually requested.`,
        );
      }
      return sample;
    })
    .filter((segment, index) => index === 0 || segment !== '')
    .join('/');
  return url || '/';
}

/**
 * Did the app turn this request away at the door?
 *
 * `maxRedirects: 0` rather than following: the whole question is what the
 * *first* response is, and a followed redirect to a login page that then 500s
 * (Clerk's `<SignIn />` has no provider under `E2E_TEST_AUTH`) would read as a
 * broken app instead of a working gate.
 */
function isSignInRedirect(status: number, location: string | undefined): boolean {
  return status >= 300 && status < 400 && (location ?? '').includes('/auth/login');
}

/**
 * The routes this spec cannot request, and the whole reason it cannot.
 *
 * 🔴 Next serves a nested metadata route at `<dir>/opengraph-image-<hash>`, and
 * the hash changes whenever the card's code does — the old proxy list carried a
 * `(.*)` for exactly this, with a note saying so. There is no stable URL to ask
 * for, and asking for the unhashed one tests the catch-all instead: it matches
 * no route, so it redirects, correctly, and the assertion would be about
 * nothing. (The root card, `/opengraph-image`, is not hashed and is requested
 * like everything else.)
 *
 * So these three are covered by `test/route-protection.test.ts` reading their
 * source and by nothing else, and that is a real gap: a metadata route is a
 * file with no auth in it, which is what public looks like, so the static check
 * cannot tell "public" from "nobody thought about it". Listed by name rather
 * than matched by a pattern, so a fourth entry is a decision somebody makes.
 */
const NOT_REQUESTABLE = new Set([
  '/award-shows/[abbr]/opengraph-image',
  '/films/[tmdbId]/opengraph-image',
  '/how-it-works/opengraph-image',
]);

test.describe('route protection, signed out', () => {
  const routes = discoverRoutes().map((route) => route.path);
  const publicRoutes = routes.filter((route) => PUBLIC_ROUTES.includes(route));
  const protectedRoutes = routes.filter((route) => !PUBLIC_ROUTES.includes(route));

  test('nothing protected is exempt from being asked for', () => {
    // The exemption above is only ever allowed to cover public routes. A
    // protected one that nothing requests is a hole with a comment over it.
    expect(
      [...NOT_REQUESTABLE].filter((route) => !PUBLIC_ROUTES.includes(route)),
    ).toEqual([]);
    // And it may only name routes that exist, or it is quietly excusing a
    // route that has since been renamed into the requested set.
    expect([...NOT_REQUESTABLE].filter((route) => !routes.includes(route))).toEqual([]);
  });

  test('the walk found routes on both sides of the line', () => {
    // 🔴 A loop over an empty list is a green run that asserted nothing, and
    // `discoverRoutes()` reads the filesystem — a path that resolves
    // differently under Playwright than under Vitest would empty both halves
    // and every test below would pass. `test/route-protection.test.ts` pins
    // which routes; this only pins that there are some.
    expect(publicRoutes).toHaveLength(PUBLIC_ROUTES.length);
    expect(protectedRoutes.length).toBeGreaterThan(0);
  });

  for (const route of protectedRoutes) {
    test(`${route} sends a stranger to log in`, async ({ request }) => {
      // The `request` fixture, not `page`: a fresh context per test with no
      // storage state configured anywhere, so it is signed out by construction
      // rather than by remembering to clear a cookie.
      const response = await request.get(urlFor(route), { maxRedirects: 0 });

      expect(
        isSignInRedirect(response.status(), response.headers().location),
        `${route} answered ${response.status()} to a signed-out request instead of ` +
          'redirecting to the login form — it is not in PUBLIC_ROUTES, so it must',
      ).toBe(true);
    });
  }

  for (const route of publicRoutes.filter((route) => !NOT_REQUESTABLE.has(route))) {
    test(`${route} opens for a stranger`, async ({ request }) => {
      const response = await request.get(urlFor(route), { maxRedirects: 0 });

      // Not `toBe(200)`: several of these legitimately answer 404 for the
      // made-up ids above, and that is the page having answered. What may never
      // happen is the door being shut.
      expect(
        isSignInRedirect(response.status(), response.headers().location),
        `${route} is in PUBLIC_ROUTES but turned a signed-out request away`,
      ).toBe(false);
    });
  }
});

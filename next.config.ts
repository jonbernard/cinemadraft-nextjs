import type { NextConfig } from 'next';

/**
 * 🔴 **`data-testid` is the only way a test may target an element, and it must
 * not reach production.**
 *
 * The rule exists because of a real failure: `e2e/browse.spec.ts` located the
 * watched badge by its accessible name, `/Mark .* as watched/`. Marking a film
 * *changes* that name — deliberately, so a screen reader hears the new state — so
 * after the click the locator silently resolved to the **next** film's badge and
 * reported the wrong poster's state. The feature was correct; the test was lying,
 * and it looked exactly like a bug.
 *
 * So a test gets a stable handle and keeps asserting behaviour through roles and
 * accessible names: the *handle* is fixed, the *assertion* is what changes.
 *
 * `reactRemoveProperties` strips the attributes from production builds, because a
 * test hook is not something to ship — it is dead weight in every payload and an
 * invitation to depend on it from outside the test suite.
 *
 * 🔴 The escape hatch is required, not optional. Playwright runs against a
 * **production build** (`playwright.config.mts` runs `npm run build && npm run
 * start`, deliberately, so the specs exercise the real compiled CSS). Stripping
 * unconditionally would remove the attributes from the only build the E2E suite
 * ever sees, and every testid selector would fail. `KEEP_TEST_IDS=1` is set by
 * that `webServer` command and nowhere else.
 */
const keepTestIds = process.env.KEEP_TEST_IDS === '1';

const nextConfig: NextConfig = {
  compiler: {
    // A regex rather than `true`: `true` also strips `data-test` and
    // `data-test-id`, and naming the one attribute the convention allows keeps
    // this honest about what it removes.
    reactRemoveProperties: keepTestIds ? false : { properties: ['^data-testid$'] },
  },

  images: {
    /**
     * Every host the database actually holds a URL for.
     *
     * 🔴 No `search` key anywhere. In the object form, `search: ''` means "the
     * URL must carry no query string" — and Gravatar avatars carry
     * `?s=480&r=pg&d=mp`. Copying the documented example verbatim would reject
     * 51 of the 378 stored avatars, on the member pages only.
     *
     * Avatars are written by the Clerk webhook, not by us, so the shapes here
     * are measured from the restored data rather than chosen.
     */
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org', pathname: '/t/p/**' },
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: 's.gravatar.com' },
      // The phase measured 4 rows, all lh*.googleusercontent.com (Google
      // profile photos). `**` would match any depth of subdomain under a
      // domain that hosts arbitrary user content, and every entry in this
      // list is a target the optimizer proxy will fetch on our behalf — so
      // it stays as narrow as the data that justified adding it.
      { protocol: 'https', hostname: 'lh*.googleusercontent.com' },
      {
        protocol: 'https',
        hostname: '5d9wubvvsbkemktm.public.blob.vercel-storage.com',
        pathname: '/award-shows/**',
      },
    ],
  },

  /**
   * The old rules page, permanently (P18.T0, D101).
   *
   * 🔴 `permanent: true` is a 308, and a 308 is cached by browsers and
   * intermediaries essentially forever — correct here, and a trap anywhere the
   * destination might move again. A year of league chat holds
   * `/rules-and-scoring` links and they have to keep opening.
   *
   * Here rather than as a surviving page or an entry in `proxy.ts` because
   * `redirects` runs *before* Proxy
   * (next/dist/docs/01-app/02-guides/redirecting.md:293), so the stale URL
   * resolves without auth ever seeing it and without a function invocation.
   * That is also why `/rules-and-scoring` no longer needs an `isPublic` entry.
   */
  async redirects() {
    return [
      { source: '/rules-and-scoring', destination: '/how-it-works', permanent: true },
    ];
  },
};

export default nextConfig;

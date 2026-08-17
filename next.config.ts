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
};

export default nextConfig;

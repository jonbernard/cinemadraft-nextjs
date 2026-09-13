import { expect, test } from '@playwright/test';

import { signInAs } from './support/session';

/**
 * The zero-pixel-diff harness for P17.T22.
 *
 * 🔴 Opt-in via `VISUAL=1`, and its baselines are NOT committed. This exists to
 * bracket exactly one commit — the surface rename — by capturing on the commit
 * before it and comparing on the commit after. A committed baseline would turn
 * every deliberate visual change in the phase into a red build, and people
 * would start passing `--update-snapshots` reflexively, which is the same as
 * having no baseline at all.
 *
 * Usage:
 *   # on the commit BEFORE the rename
 *   VISUAL=1 npx playwright test e2e/visual.spec.ts --update-snapshots
 *   # on the commit AFTER
 *   VISUAL=1 npx playwright test e2e/visual.spec.ts
 *
 * 🔴 Read-only against the restored production database. One throwaway account,
 * reused by every signed-in surface, deleted in `afterAll` and verified by
 * count — league 1 is sixty real people's history and `lib/db.test.ts` asserts
 * exactly 60 users against it.
 *
 * 🔴 The plan's version generated `visual-${Date.now()}@example.test` per test
 * and cleaned up nothing. `e2e/global-teardown.ts` only deletes
 * `%+clerk_test@%`, so that would have left 16 rows per run in a restored copy
 * of production and broken `lib/db.test.ts`. This follows the convention
 * `e2e/signed-in.spec.ts` already set: one tagged address, one `afterAll`.
 */
const TAG = 'e2e-p17-visual';

/** The same `pg` route e2e/support/session.ts uses — Playwright cannot resolve `@/`. */
async function withDb<T>(run: (query: Client['query']) => Promise<T>): Promise<T> {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await run(client.query.bind(client) as Client['query']);
  } finally {
    await client.end();
  }
}
type Client = import('pg').Client;

test.afterAll(async () => {
  await withDb(async (query) => {
    await query(`delete from users where email like $1`, [`${TAG}-%@example.test`]);
  });
});

const WIDTHS = [1440, 1280, 1024, 390] as const;
const SCHEMES = ['dark', 'light'] as const;

/** Viewport-only, because `/browse` auto-appends on scroll (D80) and a
 *  full-page height there is not deterministic between runs. */
const SURFACES = [
  { name: 'dashboard', path: '/', full: true, auth: false },
  { name: 'browse', path: '/browse', full: false, auth: false },
  { name: 'award-shows', path: '/award-shows', full: true, auth: false },
  { name: 'film', path: '/films/313369', full: true, auth: false },
  { name: 'league', path: '/leagues/1', full: true, auth: true },
  { name: 'draft-board', path: '/leagues/1/draft', full: true, auth: true },
] as const;

test.describe('the surface rename moves no pixels', () => {
  test.skip(!process.env.VISUAL, 'set VISUAL=1 to capture or compare');
  test.skip(!process.env.TMDB_API_KEY, 'TMDB_API_KEY not configured');

  for (const surface of SURFACES) {
    for (const scheme of SCHEMES) {
      for (const width of WIDTHS) {
        test(`${surface.name} ${scheme} ${width}`, async ({ page }) => {
          if (surface.auth) {
            await signInAs(page, { email: `${TAG}-reader@example.test` });
          }

          // 🔴 The scheme is set in localStorage BEFORE the page loads, not by
          // stamping the attribute afterwards. `app/providers.tsx` mounts MUI's
          // `InitColorSchemeScript`, which runs before paint and writes
          // `data-mui-color-scheme` from storage — so an attribute set between
          // `goto` and hydration is a race the script wins about one time in
          // sixteen. The plan's version did exactly that, and a no-change
          // re-run failed 3 of 48 with whole-page diffs: the baseline was
          // captured light and the comparison rendered dark. A harness that
          // fails without a change cannot certify that a change made none.
          await page.addInitScript((v) => {
            try {
              window.localStorage.setItem('mui-mode', v);
            } catch {
              // Private mode or blocked storage: the belt-and-braces set below
              // still applies, and the assertion catches it if neither did.
            }
          }, scheme);
          await page.emulateMedia({ colorScheme: scheme });
          await page.setViewportSize({ width, height: 1000 });
          await page.goto(surface.path);
          await page.waitForLoadState('networkidle');
          await page.evaluate(
            (v) => document.documentElement.setAttribute('data-mui-color-scheme', v),
            scheme,
          );
          await expect(page.locator('html')).toHaveAttribute(
            'data-mui-color-scheme',
            scheme,
          );

          await expect(page).toHaveScreenshot(`${surface.name}-${scheme}-${width}.png`, {
            fullPage: surface.full,
            // Remote TMDB art is the only genuinely non-deterministic pixel on
            // these pages — a different cached crop, a poster that 404s once.
            // Masking it is what makes a zero-diff claim about *our* CSS.
            mask: [page.locator('img')],
            maxDiffPixels: 0,
            // 🔴 `threshold: 0` as well as `maxDiffPixels: 0`. They are not the
            // same claim: `maxDiffPixels` counts pixels that differ by MORE
            // than `threshold`, whose default is 0.2 in YIQ colour distance.
            // Verified — with the default, changing `--color-bg-raised` from
            // #211c29 to #211c2a passed all 48, so "zero diff pixels" meant
            // "nothing moved by more than a fifth of the colour space". At 0
            // that same one-digit mutation fails 48 of 48.
            threshold: 0,
            animations: 'disabled',
          });
        });
      }
    }
  }
});

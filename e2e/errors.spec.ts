import { expect, test } from '@playwright/test';

/**
 * 🔴 The app had no error boundary at all until Phase 10: an unhandled error
 * in a Server Component showed Next's overlay in development and a **blank
 * page** in production.
 *
 * These run against the production build (`playwright.config.mts` builds and
 * starts it), which is the only place the real behaviour shows — in
 * development Next renders its own overlay instead.
 */
test.describe('failure surfaces', () => {
  test('an unmatched URL sends a logged-out visitor to log in, by design', async ({
    page,
  }) => {
    // 🔴 Skipped whenever the suite's own server is the one under test. Under
    // `E2E_TEST_AUTH` (D82/D84) `proxy.ts` installs a pass-through with no
    // route protection at all, so there is no redirect to observe — the
    // behaviour below is a property of the real proxy, and asserting it
    // against the test-session build would only prove the build is not it.
    // The secret is set by `playwright.config.mts` for exactly those runs.
    test.skip(
      Boolean(process.env.E2E_TEST_AUTH_SECRET),
      'the app under test runs a pass-through proxy (D84)',
    );

    // Not a 404, and deliberately so. The proxy enumerates PUBLIC routes and
    // protects everything else (D45), so a path matching no page is protected
    // like any other unknown path — which is what makes forgetting to list a
    // new page harmless instead of a leak.
    //
    // The cost is that a typo'd URL shows a logged-out visitor a login page
    // rather than "not here". Recorded rather than papered over: the fix would
    // be a public catch-all, which is exactly the fail-open behaviour D45
    // exists to prevent.
    await page.goto('/no-such-page');

    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('a page that exists but has no content gets the app’s own 404', async ({
    page,
  }) => {
    // `/award-shows/*` is public, so this reaches the route and the route
    // decides — which is the path every real 404 in the app takes.
    const response = await page.goto('/award-shows/not-a-show');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Not here' })).toBeVisible();
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
  });

  test('a league that does not exist gets the same treatment', async ({ page }) => {
    // The page calls notFound() deliberately rather than rendering an empty
    // board, because an empty board is a real state for a league nobody has
    // drafted in yet.
    const response = await page.goto('/leagues/999999');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Not here' })).toBeVisible();
  });

  test('the owner-only console 404s for a stranger, revealing nothing', async ({
    page,
  }) => {
    // 404 rather than 403 on purpose: a bounce to login would confirm the
    // league exists and is mid-draft.
    const response = await page.goto('/leagues/1/draft');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Not here' })).toBeVisible();
  });

  test('no page leaks SQL or database internals', async ({ page }) => {
    // The source app returned Postgres errors verbatim on every failing query.
    for (const url of ['/leagues/999999', '/award-shows/nope', '/leagues/1/draft']) {
      await page.goto(url);
      const body = (await page.locator('body').innerText()).toLowerCase();
      expect(body).not.toMatch(/select |from "|column|postgres|prisma|stack/);
    }
  });

  test('an unmatched URL keeps the application, and there is one main', async ({
    page,
  }) => {
    // `/members` and `/live` are directories with a dynamic child and no index,
    // so before P17.T27 they matched no route and fell through to the ROOT
    // not-found — a bare page with no rail, no tab bar and no strip, and one
    // link back out of the product. The status was already 404 then, so the
    // status alone proves nothing here; the rail is what discriminates.
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const url of ['/members', '/live', '/nonsense/deep/path']) {
      const response = await page.goto(url);

      expect(response?.status(), `${url} must answer 404`).toBe(404);
      await expect(
        page
          .getByRole('navigation', { name: 'Main' })
          .getByRole('link', { name: 'Leagues' }),
      ).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Not here' })).toBeVisible();

      // One content landmark, not two. ErrorPanel used to render its own
      // <main> inside AppShell's, on every in-shell 404 and every caught error.
      expect(await page.locator('main').count(), `${url} nests <main>`).toBe(1);
    }
  });

  test('the 404 panel does not repaint the ground inside the shell', async ({ page }) => {
    // ErrorPanel painted `bg-bg-base` — the *ground* — while sitting inside
    // AppShell's `bg-bg-surface` content panel, which punched a hole in it.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/members');

    const colours = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="error-panel"]');
      const main = document.querySelector('main');
      if (!panel || !main) return null;
      return {
        panel: getComputedStyle(panel.parentElement as Element).backgroundColor,
        main: getComputedStyle(main).backgroundColor,
      };
    });
    if (!colours) throw new Error('no panel');

    // Transparent: the host decides the ground.
    expect(colours.panel).toBe('rgba(0, 0, 0, 0)');
    expect(colours.main).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('the 404 panel sits centred in the content column', async ({ page }) => {
    // 🔴 A regression guard, not a proof of P17.T27: the column was already
    // centred by `mx-auto` before this task, and `justify-center` replaces it.
    // It is here so a later edit cannot quietly left-align the panel inside the
    // shell — which is what the 2026-09-12 review reported seeing.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/members');

    const main = await page.locator('main').boundingBox();
    const panel = await page.getByTestId('error-panel').boundingBox();
    if (!main || !panel) throw new Error('no layout');

    // The column caps at max-w-xl (576px); in a ~1100px content column the
    // space either side of it must agree. Measured on the column, never on the
    // heading — the heading is a shrink-to-fit flex item whose right-hand gap
    // is meaningless.
    const left = panel.x - main.x;
    const right = main.x + main.width - (panel.x + panel.width);
    expect(Math.abs(left - right)).toBeLessThan(2);
    expect(panel.width).toBeLessThanOrEqual(576);
  });

  test('the 404 still works on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/members');

    await expect(page.getByRole('heading', { name: 'Not here' })).toBeVisible();
    // Below xl the rail is gone and the tab bar carries navigation.
    await expect(page.getByRole('navigation', { name: 'Primary, mobile' })).toBeVisible();
    // No horizontal overflow: the document is no wider than the viewport.
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  });

  test('the 404 keeps the app’s navigation, so it is not a dead end', async ({
    page,
  }) => {
    // Why `(app)/not-found.tsx` exists as well as the root one: the root file
    // sits outside the shell and renders without a header, stranding whoever
    // mistyped a league id with nowhere to go but the back button.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/leagues/999999');

    await expect(
      page
        .getByRole('navigation', { name: 'Main' })
        .getByRole('link', { name: 'Leagues' }),
    ).toBeVisible();
  });
});

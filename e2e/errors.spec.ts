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
  test('🔴 an unmatched URL sends a logged-out visitor to log in, by design', async ({
    page,
  }) => {
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

  test('🔴 a page that exists but has no content gets the app’s own 404', async ({
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

  test('🔴 the owner-only console 404s for a stranger, revealing nothing', async ({
    page,
  }) => {
    // 404 rather than 403 on purpose: a bounce to login would confirm the
    // league exists and is mid-draft.
    const response = await page.goto('/leagues/1/draft');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Not here' })).toBeVisible();
  });

  test('🔴 no page leaks SQL or database internals', async ({ page }) => {
    // The source app returned Postgres errors verbatim on every failing query.
    for (const url of ['/leagues/999999', '/award-shows/nope', '/leagues/1/draft']) {
      await page.goto(url);
      const body = (await page.locator('body').innerText()).toLowerCase();
      expect(body).not.toMatch(/select |from "|column|postgres|prisma|stack/);
    }
  });

  test('🔴 the 404 keeps the app’s navigation, so it is not a dead end', async ({
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

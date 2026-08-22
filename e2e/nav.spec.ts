import { expect, test } from '@playwright/test';

/**
 * The shell that makes every other page reachable (D67, D75).
 *
 * 🔴 The More sheet's real behaviour — Escape, the focus trap, the inert
 * background — comes from `<dialog>` and can only be proven in a browser.
 * jsdom implements neither `showModal()` nor the focus trap nor `inert`, so
 * `AppShell.test.tsx` and `MoreSheet.test.tsx` assert structure and this file
 * asserts behaviour. Anything provable in jsdom belongs there, not here.
 *
 * 🔴 The rail's breakpoint is `xl` (1280px), not `lg`: `NavRail` is wrapped in
 * `hidden xl:block` and `TabBar`/`MoreSheet` carry `xl:hidden`. 1440px is the
 * desktop side of that line and 390px the phone side, so each viewport below
 * renders exactly one of the two navigations visibly — both are always in the
 * DOM, which is why every locator here is scoped to a named landmark.
 *
 * Accessible names are the contract, hard-coded on purpose: the rail is
 * `Main`, the tab bar is `Primary, mobile`, the sheet is `More`. They differ
 * because both navigations coexist in the DOM and identical names would make
 * the landmark list ambiguous.
 *
 * Signed out throughout: the dashboard and league boards are public (D44), and
 * a visitor on a shared link must be able to move around.
 */
test.describe('navigation', () => {
  const DESKTOP = { width: 1440, height: 900 };
  const PHONE = { width: 390, height: 844 };

  test('desktop shows the rail and hides the tab bar', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');

    const rail = page.getByRole('navigation', { name: 'Main' });
    await expect(rail.getByRole('link', { name: 'Leagues' })).toBeVisible();
    await expect(rail.getByRole('link', { name: 'Browse' })).toBeVisible();

    // Both navigations are in the DOM at every width; only CSS decides. The
    // tab bar and its More trigger belong to the phone layout, so at 1440px
    // the media query must be hiding them — a fact jsdom cannot show.
    await expect(page.getByRole('navigation', { name: 'Primary, mobile' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'More', exact: true })).toBeHidden();
  });

  test('the rail is 208px wide', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');

    // 🔴 208px, not the spec's 236px: Task 18 measured the wider rail's cost
    // to a 10-seat league board at 1280px and narrowed it. Rendered width is
    // the only place that number is real.
    const box = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
    expect(box?.width).toBe(208);
  });

  test('marks the current page', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/award-shows');

    const current = page
      .getByRole('navigation', { name: 'Main' })
      .locator('[aria-current="page"]');
    await expect(current).toHaveText(/Award shows/);
  });

  test('phone shows bottom tabs with labels, and no rail', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    const tabs = page.getByRole('navigation', { name: 'Primary, mobile' });
    await expect(tabs.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(tabs.getByRole('link', { name: 'Award shows' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'More', exact: true })).toBeVisible();

    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
  });

  test('a tab navigates and the active tab moves with it', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    const tabs = page.getByRole('navigation', { name: 'Primary, mobile' });
    await expect(tabs.locator('[aria-current="page"]')).toHaveText(/Home/);

    await tabs.getByRole('link', { name: 'Award shows' }).click();

    await expect(page).toHaveURL(/\/award-shows/);
    await expect(tabs.locator('[aria-current="page"]')).toHaveText(/Award shows/);
  });

  test('🔴 the More sheet opens, and Escape closes it', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    const trigger = page.getByRole('button', { name: 'More', exact: true });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();
    const sheet = page.getByRole('dialog', { name: 'More' });
    await expect(sheet).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Native <dialog> behaviour, which is the reason it is one. The trigger's
    // aria-expanded follows because AppShell listens for the `close` event
    // rather than only flipping state in its own click handler.
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('🔴 the More sheet traps focus while it is open', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');
    await page.getByRole('button', { name: 'More', exact: true }).click();

    // Tab well past the number of controls inside; focus must never escape to
    // the page behind. That is the property a hand-rolled sheet gets wrong.
    for (let i = 0; i < 12; i += 1) await page.keyboard.press('Tab');

    const insideSheet = await page.evaluate(() => {
      const dialog = document.querySelector('dialog[aria-label="More"]');
      return dialog?.contains(document.activeElement) ?? false;
    });
    expect(insideSheet).toBe(true);
  });

  test('🔴 the background is inert while the More sheet is open', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'More' })).toBeVisible();

    // showModal() makes everything outside the top layer inert, and inert
    // content cannot take focus — not even when script asks for it directly.
    // If the sheet were a plain div with a hand-rolled overlay this would
    // move focus behind the sheet and nothing on screen would look wrong.
    const result = await page.evaluate(() => {
      const link = document.querySelector<HTMLElement>(
        'nav[aria-label="Primary, mobile"] a',
      );
      if (!link) return { found: false, focused: false };
      link.focus();
      return { found: true, focused: document.activeElement === link };
    });
    // Without this the whole assertion would pass on a missing element.
    expect(result.found).toBe(true);
    expect(result.focused).toBe(false);
  });

  test('the More sheet holds the yours destinations, the theme and the account control', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');
    await page.getByRole('button', { name: 'More', exact: true }).click();

    const sheet = page.getByRole('dialog', { name: 'More' });
    await expect(sheet).toBeVisible();

    // 🔴 `/list` is the first `yours` page to exist (P10.T20), so the group and
    // its heading are no longer gated away. The other two are still
    // `ready: false` and the sheet filters on that flag rather than linking at
    // a 404 — which is what makes their absence here an assertion rather than
    // an omission. When T19 and T24 ship, this count moves again.
    await expect(sheet.getByText('Yours')).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Draft list' })).toHaveAttribute(
      'href',
      '/list',
    );
    await expect(sheet.getByRole('link', { name: 'Watchlist' })).toHaveCount(0);
    await expect(sheet.getByRole('link', { name: 'Rules & scoring' })).toHaveCount(0);

    // The destination and the account control; the theme toggle is a button.
    await expect(sheet.getByRole('link')).toHaveCount(2);
    await expect(sheet.getByRole('link', { name: 'Log in' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: /theme/i })).toBeVisible();
  });

  test('🔴 the tab bar does not cover the bottom of the page', async ({ page }) => {
    await page.setViewportSize(PHONE);
    // Not `/`: the signed-out dashboard is shorter than a phone viewport, so
    // it never scrolls and the assertion below would be true by accident.
    // /award-shows is long enough on a 390px phone to reach the worst case.
    await page.goto('/award-shows');

    const bar = page.getByRole('navigation', { name: 'Primary, mobile' });
    await expect(bar).toBeVisible();
    const barBox = await bar.boundingBox();
    expect(barBox).not.toBeNull();

    // The bar is fixed to the bottom, so the worst case is the page scrolled
    // all the way down: whatever `main` renders last has to sit above the
    // bar's top edge. `Panel`'s bottom padding is what reserves that room —
    // measuring it here is the gate on AppShell's `pb-[calc(4rem+...)]`,
    // which no amount of arithmetic can settle.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

    // 🔴 `.first()` rather than `getByRole('main')`: `/award-shows` and
    // `/browse` still render a `<main>` of their own inside the shell's, so
    // the role locator is ambiguous there. The outer one is the shell's, which
    // is the box whose padding this test is about. Reported to the controller;
    // the page sweep owns removing the inner landmark, not this spec.
    const geometry = await page
      .locator('main')
      .first()
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const padding = Number.parseFloat(getComputedStyle(element).paddingBottom);
        return {
          contentBottom: rect.bottom - padding,
          padding,
          scrolled: window.scrollY,
        };
      });

    // Without this the two assertions below could both pass on a page that
    // fits the viewport, which proves nothing about being covered.
    expect(geometry.scrolled).toBeGreaterThan(0);

    // Viewport coordinates on both sides, taken after the scroll.
    const barTop = (await bar.boundingBox())?.y ?? 0;
    expect(geometry.contentBottom).toBeLessThanOrEqual(barTop + 1);

    // And the reservation itself, stated directly: the padding must be at
    // least as tall as the bar. Chromium on a desktop viewport reports
    // `env(safe-area-inset-bottom)` as 0, so this proves the 4rem term of the
    // calc, not the inset term — a real device is the only place the inset is
    // non-zero.
    expect(geometry.padding).toBeGreaterThanOrEqual(barBox?.height ?? 0);
  });
});

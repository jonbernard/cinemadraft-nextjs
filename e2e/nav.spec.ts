import { expect, test } from '@playwright/test';

/**
 * The shell that makes every other page reachable.
 *
 * 🔴 The drawer's real behaviour — Escape, the focus trap, the inert
 * background — comes from `<dialog>` and can only be proven in a browser.
 * jsdom implements neither `showModal()` nor the focus trap, so the component
 * test asserts structure and this asserts behaviour.
 *
 * Signed out throughout: the dashboard and league boards are public (D44), and
 * a visitor on a shared link must be able to move around.
 */
test.describe('navigation', () => {
  test('desktop shows the destinations inline', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Leagues' })).toBeVisible();
    // The drawer trigger belongs to the phone layout.
    await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeHidden();
  });

  test('🔴 phone opens a drawer, and Escape closes it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const trigger = page.getByRole('button', { name: 'Menu', exact: true });
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();
    const drawer = page.getByRole('dialog', { name: 'Main menu' });
    await expect(drawer).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Native <dialog> behaviour, which is the reason it is one.
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('🔴 the drawer traps focus while it is open', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu', exact: true }).click();

    // Tab well past the number of controls inside; focus must never escape to
    // the page behind. That is the property a hand-rolled drawer gets wrong.
    for (let i = 0; i < 12; i += 1) await page.keyboard.press('Tab');

    const insideDrawer = await page.evaluate(() => {
      const dialog = document.querySelector('dialog[aria-label="Main menu"]');
      return dialog?.contains(document.activeElement) ?? false;
    });
    expect(insideDrawer).toBe(true);
  });

  test('choosing a destination navigates and closes the drawer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu', exact: true }).click();

    const drawer = page.getByRole('dialog', { name: 'Main menu' });
    await drawer.getByRole('link', { name: 'Award shows' }).click();

    await expect(page).toHaveURL(/\/award-shows/);
    await expect(drawer).toBeHidden();
  });

  test('marks the current page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/award-shows');

    const current = page
      .getByRole('navigation', { name: 'Main' })
      .locator('[aria-current="page"]');
    await expect(current).toHaveText(/Award shows/);
  });
});

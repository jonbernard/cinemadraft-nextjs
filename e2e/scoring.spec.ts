import { expect, test } from '@playwright/test';

/**
 * 🔴 The Phase 9 gate, in a browser: a real score on screen, and its
 * explanation one interaction away that adds up to it (§6.7).
 *
 * Signed out, deliberately — the league board is public (D44), and the ledger
 * is part of what a shared link shows. No Clerk keys needed, so this runs
 * everywhere.
 *
 * Reads league 1's real 2025 season rather than seeding a scratch league: this
 * spec only reads, and the value of using the restored data is that the
 * numbers on screen are the numbers sixty people actually played for.
 */
const LEAGUE = 1;
const YEAR = 2025;

test.describe('points ledger', () => {
  test('🔴 a pick’s points explain themselves, and the lines add up', async ({
    page,
  }) => {
    await page.goto(`/leagues/${LEAGUE}?year=${YEAR}`);

    // League 1's 2025 season drafts in four groups, so the page renders four
    // boards. The first is enough — they share a component.
    const board = page.getByRole('table').first();
    await expect(board).toBeVisible();

    // The first pick that actually scored something — a zero-point film has
    // nothing to explain and renders a bare number by design.
    const expanders = board.getByRole('group');
    await expect(expanders.first()).toBeVisible();

    const ledger = expanders.first();
    const summary = ledger.locator('summary');
    const total = Number((await summary.innerText()).match(/\d+/)?.[0] ?? '0');
    expect(total).toBeGreaterThan(0);

    await summary.click();
    await expect(ledger).toHaveAttribute('open', '');

    // Every leaf line — an award, not an award-show group.
    const lines = ledger.locator('li ul li');
    await expect(lines.first()).toBeVisible();

    const values = await lines.evaluateAll((nodes) =>
      nodes.map((node) => Number(node.textContent?.match(/(\d+)\s*$/)?.[1] ?? 0)),
    );
    expect(values.length).toBeGreaterThan(0);
    expect(values.reduce((sum, value) => sum + value, 0)).toBe(total);
  });

  test('🔴 opens from the keyboard', async ({ page }) => {
    // jsdom cannot toggle a <details> with Enter, so this is the only place
    // the keyboard path is actually proven.
    await page.goto(`/leagues/${LEAGUE}?year=${YEAR}`);

    const ledger = page.getByRole('table').first().getByRole('group').first();
    await ledger.locator('summary').focus();
    await page.keyboard.press('Enter');

    await expect(ledger).toHaveAttribute('open', '');
  });

  test('a win is named, not just coloured', async ({ page }) => {
    await page.goto(`/leagues/${LEAGUE}?year=${YEAR}`);

    const board = page.getByRole('table').first();
    // Open several ledgers; some film in a league's season has won something.
    const expanders = board.getByRole('group');
    const count = Math.min(await expanders.count(), 8);
    for (let index = 0; index < count; index += 1) {
      await expanders.nth(index).locator('summary').click();
    }

    await expect(board.getByText('· won').first()).toBeVisible();
  });
});

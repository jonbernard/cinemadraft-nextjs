import { expect, test } from '@playwright/test';

import { signInAs } from './support/session';

const TAG = 'e2e-p17';

/**
 * The signed-in surfaces (P17.T27–T36).
 *
 * 🔴 Everything here that needs data creates its own, prefixed `e2e-p17`, and
 * deletes it in `afterAll`. The database is a restored copy of production:
 * league 1 is sixty real people's history and `lib/db.test.ts` asserts exact
 * row counts against it.
 *
 * Geometry and viewport assertions live here rather than in jsdom on purpose.
 * jsdom resolves no media query and returns zeroed rects, so the defects this
 * phase is fixing were all invisible to the component suite.
 */

/** The same `pg` route `e2e/support/session.ts` uses — Playwright cannot resolve `@/`. */
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

test.describe('signed-in surfaces', () => {
  test('🔴 the active season cannot be changed without confirming', async ({ page }) => {
    // 🔴 This test never accepts the confirmation, so it never writes. The
    // scratch account is promoted to admin rather than skipping — a skipped
    // safety test is not a safety test — and deleted in afterAll.
    const id = await signInAs(page, {
      email: `${TAG}-admin@example.test`,
      firstName: 'Admin',
    });
    await withDb((query) => query(`update users set role = 'admin' where id = $1`, [id]));

    const before = await withDb(async (query) => {
      const { rows } = await query<{ year: number }>(
        `select year from available_years where is_active = true`,
      );
      return rows[0]?.year ?? null;
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/season');
    await expect(page.getByRole('heading', { name: 'Active season' })).toBeVisible();

    // One control, not one trigger per season. Ten adjacent "Make active"
    // buttons a few pixels apart was the defect.
    // Scoped to the content landmark: the shell's chrome (search, More) are
    // buttons too, and counting those would make this pass at any count.
    const buttons = page.locator('main').getByRole('button');
    await expect(buttons).toHaveCount(1);
    const commit = buttons.first();
    const box = await commit.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    // The blast radius is on the page as well as in the dialog.
    await expect(page.getByText(/re-scopes every league/i)).toBeVisible();

    const select = page.getByLabel(/season/i);
    const other = (await select.locator('option').allTextContents()).find(
      (text) => !text.includes('active'),
    );
    if (!other) throw new Error('the corpus has only one season');

    let dialogMessage: string | null = null;
    page.once('dialog', (dialog) => {
      dialogMessage = dialog.message();
      void dialog.dismiss();
    });

    await select.selectOption({ label: other });
    await commit.click();

    expect(dialogMessage, 'pressing commit must raise a confirmation').not.toBeNull();
    expect(dialogMessage).toContain(other.trim());
    expect(dialogMessage).toMatch(/\d+ (person|people)/);
    expect(dialogMessage).toMatch(/cannot be undone/i);

    // Declining changes nothing — in the UI, and in the table.
    await expect(page.getByText(/is now the active season/)).toHaveCount(0);
    const after = await withDb(async (query) => {
      const { rows } = await query<{ year: number }>(
        `select year from available_years where is_active = true`,
      );
      return rows[0]?.year ?? null;
    });
    expect(after).toBe(before);
  });
});

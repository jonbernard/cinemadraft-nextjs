import { expect, test } from '@playwright/test';

import { signInAs } from './support/session';

/**
 * The admin starts the next season, and a league owner is offered it (D138,
 * D131): the join between `/admin/season` and `open-season.spec.ts`, which
 * proves what happens after the offer.
 *
 * 🔴 **This spec flips the site's active season**, the one global every other
 * spec reads. It therefore runs in its own Playwright project that depends on
 * `chromium` (`playwright.config.mts`), so it starts only after every other
 * spec has finished, and puts the flag back in `finally`. It deletes the new
 * season's row only if it created it.
 *
 * Playwright runs a dependency project in full whatever file is named, so to
 * run this spec on its own pass `--no-deps`:
 *   npx playwright test e2e/season-rollover.spec.ts --no-deps
 */
const TAG = 'e2e-season-rollover';

async function withDb<T>(
  fn: (query: (sql: string, params?: unknown[]) => Promise<unknown[]>) => Promise<T>,
): Promise<T> {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(async (sql, params) => (await client.query(sql, params)).rows);
  } finally {
    await client.end();
  }
}

async function cleanup(): Promise<void> {
  await withDb(async (query) => {
    await query(
      'delete from drafts where league_id in (select id from leagues where name like $1)',
      [`${TAG}%`],
    );
    await query('delete from leagues where name like $1', [`${TAG}%`]);
    await query(`delete from users where email like '${TAG}-%@example.test'`);
  });
}

const activeYear = () =>
  withDb(async (query) => {
    const [row] = (await query('select year from available_years where is_active')) as {
      year: number;
    }[];
    return row?.year ?? null;
  });

test.describe('starting the next season', () => {
  test.beforeAll(cleanup);
  test.afterAll(cleanup);

  test('the admin starts it, and a league owner is offered "Open <year>"', async ({
    page,
    browser,
  }) => {
    const year = await activeYear();
    if (year == null) throw new Error('no active season; run scripts/seed-e2e.mjs');
    const next = year + 1;
    const [existing] = (await withDb((query) =>
      query('select id from available_years where year = $1', [next]),
    )) as { id: number }[];

    const adminId = await signInAs(page, { email: `${TAG}-admin@example.test` });
    const ownerContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    const ownerId = await signInAs(owner, {
      email: `${TAG}-owner@example.test`,
      firstName: 'Olive',
    });

    // A league whose newest season is the active one, drafted and finished.
    const leagueId = await withDb(async (query) => {
      await query(`update users set role = 'admin' where id = $1`, [adminId]);
      const [league] = (await query(
        `insert into leagues (name, owner, uuid, active_year, drafting_status, created_at, updated_at)
           values ($1, $2, gen_random_uuid(), $3, 'complete', now(), now()) returning id`,
        [`${TAG} league`, JSON.stringify([ownerId]), year],
      )) as { id: number }[];
      await query(
        `insert into drafts (league_id, user_id, year, "group", "order", created_at, updated_at)
           values ($1, $2, $3, 1, 1, now(), now())`,
        [league?.id, ownerId, year],
      );
      return league?.id as number;
    });

    try {
      // Before: the owner's league is on the active season, with nothing to open.
      await owner.goto(`/leagues/${leagueId}`);
      await expect(owner.getByText(`${year} · complete`)).toBeVisible();
      await expect(owner.getByRole('button', { name: `+ Open ${next}` })).toHaveCount(0);

      // The admin starts it, through the confirmation.
      await page.goto('/admin/season');
      await page
        .locator('main')
        .getByRole('button', { name: `Start the ${next} season` })
        .click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText(`Start the ${next} season?`);
      await dialog.getByRole('button', { name: `Start ${next}` }).click();
      await expect(page.getByText(`${next} is now the active season`)).toBeVisible();
      expect(await activeYear()).toBe(next);

      // After: the owner is offered the new season on the same league.
      await owner.goto(`/leagues/${leagueId}`);
      await expect(
        owner.getByRole('heading', { name: `Open the ${next} season` }),
      ).toBeVisible();
    } finally {
      await ownerContext.close();
      await withDb(async (query) => {
        await query('update available_years set is_active = false where is_active');
        await query('update available_years set is_active = true where year = $1', [
          year,
        ]);
        if (!existing) await query('delete from available_years where year = $1', [next]);
      });
    }
  });
});

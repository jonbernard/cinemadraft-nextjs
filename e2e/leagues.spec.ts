import { expect, type Page, test } from '@playwright/test';

import { signInAs } from './support/session';

/**
 * 🔴 The Batch B gate: a league can come into existence and someone else can
 * join it. Until this shipped, no new league could be created at all.
 *
 * Everything is scratch data the test creates. Two throwaway identities are
 * needed — the whole point is that a *second* person follows the link — and
 * both are seeded directly: the app under test boots with no Clerk at all
 * (D82/D84), so the session comes from `signInAs` rather than a sign-up flow.
 * What is being proven is the invite, not how either person got an account.
 */
const TAG = 'e2e-league';

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
    // Scoped to this spec's own prefix — the other specs seed identities of
    // their own, and a blanket delete takes one of them mid-flow.
    await query(`delete from users where email like '${TAG}-%@example.test'`);
  });
}

/** Seat a throwaway identity in this browser context. */
async function register(page: Page): Promise<void> {
  const address = `${TAG}-${Date.now()}-${Math.floor(performance.now())}@example.test`;
  await signInAs(page, { email: address, firstName: 'Member' });
}

/** Seats in the scratch league, as the database has them. */
async function seats() {
  return withDb(async (query) =>
    query(
      `select d.user_id from drafts d
         join leagues l on l.id = d.league_id
        where l.name like $1`,
      [`${TAG}%`],
    ),
  ) as Promise<{ user_id: number | null }[]>;
}

test.describe('leagues', () => {
  // Serial: `seats()` counts every seat matching the tag, so a second test
  // creating its own league alongside would change the number under the first.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(cleanup);

  test.afterAll(cleanup);

  test('🔴 create a league, then someone else joins by the link', async ({
    page,
    browser,
  }) => {
    await register(page);

    // Create.
    await page.goto('/leagues/new');
    await page.getByLabel('League name').fill(`${TAG} night`);
    await page.getByRole('button', { name: 'Create league' }).click();

    await expect(page).toHaveURL(/\/leagues\/\d+/);
    await expect(page.getByRole('heading', { name: `${TAG} night` })).toBeVisible();

    // 🔴 The creator is seated, or the league is half-created.
    expect(await seats()).toHaveLength(1);

    // The invite is on the page, for the owner.
    const invite = page.locator('code', { hasText: '/join/' });
    await expect(invite).toBeVisible();
    const url = (await invite.innerText()).trim();
    expect(url).toMatch(/\/join\/[0-9a-f-]{36}$/i);

    // It appears in the creator's league list, rather than redirecting away.
    await page.goto('/leagues');
    await expect(
      page.getByRole('link', { name: new RegExp(`${TAG} night`) }),
    ).toBeVisible();
    await expect(page.getByText('You run this one')).toBeVisible();

    // A second person, in their own browser context.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    try {
      const path = new URL(url).pathname;

      // Logged out, the invite names the league rather than demanding a login.
      await otherPage.goto(path);
      await expect(
        otherPage.getByRole('heading', { name: new RegExp(`${TAG} night`) }),
      ).toBeVisible();
      await expect(otherPage.getByRole('link', { name: 'Register' })).toBeVisible();

      await register(otherPage);
      await otherPage.goto(path);

      // 🔴 Loading the invite does not join — a Slack unfurl or a prefetch
      // would otherwise seat whoever pasted the link.
      expect(await seats()).toHaveLength(1);

      await otherPage.getByRole('button', { name: 'Join this league' }).click();
      await expect(otherPage).toHaveURL(/\/leagues\/\d+/);
      expect(await seats()).toHaveLength(2);

      // 🔴 Following the link again says so, and creates no second seat.
      await otherPage.goto(path);
      await expect(otherPage.getByText('You are already in this league')).toBeVisible();
      expect(await seats()).toHaveLength(2);

      // A member who does not own the league is not shown the invite.
      await expect(otherPage.locator('code', { hasText: '/join/' })).toHaveCount(0);
    } finally {
      await other.close();
    }
  });

  test('an unknown invite 404s', async ({ page }) => {
    await register(page);

    const response = await page.goto('/join/00000000-0000-4000-8000-000000000000');

    expect(response?.status()).toBe(404);
  });
});

import { expect, type Page, test } from '@playwright/test';

import { signInAs } from './support/session';

/**
 * 🔴 The Batch C gate: an owner can arrange a season and open the draft, and
 * nobody else can touch any of it.
 *
 * Scratch league throughout — this writes seats and statuses, and league 1 is
 * sixty people's real history.
 *
 * Signed in through the test session rather than Clerk (D82/D84): the app under
 * test boots with no Clerk at all, so a sign-up flow here would be typing into
 * a widget that is not on the page. What this spec is about — who may arrange a
 * season — is unchanged by how the person got a session.
 */
const TAG = 'e2e-season';

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

/**
 * Seat a throwaway identity in this browser context.
 *
 * A fresh address every call: two of the tests below need a *second* person,
 * and reusing one would make "somebody else's league" mean "my own".
 */
async function register(page: Page): Promise<void> {
  const address = `${TAG}-${Date.now()}-${Math.floor(performance.now())}@example.test`;
  await signInAs(page, { email: address, firstName: 'Owner' });
}

/** Create a league through the UI and return its id. */
async function createLeague(page: Page): Promise<number> {
  await page.goto('/leagues/new');
  await page.getByLabel('League name').fill(`${TAG} setup`);
  await page.getByRole('button', { name: 'Create league' }).click();
  await expect(page).toHaveURL(/\/leagues\/\d+/);
  return Number(new URL(page.url()).pathname.split('/')[2]);
}

const seats = (leagueId: number) =>
  withDb(async (query) =>
    query('select id, user_id, dummy_name, "group" from drafts where league_id = $1', [
      leagueId,
    ]),
  ) as Promise<
    {
      id: number;
      user_id: number | null;
      dummy_name: string | null;
      group: number | null;
    }[]
  >;

const statusOf = (leagueId: number) =>
  withDb(async (query) =>
    query('select drafting_status from leagues where id = $1', [leagueId]),
  ) as Promise<{ drafting_status: string }[]>;

test.describe('season setup', () => {
  // Serial: every test here works on a league matching the same tag, and the
  // teardown clears the tag wholesale.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(cleanup);

  test.afterAll(cleanup);

  test('🔴 the owner seats a placeholder, deals groups and opens the draft', async ({
    page,
  }) => {
    await register(page);
    const leagueId = await createLeague(page);

    await page.goto(`/leagues/${leagueId}/setup`);
    await expect(page.getByRole('heading', { name: `${TAG} setup` })).toBeVisible();

    // A placeholder — 17 of these exist in production.
    await page.getByLabel(/without an account/i).fill('Celebrity Guest');
    await page.getByRole('button', { name: 'Add seat' }).click();
    await expect(page.getByText('Celebrity Guest seated')).toBeVisible();
    await expect.poll(async () => (await seats(leagueId)).length).toBe(2);

    // 🔴 The draft cannot open while everyone is ungrouped: the board groups
    // by `group`, and all-null collapses into one group of everybody.
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Start the draft' }).click();
    await expect(page.getByText(/set up the groups/i)).toBeVisible();
    expect((await statusOf(leagueId))[0]?.drafting_status).toBe('pending');

    // Deal, then open.
    await page.getByRole('button', { name: 'Deal at random' }).click();
    await expect(page.getByText(/dealt into groups/i)).toBeVisible();
    await expect
      .poll(async () => (await seats(leagueId)).every((seat) => seat.group != null))
      .toBe(true);

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Start the draft' }).click();
    await expect(page.getByText('The draft is open')).toBeVisible();
    expect((await statusOf(leagueId))[0]?.drafting_status).toBe('active');

    // 🔴 Arrangement controls disappear once it is open.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Deal at random' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Start the draft' })).toHaveCount(0);
  });

  test('🔴 a member cannot reach the setup page for a league they do not own', async ({
    page,
    browser,
  }) => {
    await register(page);
    const leagueId = await createLeague(page);

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    try {
      await register(otherPage);

      // 404 rather than a bounce to login: it must not confirm the league
      // exists or that it is being set up.
      const response = await otherPage.goto(`/leagues/${leagueId}/setup`);
      expect(response?.status()).toBe(404);
    } finally {
      await other.close();
    }
  });

  test('assigning a group with the keyboard alone', async ({ page }) => {
    // The reason group assignment is a select rather than drag-and-drop.
    await register(page);
    const leagueId = await createLeague(page);
    await page.goto(`/leagues/${leagueId}/setup`);

    const select = page.getByRole('combobox').first();
    await select.focus();
    await select.selectOption('1');

    await expect.poll(async () => (await seats(leagueId))[0]?.group).toBe(1);
  });
});

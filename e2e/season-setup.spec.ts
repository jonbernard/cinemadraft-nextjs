import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * 🔴 The Batch C gate: an owner can arrange a season and open the draft, and
 * nobody else can touch any of it.
 *
 * Scratch league throughout — this writes seats and statuses, and league 1 is
 * sixty people's real history.
 */
const TAG = 'e2e-season';

const hasClerk = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

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
    await query("delete from users where email like 'e2e_season_%+clerk_test@%'");
  });
}

async function register(page: Page): Promise<void> {
  await setupClerkTestingToken({ page });
  const address = `e2e_season_${Date.now()}_${Math.floor(performance.now())}+clerk_test@example.com`;

  await page.goto('/auth/register');
  await page.getByLabel(/email address/i).fill(address);
  const codeSent = page.waitForResponse(
    (response) => response.url().includes('prepare_verification') && response.ok(),
    { timeout: 20_000 },
  );
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await codeSent;
  await page.getByRole('textbox', { name: /verification code/i }).fill('424242');
  await expect(page).not.toHaveURL(/\/auth\/register/, { timeout: 20_000 });
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
  test.skip(!hasClerk, 'Clerk keys not configured');
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await clerkSetup();
    await cleanup();
  });

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

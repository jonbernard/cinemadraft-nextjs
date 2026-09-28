import { type Browser, expect, type Page, test } from '@playwright/test';

import { signInAs } from './support/session';

/**
 * Opening the next season (P16.T5, D131), in a production build on CI's data.
 *
 * 🔴 **No global flip.** The site's active year is shared by every spec running
 * in parallel, so this never touches it. It reads the active year instead and
 * seeds a league whose only season is the one before, which makes the active
 * year exactly that league's newest + 1: the state in which an owner may open.
 *
 * Scratch league and identities throughout, deleted by `TAG`.
 */
const TAG = 'e2e-open-season';

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

const address = (role: string) =>
  `${TAG}-${role}-${Date.now()}-${Math.floor(performance.now())}@example.test`;

/**
 * A league that played last season and has not opened this one: the owner,
 * one member and one character, seated in `previous`, and the draft finished.
 */
async function seedLeague(page: Page) {
  const [active] = (await withDb((query) =>
    query('select year from available_years where is_active'),
  )) as { year: number }[];
  if (!active) throw new Error('no active season; run scripts/seed-e2e.mjs');
  const year = active.year;
  const previous = year - 1;

  const ownerId = await signInAs(page, { email: address('owner'), firstName: 'Olive' });
  const member = { email: address('member'), firstName: 'Mina', lastName: 'Park' };

  const leagueId = await withDb(async (query) => {
    const [memberRow] = (await query(
      `insert into users (uuid, email, first_name, last_name, created_at, updated_at)
         values (gen_random_uuid(), $1, $2, $3, now(), now()) returning id`,
      [member.email, member.firstName, member.lastName],
    )) as { id: number }[];
    const [league] = (await query(
      `insert into leagues (name, owner, uuid, active_year, drafting_status, created_at, updated_at)
         values ($1, $2, gen_random_uuid(), $3, 'complete', now(), now()) returning id`,
      [`${TAG} league`, JSON.stringify([ownerId]), previous],
    )) as { id: number }[];
    for (const [userId, order] of [
      [ownerId, 1],
      [memberRow?.id, 2],
    ]) {
      await query(
        `insert into drafts (league_id, user_id, year, "group", "order", created_at, updated_at)
           values ($1, $2, $3, 1, $4, now(), now())`,
        [league?.id, userId, previous, order],
      );
    }
    await query(
      `insert into drafts (league_id, year, "group", "order", dummy, dummy_name, created_at, updated_at)
         values ($1, $2, 1, 3, true, 'Neo', now(), now())`,
      [league?.id, previous],
    );
    return league?.id as number;
  });

  return { leagueId, year, previous, member };
}

const seatCount = (leagueId: number, year: number) =>
  withDb(async (query) => {
    const [row] = (await query(
      'select count(*)::int as n from drafts where league_id = $1 and year = $2',
      [leagueId, year],
    )) as { n: number }[];
    return row?.n;
  });

async function noSidewaysScroll(page: Page): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(0);
}

async function stranger(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

test.describe('opening the next season', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(cleanup);
  test.afterAll(cleanup);

  test('the owner opens an empty season and re-seats people one tap each; nobody else can', async ({
    page,
    browser,
  }) => {
    const { leagueId, year, previous, member } = await seedLeague(page);
    const outsider = await stranger(browser);
    const notice = (reader: Page) =>
      expect(
        reader.getByRole('heading', {
          name: `The ${year} season hasn’t been set up yet`,
        }),
      ).toBeVisible();

    try {
      // Before it is opened, a stranger reads a notice in place of the board,
      // and neither page offers them the act.
      await outsider.page.goto(`/leagues/${leagueId}`);
      await notice(outsider.page);
      await expect(
        outsider.page.getByRole('link', { name: `See ${previous}` }),
      ).toHaveAttribute('href', `/leagues/${leagueId}/${previous}`);
      await expect(outsider.page.getByRole('button', { name: /Open/ })).toHaveCount(0);
      await noSidewaysScroll(outsider.page);
      await outsider.page.goto(`/leagues/${leagueId}/${previous}`);
      await expect(
        outsider.page.getByText(`${member.firstName} ${member.lastName}`).first(),
      ).toBeVisible();
      await expect(outsider.page.getByRole('button', { name: /Open/ })).toHaveCount(0);

      // The owner, on the unopened season: the act is the panel, in place of the board.
      await page.goto(`/leagues/${leagueId}`);
      await expect(
        page.getByRole('heading', { name: `Open the ${year} season` }),
      ).toBeVisible();
      await noSidewaysScroll(page);

      // From the finished season's page it is the Seasons nav's last entry.
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/leagues/${leagueId}/${previous}`);
      await page
        .getByRole('navigation', { name: 'Seasons' })
        .getByRole('button', { name: `+ Open ${year}` })
        .click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText('It starts empty');
      await dialog.getByRole('button', { name: `Open ${year}` }).click();

      await page.waitForURL(`**/leagues/${leagueId}/setup?year=${year}`);
      expect(await seatCount(leagueId, year)).toBe(0);

      // Opened but empty: the stranger still reads the notice, not an empty board.
      await outsider.page.goto(`/leagues/${leagueId}`);
      await notice(outsider.page);
      await expect(outsider.page.getByRole('button', { name: /Open/ })).toHaveCount(0);

      // Setup opens on nobody, with everyone from before one tap away (P16.T6).
      const playing = page.locator('section', {
        has: page.getByRole('heading', { name: 'Who is playing' }),
      });
      await expect(playing.getByRole('listitem')).toHaveCount(0);
      const earlier = page.getByRole('list', { name: 'From earlier seasons' });
      await expect(earlier.getByRole('listitem')).toHaveCount(3);
      const memberName = `${member.firstName} ${member.lastName}`;
      await earlier.getByRole('button', { name: `Add ${memberName}` }).click();
      await expect(earlier.getByText(memberName)).toHaveCount(0);
      await earlier.getByRole('button', { name: 'Add Neo' }).click();
      await expect(earlier.getByText('Neo')).toHaveCount(0);

      const memberRow = playing.getByRole('listitem').filter({ hasText: memberName });
      await expect(memberRow).toBeVisible();
      await expect(memberRow).not.toContainText('not registered');
      await expect(
        playing.getByRole('listitem').filter({ hasText: 'Neo' }),
      ).toContainText('character');
      expect(await seatCount(leagueId, year)).toBe(2);
      await noSidewaysScroll(page);
      await page.setViewportSize({ width: 1440, height: 900 });

      // The season it left is exactly as it was: its seats, and finished.
      await page.goto(`/leagues/${leagueId}/${previous}`);
      await expect(page.getByText(`${previous} · complete`)).toBeVisible();
      await expect(
        page.getByText(`${member.firstName} ${member.lastName}`).first(),
      ).toBeVisible();
      expect(await seatCount(leagueId, previous)).toBe(3);
      // And the offer is gone.
      await expect(page.getByRole('button', { name: `+ Open ${year}` })).toHaveCount(0);

      // Opened and seated: the stranger reads the new season's board, not a notice.
      await outsider.page.goto(`/leagues/${leagueId}`);
      await expect(outsider.page.getByText(memberName).first()).toBeVisible();
      await expect(outsider.page.getByRole('button', { name: /Open/ })).toHaveCount(0);
    } finally {
      await outsider.context.close();
    }
  });
});

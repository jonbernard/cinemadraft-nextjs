import { expect, type Page, test } from '@playwright/test';

/**
 * League page URLs put the season and group in the path (D139):
 * `/leagues/70/2027/group/1?tv=1`, where it used to be
 * `/leagues/70?year=2027&group=1&tv=1`.
 *
 * 🔴 The URLs asserted here are literals, not `leagueHref(...)`. A test that
 * builds its expectation with the function under test agrees with any bug in
 * it; `lib/utils/league-href.test.ts` covers the function, this covers what
 * the server actually answers and the links it actually renders.
 *
 * A scratch league of its own, with two seasons nobody else uses — one of
 * them with two groups — so every claim has a wrong answer available.
 */
// Not `e2e-league…`: leagues.spec.ts clears `e2e-league%`, and took this
// spec's league out from under it mid-run.
const TAG = 'e2e-urls';
const ONE_GROUP = 2988;
const TWO_GROUPS = 2989;

async function withDb<T>(
  fn: (query: (sql: string, params?: unknown[]) => Promise<unknown[]>) => Promise<T>,
): Promise<T> {
  // Raw `pg`, as every spec here does: Playwright does not resolve `@/`.
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
      `delete from drafts where league_id in (select id from leagues where name like $1)`,
      [`${TAG}%`],
    );
    await query('delete from leagues where name like $1', [`${TAG}%`]);
  });
}

let leagueId = 0;
let activeYear = 0;

/** Path and query of a redirect's `Location`, which Next may send relative or absolute. */
function target(location: string | undefined): string {
  const url = new URL(location ?? '', 'http://x');
  return url.pathname + url.search;
}

async function status(page: Page, url: string): Promise<number | undefined> {
  return (await page.request.get(url, { maxRedirects: 0 })).status();
}

test.describe('league URLs', () => {
  // Serial: `beforeAll` runs once per worker, and a second worker's cleanup
  // would delete the league out from under the first.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await cleanup();
    await withDb(async (query) => {
      const leagues = (await query(
        `insert into leagues (name, owner, uuid, drafting_status, created_at, updated_at)
           values ($1, '[]', gen_random_uuid(), 'complete', now(), now()) returning id`,
        [`${TAG} league`],
      )) as { id: number }[];
      leagueId = Number(leagues[0]?.id);
      await query(
        `insert into drafts (league_id, year, user_id, "group", "order", dummy, dummy_name,
                             created_at, updated_at)
           values ($1, $2, null, 1, 1, true, $4, now(), now()),
                  ($1, $3, null, 1, 1, true, $5, now(), now()),
                  ($1, $3, null, 2, 1, true, $6, now(), now())`,
        [
          leagueId,
          ONE_GROUP,
          TWO_GROUPS,
          `${TAG} Early`,
          `${TAG} Late One`,
          `${TAG} Late Two`,
        ],
      );
      const active = (await query(
        'select year from available_years where is_active',
      )) as { year: number }[];
      activeYear = Number(active[0]?.year);
    });
    expect(leagueId).toBeGreaterThan(0);
    expect([ONE_GROUP, TWO_GROUPS]).not.toContain(activeYear);
  });

  test.afterAll(cleanup);

  test('every legacy query form is permanently redirected to its path', async ({
    page,
  }) => {
    const base = `/leagues/${leagueId}`;
    const cases: [string, string][] = [
      [`?year=${TWO_GROUPS}&group=2&tv=1`, `/${TWO_GROUPS}/group/2?tv=1`],
      [`?year=${TWO_GROUPS}&group=2`, `/${TWO_GROUPS}/group/2`],
      [`?year=${ONE_GROUP}&tv=1`, `/${ONE_GROUP}?tv=1`],
      [`?year=${ONE_GROUP}`, `/${ONE_GROUP}`],
    ];
    for (const [legacy, path] of cases) {
      const response = await page.request.get(base + legacy, { maxRedirects: 0 });
      expect(response.status(), legacy).toBe(308);
      expect(target(response.headers().location), legacy).toBe(base + path);
    }

    // A group with no year borrows the current season, which moves, so that
    // one is not permanent.
    const borrowed = await page.request.get(`${base}?group=2&tv=1`, { maxRedirects: 0 });
    expect(borrowed.status()).toBe(307);
    expect(target(borrowed.headers().location)).toBe(
      `${base}/${activeYear}/group/2?tv=1`,
    );

    // And tv on its own is not a legacy form: the bare page renders.
    expect(await status(page, `${base}?tv=1`)).toBe(200);
  });

  test('the current season is the bare URL', async ({ page }) => {
    const base = `/leagues/${leagueId}`;
    for (const [from, to] of [
      [`${base}/${activeYear}`, base],
      [`${base}/${activeYear}?tv=1`, `${base}?tv=1`],
    ]) {
      const response = await page.request.get(from, { maxRedirects: 0 });
      // 307, not 308: a cached permanent redirect would send this link to the
      // next season the day the admin rolls the site over.
      expect(response.status(), from).toBe(307);
      expect(target(response.headers().location), from).toBe(to);
    }
  });

  test('a season or group the league does not have is a 404', async ({ page }) => {
    const base = `/leagues/${leagueId}`;
    for (const url of [
      `${base}/1999`,
      `${base}/0${TWO_GROUPS}`,
      `${base}/${TWO_GROUPS}/group/3`,
      `${base}/${ONE_GROUP}/group/2`,
      `${base}/${TWO_GROUPS}/group/abc`,
      `/leagues/999999/${TWO_GROUPS}`,
    ]) {
      expect(await status(page, url), url).toBe(404);
    }
    // The static children still win over the year segment.
    expect(await status(page, `${base}/draft`)).toBe(404);
    expect(await status(page, `${base}/${TWO_GROUPS}/group/2`)).toBe(200);
  });

  test('a season path renders that season, and every season link is a path', async ({
    page,
  }) => {
    await page.goto(`/leagues/${leagueId}/${ONE_GROUP}`);
    await expect(page.getByText(`${TAG} Early`).first()).toBeVisible();
    await expect(page.getByText(`${TAG} Late One`)).toHaveCount(0);

    const seasons = page.getByRole('navigation', { name: 'Seasons' }).getByRole('link');
    await expect(seasons).toHaveCount(2);
    expect(
      await seasons.evaluateAll((links) => links.map((a) => a.getAttribute('href'))),
    ).toEqual([
      `/leagues/${leagueId}/${TWO_GROUPS}`,
      `/leagues/${leagueId}/${ONE_GROUP}`,
    ]);
    await expect(page.locator('a[href*="year="], a[href*="group="]')).toHaveCount(0);

    await seasons.first().click();
    await expect(page).toHaveURL(new RegExp(`/leagues/${leagueId}/${TWO_GROUPS}$`));
    await expect(page.getByText(`${TAG} Late Two`).first()).toBeVisible();
    await expect(page.getByText(`${TAG} Early`)).toHaveCount(0);
  });

  test('TV mode carries tv=1 on every group link and survives the move', async ({
    page,
  }) => {
    const season = `/leagues/${leagueId}/${TWO_GROUPS}`;
    await page.goto(season);
    await expect(page.getByRole('link', { name: 'TV mode' })).toHaveAttribute(
      'href',
      `${season}?tv=1`,
    );

    await page.goto(`${season}?tv=1`);
    const groups = page.getByRole('navigation', { name: 'Groups' }).getByRole('link');
    expect(
      await groups.evaluateAll((links) => links.map((a) => a.getAttribute('href'))),
    ).toEqual([`${season}/group/1?tv=1`, `${season}/group/2?tv=1`]);
    await expect(page.locator('a[href*="year="], a[href*="group="]')).toHaveCount(0);

    await groups.nth(1).click();
    await expect(page).toHaveURL(new RegExp(`${season}/group/2\\?tv=1$`));
    await expect(page.locator('[data-tv-mode]')).toHaveCount(1);
    // One group on a television, and it is the one the path names.
    await expect(page.getByRole('heading', { name: 'Group 2' })).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Group 1' })).toHaveCount(0);
    await expect(page.getByText(`${TAG} Late One`)).toHaveCount(0);

    // The way out keeps the season and group, and drops only tv.
    await expect(page.getByRole('link', { name: 'Leave TV mode' })).toHaveAttribute(
      'href',
      `${season}/group/2`,
    );
  });
});

import { expect, type Page, test } from '@playwright/test';

import { signInAs } from './support/session';

/**
 * Head-to-head (P16.T24, D136): "Compare" on every standings row of the
 * board, `?vs=`, public and noindexed like the board itself.
 *
 * 🔴 Scratch rows only, under this file's own `TAG` and scratch year 2986
 * (2987 is the plan's, left to the followers spec and the race). Every
 * assertion reads this league's own rows.
 *
 * Two groups of two, one film (Alpha) held across groups, one points level
 * worth 7 and a win doubling it:
 *
 *   Cy  (group 2) 28 · Alpha 7, Delta 21 (P + D + won P)
 *   Dee (group 2) 21 · Echo 7, Foxtrot 14
 *   Ada (group 1) 14 · Alpha 7, Bravo 7
 *   Bea (group 1)  7 · Charlie 7 — the signed-in reader's seat, when there is one
 */
const TAG = 'e2e-h2h';
const YEAR = 2986;
const name = (seat: string) => `${TAG} ${seat}`;
const READER = { email: `${TAG}-reader@example.test`, firstName: TAG, lastName: 'Bea' };

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
      `delete from draft_picks where draft_id in
         (select d.id from drafts d join leagues l on l.id = d.league_id where l.name like $1)`,
      [`${TAG}%`],
    );
    await query(
      'delete from drafts where league_id in (select id from leagues where name like $1)',
      [`${TAG}%`],
    );
    await query('delete from leagues where name like $1', [`${TAG}%`]);
    for (const table of ['winners', 'nominations']) {
      await query(
        `delete from ${table} where award_id in
           (select a.id from awards a join events e on e.id = a.event_id
             where e.abbreviation like $1)`,
        [`${TAG}%`],
      );
    }
    await query(
      'delete from awards where event_id in (select id from events where abbreviation like $1)',
      [`${TAG}%`],
    );
    await query('delete from events where abbreviation like $1', [`${TAG}%`]);
    await query('delete from points where level like $1', [`${TAG}%`]);
    await query('delete from movies where title like $1', [`${TAG}%`]);
    await query('delete from users where email like $1', [`${TAG}-%@example.test`]);
  });
}

/** The league above; Bea is the reader's own seat when `readerId` is given. */
async function seed(readerId: number | null): Promise<{ leagueId: number }> {
  return withDb(async (query) => {
    const [event] = (await query(
      `insert into events (name, abbreviation, nom_date, awards_date, created_at, updated_at)
         values ($1, $2, $3, $4, now(), now()) returning id`,
      [`${TAG} Show`, `${TAG}-show`, Date.UTC(YEAR - 1, 7, 2), Date.UTC(YEAR - 1, 7, 3)],
    )) as { id: number }[];
    const [points] = (await query(
      `insert into points (level, tier, points, created_at, updated_at)
         values ($1, 3, 7, now(), now()) returning id`,
      [`${TAG}-level`],
    )) as { id: number }[];
    const award: Record<string, number> = {};
    for (const category of ['Picture', 'Director']) {
      const [row] = (await query(
        `insert into awards (name, event_id, points, created_at, updated_at)
           values ($1, $2, $3, now(), now()) returning id`,
        [`${TAG} ${category}`, event?.id, points?.id],
      )) as { id: number }[];
      award[category] = row?.id as number;
    }
    const films: Record<string, number> = {};
    for (const [index, title] of [
      'Alpha',
      'Bravo',
      'Charlie',
      'Delta',
      'Echo',
      'Foxtrot',
    ].entries()) {
      const [movie] = (await query(
        `insert into movies (title, sort_title, tmdb_id, created_at, updated_at)
           values ($1, $1, $2, now(), now()) returning id`,
        [name(title), String(9_986_000 + index)],
      )) as { id: number }[];
      films[title] = movie?.id as number;
    }
    const nominations: [string, string][] = [
      ['Alpha', 'Picture'],
      ['Bravo', 'Picture'],
      ['Charlie', 'Director'],
      ['Delta', 'Picture'],
      ['Delta', 'Director'],
      ['Echo', 'Director'],
      ['Foxtrot', 'Picture'],
      ['Foxtrot', 'Director'],
    ];
    for (const [title, category] of nominations) {
      const [nomination] = (await query(
        `insert into nominations (movie_id, award_id, year, created_at, updated_at)
           values ($1, $2, $3, now(), now()) returning id`,
        [films[title], award[category], YEAR],
      )) as { id: number }[];
      if (title === 'Delta' && category === 'Picture')
        await query(
          `insert into winners (nomination_id, movie_id, award_id, year, created_at, updated_at)
             values ($1, $2, $3, $4, now(), now())`,
          [nomination?.id, films[title], award[category], YEAR],
        );
    }

    const [league] = (await query(
      `insert into leagues (name, owner, uuid, drafting_status, created_at, updated_at)
         values ($1, '[]', gen_random_uuid(), 'complete', now(), now()) returning id`,
      [`${TAG} league`],
    )) as { id: number }[];
    const seats: [string, number, number, string[]][] = [
      ['Ada', 1, 1, ['Alpha', 'Bravo']],
      ['Bea', 1, 2, ['Charlie']],
      ['Cy', 2, 1, ['Alpha', 'Delta']],
      ['Dee', 2, 2, ['Echo', 'Foxtrot']],
    ];
    for (const [seat, group, order, picks] of seats) {
      const reader = seat === 'Bea' && readerId != null;
      const [draft] = (await query(
        reader
          ? `insert into drafts (league_id, user_id, year, "group", "order", created_at, updated_at)
               values ($1, $5, $2, $3, $4, now(), now()) returning id`
          : `insert into drafts (league_id, year, "group", "order", dummy, dummy_name, created_at, updated_at)
               values ($1, $2, $3, $4, true, $5, now(), now()) returning id`,
        [league?.id, YEAR, group, order, reader ? readerId : name(seat)],
      )) as { id: number }[];
      for (const [index, title] of picks.entries())
        await query(
          `insert into draft_picks (draft_id, movie_id, "order", created_at, updated_at)
             values ($1, $2, $3, now(), now())`,
          [draft?.id, films[title], index + 1],
        );
    }
    return { leagueId: league?.id as number };
  });
}

const standings = (page: Page) =>
  page.getByRole('table', { name: 'League standings, by position' });

/** The three printed segments of the split bar: a-only, both, b-only. */
async function segments(page: Page): Promise<number[]> {
  const list = page.getByRole('list', { name: 'Where the points come from' });
  return (await list.locator('[data-points]').allInnerTexts()).map(Number);
}

async function noSideways(page: Page): Promise<void> {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(0);
}

test.describe('head to head', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(cleanup);
  test.afterEach(cleanup);
  test.afterAll(cleanup);

  test('signed out, Compare on row 3 compares the leader with it', async ({ page }) => {
    const { leagueId } = await seed(null);
    await page.setViewportSize({ width: 1440, height: 900 });
    const board = `/leagues/${leagueId}/${YEAR}`;
    await page.goto(board);

    // Row 0 is the header; row 3 is third place, Ada.
    await standings(page)
      .getByRole('row')
      .nth(3)
      .getByRole('link', { name: /^Compare/ })
      .click();
    await expect(page).toHaveURL(new RegExp(`${board}\\?vs=\\d+#head-to-head$`));

    const region = page.getByRole('region', { name: 'Head to head' });
    await expect(region.getByRole('heading', { level: 2 })).toHaveText(
      `${name('Cy')} leads ${name('Ada')} by 14`,
    );
    const [onlyA = 0, both = 0, onlyB = 0] = await segments(page);
    expect([onlyA, both, onlyB]).toEqual([21, 7, 7]);
    expect(onlyA + both).toBe(28);
    expect(onlyB + both).toBe(14);
    await expect(region.getByRole('list', { name: 'Both' })).toContainText(name('Alpha'));

    // Public and out of the index, like the board (D136).
    const html = await (await page.request.get(page.url())).text();
    expect(html).toMatch(/<meta name="robots" content="[^"]*noindex/);

    // Same group: Cy against Dee says so rather than drawing an empty band.
    await standings(page)
      .getByRole('row')
      .nth(2)
      .getByRole('link', { name: /^Compare/ })
      .click();
    await expect(region.getByRole('heading', { level: 2 })).toHaveText(
      `${name('Cy')} leads ${name('Dee')} by 7`,
    );
    await expect(region).toContainText('Same group, so no film is on both teams.');
  });

  test('a seated member compares from their own seat', async ({ page }) => {
    const readerId = await signInAs(page, READER);
    const { leagueId } = await seed(readerId);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/leagues/${leagueId}/${YEAR}`);

    // Their own row has no Compare, and the roster slot names the seat above.
    const own = standings(page).getByRole('row').filter({ hasText: 'You' });
    await expect(own.getByRole('link', { name: /^Compare/ })).toHaveCount(0);
    await expect(page.getByText(`You’re 7 behind ${name('Ada')}`)).toBeVisible();

    await standings(page)
      .getByRole('row')
      .nth(1)
      .getByRole('link', { name: /^Compare/ })
      .click();
    const region = page.getByRole('region', { name: 'Head to head' });
    await expect(region.getByRole('heading', { level: 2 })).toHaveText(
      `You’re 21 behind ${name('Cy')}`,
    );
    expect(await segments(page)).toEqual([7, 0, 28]);
  });

  test('TV mode renders no comparison', async ({ page }) => {
    const { leagueId } = await seed(null);
    await page.goto(`/leagues/${leagueId}/${YEAR}`);
    const href = await standings(page)
      .getByRole('row')
      .nth(3)
      .getByRole('link', { name: /^Compare/ })
      .getAttribute('href');
    const vs = new URL(href ?? '', 'http://x').searchParams.get('vs');
    expect(vs).toMatch(/^\d+$/);

    await page.goto(`/leagues/${leagueId}/${YEAR}?vs=${vs}`);
    await expect(page.getByRole('region', { name: 'Head to head' })).toBeVisible();
    await page.goto(`/leagues/${leagueId}/${YEAR}?tv=1&vs=${vs}`);
    await expect(page.locator('[data-tv-mode]')).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'Head to head' })).toHaveCount(0);
  });

  test('fits a phone', async ({ page }) => {
    const { leagueId } = await seed(null);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/leagues/${leagueId}/${YEAR}`);
    await standings(page)
      .getByRole('row')
      .nth(3)
      .getByRole('link', { name: /^Compare/ })
      .click();
    await expect(page.getByRole('region', { name: 'Head to head' })).toBeInViewport();
    await noSideways(page);
  });
});

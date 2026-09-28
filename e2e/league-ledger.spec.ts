import { expect, type Page, test } from '@playwright/test';

/**
 * The league's ledger tabs (P16.T19–T21): Standings, led by "what moved", and
 * each seat's season on a page of its own. Public (§7), so nobody signs in.
 *
 * 🔴 Scratch rows only, under this file's own `TAG` and scratch year 2990
 * (the plan's assignment). Every assertion reads this league's own rows.
 *
 * The show's dates are the `events` columns, inside 2990's window, which is
 * what `moments` reads for a season with no stored row (P16.T13). ponytail:
 * seed `event_dates` for 2990 instead once P16.T18 lands.
 */
const TAG = 'e2e-ledger';
const YEAR = 2990;
const SEATS = [`${TAG} Ada`, `${TAG} Bea`, `${TAG} Cy`];

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

/** Remove everything under `tag`: picks first, since `draft_picks` has no foreign key. */
async function cleanupTag(tag: string): Promise<void> {
  await withDb(async (query) => {
    await query(
      `delete from draft_picks where draft_id in
         (select d.id from drafts d join leagues l on l.id = d.league_id where l.name like $1)`,
      [`${tag}%`],
    );
    await query(
      'delete from drafts where league_id in (select id from leagues where name like $1)',
      [`${tag}%`],
    );
    await query('delete from leagues where name like $1', [`${tag}%`]);
    for (const table of ['winners', 'nominations']) {
      await query(
        `delete from ${table} where award_id in
           (select a.id from awards a join events e on e.id = a.event_id
             where e.abbreviation like $1)`,
        [`${tag}%`],
      );
    }
    await query(
      'delete from awards where event_id in (select id from events where abbreviation like $1)',
      [`${tag}%`],
    );
    await query('delete from events where abbreviation like $1', [`${tag}%`]);
    await query('delete from points where level like $1', [`${tag}%`]);
    await query('delete from movies where title like $1', [`${tag}%`]);
  });
}

/**
 * A show with two categories worth 7, three films, and a three-seat league
 * each holding one of them. Alpha is up for both (14), Bravo and Charlie for
 * one each (7); then Bravo wins, so the ceremony moves Bea from 7 to 14.
 *
 * `onAir` seeds the show `awards_active`, and `year` is the season: the live
 * case needs the site's active season, which is the only one on air (D135).
 */
async function seedLedger(
  tag: string,
  year: number,
  { onAir = false, dated = true } = {},
): Promise<{ leagueId: number; draftIds: number[] }> {
  return withDb(async (query) => {
    // Early in the season window, so this show's moments sort ahead of any
    // other spec's scratch show that happens to be on air at the same time.
    const nom = dated ? Date.UTC(year - 1, 7, 2) : null;
    const awards = dated ? Date.UTC(year - 1, 7, 3) : null;
    const [event] = (await query(
      `insert into events (name, abbreviation, nom_date, awards_date, awards_active, created_at, updated_at)
         values ($1, $2, $3, $4, $5, now(), now()) returning id`,
      [`${tag} Show`, `${tag}-show`, nom, awards, onAir],
    )) as { id: number }[];
    const [points] = (await query(
      `insert into points (level, tier, points, created_at, updated_at)
         values ($1, 3, 7, now(), now()) returning id`,
      [`${tag}-level`],
    )) as { id: number }[];
    const awardIds: number[] = [];
    for (const name of ['Picture', 'Director']) {
      const [award] = (await query(
        `insert into awards (name, event_id, points, created_at, updated_at)
           values ($1, $2, $3, now(), now()) returning id`,
        [`${tag} ${name}`, event?.id, points?.id],
      )) as { id: number }[];
      awardIds.push(award?.id as number);
    }
    const films: number[] = [];
    for (const title of ['Alpha', 'Bravo', 'Charlie']) {
      const [movie] = (await query(
        `insert into movies (title, sort_title, created_at, updated_at)
           values ($1, $1, now(), now()) returning id`,
        [`${tag} ${title}`],
      )) as { id: number }[];
      films.push(movie?.id as number);
    }
    const nominate = (movie: number | undefined, award: number | undefined) =>
      query(
        `insert into nominations (movie_id, award_id, year, created_at, updated_at)
           values ($1, $2, $3, now(), now())`,
        [movie, award, year],
      );
    await nominate(films[0], awardIds[0]);
    await nominate(films[0], awardIds[1]);
    await nominate(films[1], awardIds[0]);
    await nominate(films[2], awardIds[1]);

    const [league] = (await query(
      `insert into leagues (name, owner, uuid, drafting_status, created_at, updated_at)
         values ($1, '[]', gen_random_uuid(), 'complete', now(), now()) returning id`,
      [`${tag} league`],
    )) as { id: number }[];
    const draftIds: number[] = [];
    for (const [index, name] of ['Ada', 'Bea', 'Cy'].entries()) {
      const [draft] = (await query(
        `insert into drafts (league_id, year, "group", "order", dummy, dummy_name, created_at, updated_at)
           values ($1, $2, 1, $3, true, $4, now(), now()) returning id`,
        [league?.id, year, index + 1, `${tag} ${name}`],
      )) as { id: number }[];
      draftIds.push(draft?.id as number);
      await query(
        `insert into draft_picks (draft_id, movie_id, "order", created_at, updated_at)
           values ($1, $2, 1, now(), now())`,
        [draft?.id, films[index]],
      );
    }
    return { leagueId: league?.id as number, draftIds };
  });
}

/** Bravo wins Picture: the ceremony's one result. */
async function enterWinner(tag: string, year: number): Promise<void> {
  await withDb((query) =>
    query(
      `insert into winners (nomination_id, movie_id, award_id, year, created_at, updated_at)
         select n.id, n.movie_id, n.award_id, $1, now(), now()
           from nominations n
           join awards a on a.id = n.award_id
           join movies m on m.id = n.movie_id
          where n.year = $1 and a.name = $2 and m.title = $3`,
      [year, `${tag} Picture`, `${tag} Bravo`],
    ),
  );
}

async function noSideways(page: Page): Promise<void> {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(0);
}

/** name → total, from a table whose row header is the seat and last cell the total. */
async function totals(page: Page, table: string): Promise<Record<string, string>> {
  const rows = page.getByRole('table', { name: table }).locator('tbody tr');
  const out: Record<string, string> = {};
  for (const row of await rows.all()) {
    // The board's row header carries its tie in words (", tied for position 1").
    const name = (await row.getByRole('rowheader').innerText())
      .replace(/,\s*tied.*$/s, '')
      .trim();
    out[name] = (await row.locator('td').last().innerText()).trim();
  }
  return out;
}

test.describe('the standings tab', () => {
  test.describe.configure({ mode: 'serial' });
  let leagueId = 0;
  let draftIds: number[] = [];

  test.beforeAll(async () => {
    await cleanupTag(TAG);
    ({ leagueId, draftIds } = await seedLedger(TAG, YEAR));
    await enterWinner(TAG, YEAR);
  });
  test.afterAll(() => cleanupTag(TAG));

  test('opens signed out on what moved, dated at the latest moment', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await page.goto(`/leagues/${leagueId}/${YEAR}/standings`);
    expect(response?.status()).toBe(200);

    const moved = page.getByRole('heading', { level: 2, name: /ceremony/ });
    // The ceremony, not the nominations before it, and its own date.
    await expect(moved).toContainText(`${TAG} Show · ceremony · Mon Aug 3`);
    await expect(moved.locator('time')).toHaveAttribute('dateTime', `${YEAR - 1}-08-03`);
    await expect(
      page.getByText(`${TAG} Ada and ${TAG} Bea share the lead`),
    ).toBeVisible();

    await expect(page.getByRole('link', { name: 'Standings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await noSideways(page);
  });

  test('its totals are the board’s totals', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/leagues/${leagueId}/${YEAR}/standings`);
    const standings = await totals(page, 'League standings with points by award show');

    await page.goto(`/leagues/${leagueId}/${YEAR}`);
    await expect(page.getByRole('link', { name: 'Board' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const board = await totals(page, 'League standings, by position');

    expect(standings).toEqual({
      [SEATS[0] as string]: '14',
      [SEATS[1] as string]: '14',
      [SEATS[2] as string]: '7',
    });
    expect(standings).toEqual(board);
  });

  test('fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/leagues/${leagueId}/${YEAR}/standings`);
    await expect(page.getByRole('list', { name: 'League standings' })).toBeVisible();
    await noSideways(page);
  });

  test('opens from a name on Standings, signed out, and switches seats by GET', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/leagues/${leagueId}/${YEAR}/standings`);
    await page
      .getByRole('table', { name: 'League standings with points by award show' })
      .getByRole('link', { name: `${TAG} Bea` })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/leagues/${leagueId}/seats/${draftIds[1]}$`),
    );
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${TAG} Bea`);
    // Bravo: 7 on nomination, doubled by its win.
    const table = page.getByRole('table', { name: /picks at each award show/ });
    await expect(table.locator('[data-season-total]')).toHaveText('14');

    await page
      .getByRole('combobox', { name: 'Seat' })
      .selectOption({ label: `${TAG} Cy` });
    await page.getByRole('button', { name: 'Open' }).click();
    await expect(page).toHaveURL(
      new RegExp(`/leagues/${leagueId}/seats/${draftIds[2]}$`),
    );
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${TAG} Cy`);
  });

  test('a seat page fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/leagues/${leagueId}/seats/${draftIds[0]}`);
    await expect(page.getByRole('list', { name: `${TAG} Ada’s picks` })).toBeVisible();
    await noSideways(page);
  });

  test('a seat of another league is a 404', async ({ page }) => {
    const other = await seedLedger(`${TAG}-other`, YEAR);
    try {
      const response = await page.goto(`/leagues/${leagueId}/seats/${other.draftIds[0]}`);
      expect(response?.status()).toBe(404);
      const own = await page.goto(
        `/leagues/${other.leagueId}/seats/${other.draftIds[0]}`,
      );
      expect(own?.status()).toBe(200);
    } finally {
      await cleanupTag(`${TAG}-other`);
    }
  });
});

/**
 * "What moved" moves while a ceremony is entered (P16.T20, D135).
 *
 * 🔴 In the site's **active** season, which is the only one on air — so this
 * is the one case here that is not in 2990, and it reads the season rather
 * than typing it. Its own tag, so the static cases' cleanup never takes its
 * rows mid-flow. The show is dated at the very start of the season window, so
 * it sorts ahead of any other spec's scratch show that is on air at the same
 * moment; `latest` is the first live step.
 */
const ONAIR = 'e2e-onair';

async function activeYear(): Promise<number> {
  const rows = (await withDb((query) =>
    query('select year from available_years where is_active limit 1'),
  )) as { year: number }[];
  const year = rows[0]?.year;
  if (year == null) throw new Error('no active season in this database');
  return year;
}

async function setOnAir(onAir: boolean): Promise<void> {
  await withDb((query) =>
    query('update events set awards_active = $1 where abbreviation = $2', [
      onAir,
      `${ONAIR}-show`,
    ]),
  );
}

test.describe('what moved, live', () => {
  test.describe.configure({ mode: 'serial' });
  let leagueId = 0;
  let year = 0;

  test.beforeAll(async () => {
    year = await activeYear();
    await cleanupTag(ONAIR);
    ({ leagueId } = await seedLedger(ONAIR, year, { onAir: true }));
  });
  test.afterAll(async () => {
    await setOnAir(false);
    await cleanupTag(ONAIR);
  });

  test('moves when a winner is entered, with no reload', async ({ page }) => {
    test.setTimeout(60_000);
    let documents = 0;
    page.on('load', () => {
      documents += 1;
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/leagues/${leagueId}/standings`);
    const moved = page.getByRole('heading', { level: 2, name: /ceremony/ });
    const beaTotal = page
      .getByRole('table', { name: 'League standings with points by award show' })
      .getByRole('row')
      .filter({ hasText: `${ONAIR} Bea` })
      .locator('td')
      .last();

    // Not vacuous: before the winner, nothing is decided and Bea is on 7.
    await expect(moved).toContainText('ceremony · live · 0 of 2 decided');
    await expect(beaTotal).toHaveText('7');
    await expect(page.getByText(`${ONAIR} Ada keeps the lead`)).toBeVisible();

    await page.evaluate(() => {
      (window as unknown as { __token?: string }).__token = 'the first';
    });
    const settled = documents;

    await enterWinner(ONAIR, year);

    // Only the stream can deliver this: the page has not navigated.
    await expect(moved).toContainText('1 of 2 decided', { timeout: 20_000 });
    await expect(beaTotal).toHaveText('14');
    await expect(
      page.getByText(`${ONAIR} Ada and ${ONAIR} Bea share the lead`),
    ).toBeVisible();

    expect(documents).toBe(settled);
    expect(
      await page.evaluate(() => (window as unknown as { __token?: string }).__token),
    ).toBe('the first');
  });

  test('off air, the page opens no stream and the route refuses one', async ({
    page,
  }) => {
    // The budget, at both layers (D116's lesson). The silence is measured
    // against a positive signal in the same page rather than a clock: off
    // air first, then on air, and exactly one request, the second.
    const opened: string[] = [];
    page.on('request', (request) => {
      // `eventsource` only: the direct fetch below is the route's check, not the page's.
      if (request.resourceType() === 'eventsource') opened.push(request.url());
    });

    await setOnAir(false);
    await page.goto(`/leagues/${leagueId}/standings`);
    await expect(
      page.getByRole('heading', { level: 2, name: /ceremony/ }),
    ).not.toContainText('live');
    const status = await page.evaluate(
      async (url) => (await fetch(url)).status,
      `/api/leagues/${leagueId}/standings/stream?year=${year}`,
    );
    expect(status).toBe(204);

    await setOnAir(true);
    await page.goto(`/leagues/${leagueId}/standings`);
    await expect.poll(() => opened.length).toBe(1);
    expect(opened[0]).toContain(`/api/leagues/${leagueId}/standings/stream`);
  });
});

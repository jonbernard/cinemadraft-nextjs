import { expect, type Page, test } from '@playwright/test';

import { signInAs } from './support/session';

/**
 * 🔴 The other half of the Phase 15 gate: what an admin enters on a ceremony
 * night reaches every page that reports a score.
 *
 * `e2e/award-shows.spec.ts` proves the admin controls write the right rows;
 * `e2e/scoring.spec.ts` proves the ledger on a board adds up. Neither one
 * crosses the join. This does: one nomination and one win, entered through the
 * admin's own controls, then read back off the **film's page**, the **league
 * board** and the **season leaderboard** — three separate services over one
 * scoring rule (D41), and the place a regression would hide is in exactly one
 * of them disagreeing.
 *
 * 🔴 **The relationship, never a number.** `DECISIONS.md`: a nomination earns
 * the award's points `P`, a win earns `P` a second time, so a win is worth
 * `2P`. This asserts `won === 2 × nominated` on each surface rather than
 * "7" and "14" — a points-table edit is then a decision, not a broken test.
 *
 * 🔴 Scratch everything, on a season of its own. The show, its category, its
 * points tier, the film, the league that drafted it and the year they all
 * belong to are created here and removed afterwards. `lib/db.test.ts` asserts
 * the restored database still holds exactly 4,559 nominations and exactly ten
 * seasons, so anything this leaves behind turns an unrelated test red.
 *
 * The tag deliberately does not begin `e2e-awards`: that is
 * `e2e/award-shows.spec.ts`'s prefix, its `afterEach` deletes every event and
 * film matching it, and the two files run side by side.
 */
const TAG = 'e2e-ceremony';
const YEAR = 2993;
const SHOW = `${TAG}-show`;
const FILM = `${TAG} Contender`;

/**
 * A real TMDB id, on a scratch row.
 *
 * 🔴 The film page is keyed by TMDB id and renders from TMDB — the local row
 * exists only to carry a score — so a made-up id is a 404 and proves nothing.
 * 389 is *12 Angry Men*, which the restored database has never cached, so this
 * row cannot collide with one of the 1,355 real ones.
 */
const TMDB_ID = '389';

const hasTmdb = Boolean(process.env.TMDB_API_KEY);

/**
 * Raw `pg` rather than the Prisma client: Playwright does not resolve the `@/`
 * alias into `generated/prisma`, so importing `lib/db` fails at require time
 * and takes the whole spec with it. Same reasoning as `e2e/award-shows.spec.ts`.
 */
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
      `delete from winners where award_id in
         (select a.id from awards a join events e on e.id = a.event_id
           where e.abbreviation like $1)`,
      [`${TAG}%`],
    );
    await query(
      `delete from nominations where award_id in
         (select a.id from awards a join events e on e.id = a.event_id
           where e.abbreviation like $1)`,
      [`${TAG}%`],
    );
    await query(
      'delete from awards where event_id in (select id from events where abbreviation like $1)',
      [`${TAG}%`],
    );
    await query('delete from events where abbreviation like $1', [`${TAG}%`]);
    await query('delete from points where level like $1', [`${TAG}%`]);
    await query(
      `delete from draft_picks where draft_id in
         (select d.id from drafts d join leagues l on l.id = d.league_id
           where l.name like $1)`,
      [`${TAG}%`],
    );
    await query(
      'delete from drafts where league_id in (select id from leagues where name like $1)',
      [`${TAG}%`],
    );
    await query('delete from leagues where name like $1', [`${TAG}%`]);
    await query('delete from movies where title like $1', [`${TAG}%`]);
    // 🔴 The scratch season goes too. `lib/db.test.ts` asserts
    // `available_years` still holds exactly ten rows.
    await query('delete from available_years where year = $1', [YEAR]);
    await query('delete from users where email = $1', [`${TAG}-admin@example.test`]);
  });
}

/**
 * A show with one category, a film, and a league that drafted it.
 *
 * All of it is seeded rather than clicked: what this spec is about is the
 * nomination and the win, and building a whole league through the UI first
 * would make an unrelated failure look like a scoring one.
 */
async function seed(): Promise<{ leagueId: number; adminId: number }> {
  const adminId = await withDb(async (query) => {
    const rows = (await query(
      "update users set role = 'admin' where email = $1 returning id",
      [`${TAG}-admin@example.test`],
    )) as { id: number }[];
    const id = rows[0]?.id;
    if (id == null) throw new Error('the signed-in admin has no row');
    return id;
  });

  return withDb(async (query) => {
    // 🔴 A season of its own, registered as one: the dashboard's leaderboard
    // falls back to the newest *known* season for a `?year=` it does not
    // recognise (D65), so an unregistered year would quietly report 2026's
    // standings and the assertion below would be about the wrong table.
    await query(
      `insert into available_years (year, is_active, created_at, updated_at)
         values ($1, false, now(), now())`,
      [YEAR],
    );

    const events = (await query(
      `insert into events (name, abbreviation, created_at, updated_at)
         values ($1, $2, now(), now()) returning id`,
      [`${TAG} Show`, SHOW],
    )) as { id: number }[];

    const points = (await query(
      `insert into points (level, tier, points, created_at, updated_at)
         values ($1, 3, 7, now(), now()) returning id`,
      [`${TAG}-level`],
    )) as { id: number }[];

    // `awards.points` is a foreign key into `points.id` (D41), not a value.
    await query(
      `insert into awards (name, event_id, points, created_at, updated_at)
         values ($1, $2, $3, now(), now())`,
      [`${TAG} Best Picture`, events[0]?.id, points[0]?.id],
    );

    const movies = (await query(
      `insert into movies (title, sort_title, tmdb_id, created_at, updated_at)
         values ($1, $1, $2, now(), now()) returning id`,
      [FILM, TMDB_ID],
    )) as { id: number }[];

    const leagues = (await query(
      `insert into leagues (name, owner, uuid, drafting_status, created_at, updated_at)
         values ($1, $2, gen_random_uuid(), 'active', now(), now())
       returning id`,
      // Stored the way production stores it: TEXT holding a JSON array.
      [`${TAG} league`, JSON.stringify([adminId])],
    )) as { id: number }[];
    const leagueId = leagues[0]?.id;
    if (leagueId == null) throw new Error('could not create the scratch league');

    const seats = (await query(
      `insert into drafts (league_id, year, "group", "order", dummy, dummy_name,
                           created_at, updated_at)
         values ($1, $2, 1, 1, true, 'Ada', now(), now())
       returning id`,
      [leagueId, YEAR],
    )) as { id: number }[];

    await query(
      `insert into draft_picks (draft_id, movie_id, "order", created_at, updated_at)
         values ($1, $2, 1, now(), now())`,
      [seats[0]?.id, movies[0]?.id],
    );

    return { leagueId, adminId };
  });
}

/** The headline total on the film's own page. */
async function pointsOnFilmPage(page: Page): Promise<number> {
  await page.goto(`/films/${TMDB_ID}`);
  const value = page
    .getByText(`Total, ${YEAR} season`, { exact: true })
    .locator('xpath=following-sibling::span[1]');
  await expect(value).toBeVisible();
  return Number((await value.innerText()).trim());
}

/**
 * The film's cell on the league board.
 *
 * Read off the ledger's summary, which is the number a member actually sees on
 * the board — `film.points` renders nowhere else in the cell.
 */
async function pointsOnLeagueBoard(page: Page, leagueId: number): Promise<number> {
  await page.goto(`/leagues/${leagueId}?year=${YEAR}`);
  // Scoped to the desktop grid: the board renders both presentations (D49) and
  // CSS hides one, so an unscoped match finds the phone copy as well.
  const cell = page.getByRole('table').locator('figure').filter({ hasText: FILM });
  const summary = cell.locator('summary');
  await expect(summary).toBeVisible();
  return Number((await summary.innerText()).match(/\d+/)?.[0] ?? Number.NaN);
}

/** The Total column of the season leaderboard, on the dashboard. */
async function pointsOnLeaderboard(page: Page): Promise<number> {
  await page.goto(`/?year=${YEAR}`);
  const row = page.getByRole('row').filter({ hasText: FILM });
  // The film is the row header; the last real cell is Total, whatever the
  // season's shows are.
  const total = row.getByRole('cell').last();
  await expect(total).toBeVisible();
  return Number((await total.innerText()).trim());
}

test.describe('the awards lifecycle', () => {
  test.beforeAll(cleanup);
  test.afterAll(cleanup);

  test('a nomination and a win reach the film, the board and the leaderboard', async ({
    page,
  }) => {
    await signInAs(page, { email: `${TAG}-admin@example.test`, firstName: 'Admin' });
    const { leagueId } = await seed();

    // 1. Nominate, by searching — the path an admin uses on a nominations
    //    morning, a fragment of the title at a time (§10).
    await page.goto(`/award-shows/${SHOW}?year=${YEAR}`);
    await page.getByRole('searchbox').fill(FILM);
    await page
      .getByRole('button', { name: new RegExp(FILM) })
      .first()
      .click();
    await expect(page.getByText(`${FILM} nominated`)).toBeVisible();

    // 2. What a nomination is worth, everywhere it is reported.
    const nominated = {
      board: await pointsOnLeagueBoard(page, leagueId),
      leaderboard: await pointsOnLeaderboard(page),
      film: hasTmdb ? await pointsOnFilmPage(page) : null,
    };
    expect(nominated.board).toBeGreaterThan(0);
    // 🔴 Three services, one scoring rule (D41). Disagreement here is the
    // defect this spec exists to catch.
    expect(nominated.leaderboard).toBe(nominated.board);
    if (nominated.film != null) expect(nominated.film).toBe(nominated.board);

    // 3. The ceremony. Winner selection is a button over the nominees rather
    //    than a second search, so the board is reloaded to reach it.
    await page.goto(`/award-shows/${SHOW}?year=${YEAR}`);
    await page
      .getByRole('listitem')
      .filter({ hasText: FILM })
      .getByRole('button', { name: 'Mark winner' })
      .click();
    await expect(page.getByRole('button', { name: 'Clear winner' })).toBeVisible();

    // 4. The same three reports, after the win.
    const won = {
      board: await pointsOnLeagueBoard(page, leagueId),
      leaderboard: await pointsOnLeaderboard(page),
      film: hasTmdb ? await pointsOnFilmPage(page) : null,
    };

    // 🔴 The relationship, not the number: a win earns the category's points a
    // second time, so it is worth twice the nomination (DECISIONS.md). Asserted
    // this way, re-tiering a category is a decision rather than a red test.
    expect(won.board).toBe(nominated.board * 2);
    expect(won.leaderboard).toBe(nominated.leaderboard * 2);
    if (won.film != null && nominated.film != null) {
      expect(won.film).toBe(nominated.film * 2);
    }

    // And the win is named on the board's ledger, not signalled by the doubled
    // number alone — a reader has to be able to see *why* it moved.
    await page.goto(`/leagues/${leagueId}?year=${YEAR}`);
    const cell = page.getByRole('table').locator('figure').filter({ hasText: FILM });
    await cell.locator('summary').click();
    await expect(cell.getByText('Won')).toBeVisible();
  });
});

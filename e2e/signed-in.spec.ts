import { expect, test } from '@playwright/test';

import { skipWithoutRestoredCorpus } from './support/corpus';
import { signInAs } from './support/session';

const TAG = 'e2e-p17';
/**
 * 🔴 A tag of its own for the scratch leagues, distinct from the users' one.
 * `fullyParallel` is on, so tests in this file run in different workers; a
 * teardown scoped to `e2e-p17%` would delete rows another test in this same
 * file was still using. The league tests below are `serial` and own this tag
 * alone; the users are cleaned once, at the end, by the file-level hook.
 */
const LEAGUE_TAG = 'e2e-p17-league';
/** The one category the ledger fixture nominates for (P17.T34). */
const AWARD = `${LEAGUE_TAG} Best Picture`;

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

/**
 * The season every page defaults to — read, never typed. A restored database
 * and CI's seeded-empty one both hold exactly one active row, and a literal
 * would break as "the league is empty" the day the owner moves the season.
 */
async function activeYear(): Promise<number> {
  return withDb(async (query) => {
    const { rows } = await query<{ year: number }>(
      'select year from available_years where is_active limit 1',
    );
    const year = rows[0]?.year;
    if (year == null) throw new Error('no active season in this database');
    return year;
  });
}

/**
 * A throwaway league owned by the signed-in member (P17.T30, T31).
 *
 * 🔴 Never league 1. The database is a restored copy of production and
 * `lib/db.test.ts` asserts exact row counts against it; `LEAGUE_TAG` is what
 * `cleanupLeagues` below removes.
 *
 * Every axis the two tasks branch on is a parameter, because that is what makes
 * the tests able to fail: a fixture with a seat and a pick in every state could
 * not tell "primary on pending" from "primary always", and one with no picks
 * could not tell a rendered roster from an empty one.
 */
async function scratchLeague(
  userId: number,
  options: {
    name: string;
    status: 'pending' | 'active' | 'complete';
    seats?: boolean;
    picks?: number;
    /** Nominate every pick once for {@link AWARD}, so each carries a ledger line. */
    ledger?: boolean;
  },
): Promise<number> {
  const year = await activeYear();

  return withDb(async (query) => {
    const { rows: leagues } = await query<{ id: number }>(
      `insert into leagues (name, owner, uuid, drafting_status, created_at, updated_at)
         values ($1, $2, gen_random_uuid(), $3, now(), now()) returning id`,
      // Stored the way production stores it: TEXT holding a JSON array (D47).
      [`${LEAGUE_TAG}-${options.name}`, JSON.stringify([userId]), options.status],
    );
    const leagueId = leagues[0]?.id;
    if (leagueId == null) throw new Error('could not create the scratch league');

    if (options.seats !== false) {
      const { rows: drafts } = await query<{ id: number; order: number }>(
        `insert into drafts (league_id, year, user_id, "group", "order", dummy,
                             dummy_name, created_at, updated_at)
           values ($1, $2, $3, 1, 1, false, null, now(), now()),
                  ($1, $2, null, 1, 2, true, $4, now(), now())
         returning id, "order"`,
        [leagueId, year, userId, `${LEAGUE_TAG} Placeholder`],
      );
      const mine = drafts.find((draft) => draft.order === 1);

      // A show, a points tier and one category of their own (P17.T34), the
      // shape `journeys/03-a-ceremony-night.spec.ts` seeds: `awards.points` is
      // a foreign key into `points` (D41), not a value.
      let awardId: number | undefined;
      if (options.ledger) {
        const { rows: events } = await query<{ id: number }>(
          `insert into events (name, abbreviation, created_at, updated_at)
             values ($1, $1, now(), now()) returning id`,
          [`${LEAGUE_TAG}-${options.name}`],
        );
        const { rows: points } = await query<{ id: number }>(
          `insert into points (level, tier, points, created_at, updated_at)
             values ($1, 3, 7, now(), now()) returning id`,
          [`${LEAGUE_TAG}-${options.name}`],
        );
        const { rows: awards } = await query<{ id: number }>(
          `insert into awards (name, event_id, points, created_at, updated_at)
             values ($1, $2, $3, now(), now()) returning id`,
          [AWARD, events[0]?.id, points[0]?.id],
        );
        awardId = awards[0]?.id;
      }

      for (let index = 0; index < (options.picks ?? 0); index += 1) {
        const { rows: movies } = await query<{ id: number }>(
          `insert into movies (title, sort_title, created_at, updated_at)
             values ($1, $1, now(), now()) returning id`,
          [`${LEAGUE_TAG} Film ${options.name} ${index + 1}`],
        );
        await query(
          `insert into draft_picks (draft_id, movie_id, "order", created_at, updated_at)
             values ($1, $2, $3, now(), now())`,
          [mine?.id, movies[0]?.id, index + 1],
        );
        if (awardId != null) {
          await query(
            `insert into nominations (movie_id, award_id, year, created_at, updated_at)
               values ($1, $2, $3, now(), now())`,
            [movies[0]?.id, awardId, year],
          );
        }
      }
    }

    return leagueId;
  });
}

/**
 * 🔴 Picks first, then drafts, then leagues. `draft_picks` has no foreign key,
 * so rows deleted in the other order are orphaned rather than removed — and an
 * orphan is invisible to every league-scoped query while still counting in
 * `lib/db.test.ts`.
 */
async function cleanupLeagues() {
  await withDb(async (query) => {
    // The ledger fixture's show, category and nominations (P17.T34) first.
    const show = `(select a.id from awards a join events e on e.id = a.event_id
                    where e.abbreviation like $1)`;
    await query(`delete from nominations where award_id in ${show}`, [`${LEAGUE_TAG}%`]);
    await query(`delete from awards where id in ${show}`, [`${LEAGUE_TAG}%`]);
    await query('delete from events where abbreviation like $1', [`${LEAGUE_TAG}%`]);
    await query('delete from points where level like $1', [`${LEAGUE_TAG}%`]);
    await query(
      `delete from draft_picks where draft_id in
         (select d.id from drafts d join leagues l on l.id = d.league_id
           where l.name like $1)`,
      [`${LEAGUE_TAG}%`],
    );
    await query(
      'delete from drafts where league_id in (select id from leagues where name like $1)',
      [`${LEAGUE_TAG}%`],
    );
    await query('delete from leagues where name like $1', [`${LEAGUE_TAG}%`]);
    await query('delete from movies where title like $1', [`${LEAGUE_TAG}%`]);
  });
}

/**
 * A season of the admin test's own to offer the switch. CI's database holds
 * exactly one season, so "pick any other option" found none there and the
 * test failed as `the corpus has only one season` — it only ever passed on the
 * restored copy. Inactive, so `available_years_one_active` is untouched.
 *
 * 🔴 Removed by the test itself, not `afterAll` — every worker runs a
 * file-level hook, and one could delete the row mid-test in another. And only
 * while inactive: if a regression ever let the switch commit, the row survives
 * and `lib/db.test.ts`'s ten-season count goes red — loud — rather than this
 * delete leaving the database with no active season at all.
 */
const SCRATCH_YEAR = 2992;

/*
 * 🔴 No file-level `afterAll` deleting this file's users — the same hazard the
 * scratch season above dodges, and here it bit. With `fullyParallel` a
 * file-level hook runs once *per worker*, so the worker that finished the
 * parallel tests above deleted every `e2e-p17-*` user while another worker was
 * still inside the serial league tests — whose page then rendered signed out,
 * and a roster test timed out waiting for a roster. One such timeout in every
 * run of this file with `dashboard.spec.ts` at four workers, on main as well.
 * `e2e/global-teardown.ts` removes them after every worker is done.
 */

test.describe('signed-in surfaces', () => {
  test('the active season cannot be changed without confirming', async ({ page }) => {
    // 🔴 This test never accepts the confirmation, so it never writes. The
    // scratch account is promoted to admin rather than skipping — a skipped
    // safety test is not a safety test — and removed by the global teardown.
    const id = await signInAs(page, {
      email: `${TAG}-admin@example.test`,
      firstName: 'Admin',
    });
    await withDb(async (query) => {
      await query(`update users set role = 'admin' where id = $1`, [id]);
      await query(
        `insert into available_years (year, is_active, created_at, updated_at)
           values ($1, false, now(), now()) on conflict (year) do nothing`,
        [SCRATCH_YEAR],
      );
    });

    const before = await withDb(async (query) => {
      const { rows } = await query<{ year: number }>(
        `select year from available_years where is_active = true`,
      );
      return rows[0]?.year ?? null;
    });

    try {
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
      const other = (await select.locator('option').allTextContents()).find((text) =>
        text.includes(String(SCRATCH_YEAR)),
      );
      if (!other) throw new Error(`the scratch season ${SCRATCH_YEAR} is not offered`);

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
    } finally {
      await withDb((query) =>
        query('delete from available_years where year = $1 and not is_active', [
          SCRATCH_YEAR,
        ]),
      );
    }
  });

  test('on the real board, the de-emphasis token does not outnumber the subject', async ({
    page,
  }) => {
    // P17.T34, the aggregate. Read-only on league 1, because the multiplier
    // only exists at real size: two `dim` spans per ledger line, per pick, per
    // layout, over a sixteen-seat board. Measured on the 5434 clone the way
    // the plan's step 1 counts (elements carrying the class, both layouts):
    // dim 6,119 / secondary 1,314 / primary 1,550 before, 668 / 6,765 / 1,550
    // after. 🔴 A scratch league cannot hold this: at three picks dim was
    // already under primary before the change (62 against 68), so the same
    // assertion there passed against the defect.
    await skipWithoutRestoredCorpus();
    await signInAs(page, { email: `${TAG}-dimcount@example.test` });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/leagues/1');
    await expect(page.getByRole('table', { name: /Draft board/ }).first()).toBeVisible();

    const counts = await page.evaluate(() => ({
      dim: document.querySelectorAll('[class*="text-text-dim"]').length,
      primary: document.querySelectorAll('[class*="text-text-primary"]').length,
    }));

    expect(counts.dim).toBeLessThanOrEqual(counts.primary);
  });

  test('a single-column page has one left edge, not three', async ({ page }) => {
    // 🔴 Its own address. Two tests in this file sharing one email means two
    // workers running the same `insert … on conflict` on `users` at the same
    // moment, and the lock that takes blocks every page in the suite that reads
    // a user — measured as two 30s timeouts in `dashboard.spec.ts`, 60 lines
    // and one file away from anything this test touches.
    await signInAs(page, { email: `${TAG}-edges-list@example.test`, firstName: 'Edges' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/list');

    const heading = await page.getByRole('heading', { name: 'Draft list' }).boundingBox();
    const field = await page.getByLabel('Add a film').boundingBox();
    if (!heading || !field) throw new Error('no layout');

    // Nested containers each adding their own gutter produced 445 / 469 / 493.
    // The column has one edge; a card's internal padding is a card's business.
    expect(Math.abs(heading.x - field.x)).toBeLessThan(2);
  });

  test('the empty state is a card on the column, not a third edge', async ({ page }) => {
    // 445 / 469 / 493 was heading / search field / empty state. Deleting the
    // page's own Panel removes the middle edge; the empty state's *card edge*
    // then lands on the column and only its text is inset, which is a card's
    // business.
    //
    // 🔴 This replaces the plan's structural sweep, which could not do this
    // job. Its "no element inside main repeats main's background with padding"
    // rule flags `EmptyState` exactly as hard as it flags the deleted wrapper —
    // both are `bg-bg-surface` with padding at the column's full width, and
    // nothing in the DOM distinguishes "card" from "duplicate column". (The
    // plan's own version could not fail at all: its 90%-of-main width floor
    // excluded a `max-w-3xl` column inside a ~1154px content box.)
    await signInAs(page, {
      email: `${TAG}-edges-empty@example.test`,
      firstName: 'Edges',
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/list');

    const heading = await page.getByRole('heading', { name: 'Draft list' }).boundingBox();
    const title = page.getByRole('heading', { level: 3 }).first();
    const card = await title.locator('..').boundingBox();
    const titleBox = await title.boundingBox();
    if (!heading || !card || !titleBox) throw new Error('no layout');

    expect(Math.abs(card.x - heading.x)).toBeLessThan(2);
    expect(titleBox.x - card.x).toBeGreaterThan(8);
  });
});

/**
 * The league page's hierarchy (P17.T30), its second column (P17.T31), and the
 * home page that points at it (P17.T29) — here rather than in a describe of its
 * own because it seeds the same `LEAGUE_TAG` rows this block clears wholesale.
 *
 * 🔴 Serial, and on `LEAGUE_TAG` alone: every test seeds a league matching one
 * tag and the teardown clears the tag wholesale, so run side by side one test's
 * cleanup takes another's league out from under it.
 */
test.describe('the league page', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(cleanupLeagues);
  test.afterAll(cleanupLeagues);

  test('an owner gets controls, not underlined metadata, and no raw invite URL', async ({
    page,
  }) => {
    const userId = await signInAs(page, {
      email: `${TAG}-owner-pending@example.test`,
      firstName: 'Owner',
    });
    const leagueId = await scratchLeague(userId, { name: 'pending', status: 'pending' });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/leagues/${leagueId}`);

    // 🔴 Not just "is a link": it was already a link, an 18px underlined one in
    // a baseline row. What changed is that it is a control — a filled target a
    // thumb can hit — and the fill is what says it is the act this state calls
    // for. Both are read off the rendered element, so the old treatment fails
    // both.
    const run = page.getByRole('link', { name: 'Run the draft' });
    const setUp = page.getByRole('link', { name: 'Set up the season' });
    const runBox = await run.boundingBox();
    expect(runBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    const filled = async (locator: typeof run) =>
      locator.evaluate((node) => getComputedStyle(node).backgroundColor);
    const transparent = /rgba\(0, 0, 0, 0\)|transparent/;
    // A pending draft: running it is primary, setting up again is not.
    expect(await filled(run)).not.toMatch(transparent);
    expect(await filled(setUp)).toMatch(transparent);

    // 🔴 Not printed on arrival, and reachable in one click.
    //
    // 🔴 `toHaveCount(0)` again since P14.T15. Against P17.T30's `<details>`
    // it would have been wrong — a closed disclosure keeps its contents in the
    // DOM and in the served HTML, which is why this said `not.toBeVisible()`
    // — but the dialog renders its children only while open, so the credential
    // really is absent until it is asked for.
    await expect(page.getByText(/\/join\//)).toHaveCount(0);
    await page.getByRole('button', { name: 'Invite', exact: true }).click();
    await expect(page.getByText(/\/join\//)).toBeVisible();
  });

  test('with no seats, setting up the season is the primary act', async ({ page }) => {
    // The other side of the branch. Without this, "primary" could be hardcoded
    // onto "Run the draft" and the test above would not notice.
    const userId = await signInAs(page, {
      email: `${TAG}-owner-empty@example.test`,
      firstName: 'Owner',
    });
    const leagueId = await scratchLeague(userId, {
      name: 'empty',
      status: 'pending',
      seats: false,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/leagues/${leagueId}`);

    const fill = async (name: string) =>
      page
        .getByRole('link', { name })
        .evaluate((node) => getComputedStyle(node).backgroundColor);
    const transparent = /rgba\(0, 0, 0, 0\)|transparent/;
    expect(await fill('Set up the season')).not.toMatch(transparent);
    expect(await fill('Run the draft')).toMatch(transparent);
  });

  test('a complete season offers no invite at all', async ({ page }) => {
    // `drafting_status = 'complete'` is a real enum value and two production
    // leagues carry it. Nobody is left to invite, and a standing join
    // credential on screen is a liability rather than an affordance.
    const userId = await signInAs(page, {
      email: `${TAG}-owner-complete@example.test`,
      firstName: 'Owner',
    });
    const leagueId = await scratchLeague(userId, {
      name: 'complete',
      status: 'complete',
      picks: 2,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/leagues/${leagueId}`);

    // The controls are still there — this is about the invite only.
    await expect(page.getByRole('link', { name: 'Run the draft' })).toBeVisible();
    await expect(page.getByText('Invite')).toHaveCount(0);
    await expect(page.getByText(/\/join\//)).toHaveCount(0);
  });

  test('the league header does not wrap to two mono lines on a phone', async ({
    page,
  }) => {
    const userId = await signInAs(page, {
      email: `${TAG}-owner-phone@example.test`,
      firstName: 'Owner',
    });
    const leagueId = await scratchLeague(userId, { name: 'phone', status: 'pending' });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/leagues/${leagueId}`);

    const heading = await page.getByRole('heading', { level: 1 }).boundingBox();
    const invite = await page.getByText('Invite').boundingBox();
    if (!heading || !invite) throw new Error('no layout');

    // Whatever sits under the name, it is controls, not a wrapped URL. 96px is
    // two mono lines plus the copy button; a row of controls plus the closed
    // disclosure is less.
    expect(invite.y + invite.height - (heading.y + heading.height)).toBeLessThan(160);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  });

  test('a seated member who has not drafted is not told they have no seat', async ({
    page,
  }) => {
    // 🔴 The page branched on how many picks the reader had, not on whether
    // they held a seat, so a member seated in a league that has not drafted
    // read "You do not hold a seat this season" — while the standings table
    // beside it listed them by name. Found on the final frame of P19.T2's
    // journey, where the league's own owner is in exactly this state.
    const userId = await signInAs(page, {
      email: `${TAG}-seat-empty@example.test`,
      firstName: 'Seated',
    });
    const leagueId = await scratchLeague(userId, {
      name: 'seat-no-picks',
      status: 'pending',
      picks: 0,
    });

    await page.goto(`/leagues/${leagueId}`);

    await expect(page.getByText('You do not hold a seat this season')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Your seat is empty until the draft' }),
    ).toBeVisible();
  });

  test("the reader's own roster sits beside the standings, not 5,000px below", async ({
    page,
  }) => {
    const userId = await signInAs(page, {
      email: `${TAG}-seat@example.test`,
      firstName: 'Seat',
    });
    const leagueId = await scratchLeague(userId, {
      name: 'roster',
      status: 'active',
      picks: 3,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/leagues/${leagueId}`);

    const standings = await page.getByRole('table').first().boundingBox();
    const roster = await page
      .getByRole('list', { name: 'Drafted films, in draft order' })
      .first()
      .boundingBox();
    const main = await page.locator('main').boundingBox();
    if (!standings || !roster || !main) throw new Error('no layout');

    // Beside, not below: their vertical ranges overlap.
    expect(roster.y).toBeLessThan(standings.y + standings.height);
    // And the pair fills the column rather than leaving 55% of it empty.
    const used =
      Math.max(roster.x + roster.width, standings.x + standings.width) -
      Math.min(roster.x, standings.x);
    expect(used).toBeGreaterThan(main.width * 0.7);
  });

  test('on a phone the roster comes first and the standings follow', async ({ page }) => {
    const userId = await signInAs(page, {
      email: `${TAG}-seat-phone@example.test`,
      firstName: 'Seat',
    });
    const leagueId = await scratchLeague(userId, {
      name: 'rosterphone',
      status: 'active',
      picks: 3,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/leagues/${leagueId}`);

    const roster = await page
      .getByRole('list', { name: 'Drafted films, in draft order' })
      .first()
      .boundingBox();
    const standings = await page.getByRole('table').first().boundingBox();
    if (!roster || !standings) throw new Error('no layout');

    expect(roster.y).toBeLessThan(standings.y);
  });

  test('no signed-in text renders below the 11px floor', async ({ page }) => {
    // P17.T33. 11px is `Eyebrow`'s floor, the smallest size the product
    // sanctions (D74). Before T18 the board's round badge was `text-[0.65rem]`
    // — 10.4px, 112 rendered on `/leagues/1` alone — and an arbitrary value is
    // invisible to a sweep that matches `text-sm`/`text-xs`. `layering.sh`
    // stops the literal; this stops the *rendered* size, whatever produced it.
    //
    // 🔴 An active league with picks, or the board — where the badge lives —
    // never renders and this passes against the defect.
    const userId = await signInAs(page, {
      email: `${TAG}-floor@example.test`,
      firstName: 'Floor',
    });
    const leagueId = await scratchLeague(userId, {
      name: 'floor',
      status: 'active',
      picks: 3,
    });
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const url of ['/', `/leagues/${leagueId}`, '/leagues', '/list']) {
      await page.goto(url);
      if (url === `/leagues/${leagueId}`) {
        // The board, with a badge on it, actually rendered.
        await expect(page.getByRole('table', { name: /Draft board/ })).toBeVisible();
      }

      // Every leaf element with text, including the layout CSS hides at this
      // width: a hidden phone board still ships its badges to the phone.
      const tooSmall = await page.evaluate(() =>
        [...document.body.querySelectorAll('*')]
          .filter((node) => (node.textContent ?? '').trim().length > 0)
          .filter((node) => node.children.length === 0)
          .map((node) => Number.parseFloat(getComputedStyle(node).fontSize))
          .filter((size) => size > 0 && size < 11),
      );

      expect(tooSmall, `${url} renders text below 11px`).toEqual([]);
    }
  });

  test('content on the league page is `secondary`, not `dim`', async ({ page }) => {
    // P17.T34's rule: `dim` is for text a reader never needs to read —
    // decoration, disclosure marks, placeholders. Column headers, a group's
    // heading, a running-order position and a ledger line are how the page is
    // read, so they are `secondary`. One assertion per site, so a regression
    // names the site rather than nudging a total.
    const userId = await signInAs(page, {
      email: `${TAG}-dim@example.test`,
      firstName: 'Dim',
    });
    const active = await scratchLeague(userId, {
      name: 'dim',
      status: 'active',
      picks: 3,
      ledger: true,
    });
    const pending = await scratchLeague(userId, {
      name: 'dimpending',
      status: 'pending',
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/leagues/${active}`);

    // 🔴 The token resolved the way the page resolves it. `globals.css` holds a
    // hex and `getComputedStyle` answers `rgb()`, so comparing against the
    // custom property's text could never be equal — and could never fail.
    const token = (name: string) =>
      page.evaluate((key) => {
        const probe = document.createElement('span');
        probe.style.color = `var(--color-text-${key})`;
        document.body.append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      }, name);
    const secondary = await token('secondary');
    // The two must be tellable apart at all, or every line below is vacuous.
    expect(secondary).not.toBe(await token('dim'));

    const standings = page.getByRole('table', { name: /League standings/ });
    const board = page.getByRole('table', { name: /Draft board/ });
    await board.locator('summary').first().click();
    const line = board
      .locator('li li', { hasText: AWARD })
      .first()
      .locator(':scope > span');
    await expect(line.first()).toBeVisible();

    const sites = {
      'standings Pos': standings.getByRole('columnheader', { name: 'Pos' }),
      'standings Member': standings.getByRole('columnheader', { name: 'Member' }),
      'standings Points': standings.getByRole('columnheader', { name: 'Points' }),
      'board Seat': board.getByRole('columnheader', { name: 'Seat' }),
      'board round': board.getByRole('columnheader', { name: '01' }),
      'group heading': page.getByRole('heading', { name: 'Group 1' }),
      'ledger award name': line.nth(0),
      'ledger points earned': line.nth(1),
    };
    const found: Record<string, string> = {};
    for (const [site, locator] of Object.entries(sites)) {
      found[site] = await locator.evaluate((node) => getComputedStyle(node).color);
    }

    // The running order, which only a pending league renders.
    await page.goto(`/leagues/${pending}`);
    found['seat order'] = await page
      .locator('main ol')
      .getByText('01', { exact: true })
      .evaluate((node) => getComputedStyle(node).color);

    expect(found).toEqual(
      Object.fromEntries(Object.keys(found).map((key) => [key, secondary])),
    );
  });

  test('on a running draft, each seat name still leads to its member', async ({
    page,
  }) => {
    // The league page is the member index (owner's decision, 2026-09-12). It
    // only linked seats on a pending season; once the draft started the board
    // printed names as plain text, and there was no route to a member at all.
    const userId = await signInAs(page, {
      email: `${TAG}-index@example.test`,
      firstName: 'Index',
      lastName: 'Member',
    });
    const leagueId = await scratchLeague(userId, {
      name: 'index',
      status: 'active',
      picks: 1,
    });
    const uuid = await withDb(async (query) => {
      const { rows } = await query<{ uuid: string }>(
        'select uuid from users where id = $1',
        [userId],
      );
      return rows[0]?.uuid;
    });
    if (!uuid) throw new Error('the scratch member has no uuid');

    // 🔴 Both widths, because the board is two layouts and CSS shows one: the
    // phone list is `md:hidden`, the table `hidden md:block`. Scoped to the
    // group's section, so the standings — which print the same two names — do
    // not answer for the board.
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/leagues/${leagueId}`);
      const board = page.locator('section', {
        has: page.getByRole('heading', { name: 'Group 1' }),
      });

      // Both seats are on the board, in both of its layouts — without this the
      // "no link" assertion below could pass on a board that rendered no
      // placeholder seat at all.
      await expect(board.getByText('Index Member')).toHaveCount(2);
      await expect(board.getByText(`${LEAGUE_TAG} Placeholder`)).toHaveCount(2);

      // One reachable link per seat, not two — the hidden layout is out of the
      // accessibility tree — and it is the displayed layout's.
      const member = board.getByRole('link', { name: 'Index Member' });
      await expect(member).toHaveCount(1);
      expect(
        await member.evaluate((node) => node.closest('table') != null),
        `at ${width}px the link is in the ${width >= 768 ? 'table' : 'phone list'}`,
      ).toBe(width >= 768);
      // The placeholder seat has no member, so no page and no link.
      await expect(
        board.getByRole('link', { name: `${LEAGUE_TAG} Placeholder` }),
      ).toHaveCount(0);

      await member.click();
      await expect(page).toHaveURL(new RegExp(`/members/${uuid}$`));
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Index Member');
    }
  });

  test('a stranger gets a stated empty state in that column, not a hole', async ({
    page,
  }) => {
    // The ordinary case on a shared link (D44/D45): there is no "own roster"
    // for somebody with no session, so the slot has to say what it is for
    // rather than leaving the standings floating beside nothing.
    const userId = await signInAs(page, {
      email: `${TAG}-owner-public@example.test`,
      firstName: 'Owner',
    });
    // `pending`, so this pins the running-order list's seat links. The other
    // half — `DraftBoard`'s, on an active or complete season — was missing
    // until P17.T38 and is pinned by "on a running draft, each seat name still
    // leads to its member" above.
    const leagueId = await scratchLeague(userId, {
      name: 'public',
      status: 'pending',
      picks: 3,
    });

    // A context with no cookie at all — this is the stranger's view.
    const anonymous = await page.context().browser()?.newContext();
    if (!anonymous) throw new Error('no browser');
    const stranger = await anonymous.newPage();
    try {
      await stranger.setViewportSize({ width: 1440, height: 900 });
      await stranger.goto(`/leagues/${leagueId}`);

      await expect(stranger.getByRole('heading', { name: 'Your roster' })).toBeVisible();
      await expect(stranger.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
      // No roster, and nothing an owner gets.
      await expect(
        stranger.getByRole('list', { name: 'Drafted films, in draft order' }),
      ).toHaveCount(0);
      await expect(stranger.getByText('Invite')).toHaveCount(0);
      // 🔴 And the seats still link to member pages — P17.T37 made those
      // public, which is what supersedes the earlier "render the name as plain
      // text when signed out" note.
      await expect(stranger.locator('a[href^="/members/"]').first()).toBeVisible();
    } finally {
      await anonymous.close();
    }
  });

  test("signed in, home opens with the reader's own state", async ({ page }) => {
    const userId = await signInAs(page, {
      email: `${TAG}-home@example.test`,
      firstName: 'Home',
    });
    // Two leagues, because the finding was a member with two, and because
    // the one branch on this section — no roster yet — needs one of each to be
    // able to fail in either direction.
    const drafted = await scratchLeague(userId, {
      name: 'home-drafted',
      status: 'active',
      picks: 3,
    });
    const undrafted = await scratchLeague(userId, {
      name: 'home-undrafted',
      status: 'pending',
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const heading = (name: string) => page.getByRole('heading', { name, exact: true });
    const league = await heading(`${LEAGUE_TAG}-home-drafted`).boundingBox();
    const season = await heading('Season').boundingBox();
    if (!league || !season) throw new Error('no layout');

    // The member's own league comes before the season rail, not 1,499px
    // after it — and on the first screen, which is the whole point.
    expect(league.y).toBeLessThan(season.y);
    expect(league.y).toBeLessThan(900);

    // Name, standing, points, roster, standings and a next action. One of
    // one: the scratch league's second seat is a placeholder, and standings
    // count people.
    const section = (name: string) =>
      page.locator('section').filter({ has: heading(`${LEAGUE_TAG}-${name}`) });
    const mine = section('home-drafted');
    await expect(mine.getByText('Position 1 of 1', { exact: true })).toBeVisible();
    await expect(mine.getByText('Your points')).toBeVisible();
    await expect(
      mine.getByRole('list', { name: 'Drafted films, in draft order' }),
    ).toBeVisible();
    await expect(mine.getByRole('table')).toBeVisible();
    await expect(mine.getByRole('link', { name: 'Open the league' })).toHaveAttribute(
      'href',
      `/leagues/${drafted}`,
    );
    // 🔴 A roster means the draft list is behind them, so it is not offered.
    await expect(mine.getByRole('link', { name: 'Build your draft list' })).toHaveCount(
      0,
    );

    // No roster yet: the draft list is the act available, and it leads.
    const pending = section('home-undrafted');
    await expect(
      pending.getByRole('link', { name: 'Build your draft list' }),
    ).toHaveAttribute('href', '/list');
    await expect(pending.getByRole('link', { name: 'Open the league' })).toHaveAttribute(
      'href',
      `/leagues/${undrafted}`,
    );
  });

  test('signed out, home is still the season', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // 🔴 The document's first two headings, not merely "Season is near the
    // top": a stray signed-in block rendered for a stranger (the "No leagues
    // yet" empty state is an h3) would push Season down a couple of hundred
    // pixels and still pass a y-bound.
    //
    // Signed out the hero owns the `h1` and the season follows it as the `h2`
    // (P18.T10); signed in the season keeps the `h1`, which the tests above
    // this one assert.
    const headings = page.locator('main :is(h1, h2, h3, h4)');
    await expect(headings.first()).toHaveText(/Draft a team of films/);
    await expect(headings.first()).toHaveJSProperty('tagName', 'H1');
    await expect(headings.nth(1)).toHaveText('Season');
    await expect(headings.nth(1)).toHaveJSProperty('tagName', 'H2');
    await expect(page.getByText('No leagues yet')).toHaveCount(0);
    await expect(page.getByTestId('signed-out-hero')).toBeVisible();
  });
});

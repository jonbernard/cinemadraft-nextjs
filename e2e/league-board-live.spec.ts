import { expect, type Page, test } from '@playwright/test';

import { signInAs } from './support/session';

/**
 * 🔴 The P14 tranche-2 gate for **P10.T21** — "live board updates while the
 * draft runs". Two browser contexts against one database: the owner enters a
 * pick in the console, and the board a watcher is already sitting on moves
 * under them. `e2e/live.spec.ts` is the template — this is the same claim one
 * door further in, on `/leagues/[id]` rather than `/live/[abbr]`.
 *
 * 🔴 **Its own `TAG` and `YEAR`, and its own copies of `withDb`/`cleanup`,
 * deliberately.** The plan said to reuse `e2e/live.spec.ts`'s scaffolding; its
 * scaffolding is module-local to that file and, more to the point, is keyed on
 * a single tag whose teardown deletes *everything* matching it. `fullyParallel`
 * is on and `workers: 4`, so two spec files run side by side — sharing
 * `e2e-live` would have this file's `afterEach` delete that file's show
 * mid-flow, which is exactly the failure mode both files' serial-mode comments
 * describe. Every other spec here (`draft.spec.ts`, `award-shows.spec.ts`)
 * carries its own tag and its own copy for the same reason, so "reuse the
 * scaffolding" is honoured as *the same shapes*, not shared module state.
 *
 * 🔴 Scratch rows only. League 1 is sixty real people's history and
 * `lib/db.test.ts` asserts exact row counts against this database, so
 * `cleanup()` removing leagues, seats, picks, shows and accounts by tag is
 * what keeps that test true.
 *
 * 🔴 `/leagues/[id]` is PUBLIC (D44/D45), so the watcher here signs nobody in.
 * That is not a shortcut: what a stranger handed the link sees during a draft
 * is the thing the parity row is about.
 */
const TAG = 'e2e-board';
const YEAR = 2992;
const FILMS = [`${TAG} Alpha`, `${TAG} Bravo`];
/** The owner's seat name, distinct enough to locate a standings row by. */
const OWNER = 'Boardowner';

/**
 * Raw `pg` rather than the Prisma client: Playwright does not resolve the `@/`
 * alias into `generated/prisma`, so importing `lib/db` fails at require time
 * and takes the whole spec with it.
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
      `delete from nominations where award_id in
         (select a.id from awards a join events e on e.id = a.event_id
           where e.abbreviation like $1)`,
      [`${TAG}%`],
    );
    await query(
      `delete from awards where event_id in (select id from events where abbreviation like $1)`,
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
      `delete from drafts where league_id in (select id from leagues where name like $1)`,
      [`${TAG}%`],
    );
    await query('delete from leagues where name like $1', [`${TAG}%`]);
    await query(
      `delete from nominations where movie_id in
         (select id from movies where title like $1)`,
      [`${TAG}%`],
    );
    await query('delete from movies where title like $1', [`${TAG}%`]);
    // Scoped to this spec's own prefix — the other specs seed identities of
    // their own, and a blanket delete takes one of them mid-flow.
    await query(`delete from users where email like '${TAG}-%@example.test'`);
  });
}

/**
 * A scratch show with one category worth 7 and two films nominated in it, so a
 * pick landing on a seat moves that seat's total from 0 to 7.
 *
 * No winners: this file is about the board, and a win would only add a second
 * number to explain. The 7 is the resolved tier value (D41), not
 * `awards.points`, which is a foreign key.
 */
async function seedShow(): Promise<void> {
  await withDb(async (query) => {
    const events = (await query(
      `insert into events (name, abbreviation, awards_active, created_at, updated_at)
         values ($1, $2, false, now(), now()) returning id`,
      [`${TAG} Show`, `${TAG}-show`],
    )) as { id: number }[];
    const eventId = events[0]?.id;
    if (!eventId) throw new Error('could not create the scratch show');

    const points = (await query(
      `insert into points (level, tier, points, created_at, updated_at)
         values ($1, 3, 7, now(), now()) returning id`,
      [`${TAG}-level`],
    )) as { id: number }[];

    await query(
      `insert into awards (name, event_id, points, created_at, updated_at)
         values ($1, $2, $3, now(), now())`,
      [`${TAG} Best Picture`, eventId, points[0]?.id],
    );

    await query(
      `insert into movies (title, sort_title, created_at, updated_at)
         values ($1, $1, now(), now()), ($2, $2, now(), now())`,
      FILMS,
    );

    // 🔴 Pure SQL rather than ids matched in JavaScript: this schema mixes
    // integer and bigint primary keys, so `pg` hands some back as numbers and
    // some as strings and `===` between them silently finds nothing.
    await query(
      `insert into nominations (movie_id, award_id, year, created_at, updated_at)
         select m.id, a.id, $1, now(), now()
           from movies m
           cross join awards a
           join events e on e.id = a.event_id
          where m.title like $2 and e.abbreviation = $3`,
      [YEAR, `${TAG}%`, `${TAG}-show`],
    );
  });
}

/**
 * A scratch league with two seats — one held by the signed-in owner, one a
 * placeholder — and nothing drafted yet.
 *
 * `status` is the whole point of the fixture: `'active'` is the only state
 * `/api/leagues/[id]/board/stream` answers (P14.T10), and `'complete'` is what
 * the budget test below needs to prove it refuses.
 */
async function seedLeague(
  page: Page,
  { status = 'active' }: { status?: string } = {},
): Promise<{ leagueId: number; ownerId: number }> {
  const ownerId = await signInAs(page, {
    email: `${TAG}-${Date.now()}-${Math.floor(performance.now())}@example.test`,
    firstName: OWNER,
  });

  const leagueId = await withDb(async (query) => {
    const leagues = (await query(
      `insert into leagues (name, owner, uuid, drafting_status, created_at, updated_at)
         values ($1, $2, gen_random_uuid(), $3, now(), now()) returning id`,
      // Stored the way production stores it: TEXT holding a JSON array.
      [`${TAG} league`, JSON.stringify([ownerId]), status],
    )) as { id: number }[];
    const id = leagues[0]?.id;
    if (!id) throw new Error('could not create the scratch league');

    await query(
      `insert into drafts (league_id, year, user_id, "group", "order", dummy, dummy_name,
                           created_at, updated_at)
         values ($1, $2, $3, 1, 1, false, null, now(), now()),
                ($1, $2, null, 1, 2, true, $4, now(), now())`,
      [id, YEAR, ownerId, `${TAG} Placeholder`],
    );

    return id;
  });

  return { leagueId, ownerId };
}

/**
 * A second group on an existing league, so "only one group is on the
 * television" is a claim with two candidates and the group nav has somewhere
 * to go.
 */
async function seedSecondGroup(leagueId: number): Promise<void> {
  await withDb(async (query) => {
    await query(
      `insert into drafts (league_id, year, user_id, "group", "order", dummy, dummy_name,
                           created_at, updated_at)
         values ($1, $2, null, 2, 1, true, $3, now(), now()),
                ($1, $2, null, 2, 2, true, $4, now(), now())`,
      [leagueId, YEAR, `${TAG} Second A`, `${TAG} Second B`],
    );
  });
}

/**
 * The first frame of an SSE connection, read as bytes — `e2e/live.spec.ts`'s
 * helper, for the same reason it exists there.
 *
 * 🔴 The payload, not the page that renders it. "A signed-out watcher gets no
 * seat of their own" is a claim about what crosses the wire, and a DOM
 * assertion would pass just as well against a stream that shipped the seat and
 * a component that happened not to print it.
 *
 * `fetch` inside the page rather than `request.get`: an APIResponse's body is
 * only readable once the response completes, and this one does not complete for
 * its whole lifetime. The reader is cancelled as soon as a frame is in hand,
 * which is also what stops the test leaving a stream open behind it.
 */
async function firstFrame(page: Page, url: string): Promise<string> {
  return page.evaluate(async (target) => {
    const response = await fetch(target);
    if (!response.body) return `status:${response.status}`;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    try {
      // Bounded: a frame is one enqueue today, and a loop with no ceiling
      // against a stream with no end is a hung test rather than a red one.
      for (let read = 0; read < 20 && !text.includes('\n\n'); read += 1) {
        const chunk = await reader.read();
        if (chunk.done) break;
        text += decoder.decode(chunk.value, { stream: true });
      }
    } finally {
      await reader.cancel();
    }
    return text;
  }, url);
}

test.describe('the league board, live', () => {
  // Serial for the same reason `live.spec.ts` is: every test seeds rows
  // matching one shared tag and the teardown clears the tag wholesale, so run
  // side by side one test's cleanup takes another's league out from under it.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(cleanup);

  test.afterEach(cleanup);

  // Again after every test has finished. `afterEach` runs while the browser is
  // still open, and a request already in flight can re-provision the account it
  // just deleted — the lazy claim path in `lib/auth.ts` creates a row for any
  // valid session that reaches a page. That left one stray user behind and
  // failed `lib/db.test.ts`, which counts the restored 60.
  test.afterAll(cleanup);

  test('a pick the owner enters lands on a watcher’s board with no navigation', async ({
    page,
    browser,
  }) => {
    // 🔴 The tranche gate. Two contexts, two sessions, one database: the owner
    // drafts in the console and the board the other context is sitting on
    // changes under a reader who touched nothing.
    test.setTimeout(60_000);

    await seedShow();
    const { leagueId } = await seedLeague(page);

    const audience = await browser.newContext();
    const viewer = await audience.newPage();
    try {
      /**
       * 🔴 Documents, not navigations. `framenavigated` also fires for a
       * SAME-document history entry — the App Router writes one while it
       * hydrates — so counting those races hydration and is not a navigation
       * counter at all. `load` fires once per real document, which is the thing
       * this test is about. A value stashed on `window` says the same thing a
       * second way: only a fresh document loses it.
       */
      let documents = 0;
      viewer.on('load', () => {
        documents += 1;
      });

      await viewer.goto(`/leagues/${leagueId}?year=${YEAR}`);

      const standings = viewer.getByRole('table', {
        name: 'League standings, by position',
      });
      const ownerRow = standings.getByRole('row').filter({ hasText: OWNER });
      const ownerTotal = ownerRow.getByRole('cell').last();
      const board = viewer.getByRole('table', {
        name: 'Draft board: one row per seat, one column per round',
      });

      // Not vacuous: nothing is drafted, so the film is absent and the total
      // is zero *before* the pick. Both are asserted, so a test that passed
      // against a board that always showed Alpha would go red here.
      await expect(ownerTotal).toHaveText('0');
      await expect(board.getByText(FILMS[0] as string)).toHaveCount(0);

      await viewer.evaluate(() => {
        (window as unknown as { __gateDocument?: string }).__gateDocument = 'the first';
      });
      const settled = documents;

      // The console. Seat 1 is up — the owner's own — so this pick lands on
      // the row the watcher is already looking at.
      await page.goto(`/leagues/${leagueId}/draft?year=${YEAR}`);
      await page.getByRole('searchbox').fill('Alph');
      await page.getByRole('button', { name: new RegExp(FILMS[0] as string) }).click();

      // The pick is actually in the database before anything is claimed about
      // the other screen — the row, not the console's optimistic state.
      await expect
        .poll(() =>
          withDb(async (query) => {
            const rows = (await query(
              `select count(*)::int as n from draft_picks dp
                 join drafts d on d.id = dp.draft_id
                where d.league_id = $1`,
              [leagueId],
            )) as { n: number }[];
            return rows[0]?.n;
          }),
        )
        .toBe(1);

      // And the other client carries it. The poll waits on the stream's 2s
      // tick, which is the only thing that can deliver this: the watcher has
      // not navigated and nothing on their page fetches.
      // `.first()`: a cell prints its film's title twice — once under the
      // poster, once as the label of the points ledger it opens — so a count of
      // 1 would be asserting an implementation detail of `PickCell`.
      await expect(board.getByText(FILMS[0] as string).first()).toBeVisible({
        timeout: 20_000,
      });
      // The same frame, the other column — the seat total moved with it.
      await expect(ownerTotal).toHaveText('7');

      expect(documents).toBe(settled);
      expect(
        await viewer.evaluate(
          () => (window as unknown as { __gateDocument?: string }).__gateDocument,
        ),
      ).toBe('the first');
    } finally {
      await audience.close();
    }
  });

  test('a watcher of a finished league opens no stream, and the route refuses one', async ({
    page,
    browser,
  }) => {
    /**
     * 🔴 The budget, proved rather than asserted — and proved at **both**
     * layers, because they are two independent guards and a test of one is
     * silent about the other. `LeagueBoardRoom`'s effect returns before
     * constructing an `EventSource` when the server's own frame says the league
     * is not drafting; the route answers 204 for the same reason (P14.T10).
     * Deleting either leaves the other standing, so the first half watches for
     * the request the page makes and the second asks the route directly.
     *
     * A `complete` league would otherwise hold a connection open for months of
     * a forgotten tab against a 100 CU-hr allowance, to move numbers that do
     * not move.
     */
    await seedShow();
    const { leagueId: finished } = await seedLeague(page, { status: 'complete' });
    const { leagueId: running } = await seedLeague(page);

    const audience = await browser.newContext();
    const viewer = await audience.newPage();
    try {
      const opened: string[] = [];
      viewer.on('request', (request) => {
        if (request.url().includes('/board/stream')) opened.push(request.url());
      });

      /**
       * 🔴 **No quiet interval, and no clock.** "Nothing happened for N
       * seconds" cannot tell *refused* from *not started yet* without picking
       * an N, and `scripts/layering.sh` forbids waiting on one here for exactly
       * that reason. So the silence is measured against a positive signal in
       * the same page: the finished league first, then an `active` one, and the
       * second one's connection is the proof that a hydrated board does open
       * one. Delete the client's guard and this reads two requests, the first
       * naming the finished league.
       */
      await viewer.goto(`/leagues/${finished}?year=${YEAR}`);
      await expect(
        viewer.getByRole('table', {
          name: 'Draft board: one row per seat, one column per round',
        }),
      ).toBeVisible();

      await viewer.goto(`/leagues/${running}?year=${YEAR}`);
      await expect.poll(() => opened.length).toBe(1);
      expect(opened[0]).toContain(`/api/leagues/${running}/board/stream`);

      // And the door itself is shut, which is a separate guard the count above
      // is silent about — the client never asks, so the route's own refusal has
      // to be asked for directly. 204, not an empty 200: `EventSource` retries
      // a dropped 200 forever and gives up on any other status, so 204 is the
      // only way a server can say *stop asking* (D110).
      const status = await viewer.evaluate(
        async (url) => (await fetch(url)).status,
        `/api/leagues/${finished}/board/stream?year=${YEAR}`,
      );
      expect(status).toBe(204);
    } finally {
      await audience.close();
    }
  });

  test('TV mode puts one whole group on a television without costing the stream', async ({
    page,
    browser,
  }) => {
    /**
     * 🔴 P14.T19, and the owner's requirement verbatim: "the picks for every
     * player in the group needs to be visible at once", with the chrome gone.
     * Four claims in one flow, because they are one feature: no chrome, no
     * sideways scroll, every seat and every cell of the chosen group, and a
     * pick entered elsewhere still landing live. The last is the one TV mode
     * could quietly break — a reader who casts the board and then watches a
     * still picture has lost the whole thing.
     */
    test.setTimeout(60_000);

    await seedShow();
    const { leagueId } = await seedLeague(page);
    await seedSecondGroup(leagueId);

    // One pick before the watcher arrives: `rounds` is the longest seat in the
    // group, so an undrafted group has no columns at all and "every cell" would
    // be a claim about zero of them.
    await page.goto(`/leagues/${leagueId}/draft?year=${YEAR}`);
    await page.getByRole('searchbox').fill('Alph');
    await page.getByRole('button', { name: new RegExp(FILMS[0] as string) }).click();
    await expect
      .poll(() =>
        withDb(async (query) => {
          const rows = (await query(
            `select count(*)::int as n from draft_picks dp
               join drafts d on d.id = dp.draft_id
              where d.league_id = $1`,
            [leagueId],
          )) as { n: number }[];
          return rows[0]?.n;
        }),
      )
      .toBe(1);

    const audience = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const viewer = await audience.newPage();
    try {
      await viewer.goto(`/leagues/${leagueId}?year=${YEAR}&tv=1`);

      // 🔴 Still in the DOM and not on screen, which is what tells "hidden"
      // from "never rendered" — and 1920 is the only width where the rail is
      // on screen at all. No CSS was written for this page: the rule in
      // globals.css is keyed on `data-tv-mode`, which the page now sets.
      const rail = viewer.locator('nav[aria-label="Main"]');
      await expect(rail).toHaveCount(1);
      await expect(rail).toBeHidden();

      // A television cannot scroll, in either direction. The height is the
      // binding constraint and is measured in the task's own production run;
      // what a test can hold forever is that nothing runs off the side.
      expect(await viewer.evaluate(() => document.documentElement.scrollWidth)).toBe(
        1920,
      );

      // One group, not both stacked — and all of it.
      const board = viewer.getByRole('table', {
        name: 'Draft board: one row per seat, one column per round',
      });
      await expect(board).toHaveCount(1);
      await expect(viewer.getByRole('heading', { name: 'Group 1' })).toBeVisible();
      const rounds = (await board.locator('thead th').count()) - 1;
      expect(rounds).toBeGreaterThan(0);
      await expect(board.locator('tbody tr')).toHaveCount(2);
      await expect(board.locator('tbody td')).toHaveCount(2 * rounds);

      // 🔴 D114, exactly: the live room's league picker shipped dropping
      // `?tv=1` and stranded a reader who had a remote and no address bar. The
      // group nav is the same control in the same trap.
      await viewer
        .getByRole('navigation', { name: 'Groups' })
        .getByRole('link', { name: 'Group 2' })
        .click();
      await expect(viewer).toHaveURL(/group=2/);
      await expect(viewer).toHaveURL(/tv=1/);
      await expect(rail).toBeHidden();
      await expect(viewer.getByRole('heading', { name: 'Group 2' })).toBeVisible();
      // And the way out is still on the screen TV mode left behind.
      await expect(viewer.getByRole('link', { name: 'Leave TV mode' })).toBeVisible();

      await viewer.goto(`/leagues/${leagueId}?year=${YEAR}&group=1&tv=1`);
      await expect(board.getByText(FILMS[0] as string).first()).toBeVisible();
      await expect(board.getByText(FILMS[1] as string)).toHaveCount(0);

      let documents = 0;
      viewer.on('load', () => {
        documents += 1;
      });

      // The owner drafts the second film. It has to arrive on the television
      // with nobody touching it — TV mode must not cost the stream.
      await page.goto(`/leagues/${leagueId}/draft?year=${YEAR}`);
      await page.getByRole('searchbox').fill('Brav');
      await page.getByRole('button', { name: new RegExp(FILMS[1] as string) }).click();

      await expect(board.getByText(FILMS[1] as string).first()).toBeVisible({
        timeout: 20_000,
      });
      expect(documents).toBe(0);
      await expect(rail).toBeHidden();
    } finally {
      await audience.close();
    }
  });

  test('a signed-out watcher gets the board and no seat of their own', async ({
    page,
    browser,
  }) => {
    /**
     * 🔴 Read off the wire, not out of the DOM — the tranche 1 pattern. The
     * stream is a second door into the same data and the page's privacy line
     * has to hold at both, so this asserts the frame's shape rather than what a
     * component chose to print.
     *
     * Asserted as a **pair** against one seeded league: the stranger gets the
     * whole board and no seat, and the owner reading the same URL gets their
     * seat. Either half alone is unfalsifiable — an absence proves nothing
     * against data that was never seeded.
     */
    await seedShow();
    const { leagueId } = await seedLeague(page);

    const url = `/api/leagues/${leagueId}/board/stream?year=${YEAR}`;

    const stranger = await browser.newContext();
    try {
      const anon = await stranger.newPage();
      // A document on the origin, so `fetch` is same-origin — and with no
      // cookie, because this context has never signed anybody in.
      await anon.goto(`/leagues/${leagueId}?year=${YEAR}`);
      const open = JSON.parse(
        (await firstFrame(anon, url)).replace(/^data: /, '').trim(),
      );

      // The board is all there: the league, both seats, the running order.
      expect(open).toMatchObject({
        leagueName: `${TAG} league`,
        year: YEAR,
        isDrafting: true,
        viewerSeatId: null,
        viewerRoster: [],
        viewerSeated: false,
      });
      expect(JSON.stringify(open)).toContain(`${TAG} Placeholder`);
      expect(JSON.stringify(open)).toContain(OWNER);
      // No row claims to be theirs.
      expect(
        (open.standings as { isViewer: boolean }[]).filter((row) => row.isViewer),
      ).toEqual([]);

      // And the same URL, read by the seat's holder, hands back the seat — so
      // the absence above is a refusal rather than an empty fixture.
      await page.goto(`/leagues/${leagueId}?year=${YEAR}`);
      const mine = JSON.parse(
        (await firstFrame(page, url)).replace(/^data: /, '').trim(),
      );
      expect(mine.viewerSeatId).not.toBeNull();
      expect(mine.viewerSeated).toBe(true);
      expect(
        (mine.standings as { isViewer: boolean }[]).filter((row) => row.isViewer),
      ).toHaveLength(1);
    } finally {
      await stranger.close();
    }
  });
});

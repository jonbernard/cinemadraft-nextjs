import { expect, type Page, test } from '@playwright/test';

import { signInAs } from './support/session';

/**
 * 🔴 The Phase 6 gate: the owner can run a draft, and nobody else can touch it.
 *
 * Everything here happens in a **scratch league created by the test**, owned by
 * the throwaway identity it signs up. The dashboard spec relinks onto a real
 * restored account because it only reads; this one writes picks, and writing
 * into league 1 would edit sixty real people's draft history. The scratch rows
 * are removed afterwards.
 *
 * The pointer drag is exercised here rather than in jsdom, where every element
 * box measures zero and `@hello-pangea/dnd` will not start a drag at all.
 */
const TAG = 'e2e-draft';
const YEAR = 2996;
const FILMS = [`${TAG} Alpha`, `${TAG} Bravo`, `${TAG} Charlie`];

/**
 * Raw `pg` rather than the Prisma client: Playwright does not resolve the
 * `@/` alias into `generated/prisma`, so importing `lib/db` fails at require
 * time and takes the whole spec with it.
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
    await query('delete from movies where title like $1', [`${TAG}%`]);
    // Scoped to this spec's own prefix — the other specs seed identities of
    // their own, and a blanket delete takes one of them mid-flow.
    await query(`delete from users where email like '${TAG}-%@example.test'`);
  });
}

/**
 * Seat a throwaway identity and build it a league to run.
 *
 * The session is the signed test cookie rather than a Clerk sign-up (D82/D84):
 * the app under test boots with no Clerk at all, and what this spec is about is
 * the console, not the door.
 */
async function signInAsOwner(page: Page): Promise<{ leagueId: number }> {
  const address = `${TAG}-${Date.now()}-${Math.floor(performance.now())}@example.test`;
  const ownerId = await signInAs(page, { email: address, firstName: 'Owner' });

  return withDb(async (query) => {
    const leagues = (await query(
      `insert into leagues (name, owner, uuid, drafting_status, created_at, updated_at)
         values ($1, $2, gen_random_uuid(), 'active', now(), now())
       returning id`,
      // Stored the way production stores it: TEXT holding a JSON array.
      [`${TAG} league`, JSON.stringify([ownerId])],
    )) as { id: number }[];
    const leagueId = leagues[0]?.id;
    if (!leagueId) throw new Error('could not create the scratch league');

    for (const [index, name] of ['Ada', 'Grace'].entries()) {
      await query(
        `insert into drafts (league_id, year, "group", "order", dummy, dummy_name,
                             created_at, updated_at)
           values ($1, $2, 1, $3, true, $4, now(), now())`,
        [leagueId, YEAR, index + 1, name],
      );
    }

    for (const title of FILMS) {
      await query(
        `insert into movies (title, sort_title, created_at, updated_at)
           values ($1, $1, now(), now())`,
        [title],
      );
    }

    return { leagueId };
  });
}

/** The seat a pick landed on, and the round it took, read from the database. */
async function picksInLeague(leagueId: number) {
  return withDb(async (query) =>
    query(
      `select d.dummy_name as seat, dp."order" as round, m.title
         from draft_picks dp
         join drafts d on d.id = dp.draft_id
         join movies m on m.id = dp.movie_id
        where d.league_id = $1
        order by d."order", dp."order"`,
      [leagueId],
    ),
  ) as Promise<{ seat: string; round: number; title: string }[]>;
}

test.describe('draft', () => {
  // Serial, not parallel. Each test seats its own identity and `afterEach`
  // clears every account and league matching this spec's tag — run side by
  // side, one test's cleanup deletes another's league mid-flight, and the
  // failure looks like a broken console rather than a fixture racing itself.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(cleanup);

  test.afterEach(cleanup);

  // Again after every test has finished. `afterEach` runs while the browser is
  // still open, and a request already in flight can re-provision the account
  // it just deleted — the lazy claim path in `lib/auth.ts` creates a row for
  // any valid session that reaches a page. That left one stray user behind and
  // failed `lib/db.test.ts`, which counts the restored 60.
  test.afterAll(cleanup);

  test('the owner drafts a film onto the seat that is picking', async ({ page }) => {
    const { leagueId } = await signInAsOwner(page);
    await page.goto(`/leagues/${leagueId}/draft?year=${YEAR}`);

    // The first seat is up, and says so in words rather than by colour alone.
    await expect(page.getByRole('heading', { name: 'Pick for Ada' })).toBeVisible();

    // A fragment of the title is enough — the owner is typing what someone
    // just said out loud on the call.
    await page.getByRole('searchbox').fill('Brav');
    await page.getByRole('button', { name: new RegExp(FILMS[1] as string) }).click();

    // The turn advances on its own.
    await expect(page.getByRole('heading', { name: 'Pick for Grace' })).toBeVisible();

    expect(await picksInLeague(leagueId)).toEqual([
      { seat: 'Ada', round: 1, title: FILMS[1] },
    ]);
  });

  test('a film already taken in the group is offered as taken, not assignable', async ({
    page,
  }) => {
    const { leagueId } = await signInAsOwner(page);
    await page.goto(`/leagues/${leagueId}/draft?year=${YEAR}`);

    await page.getByRole('searchbox').fill('Alph');
    await page.getByRole('button', { name: new RegExp(FILMS[0] as string) }).click();
    await expect(page.getByRole('heading', { name: 'Pick for Grace' })).toBeVisible();

    await page.getByRole('searchbox').fill('Alph');
    const gone = page.getByRole('button', { name: new RegExp(FILMS[0] as string) });
    await expect(gone).toContainText('Taken');
    await expect(gone).toBeDisabled();
  });

  test('a reorder survives a reload', async ({ page }) => {
    const { leagueId } = await signInAsOwner(page);
    await page.goto(`/leagues/${leagueId}/draft?year=${YEAR}`);

    // Two picks onto one seat: take one, then come back to that seat.
    await page.getByRole('searchbox').fill('Alph');
    await page.getByRole('button', { name: new RegExp(FILMS[0] as string) }).click();
    await expect(page.getByRole('heading', { name: 'Pick for Grace' })).toBeVisible();
    await page.getByRole('button', { name: /Ada/ }).click();
    await page.getByRole('searchbox').fill('Brav');
    await page.getByRole('button', { name: new RegExp(FILMS[1] as string) }).click();

    // Wait for the second pick to land before overriding again: the turn
    // advances by clearing the override, so a click that lands mid-flight is
    // undone a moment later.
    await expect(page.getByRole('heading', { name: 'Pick for Grace' })).toBeVisible();

    // The console shows the picks of whichever seat is up, and after a pick
    // lands the turn moves on — so come back to Ada to see her two.
    await page.getByRole('button', { name: /Ada/ }).click();

    const list = page.getByRole('list', { name: /Picks, in draft order/ });
    await expect(list.getByRole('listitem')).toHaveCount(2);

    // A real pointer drag, in a real browser — the thing jsdom cannot do.
    const first = list.getByRole('listitem').first();
    const second = list.getByRole('listitem').nth(1);
    const target = await second.boundingBox();
    if (!target) throw new Error('the second pick has no box');
    await first.hover();
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height, {
      steps: 12,
    });
    await page.mouse.up();

    await expect(list.getByRole('listitem').first()).toContainText(FILMS[1] as string);

    // 🔴 Wait for the write, THEN reload — the assertion above is of the
    // OPTIMISTIC order. `onReorder` is a server action the drop fires and does
    // not await, and a reload cancels whatever is still in flight: held the
    // POST past a `page.reload()` deliberately and the new order never reached
    // the database at all, four seconds later. So on a loaded runner the
    // reload outruns the commit, the server renders the OLD order, and nothing
    // is coming to fix it — which is exactly how this went red on CI
    // (2026-09-13, run 34798741232: twice, "01e2e-draft Alpha" for the whole
    // five seconds, green only on the second retry). Same bug, same path, as
    // journey 5's beat.
    await expect
      .poll(async () => (await picksInLeague(leagueId))[0]?.title)
      .toBe(FILMS[1]);

    await page.reload();
    // A fresh page opens on whoever is up, which is Grace — so ask for Ada's
    // list again. What is being tested is that the new order came back from
    // the server, not that it survived in the tab.
    await page.getByRole('button', { name: /Ada/ }).click();
    await expect(
      page
        .getByRole('list', { name: /Picks, in draft order/ })
        .getByRole('listitem')
        .first(),
    ).toContainText(FILMS[1] as string);

    expect(await picksInLeague(leagueId)).toEqual([
      { seat: 'Ada', round: 1, title: FILMS[1] },
      { seat: 'Ada', round: 2, title: FILMS[0] },
    ]);
  });

  test('the board is public, and a stranger gets no controls and no console', async ({
    page,
    browser,
  }) => {
    const { leagueId } = await signInAsOwner(page);
    await page.goto(`/leagues/${leagueId}/draft?year=${YEAR}`);
    await page.getByRole('searchbox').fill('Alph');
    await page.getByRole('button', { name: new RegExp(FILMS[0] as string) }).click();
    await expect(page.getByRole('heading', { name: 'Pick for Grace' })).toBeVisible();

    // A second context with no session at all — the person who was sent the
    // link (D44).
    const stranger = await browser.newContext();
    const strangerPage = await stranger.newPage();
    try {
      await strangerPage.goto(`/leagues/${leagueId}?year=${YEAR}`);

      // The board renders, including the pick.
      // Scoped to the desktop grid: the board renders both presentations
      // (D49) and CSS hides one, so an unscoped match finds the phone copy and
      // reports it as hidden.
      await expect(
        strangerPage.getByRole('table').getByText(FILMS[0] as string),
      ).toBeVisible();
      // But nothing that changes it.
      await expect(strangerPage.getByRole('link', { name: 'Run the draft' })).toHaveCount(
        0,
      );

      // And the console is not merely styled away — it is not there.
      const response = await strangerPage.goto(`/leagues/${leagueId}/draft?year=${YEAR}`);
      expect(response?.status()).toBe(404);
      await expect(strangerPage.getByRole('searchbox')).toHaveCount(0);
    } finally {
      await stranger.close();
    }
  });
});

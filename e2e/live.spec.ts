import { expect, type Page, test } from '@playwright/test';

import { signInAs } from './support/session';

/**
 * 🔴 `/live/[abbr]` (P17.T16), which until this task was an empty `.gitkeep` —
 * so a member who opened it during a ceremony got a 404 and, because
 * `not-found` renders outside the shell (P17.T27), was dropped out of the
 * application entirely.
 *
 * 🔴 **The route is PUBLIC** (P17.T16, amending D40), and half of this file
 * signs nobody in on purpose — so that every assertion about what a stranger
 * sees is made against a stranger.
 *
 * 🔴 What these tests **cannot** catch is the `proxy.ts` entry being deleted.
 * `playwright.config.mts` sets `E2E_TEST_AUTH=1`, under which `proxy.ts`
 * installs a pass-through with no route protection at all, so no spec here can
 * ever see a redirect to `/auth/login`. The guard on the public list is
 * `proxy.test.ts`, which pins it verbatim. Said plainly because the opposite
 * was assumed while this file was being written.
 *
 * Everything runs against a **scratch show and a scratch year**: the database
 * this suite drives is a restored copy of production, and a stray nomination
 * against the real Oscars changes what sixty real people are playing for. The
 * year is scratch too, rather than flipping `available_years.active` — that is
 * a global partial unique index with no per-worker copy, and moving it is how
 * concurrent suites deadlock each other.
 */
const TAG = 'e2e-live';
const YEAR = 2995;
const FILMS = [`${TAG} Alpha`, `${TAG} Bravo`];

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

/** UTC midnight, thirty days out, so the countdown always has days to show. */
function futureMidnight(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30);
}

/**
 * A scratch show with **two** categories worth 7 each, two films nominated in
 * both, and one of them marked the winner of the first — so the page has a
 * resolved counter that is neither 0 of 0 nor N of N, a brass winner chip, and
 * a nominee count to print.
 *
 * `awards_active` is what the page reads as "on air" and what puts the
 * `Follow live` link on `/award-shows/[abbr]`; `awards_date` plus `awards_time`
 * is what the countdown counts to. `onAir` is a parameter because a show that
 * is *not* broadcasting is the other half of every assertion about the chip and
 * the link — seeded `true` everywhere, neither could fail.
 */
async function seedShow({ onAir = true } = {}): Promise<{
  abbreviation: string;
  eventId: number;
}> {
  return withDb(async (query) => {
    const abbreviation = `${TAG}-show`;
    const events = (await query(
      `insert into events (name, abbreviation, awards_active, awards_date, awards_time,
                           created_at, updated_at)
         values ($1, $2, $5, $3, $4, now(), now()) returning id`,
      [`${TAG} Show`, abbreviation, futureMidnight(), 60 * 60 * 1000, onAir],
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
         values ($1, $3, $4, now(), now()), ($2, $3, $4, now(), now())`,
      [`${TAG} Best Picture`, `${TAG} Best Sound`, eventId, points[0]?.id],
    );

    await query(
      `insert into movies (title, sort_title, created_at, updated_at)
         values ($1, $1, now(), now()), ($2, $2, now(), now())`,
      FILMS,
    );

    // 🔴 Both inserts are pure SQL rather than ids matched in JavaScript: this
    // schema mixes integer and bigint primary keys, so `pg` hands some back as
    // numbers and some as strings, and `===` between them silently finds
    // nothing — which is how the first version of this seed inserted a winner
    // row with a null movie_id.
    await query(
      `insert into nominations (movie_id, award_id, year, created_at, updated_at)
         select m.id, a.id, $1, now(), now()
           from movies m
           cross join awards a
           join events e on e.id = a.event_id
          where m.title like $2 and e.abbreviation = $3`,
      [YEAR, `${TAG}%`, abbreviation],
    );

    // Alpha wins Best Picture. Bravo wins nothing, and Best Sound stays open —
    // so `resolved` reads 1 of 2, which is the only shape that can catch the
    // counter being printed the wrong way round.
    await query(
      `insert into winners (nomination_id, movie_id, award_id, year, created_at, updated_at)
         select n.id, n.movie_id, n.award_id, $1, now(), now()
           from nominations n
           join awards a on a.id = n.award_id
           join movies m on m.id = n.movie_id
          where n.year = $1 and a.name = $2 and m.title = $3`,
      [YEAR, `${TAG} Best Picture`, FILMS[0]],
    );

    return { abbreviation, eventId };
  });
}

/** A throwaway member. No admin role: this page only reads. */
async function signInAsMember(page: Page): Promise<number> {
  return signInAs(page, {
    email: `${TAG}-${Date.now()}-${Math.floor(performance.now())}@example.test`,
    firstName: 'Member',
  });
}

/**
 * The same scratch show, plus a scratch league the signed-in member has a seat
 * in, and one dummy seat holding nothing at this show.
 *
 * Follows `e2e/draft.spec.ts`'s shape: a league owned by the throwaway
 * identity, `drafting_status = 'active'`, one real seat and one placeholder.
 * A scratch league left behind breaks `lib/db.test.ts`, which counts the
 * restored rows, so `cleanup()` removes leagues, drafts and picks by tag.
 */
async function seedShowWithLeague(
  page: Page,
): Promise<{ abbreviation: string; leagueId: number }> {
  const { abbreviation } = await seedShow();
  const userId = await signInAsMember(page);

  const leagueId = await withDb(async (query) => {
    const leagues = (await query(
      `insert into leagues (name, owner, uuid, drafting_status, created_at, updated_at)
         values ($1, $2, gen_random_uuid(), 'active', now(), now()) returning id`,
      // Stored the way production stores it: TEXT holding a JSON array.
      [`${TAG} league`, JSON.stringify([userId])],
    )) as { id: number }[];
    const id = leagues[0]?.id;
    if (!id) throw new Error('could not create the scratch league');

    const drafts = (await query(
      `insert into drafts (league_id, year, user_id, "group", "order", dummy, dummy_name,
                           created_at, updated_at)
         values ($1, $2, $3, 1, 1, false, null, now(), now()),
                ($1, $2, null, 1, 2, true, $4, now(), now())
       returning id, "order"`,
      [id, YEAR, userId, `${TAG} Placeholder`],
    )) as { id: number; order: number }[];

    const mine = drafts.find((draft) => draft.order === 1);
    // The member holds Alpha, which is nominated in both categories and won
    // one; the placeholder seat holds nothing, which is the "nothing in play"
    // branch.
    await query(
      `insert into draft_picks (draft_id, movie_id, "order", created_at, updated_at)
         select $1, id, 1, now(), now() from movies where title = $2`,
      [mine?.id, FILMS[0]],
    );

    return id;
  });

  return { abbreviation, leagueId };
}

test.describe('live show', () => {
  // Serial for the same reason `award-shows.spec.ts` is: every test seeds rows
  // matching one shared tag and the teardown clears the tag wholesale, so run
  // side by side one test's cleanup takes another's show out from under it.
  //
  // 🔴 Not for session isolation — Playwright gives each `test` a fresh browser
  // context, so the cookie `signInAs` sets never leaks into the signed-out
  // tests that follow a signed-in one.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(cleanup);

  test.afterEach(cleanup);

  // Again after every test has finished. `afterEach` runs while the browser is
  // still open, and a request already in flight can re-provision the account it
  // just deleted — the lazy claim path in `lib/auth.ts` creates a row for any
  // valid session that reaches a page. That left one stray user behind and
  // failed `lib/db.test.ts`, which counts the restored 60.
  test.afterAll(cleanup);

  test('the route exists, and a stranger can reach it', async ({ page }) => {
    // Two failures in one assertion. It used to be an empty .gitkeep, so anyone
    // opening it during a ceremony got a 404 — and, because not-found renders
    // outside the shell (P17.T27), got dropped out of the application with one
    // link back. And it is PUBLIC (P17.T16, amending D40): a stranger handed the
    // link during a show has to be able to watch. This test signs nobody in.
    const { abbreviation } = await seedShow();

    const response = await page.goto(`/live/${abbreviation}?year=${YEAR}`);
    expect(response?.status()).toBe(200);
    // Not bounced. A redirect to the login page would also answer 200.
    expect(new URL(page.url()).pathname).toBe(`/live/${abbreviation}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(`${TAG} Show`);
  });

  test('counts down to the ceremony, signed out', async ({ page }) => {
    const { abbreviation } = await seedShow();
    await page.goto(`/live/${abbreviation}?year=${YEAR}`);

    // The <time> is server-rendered; the relative string arrives after mount.
    await expect(page.locator('time')).toBeVisible();
    await expect(page.getByText(/\d+d \d\d:\d\d:\d\d/)).toBeVisible();
  });

  test('says the ceremony is live while it is on air', async ({ page }) => {
    // `awards_active` is the broadcast window, and the chip is carmine because
    // brass is not free to mean anything new yet (P17.T35).
    const { abbreviation } = await seedShow();
    await page.goto(`/live/${abbreviation}?year=${YEAR}`);

    await expect(page.getByText('Live', { exact: true })).toBeVisible();
  });

  test('shows the resolved point value, not the raw foreign key', async ({ page }) => {
    // The scratch category points at a tier worth 7 (D41). Same trap as the
    // award-show page, and this is the other surface that could print the
    // column and be believed.
    const { abbreviation } = await seedShow();
    await signInAsMember(page);
    await page.goto(`/live/${abbreviation}?year=${YEAR}`);

    // Two categories, both worth 7 — so `toHaveCount(2)` rather than a bare
    // visibility check, which trips Playwright's strict mode on the second.
    await expect(page.getByText('7 pts')).toHaveCount(2);
    // And the foreign key it would have printed instead is nowhere.
    await expect(page.getByText('1 pts')).toHaveCount(0);
  });

  test('a stranger is invited in, not shown an empty league box', async ({ page }) => {
    // The public surface's own empty state. `/leagues` is protected, so offering
    // "Find a league" to someone with no account is a link to a login page —
    // the exact defect the public-by-default reasoning exists to avoid.
    const { abbreviation } = await seedShow();

    await page.goto(`/live/${abbreviation}?year=${YEAR}`);

    await expect(page.getByRole('link', { name: 'Register' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Find a league' })).toHaveCount(0);
  });

  test('a signed-in member with no league is offered one', async ({ page }) => {
    // The other half of the branch. Without this the signed-out assertion above
    // would pass just as well against a page that only ever rendered one empty
    // state — which is precisely the defect it is guarding.
    const { abbreviation } = await seedShow();
    await signInAsMember(page);
    await page.goto(`/live/${abbreviation}?year=${YEAR}`);

    await expect(page.getByRole('link', { name: 'Find a league' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Register' })).toHaveCount(0);
  });

  test('counts the resolved categories, in that order', async ({ page }) => {
    // The seed marks one winner across two categories, so the page must read
    // "1 of 2". Printed the other way round it reads "2 of 1", which is the
    // kind of thing no other assertion in this file would notice.
    const { abbreviation } = await seedShow();
    await page.goto(`/live/${abbreviation}?year=${YEAR}`);

    await expect(page.getByText('1 of 2')).toBeVisible();
    await expect(page.getByText('2 of 1')).toHaveCount(0);
  });

  test('names the winning film once a category resolves', async ({ page }) => {
    const { abbreviation } = await seedShow();
    await page.goto(`/live/${abbreviation}?year=${YEAR}`);

    // The decided category names its winner; the open one says how many are up.
    await expect(page.getByText(FILMS[0] as string)).toBeVisible();
    await expect(page.getByText('2 nominees')).toBeVisible();
  });

  test('a show that is not broadcasting says nothing about being live', async ({
    page,
  }) => {
    // The other half of the chip and the link. Seeded on air everywhere else,
    // neither assertion about them could fail.
    const { abbreviation } = await seedShow({ onAir: false });

    await page.goto(`/live/${abbreviation}?year=${YEAR}`);
    await expect(page.getByText('Live', { exact: true })).toHaveCount(0);
    // The countdown is still there: the ceremony has a date, it is just not on.
    await expect(page.locator('time')).toBeVisible();

    await page.goto(`/award-shows/${abbreviation}?year=${YEAR}`);
    await expect(page.getByRole('link', { name: /Follow live/ })).toHaveCount(0);
  });

  test('a seat’s roster carries what it earned at THIS show', async ({ page }) => {
    const { abbreviation } = await seedShowWithLeague(page);
    await page.goto(`/live/${abbreviation}?year=${YEAR}`);

    // Alpha is nominated in both categories (7 each) and won one, so it earned
    // 7 + 14 = 21 here (D41: a win is worth the category twice, because a
    // winner was nominated). The seat's take is the same 21, and the league's.
    await expect(page.getByRole('heading', { name: 'Member' })).toBeVisible();
    // `exact`, because the section above is headed "Your seats" and a
    // substring match resolves to both.
    await expect(page.getByText('Your seat', { exact: true })).toBeVisible();
    await expect(page.getByText('21')).toHaveCount(3);
    await expect(page.getByRole('img', { name: 'Winner' })).toBeVisible();
  });

  test('a seat with nothing nominated here says so', async ({ page }) => {
    const { abbreviation } = await seedShowWithLeague(page);
    await page.goto(`/live/${abbreviation}?year=${YEAR}`);

    await expect(page.getByRole('heading', { name: `${TAG} Placeholder` })).toBeVisible();
    await expect(page.getByText(/nothing in play/i)).toBeVisible();
  });

  test('a stranger sees the show and no seat of anybody’s', async ({ page }) => {
    // The public surface's load-bearing guarantee. The league exists and has
    // real rosters; an anonymous reader must see the ceremony and none of them.
    // Not a permission check bolted on top — getLiveShow(abbr, year, null) never
    // queries leagues at all, the same shape D44 gives getDashboard(null).
    //
    // 🔴 clearCookies() rather than a second test with no signInAs: the point is
    // that the *same* league, seeded and populated, is invisible without a
    // session. A fresh spec with no league proves nothing.
    const { abbreviation } = await seedShowWithLeague(page);
    await page.context().clearCookies();

    await page.goto(`/live/${abbreviation}?year=${YEAR}`);

    await expect(page.getByRole('heading', { level: 1 })).toContainText(`${TAG} Show`);
    // The seeded seats and the seat's score are all absent.
    await expect(page.getByRole('heading', { name: 'Member' })).toHaveCount(0);
    await expect(page.getByText(`${TAG} Placeholder`)).toHaveCount(0);
    await expect(page.getByText('Your seat', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Your seats' })).toHaveCount(0);
    await expect(page.getByText('21')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Register' })).toBeVisible();
  });

  test('the award-show page links here while the show is on air', async ({ page }) => {
    // The only way in: nothing else links to /live, and the link carries no
    // session gate because the route is public.
    const { abbreviation } = await seedShow();

    await page.goto(`/award-shows/${abbreviation}?year=${YEAR}`);

    const link = page.getByRole('link', { name: /Follow live/ });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/live/${abbreviation}`));
  });
});

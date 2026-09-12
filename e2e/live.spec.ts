import { expect, type Page, test } from '@playwright/test';

import { signInAs } from './support/session';

/**
 * 🔴 `/live/[abbr]` (P17.T16), which until this task was an empty `.gitkeep` —
 * so a member who opened it during a ceremony got a 404 and, because
 * `not-found` renders outside the shell (P17.T27), was dropped out of the
 * application entirely.
 *
 * 🔴 **The route is PUBLIC** (P17.T16, amending D40), and half of this file
 * signs nobody in on purpose. A spec that only ever tested the signed-in path
 * would go green over a redirect to `/auth/login`.
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
 * A scratch show that is on air, with one category worth 7 and two films.
 *
 * `awards_active` is what the page reads as "on air" and what puts the
 * `Follow live` link on `/award-shows/[abbr]`; `awards_date` plus `awards_time`
 * is what the countdown counts to.
 */
async function seedShow(): Promise<{ abbreviation: string; eventId: number }> {
  return withDb(async (query) => {
    const abbreviation = `${TAG}-show`;
    const events = (await query(
      `insert into events (name, abbreviation, awards_active, awards_date, awards_time,
                           created_at, updated_at)
         values ($1, $2, true, $3, $4, now(), now()) returning id`,
      [`${TAG} Show`, abbreviation, futureMidnight(), 60 * 60 * 1000],
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

  test('🔴 the route exists, and a stranger can reach it', async ({ page }) => {
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

  test('🔴 shows the resolved point value, not the raw foreign key', async ({ page }) => {
    // The scratch category points at a tier worth 7 (D41). Same trap as the
    // award-show page, and this is the other surface that could print the
    // column and be believed.
    const { abbreviation } = await seedShow();
    await signInAsMember(page);
    await page.goto(`/live/${abbreviation}?year=${YEAR}`);

    await expect(page.getByText('7 pts')).toBeVisible();
  });

  test('🔴 a stranger is invited in, not shown an empty league box', async ({ page }) => {
    // The public surface's own empty state. `/leagues` is protected, so offering
    // "Find a league" to someone with no account is a link to a login page —
    // the exact defect the public-by-default reasoning exists to avoid.
    const { abbreviation } = await seedShow();

    await page.goto(`/live/${abbreviation}?year=${YEAR}`);

    await expect(page.getByRole('link', { name: 'Register' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Find a league' })).toHaveCount(0);
  });

  test('🔴 a signed-in member with no league is offered one', async ({ page }) => {
    // The other half of the branch. Without this the signed-out assertion above
    // would pass just as well against a page that only ever rendered one empty
    // state — which is precisely the defect it is guarding.
    const { abbreviation } = await seedShow();
    await signInAsMember(page);
    await page.goto(`/live/${abbreviation}?year=${YEAR}`);

    await expect(page.getByRole('link', { name: 'Find a league' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Register' })).toHaveCount(0);
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

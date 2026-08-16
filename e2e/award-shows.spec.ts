import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * 🔴 The Phase 8 gate: an admin can enter nominations and winners, a correction
 * behaves like the ordinary act it is, and nobody else can touch either.
 *
 * Everything runs against a **scratch award show the test creates**, not the
 * real twelve. This suite writes the inputs to scoring: a stray nomination
 * against the real Oscars would change what every league in the restored data
 * is playing for. Same reasoning as `e2e/draft.spec.ts` and its scratch league.
 */
const TAG = 'e2e-awards';
const YEAR = 2994;
const FILMS = [`${TAG} Alpha`, `${TAG} Bravo`];

const hasClerk = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);
const hasTmdb = Boolean(process.env.TMDB_API_KEY);

/**
 * A real film, chosen because the restored database does not contain it — a
 * 1992 anime nobody in this league has ever drafted. Nominating it proves the
 * ingest path end to end: TMDB is searched, the film is cached locally, and a
 * nomination is written against the new row.
 */
const UNCACHED = { title: 'Wicked City', tmdbId: '69011' };

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
    // The film the TMDB ingest test caches. Removing it puts the database back
    // to the state that made the test meaningful — the film absent.
    await query(
      'delete from nominations where movie_id in (select id from movies where tmdb_id = $1)',
      [UNCACHED.tmdbId],
    );
    await query('delete from movies where tmdb_id = $1', [UNCACHED.tmdbId]);
    await query("delete from users where email like 'e2e_awards_%+clerk_test@%'");
  });
}

/** Build a scratch show with one category and two candidate films. */
async function seedShow(): Promise<{ abbreviation: string }> {
  return withDb(async (query) => {
    const abbreviation = `${TAG}-show`;
    const events = (await query(
      `insert into events (name, abbreviation, created_at, updated_at)
         values ($1, $2, now(), now()) returning id`,
      [`${TAG} Show`, abbreviation],
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

    for (const title of FILMS) {
      await query(
        `insert into movies (title, sort_title, created_at, updated_at)
           values ($1, $1, now(), now())`,
        [title],
      );
    }

    return { abbreviation };
  });
}

/** Sign up a throwaway identity and make it an admin. */
async function signInAsAdmin(page: Page): Promise<void> {
  await setupClerkTestingToken({ page });
  const address = `e2e_awards_${Date.now()}+clerk_test@example.com`;

  await page.goto('/auth/register');
  await page.getByLabel(/email address/i).fill(address);

  // Wait for the code to be SENT before entering one — the OTP field submits
  // as soon as it is full, and filling it early races prepare_verification.
  const codeSent = page.waitForResponse(
    (response) => response.url().includes('prepare_verification') && response.ok(),
    { timeout: 20_000 },
  );
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await codeSent;

  await page.getByRole('textbox', { name: /verification code/i }).fill('424242');
  await expect(page).not.toHaveURL(/\/auth\/register/, { timeout: 20_000 });

  await withDb(async (query) => {
    const rows = (await query(
      "update users set role = 'admin' where email = $1 returning id",
      [address],
    )) as { id: number }[];
    if (!rows[0]) throw new Error('sign-up did not provision an account');
  });
}

/** What the database holds for the scratch category. */
async function stateOfShow() {
  return withDb(async (query) => {
    const nominations = (await query(
      `select m.title, n.year
         from nominations n
         join awards a on a.id = n.award_id
         join events e on e.id = a.event_id
         join movies m on m.id = n.movie_id
        where e.abbreviation like $1
        order by m.title`,
      [`${TAG}%`],
    )) as { title: string; year: string }[];

    const winners = (await query(
      `select m.title
         from winners w
         join awards a on a.id = w.award_id
         join events e on e.id = a.event_id
         join movies m on m.id = w.movie_id
        where e.abbreviation like $1`,
      [`${TAG}%`],
    )) as { title: string }[];

    return { nominations, winners };
  });
}

test.describe('award shows', () => {
  // Serial: each test signs up a Clerk identity, and parallel sign-ups queue
  // behind the rate limit and stall on verification.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    if (hasClerk) await clerkSetup();
    await cleanup();
  });

  test.afterEach(cleanup);

  // Again after every test has finished. `afterEach` runs while the browser is
  // still open, and a request already in flight can re-provision the account
  // it just deleted — the lazy claim path in `lib/auth.ts` creates a row for
  // any valid session that reaches a page. That left one stray user behind and
  // failed `lib/db.test.ts`, which counts the restored 60.
  test.afterAll(cleanup);

  test('🔴 the page is public, and a visitor gets no controls', async ({ page }) => {
    // D44: the source never guarded these, and they are what a member opens
    // mid-ceremony. This test needs no Clerk keys — that is the point of it.
    const { abbreviation } = await seedShow();

    const response = await page.goto(`/award-shows/${abbreviation}?year=${YEAR}`);
    expect(response?.status()).toBe(200);

    await expect(page.getByRole('heading', { name: `${TAG} Show` })).toBeVisible();
    await expect(page.getByText(`${TAG} Best Picture`)).toBeVisible();
    await expect(page.getByRole('searchbox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mark winner' })).toHaveCount(0);
  });

  test('🔴 shows the resolved point value, not the raw foreign key', async ({ page }) => {
    // `awards.points` holds a foreign key into `points.id` (D41). The scratch
    // category points at a tier worth 7; if the page printed the column it
    // would show the tier's id instead.
    const { abbreviation } = await seedShow();

    await page.goto(`/award-shows/${abbreviation}?year=${YEAR}`);

    await expect(page.getByText('7 pts')).toBeVisible();
  });

  test.describe('as an admin', () => {
    test.skip(!hasClerk, 'Clerk keys not configured');

    test('🔴 nominates a film, marks a winner, then corrects it', async ({ page }) => {
      const { abbreviation } = await seedShow();
      await signInAsAdmin(page);
      await page.goto(`/award-shows/${abbreviation}?year=${YEAR}`);

      // Nominate both films. A fragment of the title is enough (§10).
      for (const title of FILMS) {
        await page.getByRole('searchbox').fill(title);
        await page
          .getByRole('button', { name: new RegExp(title) })
          .first()
          .click();
        await expect(page.getByText(`${title} nominated`)).toBeVisible();
      }

      expect((await stateOfShow()).nominations.map((row) => row.title)).toEqual(FILMS);

      // Mark the first as winner.
      await page.reload();
      await page
        .getByRole('listitem')
        .filter({ hasText: FILMS[0] as string })
        .getByRole('button', { name: 'Mark winner' })
        .click();

      await expect
        .poll(async () => (await stateOfShow()).winners.map((row) => row.title))
        .toEqual([FILMS[0]]);

      // 🔴 Correct it — the ordinary case during a live ceremony (§12). The old
      // winner must be replaced, not joined by a second one.
      await page.reload();
      await page
        .getByRole('listitem')
        .filter({ hasText: FILMS[1] as string })
        .getByRole('button', { name: 'Mark winner' })
        .click();

      await expect
        .poll(async () => (await stateOfShow()).winners.map((row) => row.title))
        .toEqual([FILMS[1]]);
    });

    test('🔴 nominates a film TMDB knows and this app has never cached', async ({
      page,
    }) => {
      // The capability the whole phase turns on. `movies` is a cache of TMDB,
      // so during nominations season the films being entered are precisely the
      // ones not in it yet — a search that could only return cached films
      // would be unable to nominate anything new.
      test.skip(!hasTmdb, 'TMDB_API_KEY not configured');

      const { abbreviation } = await seedShow();
      await signInAsAdmin(page);
      await page.goto(`/award-shows/${abbreviation}?year=${YEAR}`);

      // Absent before.
      const before = await withDb(async (query) =>
        query('select id from movies where tmdb_id = $1', [UNCACHED.tmdbId]),
      );
      expect(before).toHaveLength(0);

      await page.getByRole('searchbox').fill(UNCACHED.title);
      await page
        .getByRole('button', { name: new RegExp(UNCACHED.title) })
        .first()
        .click();

      await expect(page.getByText(`${UNCACHED.title} nominated`)).toBeVisible();

      // Cached now, and the nomination points at the new row.
      const after = (await withDb(async (query) =>
        query('select id, title, imdb_id from movies where tmdb_id = $1', [
          UNCACHED.tmdbId,
        ]),
      )) as { id: number; title: string; imdb_id: string | null }[];

      expect(after).toHaveLength(1);
      expect(after[0]?.title).toBe(UNCACHED.title);
      // Stored the way all 1,355 existing rows are: no `tt` prefix.
      expect(after[0]?.imdb_id).not.toMatch(/^tt/);

      expect((await stateOfShow()).nominations.map((row) => row.title)).toContain(
        UNCACHED.title,
      );
    });

    test('🔴 removing the winning nominee takes its win with it', async ({ page }) => {
      // Otherwise the category is won by a film it does not list, and that film
      // keeps scoring for a nomination the app no longer believes in.
      const { abbreviation } = await seedShow();
      await signInAsAdmin(page);
      await page.goto(`/award-shows/${abbreviation}?year=${YEAR}`);

      await page.getByRole('searchbox').fill(FILMS[0] as string);
      await page
        .getByRole('button', { name: new RegExp(FILMS[0] as string) })
        .first()
        .click();
      await expect(page.getByText(`${FILMS[0]} nominated`)).toBeVisible();

      await page.reload();
      await page.getByRole('button', { name: 'Mark winner' }).click();
      await expect.poll(async () => (await stateOfShow()).winners.length).toBe(1);

      await page.reload();
      await page.getByRole('button', { name: 'Remove' }).click();

      await expect.poll(async () => (await stateOfShow()).winners.length).toBe(0);
      await expect.poll(async () => (await stateOfShow()).nominations.length).toBe(0);
    });
  });
});

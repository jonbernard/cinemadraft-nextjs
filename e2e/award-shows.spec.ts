import { type APIResponse, expect, type Page, test } from '@playwright/test';

import { skipWithoutRestoredCorpus } from './support/corpus';
import { signInAs } from './support/session';

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
    await query(
      'delete from event_dates where event_id in (select id from events where abbreviation like $1)',
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
    // Scoped to this spec's own prefix — the other specs seed identities of
    // their own, and a blanket delete takes one of them mid-flow.
    await query(`delete from users where email like '${TAG}-%@example.test'`);
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

/** Nominate one scratch film in the scratch Best Picture, straight into the table. */
async function seedNomination(title: string): Promise<void> {
  await withDb(async (query) => {
    await query(
      `insert into nominations (movie_id, award_id, year, created_at, updated_at)
         select m.id, a.id, $3, now(), now()
           from movies m, awards a
          where m.title = $1 and a.name = $2`,
      [title, `${TAG} Best Picture`, YEAR],
    );
  });
}

/** The controls an admin has on this page — every one of them, by name. */
const ADMIN_CONTROLS = [
  'Mark winner',
  'Clear winner',
  'Remove',
  'Put on screen',
  'Edit this show',
  'Delete category',
  'Add category',
];

/** The show page in one of the admin's modes (`lib/utils/admin-mode.ts`). */
function inMode(abbreviation: string, mode?: 'view' | 'nominations' | 'winners'): string {
  return `/award-shows/${abbreviation}?year=${YEAR}${mode ? `&mode=${mode}` : ''}`;
}

/** Every admin control is absent — and so is the mode selector and the Live switch. */
async function expectNoAdminControls(page: Page): Promise<void> {
  for (const name of ADMIN_CONTROLS) {
    await expect(page.getByRole('button', { name })).toHaveCount(0);
  }
  await expect(page.getByRole('group', { name: 'Admin mode' })).toHaveCount(0);
  await expect(page.getByRole('switch')).toHaveCount(0);
  await expect(page.getByRole('searchbox')).toHaveCount(0);
}

/**
 * Seat a throwaway identity and make it an admin.
 *
 * The session is the signed test cookie rather than a Clerk sign-up (D82/D84):
 * the app under test boots with no Clerk at all. The *role* is still a real
 * column read by the real guard — what these tests are about is what an admin
 * may do, not how they signed in.
 */
async function signInAsAdmin(page: Page): Promise<void> {
  const address = `${TAG}-${Date.now()}-${Math.floor(performance.now())}@example.test`;
  await signInAs(page, { email: address, firstName: 'Admin' });

  await withDb(async (query) => {
    const rows = (await query(
      "update users set role = 'admin' where email = $1 returning id",
      [address],
    )) as { id: number }[];
    if (!rows[0]) throw new Error('the seeded admin has no row');
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
  // Serial: every test here seeds a show matching the same tag, and the
  // teardown clears the tag wholesale — run side by side, one test's cleanup
  // takes another's show out from under it.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(cleanup);

  test.afterEach(cleanup);

  // Again after every test has finished. `afterEach` runs while the browser is
  // still open, and a request already in flight can re-provision the account
  // it just deleted — the lazy claim path in `lib/auth.ts` creates a row for
  // any valid session that reaches a page. That left one stray user behind and
  // failed `lib/db.test.ts`, which counts the restored 60.
  test.afterAll(cleanup);

  test('the page is public, and a visitor gets no controls', async ({ page }) => {
    // D44: the source never guarded these, and they are what a member opens
    // mid-ceremony. This test signs nobody in at all — that is the point of it.
    const { abbreviation } = await seedShow();
    // 🔴 A nominee on the page, so "no controls on the posters" is a claim
    // about a poster that exists rather than about an empty grid.
    await seedNomination(FILMS[0] as string);

    // 🔴 Asking for an admin mode by URL changes nothing for a visitor; the
    // source honoured `/nominations` for anyone who typed it.
    const response = await page.goto(inMode(abbreviation, 'nominations'));
    expect(response?.status()).toBe(200);

    await expect(page.getByRole('heading', { name: `${TAG} Show` })).toBeVisible();
    await expect(page.getByText(`${TAG} Best Picture`)).toBeVisible();
    await expect(page.getByText(FILMS[0] as string, { exact: true })).toBeVisible();
    await expectNoAdminControls(page);
  });

  test('a signed-in member who is not an admin sees the posters and no controls', async ({
    page,
  }) => {
    // The other half of "admin only": a session is not a role. The controls
    // are hidden for tidiness — the actions refuse on their own — but a
    // member shown "Mark winner" would reasonably believe they could.
    const { abbreviation } = await seedShow();
    await seedNomination(FILMS[0] as string);
    await signInAs(page, {
      email: `${TAG}-member-${Date.now()}@example.test`,
      firstName: 'Member',
    });

    await page.goto(inMode(abbreviation, 'winners'));

    await expect(page.getByText(FILMS[0] as string, { exact: true })).toBeVisible();
    await expectNoAdminControls(page);
  });

  test('says "1 category", not "1 categories"', async ({ page }) => {
    // seedShow() builds exactly one category, which is why this is the spec
    // that can assert it. The detail page already gets this right; the index
    // printed the plural unconditionally.
    //
    // 🔴 Scoped to the scratch show's own card rather than matched by text.
    // The restored corpus already contains a real show with exactly one
    // category (AFI), so a bare `getByText('1 category')` matches two elements
    // and fails Playwright's strict mode — green or red for the wrong reason.
    // `not.toContainText('1 categories')` is the load-bearing half: the
    // positive one would also pass on the plural, since it is a substring.
    const { abbreviation } = await seedShow();

    await page.goto('/award-shows');

    // Since P16.T15 the index is the season, and a show has a row per moment:
    // its (undated, upcoming) nominations row carries the category count.
    const card = page.getByRole('link', { name: new RegExp(`${TAG} Show Nominations`) });
    await expect(card).toHaveAttribute('href', new RegExp(`/${abbreviation}\\?`));
    await expect(card).toContainText('1 category');
    await expect(card).not.toContainText('1 categories');
  });

  test('shows the resolved point value, not the raw foreign key', async ({ page }) => {
    // `awards.points` holds a foreign key into `points.id` (D41). The scratch
    // category points at a tier worth 7; if the page printed the column it
    // would show the tier's id instead.
    const { abbreviation } = await seedShow();

    await page.goto(`/award-shows/${abbreviation}?year=${YEAR}`);

    await expect(page.getByText('7 pts')).toBeVisible();
  });

  test('a show wears its mark, served from Blob', async ({ page }) => {
    // Reads the real Oscars row, not the scratch show — the twelve logos
    // uploaded in Task 3 are exactly the rows this suite otherwise avoids
    // touching, and this test only reads.
    //
    // 🔴 The one test in this file that cannot run on CI. Everything else here
    // builds its own show; this asserts that a REAL row carries a logo and that
    // the URL in it resolves against Blob, and there is nothing to seed —
    // Blob is production infrastructure, and a scratch row pointed at a made-up
    // URL would assert the made-up URL. See `support/corpus.ts`.
    await skipWithoutRestoredCorpus();

    await page.goto('/award-shows/oscars');
    // The optimizer is in the path for Blob images (they are not TMDB), so the
    // rendered src is a /_next/image URL wrapping the Blob one. Assert on what
    // decodes out of it, and on what the browser actually fetched.
    const logo = page.locator('header img').first();
    await expect(logo).toBeVisible();
    const src = await logo.getAttribute('src');
    expect(decodeURIComponent(src ?? '')).toContain('blob.vercel-storage.com');
    const response = await page.request.get(src ?? '');
    expect(response.status()).toBe(200);
  });

  test.describe('the calendar feed, signed out (D127)', () => {
    // The `request` fixture: a fresh context with no storage state, so signed
    // out by construction — which is exactly what a calendar client is.
    async function expectFeed(response: APIResponse) {
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toBe('text/calendar; charset=utf-8');
      const body = await response.text();
      expect(body.startsWith('BEGIN:VCALENDAR')).toBe(true);
      return body;
    }

    test('answers at /api/ical and at one show, with no session', async ({ request }) => {
      const { abbreviation } = await seedShow();
      await withDb((query) =>
        query(
          'update events set awards_date = $1, awards_time = 0 where abbreviation = $2',
          [Date.UTC(YEAR, 1, 1), abbreviation],
        ),
      );
      const get = (path: string) => request.get(path, { maxRedirects: 0 });

      // The bare URL is the one `/award-shows` hands out, and a required
      // catch-all 404'd it.
      expect(await expectFeed(await get('/api/ical'))).toContain(
        `SUMMARY:${TAG} Show Awards`,
      );
      expect(await expectFeed(await get(`/api/ical/${abbreviation}`))).toContain(
        `SUMMARY:${TAG} Show Awards`,
      );

      expect((await get('/api/ical/nope')).status()).toBe(404);
      expect((await get('/api/ical/a/b')).status()).toBe(404);
    });

    test('serves the real Oscars feed', async ({ request }) => {
      // The URL a member would actually subscribe to. CI has no Oscars row;
      // the scratch show above is the CI-safe half of this.
      await skipWithoutRestoredCorpus();
      const body = await expectFeed(
        await request.get('/api/ical/oscars', { maxRedirects: 0 }),
      );
      expect(body).toContain('/award-shows/oscars');
    });
  });

  test.describe('as an admin', () => {
    // D134: the dialog dates the season on the page, in `event_dates`, and
    // leaves `events` (the active season's schedule) alone for any other.
    test.describe('the season dates', () => {
      // A fixed zone, so the typed wall-clock times are known instants.
      test.use({ timezoneId: 'America/New_York' });

      test("adds a season's dates, reads them back, and refuses one outside it", async ({
        page,
      }) => {
        const { abbreviation } = await seedShow();
        await signInAsAdmin(page);
        await page.goto(`/award-shows/${abbreviation}?year=${YEAR}`);

        const open = async () => {
          await page.getByRole('button', { name: 'Edit this show' }).click();
          return page.getByRole('dialog', { name: 'Edit this show' });
        };
        const announced = (edit: Awaited<ReturnType<typeof open>>, group: string) =>
          edit.getByRole('group', { name: group }).getByLabel('Announced');

        let edit = await open();
        await expect(
          edit.getByRole('heading', { name: `${YEAR} season dates` }),
        ).toBeVisible();
        await expect(announced(edit, 'Nominations')).toHaveValue('');
        await announced(edit, 'Nominations').fill(`${YEAR}-01-21T08:00`);
        await announced(edit, 'Awards').fill(`${YEAR}-03-14T20:00`);
        await edit.getByRole('button', { name: 'Save show' }).click();
        await expect(edit.getByText('Saved')).toBeVisible();

        const stored = () =>
          withDb((query) =>
            query(
              `select d.year, d.nom_date::text, d.nom_time::text, d.awards_date::text,
                      d.awards_time::text, e.nom_date::text as events_nom
                 from event_dates d join events e on e.id = d.event_id
                where e.abbreviation = $1`,
              [abbreviation],
            ),
          );
        // UTC midnight of the day typed, and the ET wall clock past it:
        // 8am is 13h, 8pm is 25h, as the award-entry skill stores them.
        expect(await stored()).toEqual([
          {
            year: YEAR,
            nom_date: String(Date.UTC(YEAR, 0, 21)),
            nom_time: String(13 * 3_600_000),
            awards_date: String(Date.UTC(YEAR, 2, 14)),
            awards_time: String(25 * 3_600_000),
            events_nom: null,
          },
        ]);

        await page.reload();
        edit = await open();
        await expect(announced(edit, 'Nominations')).toHaveValue(`${YEAR}-01-21T08:00`);
        await expect(announced(edit, 'Awards')).toHaveValue(`${YEAR}-03-14T20:00`);

        await announced(edit, 'Nominations').fill(`${YEAR - 1}-01-21T08:00`);
        await edit.getByRole('button', { name: 'Save show' }).click();
        await expect(edit.getByText(`outside the ${YEAR} season`)).toBeVisible();
        expect((await stored())[0]).toMatchObject({
          nom_date: String(Date.UTC(YEAR, 0, 21)),
        });
      });
    });

    test('nominates a film, marks a winner, then corrects it', async ({ page }) => {
      const { abbreviation } = await seedShow();
      await signInAsAdmin(page);
      await page.goto(inMode(abbreviation, 'nominations'));

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

      // Into Winners, by the selector — the mode is the URL, so the server
      // renders it and a reload keeps it.
      await page.getByText('Winners', { exact: true }).click();
      await expect(page).toHaveURL(/mode=winners/);
      await expect(page.getByRole('radio', { name: 'Winners' })).toBeChecked();

      // Mark the first as winner.
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

    test('nominates a film TMDB knows and this app has never cached', async ({
      page,
    }) => {
      // The capability the whole phase turns on. `movies` is a cache of TMDB,
      // so during nominations season the films being entered are precisely the
      // ones not in it yet — a search that could only return cached films
      // would be unable to nominate anything new.
      test.skip(!hasTmdb, 'TMDB_API_KEY not configured');

      const { abbreviation } = await seedShow();
      await signInAsAdmin(page);
      await page.goto(inMode(abbreviation, 'nominations'));

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

    test('names the person from the film’s credits — and the same film twice, for two people', async ({
      page,
    }) => {
      // The source app's picker (§12): choose the film, then choose the person
      // from its TMDB cast and crew, typing to filter. There is no free-text
      // field for the name, so the credits are the only way in — which is why
      // this needs TMDB, and skips without it the way the ingest test does.
      test.skip(!hasTmdb, 'TMDB_API_KEY not configured');

      const { abbreviation } = await seedShow();
      const category = `${TAG} Best Actor`;
      const film = `${TAG} Casablanca`;
      await withDb(async (query) => {
        await query(
          `insert into awards (name, event_id, points, requires_nominee_name, created_at, updated_at)
             select $1, a.event_id, a.points, true, now(), now()
               from awards a where a.name = $2`,
          [category, `${TAG} Best Picture`],
        );
        // A scratch row carrying a real TMDB id: the credits are TMDB's, and
        // 289 is Casablanca, which the restored database has never cached.
        await query(
          `insert into movies (title, sort_title, tmdb_id, created_at, updated_at)
             values ($1, $1, '289', now(), now())`,
          [film],
        );
      });
      const nominated = () =>
        withDb(
          async (query) =>
            (await query(
              `select n.detail_name, n.detail_character, n.detail_id::int
                 from nominations n join awards a on a.id = n.award_id
                where a.name = $1 order by n.id`,
              [category],
            )) as {
              detail_name: string;
              detail_character: string | null;
              detail_id: number;
            }[],
        );

      await signInAsAdmin(page);
      await page.goto(inMode(abbreviation, 'nominations'));
      const section = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: category }) });

      // The search result, not a poster: once the film is nominated, its
      // poster's own controls carry the title in their accessible names too.
      const filmResult = () =>
        section
          .getByRole('button', { name: new RegExp(film) })
          .filter({ hasNotText: /winner|Remove/ });

      // Film first. The person field does not exist until there is a film.
      await expect(
        section.getByRole('searchbox', { name: 'Person nominated' }),
      ).toHaveCount(0);
      await section.getByRole('searchbox').fill(`${TAG} Casa`);
      await filmResult().click();

      // Then the credits, filtered as they are typed.
      const people = section.getByRole('list', { name: 'Cast and crew' });
      await expect(people.getByRole('button', { name: /Humphrey Bogart/ })).toBeVisible();
      await expect(people.getByRole('button', { name: /Claude Rains/ })).toBeVisible();
      await section.getByRole('searchbox', { name: 'Person nominated' }).fill('bogart');
      await expect(people.getByRole('button', { name: /Claude Rains/ })).toHaveCount(0);
      await people.getByRole('button', { name: /Humphrey Bogart/ }).click();

      await expect(
        section.getByText(`Humphrey Bogart nominated for ${film}`),
      ).toBeVisible();
      expect(await nominated()).toEqual([
        {
          detail_name: 'Humphrey Bogart',
          detail_character: 'Rick Blaine',
          detail_id: 4110,
        },
      ]);
      // And the nomination shows the person, on its poster.
      await expect(
        section
          .getByRole('listitem')
          .filter({ hasText: film })
          .getByText('Humphrey Bogart as Rick Blaine'),
      ).toBeVisible();

      // 🔴 The same film again, for somebody else — the Benicio del Toro /
      // Sean Penn shape. The one already up is named and cannot be chosen.
      await section.getByRole('searchbox').fill(`${TAG} Casa`);
      await filmResult().click();
      const bogart = people.getByRole('button', { name: /Humphrey Bogart/ });
      await expect(bogart).toBeDisabled();
      await expect(bogart).toContainText('Nominated');
      await section.getByRole('searchbox', { name: 'Person nominated' }).fill('rains');
      await people.getByRole('button', { name: /Claude Rains/ }).click();

      await expect(section.getByText(`Claude Rains nominated for ${film}`)).toBeVisible();
      expect((await nominated()).map((row) => row.detail_name)).toEqual([
        'Humphrey Bogart',
        'Claude Rains',
      ]);
      await expect(section.getByRole('listitem').filter({ hasText: film })).toHaveCount(
        2,
      );
    });

    test('one film nominated twice in a category: only the nomination that won is the winner', async ({
      page,
    }) => {
      // The owner's report: *One Battle After Another* for Benicio del Toro and
      // for Sean Penn, one win, and both showed "Winner" and both offered
      // "Clear winner". Seeded in SQL so the shape is exact; entering it
      // through the picker is the TMDB-backed test below.
      const { abbreviation } = await seedShow();
      const people = ['Benicio del Toro', 'Sean Penn'] as const;
      await withDb(async (query) => {
        const rows = (await query(
          `select a.event_id, a.points, m.id as movie_id
             from awards a join events e on e.id = a.event_id, movies m
            where e.abbreviation = $1 and m.title = $2`,
          [abbreviation, FILMS[0]],
        )) as { event_id: number; points: number; movie_id: number }[];
        const seed = rows[0];
        if (!seed) throw new Error('the scratch show has no category');
        const awards = (await query(
          `insert into awards (name, event_id, points, requires_nominee_name, created_at, updated_at)
             values ($1, $2, $3, true, now(), now()) returning id`,
          [`${TAG} Supporting Actor`, seed.event_id, seed.points],
        )) as { id: number }[];
        for (const person of people) {
          await query(
            `insert into nominations (movie_id, award_id, year, detail_name, created_at, updated_at)
               values ($1, $2, $3, $4, now(), now())`,
            [seed.movie_id, awards[0]?.id, YEAR, person],
          );
        }
      });
      const winningPerson = () =>
        withDb(async (query) =>
          (
            (await query(
              `select n.detail_name
                 from winners w
                 join nominations n on n.id = w.nomination_id
                 join awards a on a.id = w.award_id
                where a.name = $1`,
              [`${TAG} Supporting Actor`],
            )) as { detail_name: string }[]
          ).map((row) => row.detail_name),
        );

      await signInAsAdmin(page);
      await page.goto(inMode(abbreviation, 'winners'));
      // One poster each, told apart by the person line under it — which is
      // what the controls on each poster are scoped by here.
      const posters = page
        .getByRole('listitem')
        .filter({ hasText: FILMS[0] as string })
        .filter({ has: page.getByRole('button', { name: /winner/ }) });
      await expect(posters).toHaveCount(2);
      const benicio = posters.filter({ hasText: 'Benicio del Toro' });
      const sean = posters.filter({ hasText: 'Sean Penn' });

      await sean.getByRole('button', { name: 'Mark winner' }).click();
      await expect.poll(winningPerson).toEqual(['Sean Penn']);

      await page.reload();
      // One chip, on the one poster that won — two if both were crowned.
      await expect(page.getByText('Winner', { exact: true })).toHaveCount(1);
      await expect(sean.getByText('Winner', { exact: true })).toBeVisible();
      await expect(sean.getByRole('button', { name: 'Clear winner' })).toBeVisible();
      await expect(benicio.getByRole('button', { name: 'Mark winner' })).toBeVisible();

      // Correcting to the other half of the same film's pair.
      await benicio.getByRole('button', { name: 'Mark winner' }).click();
      await expect.poll(winningPerson).toEqual(['Benicio del Toro']);

      await page.reload();
      await expect(page.getByText('Winner', { exact: true })).toHaveCount(1);
      await expect(benicio.getByText('Winner', { exact: true })).toBeVisible();
      await expect(benicio.getByRole('button', { name: 'Clear winner' })).toBeVisible();
      await expect(sean.getByRole('button', { name: 'Mark winner' })).toBeVisible();
    });

    test('removing the winning nominee takes its win with it', async ({ page }) => {
      // Otherwise the category is won by a film it does not list, and that film
      // keeps scoring for a nomination the app no longer believes in.
      const { abbreviation } = await seedShow();
      await signInAsAdmin(page);
      await page.goto(inMode(abbreviation, 'nominations'));

      await page.getByRole('searchbox').fill(FILMS[0] as string);
      await page
        .getByRole('button', { name: new RegExp(FILMS[0] as string) })
        .first()
        .click();
      await expect(page.getByText(`${FILMS[0]} nominated`)).toBeVisible();

      await page.goto(inMode(abbreviation, 'winners'));
      await page.getByRole('button', { name: 'Mark winner' }).click();
      await expect.poll(async () => (await stateOfShow()).winners.length).toBe(1);

      await page.goto(inMode(abbreviation, 'nominations'));
      await page.getByRole('button', { name: 'Remove' }).click();
      // 🔴 It asks first, and says the win goes too. Nothing is removed until
      // the dialog is answered.
      const confirm = page.getByRole('dialog');
      await expect(confirm).toContainText('Its win goes with it.');
      expect((await stateOfShow()).nominations).toHaveLength(1);
      await confirm.getByRole('button', { name: 'Remove' }).click();

      await expect.poll(async () => (await stateOfShow()).winners.length).toBe(0);
      await expect.poll(async () => (await stateOfShow()).nominations.length).toBe(0);
    });

    test('each mode shows its own job and nothing else', async ({ page }) => {
      // The source's View / Nominations / Pick Winners, kept apart the same
      // way: a "Remove" one poster-width from "Mark winner" on the night is
      // a slip waiting to happen.
      const { abbreviation } = await seedShow();
      await seedNomination(FILMS[0] as string);
      await signInAsAdmin(page);
      const poster = page.getByRole('listitem').filter({ hasText: FILMS[0] as string });
      const selector = page.getByRole('group', { name: 'Admin mode' });

      // View — off air, the default — is what a reader sees, plus the selector
      // and the show's settings.
      await page.goto(inMode(abbreviation));
      await expect(selector.getByRole('radio', { name: 'View' })).toBeChecked();
      await expect(poster).toBeVisible();
      for (const name of ['Mark winner', 'Remove', 'Put on screen', 'Delete category']) {
        await expect(page.getByRole('button', { name })).toHaveCount(0);
      }
      await expect(page.getByRole('searchbox')).toHaveCount(0);
      await expect(page.getByRole('switch')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Edit this show' })).toBeVisible();

      // Nominations — add, remove, set up categories.
      await page.goto(inMode(abbreviation, 'nominations'));
      await expect(poster.getByRole('button', { name: /^Remove/ })).toBeVisible();
      await expect(
        page.getByRole('searchbox', { name: /Nominate a film/ }),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add category' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Delete category' })).toBeVisible();
      await expect(page.getByRole('button', { name: /winner/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /on screen/i })).toHaveCount(0);
      await expect(page.getByRole('switch')).toHaveCount(0);

      // Winners — mark, clear, put on screen, go on air.
      await page.goto(inMode(abbreviation, 'winners'));
      await expect(poster.getByRole('button', { name: /^Mark winner/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Put on screen' })).toBeVisible();
      await expect(page.getByRole('switch', { name: 'Live' })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Remove/ })).toHaveCount(0);
      await expect(page.getByRole('searchbox')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Add category' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Delete category' })).toHaveCount(0);
    });

    test('the Live switch puts the show on air, and on air an admin lands in Winners', async ({
      page,
    }) => {
      const { abbreviation } = await seedShow();
      await seedNomination(FILMS[0] as string);
      await signInAsAdmin(page);
      const onAir = async () =>
        (
          (await withDb((query) =>
            query('select awards_active from events where abbreviation = $1', [
              abbreviation,
            ]),
          )) as { awards_active: boolean | null }[]
        )[0]?.awards_active === true;

      // Choosing Winners is not going on air: the mode is this admin's view.
      await page.goto(inMode(abbreviation, 'winners'));
      expect(await onAir()).toBe(false);
      const live = page.getByRole('switch', { name: 'Live' });
      await expect(live).not.toBeChecked();

      // The switch is. Pressed where a person presses it — the drawn track and
      // its label; the native box under them is visually hidden.
      const track = page.locator('label').filter({ has: live });
      await track.click();
      await expect.poll(onAir).toBe(true);

      // 🔴 On air, the page with no `?mode=` opens in Winners — from the
      // dashboard banner, a bookmark, a reload after the laptop slept.
      await page.goto(inMode(abbreviation));
      await expect(page.getByRole('radio', { name: 'Winners' })).toBeChecked();
      await expect(page.getByRole('button', { name: 'Mark winner' })).toBeVisible();
      // An explicit View is still View.
      await page.goto(inMode(abbreviation, 'view'));
      await expect(page.getByRole('button', { name: 'Mark winner' })).toHaveCount(0);

      // And off again.
      await page.goto(inMode(abbreviation, 'winners'));
      await expect(live).toBeChecked();
      await track.click();
      await expect.poll(onAir).toBe(false);
    });
  });
});

/**
 * The season view on `/award-shows` (P16.T15, T16), in a scratch year of its
 * own, 2989. Its own tag, so `award-shows`' `e2e-awards%` cleanup above cannot
 * take its rows, and its own cleanup, run before and after.
 *
 * One show: nominations on 10 Jan 2989 (ten films in Picture, the first also
 * in Director) and a ceremony on 1 Mar with no winners, so the ceremony is Up
 * next with ten films to name. One league with two seats holding the first
 * two films, whose names the signed-out page must never print (D44 rule b).
 */
const SV = 'e2e-season-view';
const SV_YEAR = 2989;
const SV_READER = {
  email: `${SV}-reader@example.test`,
  firstName: 'Rhea',
  lastName: 'Reader',
};
const SV_RIVAL = { name: 'Ravi Rival' };
const SV_LEAGUE = `${SV} League`;
const svFilm = (i: number) => `${SV} ${String(i).padStart(2, '0')}`;

async function svCleanup(): Promise<void> {
  await withDb(async (query) => {
    await query(
      `delete from draft_picks where draft_id in
         (select d.id from drafts d join leagues l on l.id = d.league_id where l.name like $1)`,
      [`${SV}%`],
    );
    await query(
      'delete from drafts where league_id in (select id from leagues where name like $1)',
      [`${SV}%`],
    );
    await query('delete from leagues where name like $1', [`${SV}%`]);
    for (const table of ['winners', 'nominations']) {
      await query(
        `delete from ${table} where award_id in
           (select a.id from awards a join events e on e.id = a.event_id
             where e.abbreviation like $1)`,
        [`${SV}%`],
      );
    }
    await query(
      `delete from awards where event_id in (select id from events where abbreviation like $1)`,
      [`${SV}%`],
    );
    await query('delete from events where abbreviation like $1', [`${SV}%`]);
    await query('delete from points where level like $1', [`${SV}%`]);
    await query('delete from movies where title like $1', [`${SV}%`]);
    await query('delete from users where email like $1', [`${SV}-%@example.test`]);
  });
}

async function svSeed(readerId?: number): Promise<{ leagueId: number }> {
  return withDb(async (query) => {
    const [event] = (await query(
      `insert into events (name, abbreviation, nom_date, awards_date, created_at, updated_at)
         values ($1, $2, $3, $4, now(), now()) returning id`,
      [`${SV} Show`, `${SV}-show`, Date.UTC(SV_YEAR, 0, 10), Date.UTC(SV_YEAR, 2, 1)],
    )) as { id: number }[];
    // A points row only when a seat is scored: `how-it-works.spec.ts` compares
    // the points table with its page, and every scratch level is a window in
    // which a parallel read of the two can disagree.
    const [points] =
      readerId == null
        ? [undefined]
        : ((await query(
            `insert into points (level, tier, points, created_at, updated_at)
               values ($1, 1, 10, now(), now()) returning id`,
            [`${SV}-level`],
          )) as { id: number }[]);
    const awards: number[] = [];
    for (const name of ['Picture', 'Director']) {
      const [award] = (await query(
        `insert into awards (name, event_id, points, created_at, updated_at)
           values ($1, $2, $3, now(), now()) returning id`,
        [`${SV} ${name}`, event?.id, points?.id],
      )) as { id: number }[];
      awards.push(award?.id as number);
    }
    const films: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const [movie] = (await query(
        `insert into movies (title, sort_title, tmdb_id, created_at, updated_at)
           values ($1, $1, $2, now(), now()) returning id`,
        [svFilm(i), String(9_980_000 + i)],
      )) as { id: number }[];
      films.push(movie?.id as number);
      await query(
        `insert into nominations (movie_id, award_id, year, created_at, updated_at)
           values ($1, $2, $3, now(), now())`,
        [movie?.id, awards[0], SV_YEAR],
      );
    }
    await query(
      `insert into nominations (movie_id, award_id, year, created_at, updated_at)
         values ($1, $2, $3, now(), now())`,
      [films[0], awards[1], SV_YEAR],
    );

    const [league] = (await query(
      `insert into leagues (name, owner, uuid, active_year, drafting_status, created_at, updated_at)
         values ($1, '[]', gen_random_uuid(), $2, 'complete', now(), now()) returning id`,
      [SV_LEAGUE, SV_YEAR],
    )) as { id: number }[];
    const [reader] = (await query(
      readerId == null
        ? `insert into drafts (league_id, year, "group", "order", dummy, dummy_name, created_at, updated_at)
             values ($1, $2, 1, 1, true, 'Rhea Reader', now(), now()) returning id`
        : `insert into drafts (league_id, user_id, year, "group", "order", created_at, updated_at)
             values ($1, $3, $2, 1, 1, now(), now()) returning id`,
      readerId == null ? [league?.id, SV_YEAR] : [league?.id, SV_YEAR, readerId],
    )) as { id: number }[];
    const [rival] = (await query(
      `insert into drafts (league_id, year, "group", "order", dummy, dummy_name, created_at, updated_at)
         values ($1, $2, 1, 2, true, $3, now(), now()) returning id`,
      [league?.id, SV_YEAR, SV_RIVAL.name],
    )) as { id: number }[];
    for (const [draftId, movieId] of [
      [reader?.id, films[0]],
      [rival?.id, films[1]],
    ]) {
      await query(
        `insert into draft_picks (draft_id, movie_id, "order", created_at, updated_at)
           values ($1, $2, 1, now(), now())`,
        [draftId, movieId],
      );
    }
    return { leagueId: league?.id as number };
  });
}

async function noSideways(page: Page): Promise<void> {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(0);
}

test.describe('the season view', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(svCleanup);
  test.afterEach(svCleanup);
  test.afterAll(svCleanup);

  test('signed out: the season in date order, Up next capped, and nobody’s seat', async ({
    page,
  }) => {
    await svSeed();
    const url = `/award-shows?year=${SV_YEAR}`;
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(url);
      expect(response?.status()).toBe(200);

      // The show's two moments, each under its month, each linking to the show.
      const nominations = page.getByRole('link', {
        name: new RegExp(`${SV} Show Nominations · 11 nominations`),
      });
      const ceremony = page.getByRole('link', {
        name: new RegExp(`${SV} Show Ceremony · 2 categories`),
      });
      await expect(nominations).toHaveAttribute(
        'href',
        `/award-shows/${SV}-show?year=${SV_YEAR}`,
      );
      await expect(nominations).toContainText(
        `Most nominated: ${svFilm(0)} · 2 nominations`,
      );
      await expect(ceremony).toHaveAttribute('aria-current', 'step');
      await expect(
        page.getByRole('heading', { level: 2, name: 'January 2989' }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { level: 2, name: 'March 2989' }),
      ).toBeVisible();

      // Up next: the ceremony, eight films named, and the other two counted.
      await expect(
        page.getByRole('heading', { level: 2, name: `${SV} Show` }),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: svFilm(7) })).toBeVisible();
      await expect(page.getByRole('link', { name: svFilm(8) })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'and 2 more' })).toBeVisible();

      await noSideways(page);
    }

    // D44 rule (b): no seat and no league, by name, anywhere in the HTML.
    const html = await page.content();
    for (const name of ['Rhea Reader', SV_RIVAL.name, SV_LEAGUE]) {
      expect(html.split(name).length - 1).toBe(0);
    }
  });

  test('signed in, a finished moment says what it did to your league; signed out, it does not', async ({
    page,
    browser,
  }) => {
    const readerId = await signInAs(page, SV_READER);
    await svSeed(readerId);
    const url = `/award-shows?year=${SV_YEAR}`;
    const nominations = (reader: Page) =>
      reader.getByRole('link', {
        name: new RegExp(`${SV} Show Nominations · 11 nominations`),
      });

    await page.goto(url);
    // Two nominations at 10 against the rival's one: +20, and first.
    await expect(nominations(page)).toContainText(`${SV_LEAGUE} +20 · 1st`);
    // The ceremony has not happened: no line on it.
    await expect(
      page.getByRole('link', { name: new RegExp(`${SV} Show Ceremony`) }),
    ).not.toContainText(SV_LEAGUE);
    await expect(
      page.getByText('2 of your nominations are up for 20 more points'),
    ).toBeVisible();
    // One row per film, its categories together.
    await expect(page.getByText(`${SV} Director, ${SV} Picture`)).toBeVisible();
    // A short row starts where its heading does. The row's `justify-center`
    // once centred it sideways at desktop width, off the rows above it.
    await page.setViewportSize({ width: 1440, height: 900 });
    const left = async (locator: ReturnType<Page['locator']>) =>
      (await locator.boundingBox())?.x;
    const heading = page.getByText('2 of your nominations are up for 20 more points');
    const title = heading.locator('..').getByText(svFilm(0), { exact: true });
    expect(await left(title)).toBe(await left(heading));

    const stranger = await browser.newContext();
    try {
      const other = await stranger.newPage();
      await other.goto(url);
      await expect(nominations(other)).toBeVisible();
      await expect(nominations(other)).not.toContainText(SV_LEAGUE);
      expect((await other.content()).includes(SV_LEAGUE)).toBe(false);
    } finally {
      await stranger.close();
    }
  });

  test('the rail’s heading on / opens the season', async ({ page }) => {
    await page.goto('/');
    const heading = page.getByRole('heading', { name: 'Season', exact: true });
    await expect(heading.getByRole('link', { name: 'Season' })).toHaveAttribute(
      'href',
      '/award-shows',
    );
  });
});

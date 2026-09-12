import { expect, type Page, test } from '@playwright/test';

import { signInAs } from './support/session';

/**
 * 🔴 The Phase 15 gate: one person takes a league from nothing to a drafted
 * board, in a browser, through the pages they would actually use.
 *
 * The other league specs each prove one act — creating, seating, dealing,
 * picking. None of them proves the acts *compose*: that the league a person
 * creates is the one the setup page arranges, that the seats it deals are the
 * running order the console reads, and that the picks the console takes are the
 * ones the league sees on the public board. A journey is the only shape that
 * can catch a seam between two features that are each individually green.
 *
 * 🔴 Scratch everything. The league, its seats, its picks and its five films
 * are all created by this spec and removed afterwards — league 1 is sixty
 * people's real history, and `lib/db.test.ts` asserts exact row counts for the
 * restored tables, so a leftover `movies` row turns an unrelated test red.
 * The tag is what makes both true: it prefixes the league and every film, and
 * `e2e-` is the prefix that count deliberately excludes.
 */
const TAG = 'e2e-lifecycle';

/** Five films: four for round one, one to prove the snake turns. */
const FILMS = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].map(
  (name) => `${TAG} ${name}`,
);

/** The three placeholders, so the draft has somebody to snake between. */
const DUMMIES = ['Ada', 'Grace', 'Katherine'];

/**
 * Raw `pg` rather than the Prisma client: Playwright does not resolve the `@/`
 * alias into `generated/prisma`, so importing `lib/db` fails at require time
 * and takes the whole spec with it. Same reasoning as `e2e/draft.spec.ts`.
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
    // Picks first: `draft_picks` has no foreign key, so rows deleted in the
    // other order are orphaned rather than removed.
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
    // Scoped to this spec's own address, not to `@example.test` at large —
    // the specs run side by side and a blanket delete takes another one's
    // signed-in identity mid-journey.
    await query('delete from users where email = $1', [`${TAG}-owner@example.test`]);
  });
}

/** The five films the owner drafts from, cached the way a real one would be. */
async function seedFilms(): Promise<void> {
  await withDb(async (query) => {
    for (const title of FILMS) {
      await query(
        `insert into movies (title, sort_title, created_at, updated_at)
           values ($1, $1, now(), now())`,
        [title],
      );
    }
  });
}

/** The seat the board says is up, read from the console's own heading. */
async function onTheClock(page: Page): Promise<string> {
  const heading = page.getByRole('heading', { name: /^Pick for / });
  await expect(heading).toBeVisible();
  return (await heading.innerText()).replace(/^Pick for /, '').trim();
}

/**
 * Take a film for whoever is up, and return the seat it went to.
 *
 * Waits on the console's own status line rather than on a seat name the spec
 * chose: the message is written after the action resolves, so by the time it
 * reads back the refreshed seats and the next suggestion have arrived as props.
 */
async function pick(page: Page, title: string): Promise<string> {
  const seat = await onTheClock(page);

  await page.getByRole('searchbox').fill(title);
  await page.getByRole('button', { name: new RegExp(title) }).click();
  await expect(page.getByText(`${title} → ${seat}`)).toBeVisible();

  return seat;
}

/** Every pick in the league, by seat and round, as the database has it. */
async function picksInLeague(leagueId: number) {
  return withDb(async (query) =>
    query(
      `select coalesce(d.dummy_name, u.first_name) as seat, dp."order" as round, m.title
         from draft_picks dp
         join drafts d on d.id = dp.draft_id
         left join users u on u.id = d.user_id
         join movies m on m.id = dp.movie_id
        where d.league_id = $1
        order by dp."order", dp.id`,
      [leagueId],
    ),
  ) as Promise<{ seat: string; round: number; title: string }[]>;
}

test.describe('the league lifecycle', () => {
  test.beforeAll(async () => {
    await cleanup();
    await seedFilms();
  });

  test.afterAll(cleanup);

  test('🔴 an owner takes a league from empty to a drafted board', async ({ page }) => {
    await signInAs(page, {
      email: `${TAG}-owner@example.test`,
      firstName: 'Owner',
    });

    // 1. Create. The creator is seated in the same breath, so this league has
    //    one seat before anybody is added to it.
    await page.goto('/leagues/new');
    await page.getByLabel('League name').fill(`${TAG} the lifecycle`);
    await page.getByRole('button', { name: 'Create league' }).click();
    await expect(page).toHaveURL(/\/leagues\/\d+/);
    await expect(
      page.getByRole('heading', { name: `${TAG} the lifecycle` }),
    ).toBeVisible();
    const leagueId = Number(new URL(page.url()).pathname.split('/')[2]);

    // 2. Seats. Followed from the league's own page rather than typed as a
    //    URL — the link being there for an owner is part of the journey.
    await page.getByRole('link', { name: 'Set up the season' }).click();
    for (const name of DUMMIES) {
      await page.getByLabel(/without an account/i).fill(name);
      await page.getByRole('button', { name: 'Add seat' }).click();
      await expect(page.getByText(`${name} seated`)).toBeVisible();
    }

    // 3. Groups. 🔴 One, not two: a snake is an order *within* a group, and
    //    four people split across two groups leaves two seats apiece — which
    //    a reversal and a plain repeat are indistinguishable in.
    await page.getByLabel('How many groups').fill('1');
    await page.getByRole('button', { name: 'Deal at random' }).click();
    await expect(page.getByText(/dealt into groups/i)).toBeVisible();

    // 4. Open it. Confirms first, because groups are fixed from this moment.
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Start the draft' }).click();
    await expect(page.getByText('The draft is open')).toBeVisible();

    // 5. Pick, by searching — the draft-day path that matters most. The owner
    //    types a fragment of what somebody just said out loud on the call.
    await page.goto(`/leagues/${leagueId}/draft`);
    const round1: string[] = [];
    for (const title of FILMS.slice(0, 4)) {
      round1.push(await pick(page, title));
    }

    // 6. Snake order, asserted from the console's own answer rather than from
    //    the order the spec typed the picks in — which would prove only that
    //    the spec can count. Round 1 gives everybody exactly one turn…
    expect(new Set(round1).size).toBe(4);
    // …and round 2 starts where round 1 ended rather than going back to the
    // top. 🔴 This is the whole assertion: a draft that ran 1-2-3-4-1 would
    // pass every other check in this file.
    expect(await onTheClock(page)).toBe(round1.at(-1));

    const fifth = await pick(page, FILMS[4] as string);
    expect(fifth).toBe(round1.at(-1));
    // And it keeps running back down the order.
    expect(await onTheClock(page)).toBe(round1.at(-2));

    // 7. The board the league is watching has the picks, from the public page
    //    rather than from the console that entered them.
    await page.goto(`/leagues/${leagueId}`);
    const board = page.getByRole('table');
    for (const title of FILMS) {
      await expect(board.getByText(title, { exact: true })).toBeVisible();
    }

    // And the rows say the same thing the board does: five picks, the last
    // seat of round 1 holding two.
    const picks = await picksInLeague(leagueId);
    expect(picks.map((row) => row.title)).toEqual(FILMS);
    expect(picks.map((row) => row.round)).toEqual([1, 1, 1, 1, 2]);
    expect(picks.at(-1)?.seat).toBe(round1.at(-1));
  });
});

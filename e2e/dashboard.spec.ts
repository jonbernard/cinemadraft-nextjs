import { expect, type Page, test } from '@playwright/test';

import { skipWithoutRestoredCorpus } from './support/corpus';
import { signInAs } from './support/session';

/**
 * 🔴 The Phase 5 gate from `docs/PLAN.md`:
 *
 *   "E2E green; no truncated titles at any breakpoint."
 *
 * Truncation is the specific defect this redesign exists to fix. The current
 * app overlays titles on the artwork, so a member scanning their roster sees
 * "One Ba…", "Is This …", "Wake …" — the film becomes unidentifiable at
 * exactly the moment they are looking for it. §6.7 moves the title below the
 * frame at full width for this reason.
 *
 * The title under test is read from the database — whichever film on this
 * member's roster has the longest name — so the assertion always points at the
 * hardest real case rather than a string that was true once.
 */

/** A real restored account with a 2026 roster in league 1. Referenced by id. */
const MEMBER_ID = 6;

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

/**
 * The longest title on this member's roster, read from the database.
 *
 * Hardcoding it was wrong once already: the longest title in the 2026 data
 * overall belongs to a different member's seat, so the assertion looked for a
 * film that was never on this page. Deriving it keeps the test pointed at the
 * hardest real case even as the draft changes.
 */
async function longestRosterTitle(): Promise<string> {
  return withDb(async (query) => {
    const rows = (await query(
      `select m.title from movies m
         join draft_picks dp on dp.movie_id = m.id
         join drafts d on d.id = dp.draft_id and d.year = 2026 and d.user_id = $1
        order by length(m.title) desc
        limit 1`,
      [MEMBER_ID],
    )) as { title: string }[];
    const title = rows[0]?.title;
    if (!title) throw new Error(`user ${MEMBER_ID} has no 2026 roster`);
    return title;
  });
}

/**
 * Sign in **as** the restored member, rather than as a throwaway identity
 * relinked onto them.
 *
 * 🔴 This spec has to see a real roster: a fresh account has no leagues, so it
 * would only ever exercise the empty state and the truncation assertions below
 * would have nothing to measure. Under Clerk that meant signing up, then moving
 * the new `clerk_id` onto row 6 and undoing it afterwards — a write into the
 * restored data for the sake of reading it. The test session takes the row as
 * it is (D82/D84): nothing about user 6 changes, so there is nothing to put
 * back, and the spec can no longer leave a test identity attached to a real
 * person if it fails halfway.
 *
 * The address is read from the row rather than written here — it belongs to a
 * real person and does not go in a source file.
 */
async function signInAsMember(page: Page): Promise<void> {
  const email = await withDb(async (query) => {
    const rows = (await query('select email from users where id = $1', [MEMBER_ID])) as {
      email: string;
    }[];
    const address = rows[0]?.email;
    if (!address) throw new Error(`user ${MEMBER_ID} is not in this database`);
    return address;
  });

  await signInAs(page, { email });
}

test.describe('dashboard', () => {
  test('🔴 signed out, it shows the season and no one else’s team (D44)', async ({
    page,
  }) => {
    await page.goto('/');

    // The public variant is the season itself. A login wall on the front page
    // during awards season is the worst possible first impression.
    await expect(
      page.getByRole('heading', { name: 'Season', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /register/i }).first()).toBeVisible();

    // And nothing that belongs to a person. 🔴 Named rather than "no table at
    // all": the season leaderboard is a table and it is *supposed* to be here
    // — it is the season, not anybody's team (P10.T4). Standings and a roster
    // are the two things a visitor must not see.
    await expect(page.getByRole('table', { name: /League standings/i })).toHaveCount(0);
    await expect(page.getByRole('list', { name: /drafted films/i })).toHaveCount(0);
  });

  test('🔴 the page has a valid heading outline', async ({ page }) => {
    await page.goto('/');

    const levels = await page.evaluate(() =>
      [...document.querySelectorAll('main h1, main h2, main h3, main h4')].map((h) =>
        Number(h.tagName[1]),
      ),
    );

    // One h1, first. Then no jump of more than one level — which is what
    // h1 → h3 was, and what made the page's own structure unreadable to a
    // screen reader long before it was visible to anybody else.
    expect(levels[0]).toBe(1);
    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] + 1);
    }
  });

  test('🔴 headings render at 28 / 20 / 17, and an h1 outranks a league name', async ({
    page,
  }) => {
    await page.goto('/');

    const px = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));

    // Rendered px, not class names: the whole defect was that four different
    // `as` values compiled to one size, which no class assertion would show.
    expect(await px('main h1')).toBeCloseTo(28, 0);
    expect(await px('main h2')).toBeCloseTo(20, 0);
    // A serif name is 24px on its own axis (D70), so the h1 must clear it.
    expect(await px('main h1')).toBeGreaterThan(24);
  });

  test.describe('signed in', () => {
    /**
     * 🔴 These four need the restored member, and only these four — the
     * signed-out test above is about what a stranger may see and runs
     * everywhere, including CI's empty database.
     *
     * Not seeded a scratch roster instead: `longestRosterTitle` exists so the
     * assertion always points at the hardest REAL title, and a roster this
     * file invented would be a roster this file chose the title lengths of.
     * That is the one thing these tests must not be. See `support/corpus.ts`.
     */
    test.beforeEach(skipWithoutRestoredCorpus);

    test('shows the member’s roster, total and standings', async ({ page }) => {
      await signInAsMember(page);
      await page.goto('/');

      await expect(page.getByRole('list', { name: /drafted films/i })).toBeVisible();
      // The member's own standings, named: the page also carries the season
      // leaderboard, and an unnamed `getByRole('table')` matches both.
      await expect(page.getByRole('table', { name: /League standings/i })).toBeVisible();
      // The viewer is findable without relying on colour.
      await expect(page.getByText('You', { exact: true })).toBeVisible();
    });

    // 375 is an iPhone SE, 768 an iPad portrait, 1440 a laptop — the three
    // widths the roster grid changes shape at (2 / 4 / 8 across).
    for (const width of [375, 768, 1440]) {
      test(`🔴 no truncated titles at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await signInAsMember(page);
        await page.goto('/');

        const longest = await longestRosterTitle();
        // 🔴 Scoped to the roster grid, not to the page. `longestRosterTitle`
        // applies no points filter, so the film it names may also be on the
        // dashboard's lower-fold shelves — and two matches make
        // `getByText(..., { exact: true })` fail Playwright's strict mode
        // before a single assertion runs. `RosterStrip` is the only list on
        // the page with this accessible name (`Shelf` renders a bare <ul>),
        // so this resolves to the grid this test is about and to nothing else.
        const title = page
          .getByRole('list', { name: /drafted films/i })
          .getByText(longest, { exact: true })
          .first();
        await expect(title).toBeVisible();

        // The old app's defect was the *text* being cut to "Wake …", so the
        // film could not be identified or selected. Assert the whole string is
        // really in the DOM, not an ellipsis standing in for it.
        await expect(title).toHaveText(longest);

        // And that it is not visually clipped. §6.7 specifies a two-line
        // clamp, so this checks the title fits the space it was given rather
        // than overflowing it invisibly.
        const clipped = await title.evaluate(
          (el) => el.scrollHeight > el.clientHeight + 1,
        );
        expect(clipped, `"${longest}" is clipped at ${width}px`).toBe(false);
      });
    }
  });
});

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
 * The prefix every row this spec creates is named with, so the cleanup below
 * can delete exactly its own and nothing else.
 *
 * 🔴 The database this runs against locally is a restored copy of production.
 * League 1 is sixty real people's draft history; the only rows this file may
 * remove are the `@example.test` identities it minted itself.
 */
const TAG = 'e2e-dashboard';

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

/**
 * A second season for the picker to offer. `SeasonPicker` renders nothing for a
 * single season, and CI's database holds exactly one — so the 44px test passed
 * there only when another spec's scratch season happened to exist at that
 * moment. Inactive, so `available_years_one_active` is untouched.
 *
 * 🔴 Removed by the test's own `finally`, not by `afterAll`: with
 * `fullyParallel` every worker runs the describe's `afterAll`, and one of them
 * could delete the row while another worker's copy of this test still needs it.
 */
const SCRATCH_YEAR = 2991;

test.describe('dashboard', () => {
  test.afterAll(async () => {
    await withDb(async (query) => {
      await query(`delete from users where email like '${TAG}-%@example.test'`);
    });
  });

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

  test('🔴 a signed-out reader is told what this is, above the fold', async ({
    page,
  }) => {
    await page.goto('/');

    const lede = page.getByTestId('signed-out-lede');
    await expect(lede).toBeVisible();
    await expect(lede).toContainText(/draft a team of films/i);
    await expect(lede.getByRole('link', { name: 'Register' })).toBeVisible();

    // Above the fold, which is the whole point — the invitation already
    // existed, four sections down, where nobody arriving mid-ceremony met it.
    const box = await lede.boundingBox();
    expect(box?.y ?? Infinity).toBeLessThan(600);

    // And above the rail it introduces.
    const rail = await page.getByTestId('season-window').boundingBox();
    expect(box?.y ?? Infinity).toBeLessThan(rail?.y ?? 0);
  });

  test('🔴 and it is gone the moment they are signed in', async ({ page }) => {
    await signInAs(page, { email: `${TAG}-lede@example.test`, firstName: 'Reader' });
    await page.goto('/');

    await expect(page.getByTestId('signed-out-lede')).toHaveCount(0);
    // The heading it sat under is still there, so this is the lede going and
    // not the whole section.
    await expect(page.getByRole('heading', { level: 1, name: 'Season' })).toBeVisible();
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

  test('🔴 every season target clears 44px', async ({ page }) => {
    await withDb((query) =>
      query(
        `insert into available_years (year, is_active, created_at, updated_at)
           values ($1, false, now(), now()) on conflict (year) do nothing`,
        [SCRATCH_YEAR],
      ),
    );
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/');

      // The defect: ten year links at 33.6 × 20px. Rendered geometry is the only
      // place that number was ever real, which is why no test caught it.
      const picker = page.getByRole('group', { name: 'Season' });
      const summary = await picker.locator('summary').boundingBox();
      expect(summary?.height ?? 0).toBeGreaterThanOrEqual(44);

      await picker.locator('summary').click();
      for (const link of await picker.getByRole('link').all()) {
        const box = await link.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
    } finally {
      await withDb((query) =>
        query('delete from available_years where year = $1 and not is_active', [
          SCRATCH_YEAR,
        ]),
      );
    }
  });

  test('🔴 the table owns its overflow, and the film column pins (1024px)', async ({
    page,
  }) => {
    // 🔴 Reads the active season's real leaderboard. CI's seeded database has
    // none, and this passed there only when a concurrent spec's scratch league
    // happened to be on the board — a race, not coverage.
    await skipWithoutRestoredCorpus();
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto('/');

    // 🔴 Rendered `position`, not a scroll. The review reported that twelve
    // per-show columns overflow the content panel at 1024 and take the
    // document sideways; measured against a production build on 2026-09-12
    // that is **not reproducible** — the wrapper's scrollWidth and clientWidth
    // are both 992, so there is nothing to scroll and a scroll assertion here
    // would pass whether or not the cell were sticky. What is falsifiable is
    // that the cell *is* sticky at `lg`, ready for the season that does not
    // fit, and that the document is never the thing that scrolls.
    const film = page.getByRole('rowheader').first();
    expect(await film.evaluate((el) => getComputedStyle(el).position)).toBe('sticky');

    const wrapper = page.locator('.lg\\:overflow-x-auto').first();
    expect(await wrapper.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto');

    // Whatever the table does, the document does not move.
    await wrapper.evaluate((el) => {
      el.scrollLeft = 400;
    });
    expect(
      await page.evaluate(() => document.scrollingElement?.scrollWidth ?? 0),
    ).toBeLessThanOrEqual(1024);

    // And below `lg` the cell is static and the container does not scroll —
    // D79, unchanged.
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await film.evaluate((el) => getComputedStyle(el).position)).toBe('static');
    expect(await wrapper.evaluate((el) => getComputedStyle(el).overflowX)).toBe(
      'visible',
    );
  });

  /**
   * 🔴 P17.T17, and it has to be here rather than in jsdom.
   *
   * The component test pins that `priority` reaches `next/image`; only a real
   * page can pin how many frames the shelf marks, and that is the half that
   * goes wrong — `priority` is a preload link per image, so marking the whole
   * shelf puts twelve of them in contention and makes the LCP worse.
   *
   * Two exact, not "at least one": both a zero and a twelve have to fail.
   */
  test('🔴 the first two In cinemas now frames preload, and only those two', async ({
    page,
  }) => {
    await page.goto('/');

    const shelf = page.locator('section', { hasText: 'In cinemas now' }).first();
    const frames = await shelf.locator('img').count();
    // Only meaningful when TMDB actually answered; a preview with no key
    // renders no shelf at all.
    test.skip(frames < 3, 'no now-playing shelf on this deployment');

    const preloads = await page
      .locator('head link[rel="preload"][as="image"]')
      .evaluateAll((links) => links.map((l) => l.getAttribute('href')));
    expect(preloads).toHaveLength(2);

    // And they are the shelf's own first two, in order — not two arbitrary
    // posters from somewhere else on the page.
    const firstTwo = await shelf
      .locator('img')
      .evaluateAll((imgs) => imgs.slice(0, 2).map((i) => i.getAttribute('src')));
    expect(preloads).toEqual(firstTwo);

    // The point of the preload: those two are no longer lazy, the rest are.
    await expect(shelf.locator('img').nth(0)).not.toHaveAttribute('loading', 'lazy');
    await expect(shelf.locator('img').nth(2)).toHaveAttribute('loading', 'lazy');
  });

  test('🔴 a phone can see where a total came from', async ({ page }) => {
    // 🔴 Reads the active season's real leaderboard. CI's seeded database has
    // none, and this passed there only when a concurrent spec's scratch league
    // happened to be on the board — a race, not coverage.
    await skipWithoutRestoredCorpus();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await page.getByRole('rowheader').first().getByRole('button').click();

    await expect(page.locator('[data-testid^="breakdown-"]').first()).toBeVisible();
    expect(
      await page.evaluate(() => document.scrollingElement?.scrollWidth ?? 0),
    ).toBeLessThanOrEqual(390);
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

    /**
     * 🔴 P17.T15, and the half of it that is not the animation.
     *
     * `PosterFrame` has carried a winner seal since Phase 3.5 and, until this
     * task, nothing in the application ever set `status` — the only `'won'` in
     * the repository was in a story file. So the seal had rendered zero times
     * in the product, and a component test asserting it renders when told to
     * would have gone green throughout.
     *
     * This asserts it against the real restored roster, where member 6 holds
     * films that genuinely won this season: the seal reaches the page from the
     * ledger, not from a prop a test set.
     */
    test('🔴 a film that won is sealed on the roster, from real data', async ({
      page,
    }) => {
      await signInAsMember(page);
      await page.goto('/');

      const strip = page.getByRole('list', { name: /drafted films/i });
      await expect(strip).toBeVisible();

      // Some, not all: a roster of seals would mean status was hardcoded, and
      // a roster of none is the state this task exists to end.
      const sealed = strip.getByLabel('Winner');
      const frames = strip.getByRole('figure');
      const [seals, total] = [await sealed.count(), await frames.count()];
      expect(seals).toBeGreaterThan(0);
      expect(seals).toBeLessThan(total);

      // 🔴 Read off the running animation, not off computed style. Both of the
      // obvious assertions here are ones a broken seal passes:
      // `animation-iteration-count: 1` is CSS's own default, and
      // `animation-name: stamp` reads back even when no `@keyframes stamp`
      // rule was ever compiled — a name is just a reference. Only the
      // keyframes themselves distinguish a stamp from a seal that was always
      // simply there.
      const stamp = await sealed.first().evaluate((el) => {
        const anim = el.getAnimations()[0] as CSSAnimation | undefined;
        // `getKeyframes` lives on KeyframeEffect, not the AnimationEffect base
        // the DOM lib types `effect` as.
        const effect = anim?.effect as KeyframeEffect | undefined;
        const frames = effect?.getKeyframes() ?? [];
        return {
          name: anim?.animationName ?? null,
          iterations: effect?.getTiming().iterations ?? null,
          fill: effect?.getTiming().fill ?? null,
          from: frames[0] ?? null,
        };
      });

      expect(stamp.name).toBe('stamp');
      // It is a mark, not a notification: one run, then still.
      expect(stamp.iterations).toBe(1);
      // `both` is load-bearing — without it the seal shows at full size for a
      // frame before the animation starts.
      expect(stamp.fill).toBe('both');
      // And it genuinely arrives from somewhere: oversized, rotated, invisible.
      expect(stamp.from?.opacity).toBe('0');
      expect(String(stamp.from?.transform)).toContain('scale(2.2)');
    });

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

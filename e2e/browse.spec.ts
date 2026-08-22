import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * Browse, in a real browser.
 *
 * Two things are proven here and nowhere else: that the past/future choice and
 * the page number really do live in the URL (D65), and that marking a film
 * watched survives a reload — which is the whole point of the badge, and which a
 * component test with a stubbed action cannot show.
 *
 * 🔴 The watched test **puts the row back**. It marks a real film against a
 * throwaway identity, reloads, unmarks it, and then deletes the account — so the
 * restored data's 486 watchlist rows are untouched either way.
 */
const hasTmdb = Boolean(process.env.TMDB_API_KEY);
const hasClerk = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

/**
 * Raw `pg` rather than the Prisma client: Playwright does not resolve the `@/`
 * alias into `generated/prisma`, so importing `lib/db` fails at require time and
 * takes the whole spec with it. Same reasoning as `e2e/award-shows.spec.ts`.
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

/** Sign up a throwaway identity, and return its address so it can be removed. */
async function signUp(page: Page): Promise<string> {
  await setupClerkTestingToken({ page });
  const address = `e2e_browse_${Date.now()}+clerk_test@example.com`;

  await page.goto('/auth/register');
  await page.getByLabel(/email address/i).fill(address);

  // Wait for the code to be SENT before entering one — the OTP field submits as
  // soon as it is full, and filling it early races prepare_verification.
  const codeSent = page.waitForResponse(
    (response) => response.url().includes('prepare_verification') && response.ok(),
    { timeout: 20_000 },
  );
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await codeSent;

  await page.getByRole('textbox', { name: /verification code/i }).fill('424242');
  await expect(page).not.toHaveURL(/\/auth\/register/, { timeout: 20_000 });

  return address;
}

async function watchlistCountFor(address: string): Promise<number> {
  return withDb(async (query) => {
    const rows = (await query(
      `select count(*)::int as count
         from watchlists w join users u on u.id = w.user_id
        where u.email = $1`,
      [address],
    )) as { count: number }[];
    return rows[0]?.count ?? 0;
  });
}

/** The TMDB id of the first poster on the shelf, so a badge can be addressed. */
async function firstFilmId(page: Page): Promise<string> {
  const href = await page.locator('a[href^="/films/"]').first().getAttribute('href');
  const id = href?.split('/').at(-1);
  if (!id) throw new Error('no film on the browse page to mark');
  return id;
}

async function removeAccount(address: string): Promise<void> {
  await withDb(async (query) => {
    await query(
      'delete from watchlists where user_id in (select id from users where email = $1)',
      [address],
    );
    await query('delete from users where email = $1', [address]);
  });
}

/** Whether this film is already one of the cached rows. */
async function isCached(tmdbId: string): Promise<boolean> {
  return withDb(async (query) => {
    const rows = (await query('select id from movies where tmdb_id = $1', [tmdbId])) as {
      id: number;
    }[];
    return rows.length > 0;
  });
}

/**
 * Remove the `movies` row this test caused to be created.
 *
 * 🔴 Marking a film watched **ingests it** (D63 draws the line: a person acting
 * deliberately writes, a page render does not), so this test adds a row to
 * `movies` as a side effect. `lib/db.test.ts` asserts the restored table still
 * holds exactly 1,355 films, and it failed with 1,356 the first time this spec
 * ran — correctly. A test that leaves data behind makes every later count
 * assertion a little less true.
 *
 * Only ever deletes a film that was **not** cached before the test ran, and only
 * when nothing references it.
 */
async function forgetFilm(tmdbId: string): Promise<void> {
  await withDb(async (query) => {
    const rows = (await query(
      `select m.id from movies m
        where m.tmdb_id = $1
          and not exists (select 1 from watchlists w where w.movie_id = m.id)
          and not exists (select 1 from draft_picks d where d.movie_id = m.id)
          and not exists (select 1 from nominations n where n.movie_id = m.id)
          and not exists (select 1 from lists l where l.movie_id = m.id)`,
      [tmdbId],
    )) as { id: number }[];
    const id = rows[0]?.id;
    if (id) await query('delete from movies where id = $1', [id]);
  });
}

test.describe('browse', () => {
  test.skip(!hasTmdb, 'TMDB_API_KEY not configured');

  test('🔴 the past/future choice is in the URL, not in component state', async ({
    page,
  }) => {
    // The source held it in `useState`, so the view could not be linked and Back
    // did not return to it (D65).
    await page.goto('/browse');

    const past = page.getByRole('link', { name: 'The past' });
    const future = page.getByRole('link', { name: 'The future' });
    await expect(past).toHaveAttribute('aria-current', 'true');

    await future.click();
    await expect(page).toHaveURL(/when=future/);
    await expect(future).toHaveAttribute('aria-current', 'true');

    // And Back returns to where the reader was, which is the whole point.
    await page.goBack();
    await expect(past).toHaveAttribute('aria-current', 'true');
  });

  test('groups films by release month', async ({ page }) => {
    await page.goto('/browse');

    await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText(
      /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/,
    );
  });

  test('🔴 the months reverse when looking forward', async ({ page }) => {
    // Looking back the newest month is the top of the page; looking forward the
    // soonest is. Read the first heading on each side and compare.
    await page.goto('/browse?when=past');
    const newestPast = await page
      .getByRole('heading', { level: 2 })
      .first()
      .textContent();

    await page.goto('/browse?when=future');
    const soonestFuture = await page
      .getByRole('heading', { level: 2 })
      .first()
      .textContent();

    const order = (label: string | null) => {
      const at = Date.parse(`1 ${label ?? ''}`);
      return Number.isNaN(at) ? Number.POSITIVE_INFINITY : at;
    };
    // The past side's newest month is at or before the future side's soonest.
    expect(order(newestPast)).toBeLessThanOrEqual(order(soonestFuture));
  });

  test('🔴 "Show more" is a real link to the next page', async ({ page }) => {
    // Not an intersection observer: it works before hydration, can be opened in a
    // new tab, and is reachable with a keyboard.
    await page.goto('/browse?when=future');

    const more = page.getByRole('link', { name: /Show more/ });
    await more.scrollIntoViewIfNeeded();
    await expect(more).toHaveAttribute('href', '/browse?when=future&page=2');

    await more.click();
    await expect(page).toHaveURL(/page=2/);
  });

  test('a poster links to the film’s page', async ({ page }) => {
    await page.goto('/browse');

    const first = page.locator('a[href^="/films/"]').first();
    await expect(first).toHaveAttribute('href', /^\/films\/\d+$/);
  });

  test('the watched badge is hidden from a signed-out reader', async ({ page }) => {
    await page.goto('/browse');

    await expect(page.getByRole('button', { name: /Mark .* as watched/ })).toHaveCount(0);
  });
});

test.describe('marking a film watched', () => {
  test.skip(!hasTmdb || !hasClerk, 'TMDB or Clerk keys not configured');
  // Serial: each test signs up a Clerk identity, and parallel sign-ups queue
  // behind the rate limit and stall on verification.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    if (hasClerk) await clerkSetup();
  });

  test('🔴 survives a reload, and can be undone', async ({ page }) => {
    const address = await signUp(page);
    let markedFilm: string | null = null;
    let wasCached = true;

    try {
      await page.goto('/browse');

      // 🔴 Located by `data-testid`, **not** by the badge's accessible name. That
      // name changes when the film is marked — deliberately, so a screen reader
      // hears the new state — so a name-based locator silently resolves to the
      // *next* unmarked film's badge after the click and reports the wrong
      // poster's state. The feature was correct and the test was lying, which is
      // exactly the failure mode the testid convention exists to prevent.
      const tmdbId = await firstFilmId(page);
      markedFilm = tmdbId;
      // Recorded before the click: marking a film ingests it, and the row must
      // only be removed afterwards if this test is what created it.
      wasCached = await isCached(tmdbId);

      const badge = page.getByTestId(`watched-toggle-${tmdbId}`);
      await badge.scrollIntoViewIfNeeded();
      await expect(badge).toHaveAttribute('aria-pressed', 'false');
      // The name is still asserted — it is what a screen reader hears. The
      // difference is that it is the assertion rather than the handle.
      await expect(badge).toHaveAccessibleName(/^Mark .* as watched$/);

      await badge.click();
      await expect(badge).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => watchlistCountFor(address)).toBe(1);

      // The write is what has to survive; the flip above could be optimism alone.
      await page.reload();
      const sameBadge = page.getByTestId(`watched-toggle-${tmdbId}`);
      await sameBadge.scrollIntoViewIfNeeded();
      await expect(sameBadge).toHaveAttribute('aria-pressed', 'true');
      await expect(sameBadge).toHaveAccessibleName(/Mark as not watched$/);

      // Unmark, so the row is gone even before the account is deleted.
      await sameBadge.click();
      await expect.poll(() => watchlistCountFor(address)).toBe(0);
    } finally {
      await removeAccount(address);
      if (markedFilm && !wasCached) await forgetFilm(markedFilm);
    }
  });
});

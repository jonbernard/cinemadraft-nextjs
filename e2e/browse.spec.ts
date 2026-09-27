import { expect, type Page, test } from '@playwright/test';

import { signInAs } from './support/session';

/**
 * Browse, in a real browser.
 *
 * Two things are proven here and nowhere else: that the past/future choice
 * really does live in the URL (D65) while the pages now append (D80), and that
 * marking a film watched survives a reload — which is the whole point of the
 * badge, and which a component test with a stubbed action cannot show.
 *
 * 🔴 The watched test **puts the row back**. It marks a real film against a
 * throwaway identity, reloads, unmarks it, and then deletes the account — so the
 * restored data's 486 watchlist rows are untouched either way.
 */
const TAG = 'e2e-browse';
const hasTmdb = Boolean(process.env.TMDB_API_KEY);

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

/**
 * Seat a throwaway identity, and return its address so it can be removed.
 *
 * The session is the signed test cookie rather than a Clerk sign-up (D82/D84):
 * the app under test boots with no Clerk at all, and what this test is about is
 * the badge surviving a reload, not how the reader signed in.
 */
async function signUp(page: Page): Promise<string> {
  const address = `${TAG}-${Date.now()}-${Math.floor(performance.now())}@example.test`;
  await signInAs(page, { email: address, firstName: 'Reader' });
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

  test('the past/future choice is in the URL, not in component state', async ({
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

  test('the months reverse when looking forward', async ({ page }) => {
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

  test('the shelf appends when the reader reaches the bottom', async ({ page }) => {
    // D80 traded the "Show more" link for auto-append. Proven in a browser
    // because a component test supplies its own IntersectionObserver — whether
    // a real one fires is exactly what it cannot say.
    await page.goto('/browse?when=past');

    const films = page.locator('section ul > li');
    const before = await films.count();
    expect(before).toBeGreaterThan(0);

    await page.getByTestId('browse-sentinel').scrollIntoViewIfNeeded();
    await expect.poll(() => films.count(), { timeout: 15_000 }).toBeGreaterThan(before);

    // 🔴 No month appears twice. Two pages routinely carry films from the same
    // month, and a second "October 2026" section is the bug the merge prevents.
    const months = await page.getByRole('heading', { level: 2 }).allTextContents();
    expect(new Set(months).size).toBe(months.length);
  });

  test('the cursor follows the reader into the URL (amends D80)', async ({ page }) => {
    // 🔴 jsdom has a history object but no scrolling, no real navigation and no
    // bfcache, so every property this task exists for is a browser property.
    //
    // D80 is otherwise untouched: no button comes back, nothing on screen
    // changes, and the reader cannot tell this shipped by looking at the page.
    await page.goto('/browse');

    const films = page.locator('section ul > li');
    const start = await films.count();
    const entries = await page.evaluate(() => history.length);

    await page.getByTestId('browse-sentinel').scrollIntoViewIfNeeded();
    await expect.poll(() => films.count(), { timeout: 15_000 }).toBeGreaterThan(start);
    await expect(page).toHaveURL(/[?&]page=2/);

    const two = await films.count();
    await page.getByTestId('browse-sentinel').scrollIntoViewIfNeeded();
    await expect.poll(() => films.count(), { timeout: 15_000 }).toBeGreaterThan(two);
    await expect(page).toHaveURL(/[?&]page=3/);
    // The side rides along, or the cursor points into the wrong catalogue.
    await expect(page).toHaveURL(/[?&]when=past/);

    // 🔴 `replaceState`, not `pushState`: two appends and the history is the
    // same length it was. This is the infinite-scroll Back trap D80 was right
    // to avoid, and buying the URL back must not rebuild it.
    expect(await page.evaluate(() => history.length)).toBe(entries);
  });

  test('the cursor survives a trip to a film and back (amends D80)', async ({ page }) => {
    await page.goto('/browse');
    const films = page.locator('section ul > li');
    const start = await films.count();

    await page.getByTestId('browse-sentinel').scrollIntoViewIfNeeded();
    await expect.poll(() => films.count(), { timeout: 15_000 }).toBeGreaterThan(start);
    const cursor = new URL(page.url()).search;
    expect(cursor).toMatch(/page=2/);

    await page.locator('a[href^="/films/"]').first().click();
    await page.waitForURL(/\/films\//);

    // 🔴 One press of Back, not one per appended page.
    await page.goBack();
    await expect(page).toHaveURL(/\/browse/);

    // The cursor came back with it. 🔴 What comes back on screen is the App
    // Router's cached first page, not the cursor's — measured, 2026-09-12: the
    // client cache answers the Back before any request is made, and that is
    // Next's behaviour for a soft-navigated entry, not something this page
    // chooses. The URL is the half that is bought back, and it is the half
    // that travels: a reload or a paste of this address lands on the cursor.
    expect(new URL(page.url()).search).toBe(cursor);
    await page.reload();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(films.first()).toBeVisible();
  });

  test('a shared cursor opens where the sender was', async ({ page }) => {
    // The entry point `?page=` already worked (D65, kept by D80) — nothing had
    // ever pointed at it. Now the address bar does, so this is the other end of
    // the same trip.
    const films = page.locator('section ul > li');

    await page.goto('/browse');
    const fromTheTop = await films.first().textContent();

    await page.goto('/browse?when=past&page=3');
    // Page 3, not the top of the catalogue.
    expect(await films.first().textContent()).not.toBe(fromTheTop);

    await page.goto('/browse?when=future&page=2');
    // The side the sender was on, not the default.
    await expect(page.getByRole('link', { name: 'The future' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
  });

  test('a crawler still has a path into page 2', async ({ page }) => {
    // The one property of D65 that auto-append keeps. The sitemap (P15.T6)
    // leads here, and the sentinel offers nothing to a client without
    // JavaScript — so the link stays, in a <noscript> readers never see.
    await page.goto('/browse?when=past');

    // `textContent` of a <noscript> in a JS-enabled browser is the raw markup,
    // ampersand still entity-escaped — so the href is matched, not compared.
    const crawlPath = await page.locator('noscript').last().textContent();
    expect(crawlPath).toMatch(/href="\/browse\?when=past&(amp;)?page=2"/);
  });

  test('?page= still works as an entry point', async ({ page }) => {
    // A shared link or a crawler landing on page 3 gets page 3, and appends
    // 4, 5, … from there.
    await page.goto('/browse?when=past&page=3');

    await expect(page.locator('section ul > li').first()).toBeVisible();
    await expect(page.getByTestId('browse-sentinel')).toBeAttached();
  });

  test('a poster links to the film’s page', async ({ page }) => {
    await page.goto('/browse');

    const first = page.locator('a[href^="/films/"]').first();
    await expect(first).toHaveAttribute('href', /^\/films\/\d+$/);
  });

  test('the watched badge is hidden from a signed-out reader', async ({ page }) => {
    await page.goto('/browse');

    await expect(page.getByRole('button', { name: /Mark as watched: / })).toHaveCount(0);
  });

  test('posters come straight from TMDB, not the optimizer', async ({ page }) => {
    await page.goto('/browse');
    const poster = page.locator('img[src*="image.tmdb.org"]').first();
    await expect(poster).toBeVisible();
    // 🔴 The bill lands here: browse renders dozens of posters at once. A src
    // that starts /_next/image means the pass-through rule regressed.
    expect(await poster.getAttribute('src')).not.toContain('/_next/image');
  });
});

test.describe('marking a film watched', () => {
  test.skip(!hasTmdb, 'TMDB_API_KEY not configured');

  test('survives a reload, and can be undone', async ({ page }) => {
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
      await expect(badge).toHaveAccessibleName(/^Mark as watched: .+$/);

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

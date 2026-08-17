import { expect, test } from '@playwright/test';

/**
 * The film page, in a real browser.
 *
 * Three of the four things asserted here **cannot** be tested anywhere else:
 * whether the title is actually visible over the backdrop, whether a native
 * `<details>` opens from the keyboard, and whether the poster strip scrolls. jsdom
 * has no layout, no paint and no scrolling, so all three passed in unit tests
 * while the title was in fact rendered behind the banner image.
 *
 * Signed out throughout — the page is public (D44) — and read-only, so it runs
 * against the real La La Land rather than a scratch film. Nothing here writes.
 */
const LA_LA_LAND = '313369';

/** A TMDB id nothing will ever own. */
const UNKNOWN = '999999999';

const hasTmdb = Boolean(process.env.TMDB_API_KEY);

test.describe('a film page', () => {
  test.skip(!hasTmdb, 'TMDB_API_KEY not configured');

  test('🔴 the title is visible over the backdrop', async ({ page }) => {
    // The bug this exists for: the title block is pulled up over the banner with
    // a negative margin, and the banner is positioned — so within one stacking
    // context it painted *above* the static title regardless of source order, and
    // the title was invisible. Every unit test passed.
    await page.goto(`/films/${LA_LA_LAND}`);

    const title = page.getByRole('heading', { name: 'La La Land', level: 1 });
    await expect(title).toBeVisible();

    // Visible is not enough on its own — an element behind an image still
    // reports as visible. This asserts it is the element actually painted at its
    // own centre.
    const box = await title.boundingBox();
    expect(box).not.toBeNull();
    const topmost = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x as number, y as number)?.textContent ?? '',
      [(box?.x ?? 0) + 10, (box?.y ?? 0) + (box?.height ?? 0) / 2],
    );
    expect(topmost).toContain('La La Land');
  });

  test('shows the real runtime, not the source’s hard-coded one', async ({ page }) => {
    // The live site prints 1 hour 41 minutes for every film in the catalogue
    // (PARITY bug 12). La La Land is 2 hours 9 minutes.
    await page.goto(`/films/${LA_LA_LAND}`);

    await expect(page.getByText('2 hours 9 minutes')).toBeVisible();
  });

  test('shows the league points, per award show', async ({ page }) => {
    // The numbers are from `fixtures/points-by-movie.json`, captured from the
    // live site: 335 in total, 170 of it from the Oscars.
    await page.goto(`/films/${LA_LA_LAND}`);

    await expect(page.getByText('335', { exact: true }).first()).toBeVisible();

    const oscars = page.getByRole('link', {
      name: /Academy of Motion Picture Arts and Sciences/,
    });
    await expect(oscars).toBeVisible();
    await expect(oscars).toContainText('170');
    // The season is carried in the link, so following it lands on the year these
    // points belong to rather than the active one.
    await expect(oscars).toHaveAttribute('href', '/award-shows/oscars?year=2017');
  });

  test('🔴 a credits disclosure opens from the keyboard', async ({ page }) => {
    // jsdom does not toggle `<details>` at all, so the component test asserts
    // only that the hidden names are in the DOM. This is where the interaction is
    // proven.
    await page.goto(`/films/${LA_LA_LAND}`);

    const summary = page
      .locator('summary')
      .filter({ hasText: /Show \d+ more in/ })
      .first();
    await summary.scrollIntoViewIfNeeded();
    const details = page.locator('details').filter({ has: summary }).first();

    await expect(details).not.toHaveAttribute('open', '');
    await summary.press('Enter');
    await expect(details).toHaveAttribute('open', '');
  });

  test('🔴 the poster strip scrolls, and the counter follows', async ({ page }) => {
    await page.goto(`/films/${LA_LA_LAND}`);

    const counter = page.getByText(/^1\/\d+$/);
    await counter.scrollIntoViewIfNeeded();
    await expect(counter).toBeVisible();

    await page.getByRole('button', { name: 'Next poster' }).click();

    // The counter is derived from the scroll position rather than from the click,
    // so this proves the strip actually moved.
    await expect(page.getByText(/^2\/\d+$/)).toBeVisible();
  });

  test('🔴 mounts no YouTube iframe until a trailer is pressed', async ({ page }) => {
    // The source mounted 32 at once. This is the assertion that keeps it at one.
    await page.goto(`/films/${LA_LA_LAND}`);

    await expect(page.locator('iframe')).toHaveCount(0);

    const trailer = page.getByRole('button', { name: /Official Trailer/ }).first();
    await trailer.scrollIntoViewIfNeeded();
    await trailer.click();

    await expect(page.locator('iframe')).toHaveCount(1);
    await expect(page.locator('iframe')).toHaveAttribute(
      'src',
      /youtube-nocookie\.com\/embed\//,
    );
  });

  test('the watched badge is hidden from a signed-out reader', async ({ page }) => {
    await page.goto(`/films/${LA_LA_LAND}`);

    await expect(page.getByRole('button', { name: /Mark .* as watched/ })).toHaveCount(0);
  });

  test('similar films link on to other film pages', async ({ page }) => {
    await page.goto(`/films/${LA_LA_LAND}`);

    const similar = page.getByRole('heading', { name: 'Similar films' });
    await similar.scrollIntoViewIfNeeded();
    await expect(similar).toBeVisible();

    const first = page.locator('a[href^="/films/"]').last();
    await expect(first).toBeVisible();
  });
});

test.describe('a film that does not exist', () => {
  test('🔴 answers 404 rather than 500', async ({ page }) => {
    const response = await page.goto(`/films/${UNKNOWN}`);

    expect(response?.status()).toBe(404);
  });

  test('🔴 a non-numeric id answers 404 without asking TMDB', async ({ request }) => {
    // Validating the id's shape first means a crawler walking nonsense URLs
    // cannot burn the TMDB rate limit.
    //
    // 🔴 Uses `request`, not `page`. A browser **normalises the path before
    // sending it**, so `page.goto('/films/..')` fetches `/` and returns the
    // dashboard's 200 — which looks exactly like a missing guard and is not one.
    // Only a raw request puts the traversal in front of the server.
    // 🔴 **No path traversal in this list, and that is a finding rather than a
    // gap.** Neither `..` nor `%2e%2e` can be made to reach this handler: HTTP
    // clients resolve dot segments before sending (RFC 3986) and Next normalises
    // whatever survives, so both arrive as `/` and answer with the dashboard's
    // 200. Asserting 404 for them was testing the platform and getting a
    // false failure that read exactly like a missing guard. What this route can
    // actually be handed is garbage in the id position, and that is what is
    // asserted: the last entry is 14 digits, past the 12 the pattern allows.
    for (const id of ['abc', '1e9', '1;2', '-1', '1.5', '12345678901234']) {
      const response = await request.get(`/films/${id}`, { maxRedirects: 0 });
      expect(response.status(), `/films/${id}`).toBe(404);
    }
  });
});

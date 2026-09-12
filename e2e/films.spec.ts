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

/** 77 posters and 32 trailers — the film that made the overflow measurable. */
const PARASITE = '496243';

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

  test('🔴 the year is part of the title, inside the scrim', async ({ page }) => {
    // A film is identified by name AND year. The year used to sit below the
    // banner in 14px dim mono, cut from the name by the image's hard edge.
    await page.goto(`/films/${LA_LA_LAND}`);

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toContainText('La La Land');
    await expect(heading).toContainText('2016');

    // Geometry, because that is the actual defect. The year's box must share a
    // line with the title's, not sit on the row beneath it: same top within a
    // few px, and a bottom inside the heading's own bottom.
    const title = await heading.boundingBox();
    const year = await heading.getByText('2016', { exact: true }).boundingBox();
    // Thrown rather than asserted: a null box makes every number below
    // meaningless, and `noNonNullAssertion` is on in this repo.
    if (title === null || year === null) throw new Error('the lockup has no box');

    // Optically smaller type sits lower in the line box, never below it.
    expect(year.y).toBeGreaterThanOrEqual(title.y - 2);
    expect(year.y + year.height).toBeLessThanOrEqual(title.y + title.height + 2);

    // 🔴 And the YEAR is inside the scrim, which is the other half of the
    // defect — the title always was. On its old row below the heading it
    // cleared the frame's bottom edge by about a dozen pixels and sat on bare
    // ground; in the line box it does not. Measured on the year rather than on
    // the heading, because the heading's box would pass either way.
    const frameBottom = await page.evaluate(() => {
      const frame = document.querySelector('main header > div');
      return frame ? frame.getBoundingClientRect().bottom + window.scrollY : null;
    });
    if (frameBottom === null) throw new Error('the banner frame has no box');
    expect(year.y + year.height).toBeLessThanOrEqual(frameBottom);
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
  /**
   * 🔴 Geometry, which is why this is here and not in a component test.
   *
   * Below `md` the page is one grid column, and a `1fr` track takes its minimum
   * from the item's min-content. `PosterCarousel`'s strip contributed the sum of
   * its 16px gaps — 76 of them for this film — so the single column measured far
   * wider than its 358px container, and light added 2px of poster border per
   * poster on top of that.
   *
   * Both schemes, because the failure is worse in light and a dark-only
   * assertion would have called it fixed.
   */
  test('🔴 fits a 390px phone in both schemes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const widths: Record<string, { doc: number; columns: number[] }> = {};

    for (const scheme of ['dark', 'light'] as const) {
      // InitColorSchemeScript reads this key before paint; setting it as an
      // init script means the page never renders in the other scheme first.
      await page.addInitScript(
        (mode) => window.localStorage.setItem('mui-mode', mode),
        scheme,
      );
      await page.goto(`/films/${PARASITE}`);
      await expect(
        page.getByRole('heading', { name: 'Parasite', level: 1 }),
      ).toBeVisible();

      widths[scheme] = await page.evaluate(() => {
        const grid = document.querySelector('main .grid');
        return {
          doc: document.documentElement.scrollWidth,
          columns: [...(grid?.children ?? [])].map((c) =>
            Math.round(c.getBoundingClientRect().width),
          ),
        };
      });

      // The page never scrolls sideways. 390 exactly: one pixel more is the
      // defect, and `<=` would let a 1px regression through as "close enough".
      expect(widths[scheme]?.doc, `${scheme} document width`).toBe(390);

      // Both columns sit inside the 326px the shell's p-4 and the page's px-4
      // leave them.
      for (const width of widths[scheme]?.columns ?? []) {
        expect(width, `${scheme} column width`).toBeLessThanOrEqual(326);
      }
    }

    // 🔴 The light-versus-dark delta itself. A `light:` variant may change
    // colour; it may not change how wide anything is.
    expect(widths.light?.columns).toEqual(widths.dark?.columns);
  });

  /**
   * The trailer rows are `w-full` with horizontal padding, and the button
   * computes `box-sizing: content-box` — so the padding landed outside the 100%
   * and every row rendered 342px inside a 326px list item. Scheme-independent.
   */
  test('🔴 a trailer row fits its list item', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/films/${PARASITE}`);

    const overflow = await page.evaluate(
      () =>
        [...document.querySelectorAll('main li')].filter(
          (li) => li.clientWidth > 100 && li.scrollWidth > li.clientWidth + 1,
        ).length,
    );

    expect(overflow).toBe(0);
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

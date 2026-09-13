import { expect, test } from '@playwright/test';

import { beat, DEMO_PACE, startJourney } from './support/pace';

/**
 * Journey 4: a reader with no account browses the release calendar, opens a
 * film, and finds another by name.
 *
 * 🔴 **Skipped whole without `TMDB_API_KEY`, never half-run.** `/browse` is
 * TMDB's discover feed and `/films/[tmdbId]` renders from TMDB, so there is no
 * CI version of this journey — and a journey that quietly ran three of its
 * eight beats would be worse than one that did not run, because the report
 * would say it passed. The skip is visible in the report, with its reason,
 * exactly like `browse.spec.ts`'s and `films.spec.ts`'s.
 *
 * Read-only and signed out throughout: these pages are public (D44), nothing
 * here marks a film watched, and a page render does not ingest (D63). So there
 * is deliberately no cleanup and no `assertNoResidue` — this journey writes
 * nothing, and the omission is a decision rather than an oversight.
 *
 * **What it walks that the slices do not.** `browse.spec.ts` has eleven tests
 * each proving one property of the shelf, `films.spec.ts` eight proving one
 * property of the film page, `nav.spec.ts` two proving the search panel opens
 * and closes. None of them goes *from* the shelf *to* a film *to* the search
 * panel *to* another film — the trip a reader actually makes, and the one
 * where a regression in the `href` shape or the panel's `router.push` hides.
 *
 * 🔴 **The credits beat is done on La La Land, not on whichever film the shelf
 * happened to open.** The plan put it on the shelf's first poster; not every
 * film has more cast than it shows, so that beat would fail on a quiet month
 * for a reason that has nothing to do with disclosures. La La Land is the film
 * `films.spec.ts` pins the same behaviour on, and the journey is already
 * standing on it by then — so the beat moved rather than being made
 * conditional, which would have been a check that cannot fail.
 */
const hasTmdb = Boolean(process.env.TMDB_API_KEY);

/** The film the search panel is aimed at. `films.spec.ts`'s constant, verbatim. */
const LA_LA_LAND = '313369';

test.describe('journey 4 — a reader browses', () => {
  test.skip(!hasTmdb, 'TMDB_API_KEY not configured — this journey is TMDB end to end');
  // The budget grows with the pacing, the way journeys 1–3 do: a fixed number
  // ample at `DEMO_PACE=0` fails at `DEMO_PACE=1` as a timeout on whichever
  // beat happened to be last.
  test.describe.configure({ timeout: 120_000 + DEMO_PACE * 60_000 });

  test('the calendar, a film, and the search bar', async ({ page }) => {
    await startJourney(page);
    // Desktop: the search panel's trigger is on the strip above `xl`, and this
    // journey is watched on a laptop.
    await page.setViewportSize({ width: 1440, height: 900 });

    await beat(page, 'A reader opens the release calendar', async () => {
      await page.goto('/browse');
      await expect(page.getByRole('link', { name: 'The past' })).toHaveAttribute(
        'aria-current',
        'true',
      );
      await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText(
        /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/,
      );
    });

    await beat(page, 'And looks forward instead — the choice is in the URL', async () => {
      await page.getByRole('link', { name: 'The future' }).click();
      await expect(page).toHaveURL(/when=future/);
      await page.goBack();
      await expect(page.getByRole('link', { name: 'The past' })).toHaveAttribute(
        'aria-current',
        'true',
      );
    });

    await beat(page, 'Scrolling brings the next page in', async () => {
      const films = page.locator('section ul > li');
      const before = await films.count();
      await page.getByTestId('browse-sentinel').scrollIntoViewIfNeeded();
      await expect.poll(() => films.count(), { timeout: 15_000 }).toBeGreaterThan(before);
      // The cursor followed the reader, so this view can be shared (amends D80).
      await expect(page).toHaveURL(/[?&]page=2/);
    });

    const title = await beat(page, 'A poster opens the film', async () => {
      await page.locator('a[href^="/films/"]').first().click();
      await page.waitForURL(/\/films\/\d+/);
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
      // The name only — the lockup carries the release year beside it.
      return ((await heading.innerText()).split('\n')[0] ?? '').trim();
    });

    await beat(page, `The title is legible over the backdrop — ${title}`, async () => {
      // The bug this inherits from `films.spec.ts`: the title block is pulled
      // over a positioned banner, so it painted *behind* the image and every
      // unit test passed. "Visible" is not enough; this asks what is actually
      // painted at the title's own centre.
      const heading = page.getByRole('heading', { level: 1 });
      const box = await heading.boundingBox();
      expect(box).not.toBeNull();
      const topmost = await page.evaluate(
        ([x, y]) =>
          document.elementFromPoint(x as number, y as number)?.textContent ?? '',
        [(box?.x ?? 0) + 10, (box?.y ?? 0) + (box?.height ?? 0) / 2],
      );
      expect(topmost).toContain(title);
    });

    await beat(page, 'The reader searches for a film by name', async () => {
      // The panel's trigger: the strip's above `xl`, the More sheet's below.
      // `.first()` because both are in the DOM at every width and exactly one
      // is clickable — the same reasoning as `nav.spec.ts`'s helper.
      await page.getByRole('button', { name: 'Search' }).first().click();
      const panel = page.getByRole('dialog', { name: 'Search films' });
      await expect(panel).toBeVisible();
      await expect(page.getByRole('searchbox', { name: 'Find a film' })).toBeFocused();

      await page.getByRole('searchbox', { name: 'Find a film' }).fill('La La Land');
      const result = panel.getByRole('button', { name: /La La Land/ }).first();
      await expect(result).toBeVisible();
      await result.click();
    });

    await beat(page, 'And lands on it', async () => {
      await page.waitForURL(new RegExp(`/films/${LA_LA_LAND}`));
      await expect(
        page.getByRole('heading', { name: /La La Land/, level: 1 }),
      ).toBeVisible();
      // The panel closed itself on the way — two modals would trap the reader.
      await expect(page.getByRole('dialog', { name: 'Search films' })).toBeHidden();
    });

    await beat(page, 'The credits open from the keyboard', async () => {
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

    await beat(page, 'One Escape puts the panel away again', async () => {
      // 🔴 Typed, not left empty. The field is `<input type="search">`, whose
      // native behaviour spends the first Escape clearing the value — so until
      // `SearchOverlay` handled the key itself, "Escape closes" was two
      // Escapes for anybody who had typed anything, which is everybody.
      const trigger = page.getByRole('button', { name: 'Search' }).first();
      await trigger.click();
      await page.getByRole('searchbox', { name: 'Find a film' }).fill('sinners');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Search films' })).toBeHidden();
      await expect(trigger).toBeFocused();
    });
  });
});

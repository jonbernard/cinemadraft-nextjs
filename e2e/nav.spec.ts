import { expect, type Page, test } from '@playwright/test';

/**
 * The scratch shows this file's last test needs, and the tag that removes them.
 *
 * `e2e-` is the prefix `lib/db.test.ts`'s restored-row counts deliberately
 * exclude, so these cannot turn an unrelated contract test red — and the tag is
 * this file's own, because `award-shows.spec.ts` clears `e2e-awards%` wholesale
 * and the two run side by side.
 *
 * Raw `pg` rather than the Prisma client: Playwright does not resolve the `@/`
 * alias into `generated/prisma`, so importing `lib/db` fails at require time
 * and takes the whole spec with it. Same reasoning as every other spec here.
 */
const TAG = 'e2e-nav';

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
 * A dozen shows, so `/award-shows` is longer than a phone viewport.
 *
 * Idempotent on the abbreviation, because these tests run in parallel and a
 * retry must not double the list. Nothing reads their names — they exist only
 * to give the page a height — so they are plainly synthetic rather than
 * imitations of the real twelve.
 */
async function seedShows(): Promise<void> {
  await withDb(async (query) => {
    for (let index = 1; index <= 12; index += 1) {
      await query(
        `insert into events (name, abbreviation, created_at, updated_at)
           select $1, $2, now(), now()
            where not exists (select 1 from events where abbreviation = $2)`,
        [`${TAG} Show ${index}`, `${TAG}-${index}`],
      );
    }
  });
}

async function cleanup(): Promise<void> {
  await withDb(async (query) =>
    query('delete from events where abbreviation like $1', [`${TAG}-%`]),
  );
}

/**
 * Open the global search panel from whichever trigger the width actually
 * shows — the strip's icon above `xl`, the bar's own icon from `sm` up, the
 * More sheet's row below that. All three are in the DOM at every width and
 * only one is ever clickable.
 *
 * 🔴 The `< 1280` branch used to be the More sheet, because below `xl` there
 * was no other way in — the shape of the defect P17.T2 closed. The sheet's
 * route still exists and keeps its own test below; it is simply no longer the
 * only one.
 */
async function openSearchPanel(page: Page, width: number): Promise<void> {
  if (width >= 640) {
    // `.first()` on purpose: the strip's trigger and the bar's are both in the
    // DOM at every width, and Playwright's visibility filter leaves exactly
    // one of them clickable.
    await page.getByRole('button', { name: 'Search' }).first().click();
  } else {
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'More' })
      .getByRole('button', { name: 'Search' })
      .click();
  }
  await expect(page.getByRole('dialog', { name: 'Search films' })).toBeVisible();
}

/**
 * The shell that makes every other page reachable (D67, D75).
 *
 * 🔴 The More sheet's real behaviour — Escape, the focus trap, the inert
 * background — comes from `<dialog>` and can only be proven in a browser.
 * jsdom implements neither `showModal()` nor the focus trap nor `inert`, so
 * `AppShell.test.tsx` and `MoreSheet.test.tsx` assert structure and this file
 * asserts behaviour. Anything provable in jsdom belongs there, not here.
 *
 * 🔴 The rail's breakpoint is `xl` (1280px), not `lg`: `NavRail` is wrapped in
 * `hidden xl:block` and `TabBar`/`MoreSheet` carry `xl:hidden`. 1440px is the
 * desktop side of that line and 390px the phone side, so each viewport below
 * renders exactly one of the two navigations visibly — both are always in the
 * DOM, which is why every locator here is scoped to a named landmark.
 *
 * 🔴 The bar's *chrome* is gated separately, at `sm` (640px), and that is the
 * whole of P17.T2: until it was, 1024–1280px got the phone layout — no rail,
 * no header, no wordmark, no search, no way in except two taps into the More
 * sheet. The four widths below are the four that decide something: 1440 the
 * design target, 1280 the rail's edge, 1024 the dead zone, 390 the phone.
 *
 * Accessible names are the contract, hard-coded on purpose: the rail is
 * `Main`, the tab bar is `Primary, mobile`, the sheet is `More`. They differ
 * because both navigations coexist in the DOM and identical names would make
 * the landmark list ambiguous.
 *
 * Signed out throughout: the dashboard and league boards are public (D44), and
 * a visitor on a shared link must be able to move around.
 */
/** `rgb(192, 61, 78)` → `#c03d4e`, so a computed colour can be compared to a token. */
function toHex(rgb: string): string {
  const parts = rgb.match(/\d+/g)?.slice(0, 3) ?? [];
  return `#${parts.map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
}

test.describe('navigation', () => {
  const DESKTOP = { width: 1440, height: 900 };
  const RAIL_EDGE = { width: 1280, height: 900 };
  const DEAD_ZONE = { width: 1024, height: 800 };
  const PHONE = { width: 390, height: 844 };

  // Before as well as after: a run killed halfway leaves rows behind, and the
  // next run's `marks the current page` would then be reading debris.
  test.beforeAll(cleanup);
  test.afterAll(cleanup);

  test('desktop shows the rail and hides the tab bar', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');

    const rail = page.getByRole('navigation', { name: 'Main' });
    await expect(rail.getByRole('link', { name: 'Leagues' })).toBeVisible();
    await expect(rail.getByRole('link', { name: 'Browse' })).toBeVisible();

    // Both navigations are in the DOM at every width; only CSS decides. The
    // bar is gated at `xl` and the rail is its complement, so at 1440px the
    // media query must be hiding the whole bar — a fact jsdom cannot show.
    // (The bar's chrome has its own, lower gate at `sm`; above `xl` it goes
    // with the bar, and the strip carries identity, search and the account
    // control instead. The two never render at once.)
    await expect(page.getByRole('navigation', { name: 'Primary, mobile' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'More', exact: true })).toBeHidden();
  });

  test('🔴 1280px is the rail edge — the rail appears at 208px and the bar goes', async ({
    page,
  }) => {
    // The width the rail's own number was measured at: 208px, not the spec's
    // 236px, because Task 18 measured the wider rail's cost to a 10-seat league
    // board *here* and narrowed it. Rendered width is the only place that
    // number is real, and 1280 is the first width at which the rail exists.
    await page.setViewportSize(RAIL_EDGE);
    await page.goto('/');

    const box = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
    expect(box?.width).toBe(208);
    await expect(page.getByRole('navigation', { name: 'Primary, mobile' })).toBeHidden();
  });

  test('🔴 1024px is not a phone — the bar carries identity, search and the way in', async ({
    page,
  }) => {
    await page.setViewportSize(DEAD_ZONE);
    await page.goto('/');

    // The defect this closes: at 1024px the app used to render a phone tab bar
    // with no rail, no header, no wordmark and no search — a reader on an iPad
    // in landscape could not tell which app they were in.
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Primary, mobile' })).toBeVisible();

    await expect(page.getByRole('link', { name: 'Cinemadraft, home' })).toBeVisible();
    // Unqualified on purpose: the strip's copies are `xl:flex` and the More
    // sheet's are inside a closed `<dialog>`, so neither is in the
    // accessibility tree here. One match each means the bar's is the one on
    // screen, which is the whole claim.
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();

    // And nothing the chrome added pushed the page sideways.
    expect(
      await page.evaluate(() => document.scrollingElement?.scrollWidth ?? 0),
    ).toBeLessThanOrEqual(1024);
  });

  test('🔴 every destination still clears 44px at 390px, and the bar stays one row', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    // The arithmetic the decision risks: five destinations on one 390px row.
    // Geometry, measured — a jsdom test cannot see a single one of these
    // numbers, which is why this assertion is here and not in TabBar.test.tsx.
    const slots = page.locator(
      'nav[aria-label="Primary, mobile"] > a, nav[aria-label="Primary, mobile"] > button',
    );
    await expect(slots).toHaveCount(5);
    for (const slot of await slots.all()) {
      const box = await slot.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    // 🔴 And no label wrapped: a two-line label is the bar growing taller,
    // which is exactly what folding the chrome in was chosen to avoid — and
    // the measurement (P17.T2 Step 1) that put the chrome's floor at `sm`
    // rather than at every width. 48.5px today; 65px the moment a slot drops
    // below about 65px of label.
    const bar = page.locator('nav[aria-label="Primary, mobile"]');
    const height = (await bar.boundingBox())?.height ?? 0;
    expect(height).toBeLessThanOrEqual(56);
  });

  test('🔴 the chrome is not a sixth tab, and is absent where it would not fit', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    // Five destinations in the landmark, whatever else sits on the bar.
    await expect(
      page.locator(
        'nav[aria-label="Primary, mobile"] > a, nav[aria-label="Primary, mobile"] > button',
      ),
    ).toHaveCount(5);

    // At 390px the chrome is in the DOM and displayed nowhere: the row has no
    // slack for it. Search and the account control are in the More sheet,
    // which is where D75 put them and where they stayed.
    await expect(page.getByRole('link', { name: 'Cinemadraft, home' })).toBeHidden();

    // At 1024 it is on the bar — and even there it never claims to be the
    // current page, on `/` or anywhere else. Current-ness is a destination
    // property.
    await page.setViewportSize(DEAD_ZONE);
    const mark = page.getByRole('link', { name: 'Cinemadraft, home' });
    await expect(mark).toBeVisible();
    await expect(mark).not.toHaveAttribute('aria-current', /.*/);
  });

  test('marks the current page', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/award-shows');

    const current = page
      .getByRole('navigation', { name: 'Main' })
      .locator('[aria-current="page"]');
    await expect(current).toHaveText(/Award shows/);
  });

  // 390px: the bar is the phone's navigation and nothing else. Its chrome
  // starts at `sm` — see the two tests above for why, and for what 1024px gets.
  test('phone shows bottom tabs with labels, and no rail', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    const tabs = page.getByRole('navigation', { name: 'Primary, mobile' });
    await expect(tabs.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(tabs.getByRole('link', { name: 'Award shows' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'More', exact: true })).toBeVisible();

    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
  });

  test('a tab navigates and the active tab moves with it', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    const tabs = page.getByRole('navigation', { name: 'Primary, mobile' });
    await expect(tabs.locator('[aria-current="page"]')).toHaveText(/Home/);

    await tabs.getByRole('link', { name: 'Award shows' }).click();

    await expect(page).toHaveURL(/\/award-shows/);
    await expect(tabs.locator('[aria-current="page"]')).toHaveText(/Award shows/);
  });

  test('🔴 the More sheet opens, and Escape closes it', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    const trigger = page.getByRole('button', { name: 'More', exact: true });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();
    const sheet = page.getByRole('dialog', { name: 'More' });
    await expect(sheet).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Native <dialog> behaviour, which is the reason it is one. The trigger's
    // aria-expanded follows because AppShell listens for the `close` event
    // rather than only flipping state in its own click handler.
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('🔴 the More sheet traps focus while it is open', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');
    await page.getByRole('button', { name: 'More', exact: true }).click();

    // Tab well past the number of controls inside; focus must never escape to
    // the page behind. That is the property a hand-rolled sheet gets wrong.
    for (let i = 0; i < 12; i += 1) await page.keyboard.press('Tab');

    const insideSheet = await page.evaluate(() => {
      const dialog = document.querySelector('dialog[aria-label="More"]');
      return dialog?.contains(document.activeElement) ?? false;
    });
    expect(insideSheet).toBe(true);
  });

  test('🔴 the background is inert while the More sheet is open', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'More' })).toBeVisible();

    // showModal() makes everything outside the top layer inert, and inert
    // content cannot take focus — not even when script asks for it directly.
    // If the sheet were a plain div with a hand-rolled overlay this would
    // move focus behind the sheet and nothing on screen would look wrong.
    const result = await page.evaluate(() => {
      const link = document.querySelector<HTMLElement>(
        'nav[aria-label="Primary, mobile"] a',
      );
      if (!link) return { found: false, focused: false };
      link.focus();
      return { found: true, focused: document.activeElement === link };
    });
    // Without this the whole assertion would pass on a missing element.
    expect(result.found).toBe(true);
    expect(result.focused).toBe(false);
  });

  test('the More sheet holds the yours destinations, the theme and the account control', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');
    await page.getByRole('button', { name: 'More', exact: true }).click();

    const sheet = page.getByRole('dialog', { name: 'More' });
    await expect(sheet).toBeVisible();

    // 🔴 All three `yours` pages now exist — the count this test's own comment
    // said would move when T19 and T24 shipped has moved. The sheet still
    // filters on `ready`, which is what keeps a link from pointing at a 404;
    // what changed is that nothing is unready any more.
    await expect(sheet.getByText('Yours')).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Draft list' })).toHaveAttribute(
      'href',
      '/list',
    );
    await expect(sheet.getByRole('link', { name: 'Watchlist' })).toHaveAttribute(
      'href',
      '/watchlist',
    );
    await expect(sheet.getByRole('link', { name: 'Rules & scoring' })).toHaveAttribute(
      'href',
      '/rules-and-scoring',
    );

    // The three destinations and the account control; the theme toggle is a
    // button.
    await expect(sheet.getByRole('link')).toHaveCount(4);
    await expect(sheet.getByRole('link', { name: 'Log in' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: /theme/i })).toBeVisible();
  });

  /**
   * 🔴 The search panel's Escape (P15.T3), which only a browser can show.
   *
   * Its field is `<input type="search">`, and the browser spends the first
   * Escape clearing that field instead of letting the `<dialog>`'s own cancel
   * through — so until the panel handled the key itself, "Escape closes" was
   * two Escapes for anybody who had typed anything, which is everybody. jsdom
   * implements neither the native clear nor the dialog's focus restoration, so
   * `SearchOverlay.test.tsx` can only prove the handler runs; the behaviour is
   * here.
   */
  test('🔴 one Escape closes the search panel, and the trigger gets focus back', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');

    const trigger = page.getByRole('button', { name: 'Search' });
    await trigger.click();

    const panel = page.getByRole('dialog', { name: 'Search films' });
    await expect(panel).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Find a film' })).toBeFocused();

    // Typed, not left empty: the browser only spends an Escape on a search
    // field that has something in it, so an empty box hides the whole bug.
    await page.getByRole('searchbox', { name: 'Find a film' }).fill('sinners');
    await page.keyboard.press('Escape');

    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('🔴 the panel opens from the More sheet, and one Escape closes it there too', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    await page.getByRole('button', { name: 'More', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'More' });
    await sheet.getByRole('button', { name: 'Search' }).click();

    const panel = page.getByRole('dialog', { name: 'Search films' });
    await expect(panel).toBeVisible();
    // Opening the panel closes the sheet — two modal dialogs at once leaves
    // the reader trapped behind the wrong one — so the element focus returns
    // to is the sheet's trigger, not the row that was clicked.
    await expect(sheet).toBeHidden();

    await page.getByRole('searchbox', { name: 'Find a film' }).fill('sinners');
    await page.keyboard.press('Escape');

    await expect(panel).toBeHidden();
    await expect(page.getByRole('button', { name: 'More', exact: true })).toBeFocused();
  });

  test('🔴 the search panel is centred, guttered and inside the viewport', async ({
    page,
  }) => {
    for (const size of [DESKTOP, PHONE]) {
      await page.setViewportSize(size);
      await page.goto('/');
      await openSearchPanel(page, size.width);

      const panel = page.getByRole('dialog', { name: 'Search films' });
      const box = await panel.boundingBox();
      if (!box) throw new Error('the search panel rendered no box');

      // 🔴 Preflight zeroes the UA's `dialog { margin: auto }`, so a dialog
      // that sets its own top margin and nothing else sits flush against the
      // left edge — measured at `left=0, right=768` in a 1440px window. Both
      // gaps are asserted, because equal gaps are what centring is, and a
      // gutter at the narrow end is what `w-full` never left.
      expect(box.x).toBeGreaterThanOrEqual(16);
      expect(Math.round(box.x)).toBe(Math.round(size.width - (box.x + box.width)));

      // The panel used to end at 926px in a 900px window. The height is the
      // symptom; the cap is the guarantee, and both are checked because a
      // short result set would satisfy the first on a panel that had no cap.
      expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      const cap = await panel.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).maxHeight),
      );
      expect(cap).toBeLessThan(size.height);
    }
  });

  test('🔴 the tab bar does not cover the bottom of the page', async ({ page }) => {
    await page.setViewportSize(PHONE);
    // Not `/`: the signed-out dashboard is shorter than a phone viewport, so
    // it never scrolls and the assertion below would be true by accident.
    // /award-shows is one card per show, so it is as long as the shows make it.
    //
    // 🔴 Which is why this spec now seeds its own. It used to rely on the
    // twelve restored shows being there, and on CI — schema, no data — the page
    // came back 415px tall inside an 844px viewport, never scrolled, and the
    // anti-vacuity guard below failed. Correctly: without a scroll this test
    // measures nothing. A dozen scratch shows make the page taller than the
    // viewport on any database, so what is being tested is the shell's bottom
    // padding rather than how much data happens to be lying around.
    await seedShows();
    await page.goto('/award-shows');

    const bar = page.getByRole('navigation', { name: 'Primary, mobile' });
    await expect(bar).toBeVisible();
    const barBox = await bar.boundingBox();
    expect(barBox).not.toBeNull();

    // The bar is fixed to the bottom, so the worst case is the page scrolled
    // all the way down: whatever `main` renders last has to sit above the
    // bar's top edge. `Panel`'s bottom padding is what reserves that room —
    // measuring it here is the gate on AppShell's `pb-[calc(4rem+...)]`,
    // which no amount of arithmetic can settle.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

    // 🔴 `.first()` rather than `getByRole('main')`: `/award-shows` and
    // `/browse` still render a `<main>` of their own inside the shell's, so
    // the role locator is ambiguous there. The outer one is the shell's, which
    // is the box whose padding this test is about. Reported to the controller;
    // the page sweep owns removing the inner landmark, not this spec.
    const geometry = await page
      .locator('main')
      .first()
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const padding = Number.parseFloat(getComputedStyle(element).paddingBottom);
        return {
          contentBottom: rect.bottom - padding,
          padding,
          scrolled: window.scrollY,
        };
      });

    // Without this the two assertions below could both pass on a page that
    // fits the viewport, which proves nothing about being covered.
    expect(geometry.scrolled).toBeGreaterThan(0);

    // Viewport coordinates on both sides, taken after the scroll.
    const barTop = (await bar.boundingBox())?.y ?? 0;
    expect(geometry.contentBottom).toBeLessThanOrEqual(barTop + 1);

    // And the reservation itself, stated directly: the padding must be at
    // least as tall as the bar. Chromium on a desktop viewport reports
    // `env(safe-area-inset-bottom)` as 0, so this proves the 4rem term of the
    // calc, not the inset term — a real device is the only place the inset is
    // non-zero.
    expect(geometry.padding).toBeGreaterThanOrEqual(barBox?.height ?? 0);
  });

  /**
   * 🔴 Focus rings, measured after they settle.
   *
   * Both halves of this failed for different reasons: the theme toggle drew
   * Chrome's default ring because it declared none, and the rail links drew a
   * grey one for the first 150ms because `transition-colors` animates
   * `outline-color`. Neither is visible to jsdom, and reading the computed
   * style in the same frame as `focus()` reports the transition's start value —
   * which is how the ring was first misdiagnosed as a broken token.
   */
  test('🔴 every focus ring is the product\u2019s own', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/browse');

    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-accent-fill')
        .trim(),
    );

    const settled = async (locator: ReturnType<typeof page.locator>) => {
      await locator.focus();
      // Longer than the 150ms motion budget, so the transition has finished.
      await page.waitForTimeout(300);
      return locator.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          color: style.outlineColor,
          style: style.outlineStyle,
          width: style.outlineWidth,
        };
      });
    };

    const railLink = page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Award shows' });
    const ring = await settled(railLink);
    expect(ring.style).toBe('solid'); // not 'auto', which is the browser's
    expect(ring.width).toBe('2px');
    expect(toHex(ring.color)).toBe(accent);

    const toggleRing = await settled(
      page.getByRole('button', { name: /switch to .* theme/i }),
    );
    expect(toggleRing.style).toBe('solid');
    expect(toggleRing.width).toBe('2px');
    expect(toHex(toggleRing.color)).toBe(accent);
  });
});

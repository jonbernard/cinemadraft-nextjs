import { expect, test } from '@playwright/test';

/**
 * The Phase 17 type/colour inventory (P17.T18–T25).
 *
 * 🔴 This is a measurement, not an assertion. It is opt-in via `INVENTORY=1`
 * and deliberately absent from `npm run verify` and from CI: it needs the
 * restored database and a TMDB key, it reports numbers rather than passing or
 * failing, and a measurement wired into a gate becomes a number people tune
 * until it is green.
 *
 * 🔴 Read-only. Port 5433 holds a restored copy of production and league 1 is
 * sixty real people's history. Nothing here signs in, posts, or writes.
 *
 * 🔴 The 2026-09-12 baseline in `docs/PROGRESS.md` was measured by hand with an
 * unrecorded method, and its element total (1,272) does not reconcile with its
 * own font histogram (1,312). So the FIRST thing you do with this file is run
 * it on the pre-sweep tree and record *that* as the before-number. The recorded
 * before must come from the same code as the recorded after, or the comparison
 * is an impression wearing a number's clothes.
 *
 * 🔴 Nothing here waits on a clock. `scripts/layering.sh` allows exactly one
 * such wait in `e2e/`, in the journey pacing helper — and none is needed here:
 * setting the scheme attribute and then reading `getComputedStyle` forces a
 * style recalculation synchronously inside the same evaluate.
 */
const ROUTES = ['/', '/browse', '/award-shows', '/films/313369'] as const;
const SCHEMES = ['dark', 'light'] as const;

type Inventory = {
  fonts: Record<string, number>;
  sizes: Record<string, number>;
  gaps: Record<string, number>;
  radii: Record<string, number>;
};

test.describe('the type and colour inventory', () => {
  test.skip(!process.env.INVENTORY, 'set INVENTORY=1 to measure');
  test.skip(!process.env.TMDB_API_KEY, 'TMDB_API_KEY not configured');

  test('inventory', async ({ page }) => {
    const total: Inventory = { fonts: {}, sizes: {}, gaps: {}, radii: {} };

    for (const route of ROUTES) {
      for (const scheme of SCHEMES) {
        await page.setViewportSize({ width: 1440, height: 1200 });
        await page.goto(route);
        await page.waitForLoadState('networkidle');

        const found: Inventory = await page.evaluate((value) => {
          // Tailwind's `dark:`/`light:` variants and MUI's palette are both
          // bound to this one attribute (globals.css), so setting it directly
          // is the whole scheme switch — no toggle click, no storage round
          // trip. Done inside the same evaluate as the read, because the first
          // `getComputedStyle` below forces the recalculation.
          document.documentElement.setAttribute('data-mui-color-scheme', value);

          const out = {
            fonts: {} as Record<string, number>,
            sizes: {} as Record<string, number>,
            gaps: {} as Record<string, number>,
            radii: {} as Record<string, number>,
          };
          const bump = (bag: Record<string, number>, key: string) => {
            bag[key] = (bag[key] ?? 0) + 1;
          };

          for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
            const box = el.getBoundingClientRect();
            if (box.width === 0 || box.height === 0) continue;
            const style = getComputedStyle(el);
            if (style.visibility === 'hidden' || style.display === 'none') continue;

            // "Visible text element" = it owns text, rather than inheriting a
            // font from a child's. Counting every element would count every
            // wrapper's inherited family and inflate Archivo enormously.
            const owns = [...el.childNodes].some(
              (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
            );
            if (owns) {
              bump(out.fonts, style.fontFamily.split(',')[0].replace(/["']/g, '').trim());
              bump(out.sizes, style.fontSize);
            }

            for (const gap of [style.rowGap, style.columnGap]) {
              if (gap && gap !== 'normal' && gap !== '0px') bump(out.gaps, gap);
            }

            const radius = style.borderTopLeftRadius;
            if (radius && radius !== '0px') {
              const px = Number.parseFloat(radius);
              // The poster clamp resolves against the element's own box (D73),
              // so it lands on a non-integer between 4 and 12 and must not be
              // bucketed as drift. Identified by class, not by value.
              const clamped =
                el.classList.contains('poster-radius') ||
                (px > 4 && px < 12 && !Number.isInteger(px));
              bump(out.radii, clamped ? 'poster-clamp' : radius);
            }
          }
          return out;
        }, scheme);

        for (const key of ['fonts', 'sizes', 'gaps', 'radii'] as const) {
          for (const [name, count] of Object.entries(found[key])) {
            total[key][name] = (total[key][name] ?? 0) + count;
          }
        }
      }
    }

    const line = (bag: Record<string, number>) =>
      Object.entries(bag)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `${name} ×${count}`)
        .join(', ');

    // Printed rather than snapshotted: the output is pasted into PROGRESS.md by
    // a human who is comparing it to a previous run.
    //
    // 🔴 `process.stdout.write`, not `console.log`: Biome's `noConsole` is an
    // error in this repo, and a harness whose only product is text has to be
    // able to emit it without an ignore comment.
    process.stdout.write(
      [
        `\n### Inventory — ${ROUTES.join(', ')} @1440, both schemes`,
        `Fonts:  ${line(total.fonts)}`,
        `Sizes:  ${line(total.sizes)}`,
        `Gaps:   ${line(total.gaps)}`,
        `Radii:  ${line(total.radii)}`,
        '',
      ].join('\n'),
    );

    // The only assertion: that it measured something. A harness that silently
    // measures an empty page reports "all zero" as if it were progress.
    expect(Object.keys(total.fonts).length).toBeGreaterThan(0);
  });
});

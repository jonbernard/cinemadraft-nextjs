import { expect, test } from '@playwright/test';

/**
 * These run against /tokens, not /.
 *
 * `/` is the dashboard and requires a session (Phase 5), so a signed-out
 * smoke run would only ever see a redirect to sign-in. /tokens is public and
 * renders the design system, which is what these assertions are actually
 * about.
 */
test('the page renders', async ({ page }) => {
  await page.goto('/tokens');
  await expect(page.getByText('Cinemadraft')).toBeVisible();
});

/**
 * The two tests below pin the MUI/Tailwind cascade layer contract (D29).
 *
 * They are the only automated guard on an arrangement that fails silently:
 * get the layer order wrong and the app still builds, still renders, and
 * simply looks wrong in ways that are easy to misattribute to a component.
 *
 * If either fails, fix the layer order in app/globals.css or the
 * `enableCssLayer` option in app/providers.tsx. Do not relax the assertion.
 */

test('MUI component styling survives Tailwind preflight', async ({ page }) => {
  await page.goto('/tokens');

  const background = await page
    .getByTestId('mui-button')
    .evaluate((el) => getComputedStyle(el).backgroundColor);

  // Preflight resets buttons to a transparent background. A themed colour
  // here proves the `mui` layer is ordered above `base`.
  expect(background).not.toBe('rgba(0, 0, 0, 0)');
  expect(background).not.toBe('transparent');
});

test('a Tailwind utility overrides MUI', async ({ page }) => {
  await page.goto('/tokens');

  const background = await page
    .getByTestId('tailwind-wins')
    .evaluate((el) => getComputedStyle(el).backgroundColor);

  // bg-black beating MUI's contained background proves the `mui` layer is
  // ordered below `utilities`.
  expect(background).toBe('rgb(0, 0, 0)');
});

test('the cascade layers resolve in the declared order', async ({ page }) => {
  await page.goto('/tokens');

  const order = await page.evaluate(() => {
    const seen = new Set<string>();
    const result: string[] = [];

    // Scan every same-origin sheet in document order. The production build
    // emits content-hashed filenames, so matching on 'globals' finds nothing.
    for (const sheet of document.styleSheets) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin, not ours
      }
      for (const rule of rules) {
        const names =
          rule.constructor.name === 'CSSLayerStatementRule'
            ? (rule as CSSLayerStatementRule).nameList
            : rule.constructor.name === 'CSSLayerBlockRule'
              ? [(rule as CSSLayerBlockRule).name]
              : [];
        for (const name of names) {
          if (!seen.has(name)) {
            seen.add(name);
            result.push(name);
          }
        }
      }
    }
    return result;
  });

  // Guard against the assertions below passing vacuously on an empty list:
  // indexOf returns -1 for everything, and -1 < -1 is false, but a partial
  // match could still slip through.
  expect(order).toContain('base');
  expect(order).toContain('mui');
  expect(order).toContain('utilities');

  // Tailwind rewrites the @layer statement during compilation, so this
  // asserts the resolved order rather than the source text. `mui` must sit
  // between `base` and `utilities`.
  expect(order.indexOf('base')).toBeLessThan(order.indexOf('mui'));
  expect(order.indexOf('mui')).toBeLessThan(order.indexOf('utilities'));
});

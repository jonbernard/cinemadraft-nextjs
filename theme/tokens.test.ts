import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { type ColorScheme, flatPalette, palettes, radius } from './tokens';

/**
 * The anti-drift test.
 *
 * Two copies of every colour exist by necessity — Tailwind's theme is CSS,
 * MUI's is JS. This reads the CSS back and asserts it says what tokens.ts
 * says, so the copies cannot silently diverge. If it fails, one of the two is
 * wrong; fix the mismatch rather than relaxing the comparison.
 *
 * Resolved from `process.cwd()` rather than `import.meta.url`: these tests run
 * under the jsdom environment, where `import.meta.url` is an http:// URL and
 * `readFileSync` rejects it. Vitest always runs from the project root.
 */
const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

/** `--color-bg-base: #0B0D10;` -> Map { 'bg-base' => '#0b0d10' } for one block. */
function propsIn(block: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const [, name, value] of block.matchAll(/--color-([a-z-]+):\s*([^;]+);/g)) {
    found.set(name, value.trim().toLowerCase());
  }
  return found;
}

describe('globals.css agrees with tokens.ts', () => {
  const blocks: [ColorScheme, RegExp][] = [
    ['dark', /@theme\s*\{([^}]*)\}/],
    ['light', /\[data-mui-color-scheme="light"\]\s*\{([^}]*)\}/],
  ];

  it.each(blocks)('%s palette', (scheme, pattern) => {
    const block = css.match(pattern)?.[1];
    expect(block, `no ${scheme} block found in globals.css`).toBeDefined();
    expect(propsIn(block as string)).toEqual(flatPalette(palettes[scheme]));
  });

  it('declares every token in both schemes — a missing light override falls back to dark', () => {
    const dark = propsIn(css.match(/@theme\s*\{([^}]*)\}/)?.[1] ?? '');
    const light = propsIn(
      css.match(/\[data-mui-color-scheme="light"\]\s*\{([^}]*)\}/)?.[1] ?? '',
    );
    expect([...light.keys()].sort()).toEqual([...dark.keys()].sort());
  });
});

describe('globals.css agrees with the radius scale', () => {
  it('every radius token is mirrored', () => {
    const block = css.match(/@theme\s*\{([^}]*)\}/)?.[1] ?? '';
    const found = new Map(
      [...block.matchAll(/--radius-([a-z]+):\s*([^;]+);/g)].map(([, k, v]) => [
        k,
        v.trim(),
      ]),
    );
    expect(found).toEqual(new Map(Object.entries(radius)));
  });
});

describe('the type scale is the one D71 was amended to (P17.T18)', () => {
  /**
   * 🔴 `text-sm` is 15px and `text-xs` is 13px. The names are Tailwind's and
   * no longer describe their values, which is the price of changing the scale
   * in one place instead of in every class site across the app — see the
   * comment in globals.css. This test is what stops the names being believed.
   */
  it.each([
    ['sm', '15px', 'calc(21 / 15)'],
    ['xs', '13px', 'calc(18 / 13)'],
  ])('--text-%s', (step, size, lineHeight) => {
    const block = css.match(/@theme\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(block).toContain(`--text-${step}: ${size};`);
    expect(block).toContain(`--text-${step}--line-height: ${lineHeight};`);
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { type ColorScheme, type Palette, palettes } from './tokens';

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

function flatten(palette: Palette): Map<string, string> {
  const pairs: [string, string][] = [
    ['bg-base', palette.bg.base],
    ['bg-surface', palette.bg.surface],
    ['bg-raised', palette.bg.raised],
    ['border-rule', palette.border.rule],
    ['text-primary', palette.text.primary],
    ['text-secondary', palette.text.secondary],
    ['text-dim', palette.text.dim],
    ['accent-fill', palette.accent.fill],
    ['accent-text', palette.accent.text],
    ['beam', palette.beam],
    ['score-high', palette.score.high],
    ['score-mid', palette.score.mid],
    ['score-low', palette.score.low],
  ];
  return new Map(pairs.map(([k, v]) => [k, v.toLowerCase()]));
}

describe('globals.css agrees with tokens.ts', () => {
  const blocks: [ColorScheme, RegExp][] = [
    ['dark', /@theme\s*\{([^}]*)\}/],
    ['light', /\[data-mui-color-scheme="light"\]\s*\{([^}]*)\}/],
  ];

  it.each(blocks)('%s palette', (scheme, pattern) => {
    const block = css.match(pattern)?.[1];
    expect(block, `no ${scheme} block found in globals.css`).toBeDefined();
    expect(propsIn(block as string)).toEqual(flatten(palettes[scheme]));
  });

  it('declares every token in both schemes — a missing light override falls back to dark', () => {
    const dark = propsIn(css.match(/@theme\s*\{([^}]*)\}/)?.[1] ?? '');
    const light = propsIn(
      css.match(/\[data-mui-color-scheme="light"\]\s*\{([^}]*)\}/)?.[1] ?? '',
    );
    expect([...light.keys()].sort()).toEqual([...dark.keys()].sort());
  });
});

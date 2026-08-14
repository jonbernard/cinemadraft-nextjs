# Phase 3 — Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Screening Room identity from spec §6 as a token system that MUI and Tailwind both read, with contrast and luminance-clamping enforced by tests rather than by review.

**Architecture:** Tokens are declared once in TypeScript (`theme/tokens.ts`) and consumed twice — by the MUI theme as palette values, and by Tailwind as `@theme` custom properties in `globals.css`. Because Tailwind 4 takes its theme from CSS and MUI takes its from JS, the two copies are unavoidable; a test parses `globals.css` and asserts it agrees with `tokens.ts`, so drift fails CI instead of shipping. Poster-derived accents pass through a pure OKLCH clamp that guarantees a contrast floor before any component sees a color.

**Tech Stack:** MUI 9.3.1 (`cssVariables` + `colorSchemes`), Tailwind 4.3.3 (`@theme`, `@custom-variant`), `next/font/google` (Archivo variable with `wdth` axis, IBM Plex Mono), Vitest.

## Global Constraints

- **D3/D29** — MUI supplies components, Tailwind supplies all custom styling. Cascade layer order `@layer theme, base, mui, components, utilities` is already declared in `globals.css` and is load-bearing; do not reorder it.
- **D15** — light and dark are both first-class designed palettes. Dark is the default. No component may branch on theme; theming happens by token swap only.
- **D28** — every dependency introduced is the latest stable at time of introduction, verified against the npm registry.
- **D33** — repository DTOs come from generated Prisma models. Nothing in `theme/` or `components/` may import from `generated/prisma`, even as a type. The four `layering` CI checks enforce this.
- **D34** — no roster size exists anywhere. Layout must not assume a count of posters.
- **§6.10** — the logo mark is undecided. Use the Archivo Expanded wordmark alone. The MUI Minimal pinwheel must not appear.
- **§6.4** — the contrast test must exist and pass **before** any component consumes a token.
- Biome formats and lints; `npm run typecheck`, `npm run lint`, `npm run test` must all be clean at every commit.

---

## File structure

| File | Responsibility |
|---|---|
| `theme/tokens.ts` | The single source of truth. Both palettes, the type scale, spacing, radii, motion durations. Plain data, no imports. |
| `theme/tokens.test.ts` | Asserts `globals.css` `@theme` block matches `tokens.ts` exactly — the anti-drift test. |
| `theme/contrast.ts` | WCAG relative luminance + contrast ratio. Pure. |
| `theme/contrast.test.ts` | 🔴 Asserts every declared foreground/background pair in both palettes clears its threshold, including the three §6.4 corrections. |
| `theme/oklch.ts` | sRGB ↔ OKLCH conversion and the poster-accent clamp. Pure, no dependencies. |
| `theme/oklch.test.ts` | Round-trip accuracy, clamp behaviour, and a property test: no input hex can produce an output that fails contrast. |
| `theme/fonts.ts` | `next/font` declarations. Server-side; exports CSS variable class names. |
| `theme/index.ts` | Assembles the MUI theme from tokens. Replaces the current placeholder wholesale. |
| `app/globals.css` | Adds the `@theme` block and the `dark` custom variant. Layer statement unchanged. |
| `components/LetterboxRule.tsx` | The signature device — hairline rules framing a section header. |
| `components/PosterFrame.tsx` | 2:3 frame, title below, tabular points, accent bar, winner seal. |

---

## Task 1: Tokens and the anti-drift test

**Files:**
- Create: `theme/tokens.ts`, `theme/tokens.test.ts`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `palettes` (`{ dark: Palette, light: Palette }`), `type Palette`, `type ColorScheme = 'dark' | 'light'`, `typeScale`, `motion`. Task 3 consumes `palettes`; Task 5 consumes all of them.

- [ ] **Step 1: Write `theme/tokens.ts`**

Values are copied verbatim from spec §6.2 and §6.3. `accent.fill` in dark is fill-only — the type does not stop you misusing it, but the contrast test in Task 3 does.

```ts
/**
 * The design tokens, declared once.
 *
 * MUI reads these as JS (theme/index.ts). Tailwind reads them as CSS custom
 * properties (the `@theme` block in globals.css). Tailwind 4 takes its theme
 * from CSS and MUI takes its from JS, so the two copies cannot be collapsed —
 * but `tokens.test.ts` parses the CSS and asserts it agrees with this file,
 * so a drifted copy fails CI rather than shipping a wrong colour.
 */
export type Palette = {
  bg: { base: string; surface: string; raised: string };
  border: { rule: string };
  text: { primary: string; secondary: string; dim: string };
  accent: { fill: string; text: string };
  beam: string;
};

export type ColorScheme = 'dark' | 'light';

export const palettes: Record<ColorScheme, Palette> = {
  dark: {
    bg: { base: '#0B0D10', surface: '#14171C', raised: '#1D2127' },
    border: { rule: '#2A2F38' },
    text: { primary: '#E8E6E1', secondary: '#8A9099', dim: '#828993' },
    // fill-only: #A8323E on #0B0D10 is 2.96:1 and fails as text (§6.2)
    accent: { fill: '#A8323E', text: '#DA707C' },
    beam: '#7FA6B8',
  },
  light: {
    bg: { base: '#F5F3EF', surface: '#FFFFFF', raised: '#EDEAE3' },
    border: { rule: '#DED9CF' },
    text: { primary: '#14171C', secondary: '#5F636C', dim: '#5F636C' },
    accent: { fill: '#8C2F39', text: '#8C2F39' },
    beam: '#3F6273',
  },
};

/** Motion budget from §6.8. The winner seal is the one exception and owns its own timing. */
export const motion = {
  fast: '150ms',
  base: '200ms',
  ease: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;
```

- [ ] **Step 2: Add the `@theme` block to `app/globals.css`**

Goes after the `@import "tailwindcss"` line. Every custom property here has a matching entry in `tokens.ts`.

```css
/* Tokens, mirrored from theme/tokens.ts.
 *
 * Tailwind 4 reads its theme from CSS, MUI reads its from JS, so this block
 * duplicates tokens.ts by necessity. theme/tokens.test.ts parses this file and
 * asserts the two agree — edit one and you must edit the other, or CI fails.
 *
 * Dark is the default (D15): the values live on :root, and the light scheme
 * overrides them under MUI's own attribute.
 */
@theme {
  --color-bg-base: #0B0D10;
  --color-bg-surface: #14171C;
  --color-bg-raised: #1D2127;
  --color-border-rule: #2A2F38;
  --color-text-primary: #E8E6E1;
  --color-text-secondary: #8A9099;
  --color-text-dim: #828993;
  --color-accent-fill: #A8323E;
  --color-accent-text: #DA707C;
  --color-beam: #7FA6B8;
}

/* MUI's cssVariables plugin stamps data-mui-color-scheme on <html>. Binding
 * Tailwind's `dark:` variant to the same attribute means one toggle drives
 * both systems — no second theme context, no component reading a hook to
 * decide which class to render.
 */
@custom-variant dark (&:where([data-mui-color-scheme="dark"], [data-mui-color-scheme="dark"] *));

[data-mui-color-scheme="light"] {
  --color-bg-base: #F5F3EF;
  --color-bg-surface: #FFFFFF;
  --color-bg-raised: #EDEAE3;
  --color-border-rule: #DED9CF;
  --color-text-primary: #14171C;
  --color-text-secondary: #5F636C;
  --color-text-dim: #5F636C;
  --color-accent-fill: #8C2F39;
  --color-accent-text: #8C2F39;
  --color-beam: #3F6273;
}
```

- [ ] **Step 3: Write the failing anti-drift test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type Palette, palettes } from './tokens';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

/** `--color-bg-base: #0B0D10;` -> Map { 'bg-base' => '#0b0d10' } for one block. */
function propsIn(block: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const [, name, value] of block.matchAll(/--color-([a-z-]+):\s*([^;]+);/g)) {
    found.set(name, value.trim().toLowerCase());
  }
  return found;
}

function flatten(palette: Palette): Map<string, string> {
  return new Map([
    ['bg-base', palette.bg.base], ['bg-surface', palette.bg.surface],
    ['bg-raised', palette.bg.raised], ['border-rule', palette.border.rule],
    ['text-primary', palette.text.primary], ['text-secondary', palette.text.secondary],
    ['text-dim', palette.text.dim], ['accent-fill', palette.accent.fill],
    ['accent-text', palette.accent.text], ['beam', palette.beam],
  ].map(([k, v]) => [k, v.toLowerCase()]) as [string, string][]);
}

describe('globals.css agrees with tokens.ts', () => {
  it.each([
    ['dark', /@theme\s*\{([^}]*)\}/],
    ['light', /\[data-mui-color-scheme="light"\]\s*\{([^}]*)\}/],
  ] as const)('%s palette', (scheme, pattern) => {
    const block = css.match(pattern)?.[1];
    expect(block, `no ${scheme} block found in globals.css`).toBeDefined();
    expect(propsIn(block as string)).toEqual(flatten(palettes[scheme as 'dark' | 'light']));
  });
});
```

- [ ] **Step 4: Run it**

Run: `npx vitest run theme/tokens.test.ts`
Expected: PASS. If it fails, the CSS and TS genuinely disagree — fix the mismatch, do not loosen the test.

- [ ] **Step 5: Commit**

```bash
git add theme/tokens.ts theme/tokens.test.ts app/globals.css
git commit -m "feat(theme): design tokens with an anti-drift test"
```

---

## Task 2: Contrast enforcement

**Files:**
- Create: `theme/contrast.ts`, `theme/contrast.test.ts`

**Interfaces:**
- Consumes: `palettes` from Task 1.
- Produces: `contrastRatio(hex, hex): number`, `relativeLuminance(hex): number`. Task 4 consumes `contrastRatio` for the clamp.

🔴 This task is the gate named in §6.4. No component may consume a token until it passes.

- [ ] **Step 1: Write the failing test first**

Pairs are asserted, not colours. AA is 4.5:1 for body text, 3:1 for large text and non-text UI.

```ts
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import { palettes } from './tokens';

const TEXT = 4.5;
const UI = 3;

describe.each(['dark', 'light'] as const)('%s palette meets WCAG AA', (scheme) => {
  const p = palettes[scheme];

  it.each([
    ['primary on base', p.text.primary, p.bg.base, TEXT],
    ['primary on surface', p.text.primary, p.bg.surface, TEXT],
    ['primary on raised', p.text.primary, p.bg.raised, TEXT],
    ['secondary on base', p.text.secondary, p.bg.base, TEXT],
    ['secondary on surface', p.text.secondary, p.bg.surface, TEXT],
    ['dim on base', p.text.dim, p.bg.base, TEXT],
    ['accent text on base', p.accent.text, p.bg.base, TEXT],
    ['accent text on surface', p.accent.text, p.bg.surface, TEXT],
    ['white on accent fill', '#FFFFFF', p.accent.fill, TEXT],
    ['rule on base', p.border.rule, p.bg.base, 1.2],
    ['beam on base', p.beam, p.bg.base, UI],
  ])('%s', (_label, fg, bg, threshold) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(threshold);
  });
});

describe('the §6.4 corrections stay corrected', () => {
  it('rejects carmine fill as dark-mode text', () => {
    // 2.96:1 — this is why accent.text exists as a separate token.
    expect(contrastRatio('#A8323E', palettes.dark.bg.base)).toBeLessThan(TEXT);
  });

  it.each([
    ['#7C8089 as light secondary', '#7C8089', palettes.light.bg.base],
    ['#6E757F as dark mono label', '#6E757F', palettes.dark.bg.base],
  ])('%s was replaced because it failed', (_label, rejected, bg) => {
    expect(contrastRatio(rejected, bg)).toBeLessThan(TEXT);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run theme/contrast.test.ts`
Expected: FAIL — `contrast.ts` does not exist.

- [ ] **Step 3: Implement `theme/contrast.ts`**

```ts
/**
 * WCAG 2.2 relative luminance and contrast ratio.
 *
 * Written out rather than pulled from a package: it is twenty lines of a
 * frozen specification, and it is the thing standing between a poster's
 * dominant colour and unreadable text (§6.6).
 */

/** `#0B0D10` or `#abc` -> [11, 13, 16]. Throws rather than guessing. */
export function parseHex(hex: string): [number, number, number] {
  const raw = hex.trim().replace(/^#/, '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new TypeError(`not a hex colour: ${hex}`);
  }
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** sRGB 0–255 -> linear 0–1, the gamma curve WCAG specifies. */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(linearize) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Symmetric: order of arguments does not matter. Range 1–21. */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run theme/contrast.test.ts`
Expected: PASS. A genuine failure means a spec token is wrong — report it, do not adjust the threshold.

- [ ] **Step 5: Commit**

```bash
git add theme/contrast.ts theme/contrast.test.ts
git commit -m "feat(theme): WCAG contrast, asserted across both palettes"
```

---

## Task 3: Poster-accent luminance clamp

**Files:**
- Create: `theme/oklch.ts`, `theme/oklch.test.ts`

**Interfaces:**
- Consumes: `contrastRatio` (Task 2), `palettes` (Task 1).
- Produces: `clampAccent(hex: string, scheme: ColorScheme): string`. Consumed by Task 6's accent bar and, later, by the roster strip in Phase 6.

This is independent of Tasks 4–5 and can run in parallel with them.

- [ ] **Step 1: Write the failing test**

The property test is the point: `Movie.accentHex` is whatever TMDB's artwork happened to be, so the clamp must hold for colours nobody chose.

```ts
import { describe, expect, it } from 'vitest';
import { clampAccent, hexToOklch, oklchToHex } from './oklch';
import { contrastRatio } from './contrast';
import { palettes } from './tokens';

describe('oklch conversion', () => {
  it.each(['#000000', '#FFFFFF', '#A8323E', '#7FA6B8', '#0B0D10'])(
    'round-trips %s within one 8-bit step',
    (hex) => {
      const [r, g, b] = [hex, oklchToHex(hexToOklch(hex))].map((h) =>
        Number.parseInt(h.slice(1), 16),
      ) as [number, number];
      for (const shift of [16, 8, 0]) {
        expect(Math.abs(((r >> shift) & 0xff) - ((b >> shift) & 0xff))).toBeLessThanOrEqual(1);
      }
    },
  );
});

describe('clampAccent', () => {
  // Deliberately hostile inputs: pure black, pure white, and fully saturated
  // primaries are all real poster dominant colours.
  const HOSTILE = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#7F7F7F', '#1A1A1A'];

  it.each(HOSTILE)('%s clears 4.5:1 against the dark ground', (hex) => {
    expect(contrastRatio(clampAccent(hex, 'dark'), palettes.dark.bg.base)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(HOSTILE)('%s clears 4.5:1 against the light ground', (hex) => {
    expect(contrastRatio(clampAccent(hex, 'light'), palettes.light.bg.base)).toBeGreaterThanOrEqual(4.5);
  });

  it('is deterministic', () => {
    expect(clampAccent('#A8323E', 'dark')).toBe(clampAccent('#A8323E', 'dark'));
  });

  it('preserves hue family — a red poster stays red', () => {
    const [, , hue] = hexToOklch(clampAccent('#B01020', 'dark'));
    expect(Math.abs(hue - hexToOklch('#B01020')[2])).toBeLessThan(12);
  });

  it('rejects malformed input rather than rendering something arbitrary', () => {
    expect(() => clampAccent('not-a-colour', 'dark')).toThrow(TypeError);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run theme/oklch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `theme/oklch.ts`**

OKLCH rather than HSL because OKLCH lightness is perceptually uniform — moving L is close to moving measured contrast, so the search below converges in a few steps instead of thrashing. Matrices are Björn Ottosson's published OKLab constants.

```ts
import { contrastRatio, parseHex } from './contrast';
import type { ColorScheme } from './tokens';

export type Oklch = [l: number, c: number, h: number];

function toLinear(channel: number): number {
  const v = channel / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function fromLinear(v: number): number {
  const s = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, s)) * 255);
}

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = parseHex(hex).map(toLinear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const okL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const okA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const okB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const hue = (Math.atan2(okB, okA) * 180) / Math.PI;
  return [okL, Math.hypot(okA, okB), hue < 0 ? hue + 360 : hue];
}

export function oklchToHex([okL, chroma, hue]: Oklch): string {
  const rad = (hue * Math.PI) / 180;
  const okA = chroma * Math.cos(rad);
  const okB = chroma * Math.sin(rad);

  const l = (okL + 0.3963377774 * okA + 0.2158037573 * okB) ** 3;
  const m = (okL - 0.1055613458 * okA - 0.0638541728 * okB) ** 3;
  const s = (okL - 0.0894841775 * okA - 1.291485548 * okB) ** 3;

  const r = fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const b = fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);

  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Chroma above this reads as neon against a neutral UI regardless of hue. */
const MAX_CHROMA = 0.16;
const FLOOR = 4.5;

/**
 * Force a poster's dominant colour into a band where it is guaranteed
 * readable against the theme's ground (§6.6).
 *
 * A poster colour is never trusted raw. `Movie.accentHex` comes from whatever
 * artwork TMDB served, and a black-and-white poster yields near-black — which
 * on the dark ground is invisible, and as a bar reads as "no points".
 *
 * The walk is deliberate rather than a formula: lightness and contrast are
 * monotonically related but not analytically invertible once chroma is
 * involved, so we step L toward the readable end until the measured ratio
 * clears the floor. Hue is never moved — a red film keeps a red accent, which
 * is the entire point of deriving the colour from the poster.
 */
export function clampAccent(hex: string, scheme: ColorScheme): string {
  const ground = scheme === 'dark' ? '#0B0D10' : '#F5F3EF';
  const [, chroma, hue] = hexToOklch(hex);
  const c = Math.min(chroma, MAX_CHROMA);

  // Dark ground: brighten toward 1. Light ground: darken toward 0.
  const step = scheme === 'dark' ? 0.02 : -0.02;
  let l = scheme === 'dark' ? 0.55 : 0.55;

  for (let i = 0; i < 40; i += 1) {
    const candidate = oklchToHex([l, c, hue]);
    if (contrastRatio(candidate, ground) >= FLOOR) return candidate;
    l += step;
    if (l > 1 || l < 0) break;
  }

  // Unreachable for in-gamut input, but a silent wrong colour is worse than a
  // known-good one: fall back to the theme's own accent.
  return scheme === 'dark' ? '#DA707C' : '#8C2F39';
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run theme/oklch.test.ts`
Expected: PASS. If the hue-preservation test fails, the clamp is moving hue — fix the clamp, not the test.

- [ ] **Step 5: Commit**

```bash
git add theme/oklch.ts theme/oklch.test.ts
git commit -m "feat(theme): luminance-clamped poster accents"
```

---

## Task 4: Typography

**Files:**
- Create: `theme/fonts.ts`
- Modify: `app/layout.tsx`, `app/globals.css`

**Interfaces:**
- Produces: `fontVariables` (a className string), and the CSS custom properties `--font-archivo` / `--font-mono`. Task 5 consumes the property names.

- [ ] **Step 1: Write `theme/fonts.ts`**

Archivo is loaded as a variable font including its `wdth` axis, because §6.5's display treatment is Archivo *Expanded* — `wdth` 118–120. Requesting the axis is what makes that width reachable; without it `next/font` ships the weight axis only and the display face silently renders at normal width.

```ts
import { Archivo, IBM_Plex_Mono } from 'next/font/google';

export const archivo = Archivo({
  subsets: ['latin'],
  display: 'swap',
  axes: ['wdth'],
  variable: '--font-archivo',
});

export const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const fontVariables = `${archivo.variable} ${plexMono.variable}`;
```

- [ ] **Step 2: Apply the variables in `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';

import { fontVariables } from '@/theme/fonts';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cinemadraft',
  description: 'Fantasy movie award leagues',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

`suppressHydrationWarning` is required, not cosmetic: Task 5 adds MUI's colour-scheme script, which sets an attribute on `<html>` before React hydrates. Without it every page logs a hydration mismatch.

- [ ] **Step 3: Register the faces with Tailwind**

Append to the `@theme` block in `globals.css`, then extend `tokens.test.ts`'s regex expectations if it asserts an exact property set (it matches `--color-*` only, so no change is needed).

```css
@theme {
  /* …colour tokens from Task 1… */
  --font-display: var(--font-archivo);
  --font-sans: var(--font-archivo);
  --font-mono: var(--font-mono);
}

/* Every number in this product sits in a column — points, standings, dates,
 * countdowns. Proportional figures make those columns jitter as values change,
 * which on a live scoreboard reads as the layout breaking. (§6.5)
 */
@layer base {
  .tabular {
    font-variant-numeric: tabular-nums;
  }
}
```

- [ ] **Step 4: Verify the build compiles and fonts resolve**

Run: `npm run build`
Expected: success. `next/font` fails the build on an unknown axis or weight, so this step is the test.

- [ ] **Step 5: Commit**

```bash
git add theme/fonts.ts app/layout.tsx app/globals.css
git commit -m "feat(theme): Archivo + IBM Plex Mono via next/font"
```

---

## Task 5: MUI theme assembly

**Files:**
- Modify: `theme/index.ts`, `app/providers.tsx`
- Create: `theme/index.test.ts`

**Interfaces:**
- Consumes: `palettes`, `motion` (Task 1); font variables (Task 4).
- Produces: `theme`. Consumed by `Providers`.

- [ ] **Step 1: Replace `theme/index.ts`**

```ts
'use client';

import { createTheme } from '@mui/material/styles';

import { motion, palettes } from './tokens';

/**
 * The MUI half of the token system.
 *
 * Values come from tokens.ts so this file cannot disagree with Tailwind's
 * copy — globals.css mirrors the same source, and tokens.test.ts holds the
 * two together.
 *
 * `colorSchemes` plus `cssVariables` is what makes the toggle a one-attribute
 * change: MUI emits both palettes as custom properties up front and switches
 * between them with data-mui-color-scheme on <html>. Tailwind's `dark:`
 * variant is bound to that same attribute (globals.css), so one toggle drives
 * both systems and no component reads a theme hook to decide what to render.
 */
const scheme = (name: 'dark' | 'light') => {
  const p = palettes[name];
  return {
    palette: {
      mode: name,
      background: { default: p.bg.base, paper: p.bg.surface },
      text: { primary: p.text.primary, secondary: p.text.secondary },
      primary: { main: p.accent.fill, contrastText: '#FFFFFF' },
      info: { main: p.beam },
      divider: p.border.rule,
    },
  };
};

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-mui-color-scheme' },
  defaultColorScheme: 'dark',
  colorSchemes: { dark: scheme('dark'), light: scheme('light') },
  shape: { borderRadius: 2 },
  typography: {
    fontFamily: 'var(--font-archivo), system-ui, sans-serif',
    // The film credit block: expanded, heavy, uppercase, tight. (§6.5)
    h1: {
      fontFamily: 'var(--font-archivo), system-ui, sans-serif',
      fontVariationSettings: '"wdth" 120',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '-0.01em',
    },
    button: { textTransform: 'none' },
  },
  transitions: { duration: { shortest: 150, standard: 200 } },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Respected throughout, per §6.8.
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            transitionDuration: '0.01ms !important',
          },
        },
      },
    },
  },
});

export { motion };
```

- [ ] **Step 2: Add the colour-scheme script to `app/providers.tsx`**

```tsx
'use client';

import CssBaseline from '@mui/material/CssBaseline';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { ThemeProvider } from '@mui/material/styles';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import type { ReactNode } from 'react';

import { theme } from '@/theme';

/**
 * `enableCssLayer` is what puts emotion's output into the `mui` cascade layer
 * declared in globals.css. Without it MUI's styles are emitted unlayered, and
 * unlayered CSS beats every layered rule — so every Tailwind utility would
 * silently lose to MUI. See D29.
 *
 * `InitColorSchemeScript` runs before paint and stamps the stored scheme onto
 * <html>. Without it a returning user on light theme gets a frame of the dark
 * ground first, which on this palette is a black flash.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <InitColorSchemeScript attribute="data-mui-color-scheme" defaultMode="dark" />
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
```

- [ ] **Step 3: Write the test**

```ts
import { describe, expect, it } from 'vitest';
import { theme } from './index';
import { palettes } from './tokens';

describe('MUI theme is built from the tokens', () => {
  it('defaults to dark (D15)', () => {
    expect(theme.defaultColorScheme).toBe('dark');
  });

  it.each(['dark', 'light'] as const)('%s palette matches tokens.ts', (name) => {
    expect(theme.colorSchemes[name]?.palette?.background?.default).toBe(palettes[name].bg.base);
    expect(theme.colorSchemes[name]?.palette?.text?.primary).toBe(palettes[name].text.primary);
  });

  it('uses carmine fill for primary, with white on it', () => {
    // accent.fill is fill-only — contrast.test.ts proves white on it passes
    // and that the same colour fails as text.
    expect(theme.colorSchemes.dark?.palette?.primary?.contrastText).toBe('#FFFFFF');
  });
});
```

- [ ] **Step 4: Run the full suite**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add theme/index.ts theme/index.test.ts app/providers.tsx
git commit -m "feat(theme): MUI theme from tokens, dark default with light scheme"
```

---

## Task 6: Letterbox rule and poster frame

**Files:**
- Create: `components/LetterboxRule.tsx`, `components/LetterboxRule.test.tsx`
- Create: `components/PosterFrame.tsx`, `components/PosterFrame.test.tsx`

**Interfaces:**
- Consumes: tokens as Tailwind classes; `clampAccent` (Task 3).
- Produces: `<LetterboxRule>{heading}</LetterboxRule>`, `<PosterFrame …>`. Phase 5 and 6 consume both.

These are the first components to consume tokens, so Task 2 must be green before starting.

- [ ] **Step 1: Write `components/LetterboxRule.tsx`**

```tsx
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * The signature device (§6.1): hairline rules above and below a section
 * header, borrowing cinema's letterbox. Structural, not decorative — it is
 * how a section announces itself, which is why there is no variant that
 * renders without the rules.
 */
export function LetterboxRule({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('border-border-rule border-y py-2', className)}>
      <h2 className="font-display text-text-primary text-sm uppercase tracking-wide [font-variation-settings:'wdth'_118] font-bold">
        {children}
      </h2>
    </div>
  );
}
```

- [ ] **Step 2: Write `components/PosterFrame.tsx`**

Every rule below is from §6.7 and each encodes a fix to a real defect in the current app.

```tsx
import { cn } from '@/lib/utils/cn';

export type PosterFrameProps = {
  title: string;
  posterUrl: string | null;
  /** Draft round, rendered from 01. There is no roster size (D34). */
  round: number;
  points: number;
  /** Share of the team total, 0–1. Drives the contribution bar. */
  share?: number;
  accent?: string;
  status?: 'none' | 'nominated' | 'won';
  className?: string;
};

/**
 * A single drafted film.
 *
 * Title sits BELOW the frame at full width rather than over the artwork —
 * the current app overlays it and truncates to "One Ba…", "Is This …".
 *
 * One signal per fact: a win is a carmine corner seal, a live nomination is a
 * top hairline. The current app marks a winner with both a size change and a
 * green check, and green reads as validation state, not victory.
 *
 * Never greyed out by score. The strip is ordered by draft position, not
 * performance — a last pick may be the best pick.
 */
export function PosterFrame({
  title, posterUrl, round, points, share = 0, accent, status = 'none', className,
}: PosterFrameProps) {
  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      <div
        className={cn(
          'relative aspect-[2/3] overflow-hidden bg-bg-raised',
          status === 'nominated' && 'border-accent-fill border-t-2',
        )}
      >
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- swapped for next/image in Phase 5, which needs the remote host allowlist
          <img src={posterUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-text-dim absolute inset-0 grid place-items-center font-mono text-xs">
            {title.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="text-text-dim absolute left-1 top-1 font-mono text-xs tabular">
          {String(round).padStart(2, '0')}
        </span>
        {status === 'won' && (
          <span
            aria-label="Winner"
            className="bg-accent-fill absolute right-0 top-0 h-6 w-6 [clip-path:polygon(100%_0,100%_100%,0_0)]"
          />
        )}
      </div>

      <figcaption className="flex flex-col gap-1">
        <span className="text-text-primary line-clamp-2 text-sm leading-tight">{title}</span>
        <span className="text-text-secondary font-mono text-xs tabular">{points}</span>
        <span className="bg-bg-raised h-0.5 w-full" aria-hidden="true">
          <span
            className="block h-full"
            style={{
              width: `${Math.min(100, Math.max(0, share * 100))}%`,
              backgroundColor: accent ?? 'var(--color-accent-fill)',
            }}
          />
        </span>
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 3: Write the component tests**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LetterboxRule } from './LetterboxRule';
import { PosterFrame } from './PosterFrame';

const base = { title: 'Sinners', posterUrl: null, round: 1, points: 40 };

describe('LetterboxRule', () => {
  it('renders its heading as a heading', () => {
    render(<LetterboxRule>Roster</LetterboxRule>);
    expect(screen.getByRole('heading', { name: 'Roster' })).toBeInTheDocument();
  });
});

describe('PosterFrame', () => {
  it('pads the round to two digits', () => {
    render(<PosterFrame {...base} />);
    expect(screen.getByText('01')).toBeInTheDocument();
  });

  it('renders a round past nine without truncating (D34)', () => {
    render(<PosterFrame {...base} round={30} />);
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('marks a winner once, not twice', () => {
    render(<PosterFrame {...base} status="won" />);
    expect(screen.getByLabelText('Winner')).toBeInTheDocument();
  });

  it('never hides a title behind the artwork', () => {
    render(<PosterFrame {...base} title="Is This Thing On?" />);
    expect(screen.getByText('Is This Thing On?')).toBeInTheDocument();
  });

  it('clamps a share outside 0–1 rather than overflowing the bar', () => {
    const { container } = render(<PosterFrame {...base} share={4} />);
    expect(container.querySelector('[style*="width"]')).toHaveStyle({ width: '100%' });
  });

  it('has an empty alt so the visible title is not read twice', () => {
    render(<PosterFrame {...base} posterUrl="https://example.test/p.jpg" />);
    expect(screen.getByRole('img', { hidden: true })).toHaveAttribute('alt', '');
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run components/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/
git commit -m "feat(components): letterbox rule and poster frame"
```

---

## Task 7: Token gallery and the no-raw-hex gate

**Files:**
- Create: `app/(marketing)/tokens/page.tsx`, `components/ThemeToggle.tsx`
- Modify: `.github/workflows/ci.yml`

This is the phase gate named in `docs/PLAN.md`: *"a token-gallery page renders both themes with no raw hex anywhere in `components/`."* Both halves are required.

- [ ] **Step 1: Write `components/ThemeToggle.tsx`**

```tsx
'use client';

import { useColorScheme } from '@mui/material/styles';

/**
 * The light/dark switch (D15).
 *
 * `mode` is undefined until the client mounts — MUI cannot know the stored
 * scheme during SSR. Rendering a placeholder of the same size avoids both a
 * hydration mismatch and a layout shift when the real label arrives.
 */
export function ThemeToggle() {
  const { mode, setMode } = useColorScheme();
  const next = mode === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={() => setMode(next)}
      className="border-border-rule text-text-secondary hover:text-text-primary border px-3 py-1 font-mono text-xs uppercase"
    >
      {mode ? `→ ${next}` : ' '}
    </button>
  );
}
```

- [ ] **Step 2: Write the gallery page**

Every swatch reads its colour from a Tailwind class, never a literal — the page is the demonstration that the token system works, so a hex here would defeat it.

```tsx
import { LetterboxRule } from '@/components/LetterboxRule';
import { PosterFrame } from '@/components/PosterFrame';
import { ThemeToggle } from '@/components/ThemeToggle';

const SWATCHES = [
  ['bg.base', 'bg-bg-base'], ['bg.surface', 'bg-bg-surface'],
  ['bg.raised', 'bg-bg-raised'], ['border.rule', 'bg-border-rule'],
  ['text.primary', 'bg-text-primary'], ['text.secondary', 'bg-text-secondary'],
  ['text.dim', 'bg-text-dim'], ['accent.fill', 'bg-accent-fill'],
  ['accent.text', 'bg-accent-text'], ['beam', 'bg-beam'],
] as const;

export default function TokensPage() {
  return (
    <main className="bg-bg-base text-text-primary min-h-dvh p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <span className="font-display text-lg uppercase [font-variation-settings:'wdth'_120] font-bold">
            Cinemadraft
          </span>
          <ThemeToggle />
        </div>

        <LetterboxRule>Palette</LetterboxRule>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {SWATCHES.map(([name, cls]) => (
            <li key={name} className="flex flex-col gap-1">
              <span className={`border-border-rule h-14 w-full border ${cls}`} />
              <span className="text-text-secondary font-mono text-xs">{name}</span>
            </li>
          ))}
        </ul>

        <LetterboxRule>Roster strip</LetterboxRule>
        {/* No count is assumed anywhere (D34) — this happens to be five. */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          {['Sinners', 'One Battle After Another', 'Is This Thing On?', 'Wake Up Dead Man', 'Marty Supreme'].map(
            (title, i) => (
              <PosterFrame
                key={title}
                title={title}
                posterUrl={null}
                round={i + 1}
                points={(5 - i) * 10}
                share={(5 - i) / 15}
                status={i === 0 ? 'won' : i === 1 ? 'nominated' : 'none'}
              />
            ),
          )}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify both themes render**

Run: `npm run dev`, open `/tokens`, toggle. Confirm the ground, rules and text all swap, and that no element keeps a dark-theme colour on the light ground. Confirm no pinwheel or MUI Minimal asset appears (§6.10).

- [ ] **Step 4: Add the no-raw-hex check to `.github/workflows/ci.yml`**

Add as a step in the existing `layering` job, matching the style of the four checks already there — every grep guarded with `|| true`, because GitHub runs steps under `bash -e` and grep exits non-zero on no-match, which is the passing case.

```yaml
      - name: Components carry no raw hex colours
        run: |
          set -uo pipefail
          # Tokens live in theme/ and globals.css. A hex literal under
          # components/ or app/ is a colour outside the system — it cannot be
          # themed, and no contrast test covers it.
          offenders=$(grep -rnE "#[0-9a-fA-F]{3,8}\b" components app \
            --include='*.tsx' --include='*.ts' 2>/dev/null || true)
          if [ -n "$offenders" ]; then
            echo "Raw hex colours outside the token system:"
            echo "$offenders"
            exit 1
          fi
```

- [ ] **Step 5: Run the check locally, then commit**

```bash
grep -rnE "#[0-9a-fA-F]{3,8}\b" components app --include='*.tsx' --include='*.ts' || echo "clean"
git add app components .github/workflows/ci.yml
git commit -m "feat(theme): token gallery, theme toggle, no-raw-hex CI gate"
```

---

## Task 8: Phase close-out

- [ ] **Step 1: Run everything**

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

- [ ] **Step 2: Tick P3.T1–T8 in `docs/PROGRESS.md`** and replace `Plan: _not yet written_` with a link to this file.

- [ ] **Step 3: Record any decision made during execution in `docs/DECISIONS.md`** as D35+, and check it does not contradict D3, D15, D28, D29 or D34.

- [ ] **Step 4: Commit**

```bash
git add docs/
git commit -m "docs: phase 3 complete"
```

---

## Notes for the executor

- **The pinwheel must not appear.** If any MUI Minimal asset is found under `public/`, delete it (§6.10). The wordmark is Archivo Expanded text until the mark is decided by the owner.
- **Do not add a colour that is not in `tokens.ts`.** If a component needs one, the token system is missing something — add it to `tokens.ts`, mirror it in `globals.css`, and add its pair to `contrast.test.ts`.
- **`accent.fill` is fill-only in dark mode.** Using it as a text colour on the dark ground is a 2.96:1 accessibility failure. `accent.text` exists for that.

/**
 * The design tokens, declared once.
 *
 * MUI reads these as JS (theme/index.ts). Tailwind reads them as CSS custom
 * properties (the `@theme` block in globals.css). Tailwind 4 takes its theme
 * from CSS and MUI takes its from JS, so the two copies cannot be collapsed —
 * but `tokens.test.ts` parses the CSS and asserts it agrees with this file,
 * so a drifted copy fails CI rather than shipping a wrong colour.
 *
 * Values are from spec §6.2 and §6.3. Do not adjust one without re-running
 * `contrast.test.ts`, which is what proves the pairs are readable.
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
    // `fill` is fill-only in dark: #A8323E on #0B0D10 is 2.96:1 and fails as
    // text, which is why `text` exists as a separate carmine (§6.2).
    accent: { fill: '#A8323E', text: '#DA707C' },
    beam: '#7FA6B8',
  },
  light: {
    bg: { base: '#F5F3EF', surface: '#FFFFFF', raised: '#EDEAE3' },
    border: { rule: '#DED9CF' },
    // The spec lists no `dim` for light; secondary's value is reused rather
    // than inventing a lighter grey that no contrast pair was computed for.
    text: { primary: '#14171C', secondary: '#5F636C', dim: '#5F636C' },
    accent: { fill: '#8C2F39', text: '#8C2F39' },
    // Darkened from the dark theme's #7FA6B8, which is 1.9:1 on warm paper.
    beam: '#3F6273',
  },
};

/**
 * Motion budget (§6.8). Everything sits at 150–200ms with ease-out on enter.
 * The winner seal is the single orchestrated exception and owns its timing at
 * the point of use rather than widening this scale.
 */
export const motion = {
  fast: '150ms',
  base: '200ms',
  ease: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

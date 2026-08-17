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
  /**
   * Critic-score colours, for the ratings chip on a film page.
   *
   * 🔴 Added rather than reused, and used as **text and border colour, never as
   * a fill**. The source app rendered Metacritic's own flat green/yellow/red
   * box (`server/routes/movie/movie.js:117` picks the colour, and
   * `src/pages/movie/index.jsx:180` fills a 50px square with it). Filling would
   * force all three to be dark enough to carry white text at 4.5:1, which makes
   * them muddy and mutually indistinguishable — destroying the one thing a
   * traffic light is for. As text on the app's own surfaces they can be bright
   * and legible, and the hairline chip matches the letterbox language the rest
   * of the product uses.
   *
   * The three-band rule itself is Metacritic's and is ported exactly — readers
   * already know green/yellow/red from their site, and inventing a different
   * threshold would make the same film look better here than there.
   */
  score: { high: string; mid: string; low: string };
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
    score: { high: '#63C08A', mid: '#D6A64A', low: '#E06C74' },
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
    // Darkened the same way. `low` lands on the same carmine as `accent.fill`
    // and that is deliberate rather than lazy: a bad review score in this
    // product's own red is on-palette and reads as a judgement, where a second
    // near-identical red beside it would read as a mistake.
    score: { high: '#1F6B41', mid: '#7A5410', low: '#8C2F39' },
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

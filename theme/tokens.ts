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
  bg: { ground: string; panel: string; surface: string };
  border: { rule: string };
  text: { primary: string; secondary: string; dim: string };
  accent: { fill: string; text: string; contrast: string };
  /**
   * 🔴 Brass is the awards accent; carmine is the urgency accent (D69). One
   * red doing both is why a winner and a countdown currently look identical.
   *
   * `contrast` differs per scheme and that is the point: dark ink on the dark
   * theme's bright brass is 7.55, white on the light theme's dark brass is
   * 6.37, and dark ink on light brass is 2.65 and fails. Carrying it as a
   * token means no component ever reads the mode to decide.
   */
  brass: { fill: string; text: string; contrast: string };
  /**
   * The projector beam: scheduled, counting down, or live — never urgent
   * (carmine) and never an award (brass). Spent by P17.T20 as
   * `<StatusChip tone="beam">` on the season rail's next chip, and by the live
   * surface's countdown (`components/LiveCountdown.tsx`). Wired into MUI as
   * `info.main`.
   *
   * 🔴 Ink, not a fill. contrast.test.ts proves it as text against every
   * surface; there is no measured on-beam contrast colour, so a fill would need
   * a `beam.contrast` token and its own rows there first.
   */
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
    // Violet-warm, not neutral (D68). The hue shift at matched luminance is
    // the primary anti-"developer tool" signal — measured off Sleeper, whose
    // #05091D ground is what stops a dense stats UI reading as a terminal.
    bg: { ground: '#0A0910', panel: '#16131C', surface: '#211C29' },
    // Dividers and table rules only. Never a card outline (D72).
    border: { rule: '#302938' },
    text: { primary: '#EFECE9', secondary: '#A8A1B2', dim: '#8C8598' },
    // `fill` is still fill-only: white on #C03D4E is 5.23:1, but #C03D4E as
    // text on the ground is below AA (3.79:1). Components needing carmine
    // *text* use accent.text, never palette.primary.main.
    //
    // 🔴 `contrast` is the pairing `fill` was measured for, and it is white in
    // both schemes. Anything that paints text ON accent.fill uses it. Handing
    // that slot `text.primary` instead is what put the Clerk sign-in button at
    // 2.45:1 in light and 4.44:1 in dark (P17.T9).
    accent: { fill: '#C03D4E', text: '#E78E99', contrast: '#FFFFFF' },
    brass: { fill: '#CFA93A', text: '#CFA93A', contrast: '#241C05' },
    beam: '#7FA6B8',
    score: { high: '#63C08A', mid: '#D6A64A', low: '#E06C74' },
  },
  light: {
    bg: { ground: '#EFEAE2', panel: '#FBF9F6', surface: '#E7E1D7' },
    border: { rule: '#D5CDC0' },
    // §3.1 gives light `dim` its own value, distinct from `secondary` — unlike
    // the previous palette, which had no dedicated light `dim` and reused
    // secondary's colour for it.
    text: { primary: '#1A151F', secondary: '#5C5566', dim: '#665E70' },
    accent: { fill: '#9B2F3C', text: '#8E2A36', contrast: '#FFFFFF' },
    brass: { fill: '#7A5A12', text: '#7A5A12', contrast: '#FFFFFF' },
    // Darkened from the dark theme's #7FA6B8, which is 1.9:1 on warm paper.
    beam: '#3F6273',
    // Darkened the same way. `low` (#8C2F39) no longer matches `accent.fill`
    // (#9B2F3C) — it now sits close to `accent.text` (#8E2A36) instead. Two
    // near-identical carmines coexisting is fine here because score colours
    // are read as text/border only, never as a fill, so they never compete
    // with accent for the same visual role.
    score: { high: '#1F6B41', mid: '#7A5410', low: '#8C2F39' },
  },
};

/**
 * A palette as the CSS custom properties it becomes: `accent-fill` → `#c03d4e`.
 *
 * Lives here rather than in a test because two tests need it — `tokens.test.ts`
 * to prove globals.css agrees with this file, and `contrast.test.ts` to resolve
 * the `var(--color-…)` strings in the Clerk appearance map back to colours.
 */
export function flatPalette(palette: Palette): Map<string, string> {
  const pairs: [string, string][] = [
    ['bg-ground', palette.bg.ground],
    ['bg-panel', palette.bg.panel],
    ['bg-surface', palette.bg.surface],
    ['border-rule', palette.border.rule],
    ['text-primary', palette.text.primary],
    ['text-secondary', palette.text.secondary],
    ['text-dim', palette.text.dim],
    ['accent-fill', palette.accent.fill],
    ['accent-text', palette.accent.text],
    ['accent-contrast', palette.accent.contrast],
    ['brass-fill', palette.brass.fill],
    ['brass-text', palette.brass.text],
    ['brass-contrast', palette.brass.contrast],
    ['beam', palette.beam],
    ['score-high', palette.score.high],
    ['score-mid', palette.score.mid],
    ['score-low', palette.score.low],
  ];
  return new Map(pairs.map(([k, v]) => [k, v.toLowerCase()]));
}

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

/**
 * Radius scale (D73). Buttons are always `sm` — never 0, never pill. `pill` is
 * status and filter chips only.
 *
 * Posters are deliberately absent: they use `clamp(4px, 2.8%, 12px)`, because a
 * percentage radius resolves against the element's own box, so a 40px thumbnail
 * and a hero poster are tuned by one declaration. A token cannot do that.
 */
export const radius = {
  xs: '3px',
  sm: '6px',
  md: '10px',
  lg: '16px',
  pill: '999px',
} as const;

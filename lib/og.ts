import { palettes } from '@/theme/tokens';

/**
 * The share-card palette (P15.T6).
 *
 * 🔴 `next/og` renders in an isolated Satori context: no CSS variables, no
 * Tailwind, no cascade — so a card cannot write `var(--color-bg-base)` and has
 * to hold real values. Reading them out of `theme/tokens.ts` keeps the single
 * source of truth intact, which a hand-copied hex would not.
 *
 * The dark scheme unconditionally: a share card is rendered once, server-side,
 * for a viewer whose colour-scheme preference we will never know.
 */
const DARK = palettes.dark;

export const CARD = {
  bg: DARK.bg.base,
  surface: DARK.bg.surface,
  ink: DARK.text.primary,
  inkSecondary: DARK.text.secondary,
  inkDim: DARK.text.dim,
  accent: DARK.accent.fill,
  brass: DARK.brass.fill,
} as const;

/** 1200×630 is what every scraper crops to; the routes all export it. */
export const CARD_SIZE = { width: 1200, height: 630 } as const;

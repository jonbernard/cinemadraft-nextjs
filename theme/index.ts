'use client';

import { createTheme } from '@mui/material/styles';

import { type ColorScheme, motion, palettes } from './tokens';

const SANS = 'var(--font-archivo), system-ui, sans-serif';
const SERIF = 'var(--font-instrument-serif), Georgia, serif';

/**
 * The MUI half of the token system.
 *
 * Values come from tokens.ts so this file cannot disagree with Tailwind's
 * copy — globals.css mirrors the same source and tokens.test.ts holds the two
 * together.
 *
 * `colorSchemes` plus `cssVariables` is what makes the light/dark switch a
 * one-attribute change: MUI emits both palettes as custom properties up front
 * and swaps between them via data-mui-color-scheme on <html>. Tailwind's
 * `dark:` variant is bound to that same attribute (globals.css), so one toggle
 * drives both systems and no component reads a theme hook to decide what to
 * render — which is what D15's "no component branches on theme" requires.
 */
function scheme(name: ColorScheme) {
  const p = palettes[name];
  return {
    palette: {
      background: { default: p.bg.base, paper: p.bg.surface },
      text: { primary: p.text.primary, secondary: p.text.secondary },
      // Carmine is the system colour — actions, deadlines, live states. Films
      // supply the content colour via clampAccent (§6.6).
      //
      // `main` is accent.fill, which is fill-only in dark mode: white on it is
      // 6.58:1, but it as text on the ground is 2.96:1. MUI uses `main` for
      // both filled and text buttons, so a text-variant Button in the primary
      // colour is an accessibility failure. Components needing carmine *text*
      // use the accent-text token, never palette.primary.main.
      primary: { main: p.accent.fill, contrastText: '#FFFFFF' },
      info: { main: p.beam },
      divider: p.border.rule,
    },
  };
}

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-mui-color-scheme' },
  defaultColorScheme: 'dark',
  colorSchemes: { dark: scheme('dark'), light: scheme('light') },
  // D73. Buttons are the default consumer of this value, and 6px is the whole
  // scale's anchor: soft enough to stop reading as a developer tool, hard
  // enough to stay a projection room rather than a friendly app.
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: SANS,
    /**
     * 🔴 Tracking is negative and tightens as size grows — the direct
     * opposite of the retired expanded-uppercase treatment. This single
     * inversion is what separates editorial from techy.
     *
     * h1/h2 are serif because a page heading is a *name* (D70). A section
     * heading is structure and uses h3 in Archivo.
     */
    h1: { fontFamily: SERIF, fontWeight: 400, letterSpacing: '-0.03em' },
    h2: { fontFamily: SERIF, fontWeight: 400, letterSpacing: '-0.02em' },
    h3: { fontFamily: SANS, fontWeight: 600, letterSpacing: '-0.01em' },
    h4: { fontFamily: SANS, fontWeight: 600, letterSpacing: '-0.01em' },
    button: { textTransform: 'none', fontWeight: 600 },
    // MUI ships this variant uppercase by default. The plan allows uppercase
    // in exactly one place — the 11px Eyebrow component — so this override
    // stays even though nothing currently renders `overline`: do not delete
    // it as a no-op.
    overline: { textTransform: 'none' },
  },
  transitions: {
    duration: {
      shortest: Number.parseInt(motion.fast, 10),
      standard: Number.parseInt(motion.base, 10),
    },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        // Pinned rather than inherited so a future shape change cannot
        // silently turn every button into something else.
        root: { borderRadius: 'var(--radius-sm)' },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        // Respected throughout (§6.8). Declared once here rather than per
        // component, because the guarantee must hold for MUI's own
        // transitions too — not only for animation this codebase authored.
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
          },
        },
      },
    },
  },
});

export { motion };

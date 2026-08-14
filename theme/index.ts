'use client';

import { createTheme } from '@mui/material/styles';

/**
 * Deliberately bare.
 *
 * Phase 3 replaces this wholesale with the token system from spec §6 — both
 * palettes, the type scale, and the contrast-verified colour pairs. Defining
 * any of that here would mean writing it twice and risking the two copies
 * drifting.
 *
 * `cssVariables` makes MUI emit its palette as CSS custom properties, which
 * is what will let Tailwind and MUI read the same tokens in Phase 3.
 */
export const theme = createTheme({
  cssVariables: true,
});

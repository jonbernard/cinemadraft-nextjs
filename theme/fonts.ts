import { Archivo, IBM_Plex_Mono } from 'next/font/google';

/**
 * One family across two width axes, plus a mono for data (§6.5).
 *
 * The `wdth` axis is requested explicitly because the display treatment is
 * Archivo *Expanded* — `wdth` 118–120, borrowed from the film credit block.
 * Without the axis `next/font` ships the weight axis alone, `font-variation-
 * settings: "wdth" 120` silently does nothing, and every display heading
 * renders at normal width. Archivo's axis range is 62–125, so 120 is inside
 * it; asking for a value outside that range fails the build rather than
 * clamping, which is the behaviour we want.
 *
 * IBM Plex Mono has no variable release, so its weights are enumerated. Only
 * the two the design uses are requested — each additional weight is another
 * font file on the critical path.
 */
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
  // Deliberately NOT `--font-mono`: Tailwind's own theme key is `--font-mono`,
  // so `--font-mono: var(--font-mono)` in globals.css would be a reference
  // cycle. CSS resolves a cycle to the guaranteed-invalid value, silently
  // dropping the family — the build still passes and every mono column falls
  // back to the browser default.
  variable: '--font-plex-mono',
});

/** Applied to <html> so both faces are reachable as CSS custom properties. */
export const fontVariables = `${archivo.variable} ${plexMono.variable}`;

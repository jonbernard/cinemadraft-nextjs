import {
  Archivo,
  IBM_Plex_Mono,
  Instrument_Serif,
  Newsreader,
  Sora,
} from 'next/font/google';

/**
 * Four roles, four families (D70, D71), plus the wordmark's own face (D83).
 *
 * 🔴 Archivo no longer requests the `wdth` axis. The expanded display
 * treatment is retired: measured against ten reference products, big type in
 * this category gets *tighter*, not wider — Criterion sets 64px headings at
 * −0.04em — and expanded uppercase is now the fantasy-sports uniform (Sleeper
 * and Underdog both ship Druk Wide), which is the exact association to avoid.
 * Dropping the axis also drops it from the payload.
 */
export const archivo = Archivo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-archivo',
});

/**
 * Names only — films, members, leagues, award shows (D70). The rule is
 * semantic rather than dimensional, which is what makes a single-weight face
 * safe: a name is never set below 15px, so 400 never has to signal "heading"
 * at a size where it cannot. A name that must go smaller renders in Archivo.
 */
export const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  display: 'swap',
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
});

/** Prose: synopses, ledes, explanatory copy. Variable. */
export const newsreader = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-newsreader',
});

/**
 * IBM Plex Mono has no variable release, so its weights are enumerated. Only
 * the two the design uses are requested — each one is another file on the
 * critical path.
 *
 * Deliberately NOT `--font-mono`: Tailwind's own theme key is `--font-mono`,
 * so `--font-mono: var(--font-mono)` in globals.css would be a reference
 * cycle. CSS resolves a cycle to the guaranteed-invalid value, silently
 * dropping the family — the build still passes and every mono column falls
 * back to the browser default. The same trap applies to `--font-serif`, which
 * is why Instrument Serif is loaded as `--font-instrument-serif`.
 */
export const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
  variable: '--font-plex-mono',
});

/**
 * The wordmark, and nothing else (D83).
 *
 * 🔴 Never use this for UI text. Sora and Archivo are both geometric-ish
 * grotesques with different skeletons, and mixing them in running copy reads
 * as a mistake rather than as a pairing — the lockup gets away with it because
 * it is a fixed piece of art the eye reads as a logo, not as type. Only
 * `components/Wordmark.tsx` may reference `--font-sora`.
 *
 * One weight is requested, because the lockup only ever sets one.
 */
export const sora = Sora({
  subsets: ['latin'],
  display: 'swap',
  weight: '600',
  variable: '--font-sora',
});

/** Applied to <html> so all five faces are reachable as custom properties. */
export const fontVariables = [
  archivo.variable,
  instrumentSerif.variable,
  newsreader.variable,
  plexMono.variable,
  sora.variable,
].join(' ');

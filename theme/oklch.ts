import { contrastRatio, parseHex } from './contrast';
import { type ColorScheme, palettes } from './tokens';

/**
 * Poster-derived accent colours, forced into a readable band (§6.6).
 *
 * `Movie.accentHex` is the dominant colour extracted from a film's poster at
 * TMDB ingest, and it accents that film everywhere it appears — contribution
 * bar, ledger rule, hover state. It is never trusted raw: a black-and-white
 * poster yields near-black, which on the dark ground is invisible and, as a
 * contribution bar, silently reads as "zero points". So the colour is moved
 * until it is guaranteed readable while its hue is left alone — a red film
 * still reads red, which is the only reason to derive the colour at all.
 *
 * OKLCH rather than HSL because OKLab lightness is perceptually uniform:
 * moving L tracks measured luminance closely enough that the search below
 * converges monotonically. HSL's `L` does not — an HSL search thrashes around
 * yellows and blues because equal HSL lightness is wildly unequal luminance.
 *
 * Matrices are Björn Ottosson's published OKLab constants. Deliberately no
 * dependency: this is two 3x3 matrices and a cube root, and a colour library
 * would be a supply-chain surface for code that never changes.
 */

export type Oklch = [l: number, c: number, h: number];

/** sRGB 0–255 -> linear 0–1. Same curve as `contrast.ts`, duplicated because
 * exporting it from there would widen that module's surface for one caller. */
function toLinear(channel: number): number {
  const v = channel / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Linear 0–1 -> sRGB 0–1, *unclamped* so gamut checks can see the overshoot. */
function toGamma(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.abs(v) ** (1 / 2.4) - 0.055;
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
  // Hue is normalised to [0, 360) so callers can compare two hues without
  // first having to know that atan2 returns a signed angle.
  return [okL, Math.hypot(okA, okB), hue < 0 ? hue + 360 : hue];
}

/** OKLCH -> sRGB 0–1, unclamped. Values outside [0,1] mean out of gamut. */
function oklchToRgb([okL, chroma, hue]: Oklch): [number, number, number] {
  const rad = (hue * Math.PI) / 180;
  const okA = chroma * Math.cos(rad);
  const okB = chroma * Math.sin(rad);

  const l = (okL + 0.3963377774 * okA + 0.2158037573 * okB) ** 3;
  const m = (okL - 0.1055613458 * okA - 0.0638541728 * okB) ** 3;
  const s = (okL - 0.0894841775 * okA - 1.291485548 * okB) ** 3;

  return [
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/**
 * OKLCH -> `#rrggbb`, clipping per channel if the colour is outside sRGB.
 *
 * Per-channel clipping distorts hue, so `clampAccent` never relies on it —
 * it fits chroma into gamut first. This is only the honest behaviour for a
 * public converter handed a colour that sRGB cannot represent.
 */
export function oklchToHex(oklch: Oklch): string {
  return `#${oklchToRgb(oklch)
    .map((v) => {
      const byte = Math.round(Math.min(1, Math.max(0, v)) * 255);
      return byte.toString(16).padStart(2, '0');
    })
    .join('')}`;
}

/**
 * Chroma ceiling. sRGB tops out near 0.32 (pure green), so this is roughly
 * half the available saturation and sits just above the brand carmine's own
 * chroma (#A8323E is ~0.135). Set it higher and a neon poster — anime keys,
 * 80s synth covers — vibrates against a deliberately desaturated UI; set it
 * much lower and every film's accent converges on the same muddy pastel and
 * the whole poster-derived idea stops being legible.
 */
const MAX_CHROMA = 0.16;

/**
 * Below this the hue angle is atan2 of two near-zero numbers — it is
 * quantisation noise, not a colour. A greyscale poster is treated as
 * genuinely achromatic and gets a neutral accent, because the alternative is
 * amplifying an 8-bit rounding artifact into a confidently wrong tint (a
 * black-and-white film rendered as, say, faintly green).
 */
const GREY_CHROMA = 0.02;

/** WCAG AA for body text. The accent is used as text, not only as fill. */
const FLOOR = 4.5;

/**
 * Lightness bands, per ground. The near end of each band is where an
 * achromatic colour first clears 4.5:1 (dark needs L >= ~0.55, light needs
 * L <= ~0.52); the far end stops short of pure white/black so that accents
 * keep some room to differ from the text tokens they sit beside. Within the
 * band the poster's *own* lightness is preserved, so a bright poster still
 * yields a brighter accent than a dark one — without it every film would get
 * an accent of identical lightness and only hue would vary.
 */
const BAND: Record<ColorScheme, { near: number; far: number }> = {
  dark: { near: 0.58, far: 0.94 },
  light: { near: 0.5, far: 0.22 },
};

/** Largest chroma <= `max` that is inside sRGB at this L and hue. */
function fitChroma(okL: number, max: number, hue: number): number {
  const inGamut = (c: number) =>
    oklchToRgb([okL, c, hue]).every((v) => v >= -0.001 && v <= 1.001);

  if (inGamut(max)) return max;

  // Bisection rather than a closed form: the sRGB gamut boundary in OKLCH has
  // no cheap analytic expression, and 16 halvings put us within 1e-5 of the
  // edge, far below one 8-bit step. Chroma is the only thing that moves, so
  // hue survives exactly — which is what the per-channel clip would have cost.
  let lo = 0;
  let hi = max;
  for (let i = 0; i < 16; i += 1) {
    const mid = (lo + hi) / 2;
    if (inGamut(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Force a poster's dominant colour into a band where it clears 4.5:1 against
 * the theme's ground, keeping its hue.
 *
 * The lightness walk is a search rather than a formula because contrast is
 * measured on the *quantised, gamut-fitted* output, and that relationship is
 * not analytically invertible. It is guaranteed to terminate having found
 * something: the walk ends at pure white (dark ground) or pure black (light
 * ground), where gamut fitting has driven chroma to zero and contrast is
 * ~19:1. The floor therefore holds by construction, not by luck — the test
 * sweep confirms it rather than establishing it.
 *
 * Throws `TypeError` on malformed input, propagated from `parseHex`: an
 * invisible UI element is a worse outcome than a loud failure at ingest.
 */
export function clampAccent(hex: string, scheme: ColorScheme): string {
  const ground = palettes[scheme].bg.base;
  const [okL, rawChroma, hue] = hexToOklch(hex);
  const chroma = rawChroma < GREY_CHROMA ? 0 : Math.min(rawChroma, MAX_CHROMA);

  const { near, far } = BAND[scheme];
  const toDark = scheme === 'dark';
  // Keep the poster's own lightness where the band allows it, then walk
  // outward. `near` is the readable edge, so clamping to it is already the
  // first plausible candidate.
  const start = toDark
    ? Math.min(Math.max(okL, near), far)
    : Math.max(Math.min(okL, near), far);

  const STEP = 0.02;
  const limit = toDark ? 1 : 0;
  const steps = Math.ceil(Math.abs(limit - start) / STEP);

  for (let i = 0; i <= steps; i += 1) {
    const l = toDark
      ? Math.min(start + i * STEP, limit)
      : Math.max(start - i * STEP, limit);
    const candidate = oklchToHex([l, fitChroma(l, chroma, hue), hue]);
    if (contrastRatio(candidate, ground) >= FLOOR) return candidate;
  }

  // Unreachable: the walk ends at white/black, which clears the floor against
  // either ground. Kept because a silently wrong colour is worse than a
  // known-good one, and this returns the theme's own accent token.
  return palettes[scheme].accent.text;
}

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
    // Loud rather than lenient: this runs on `Movie.accentHex`, which is
    // whatever the ingest step wrote. A silently-tolerated bad value would
    // surface as an invisible UI element, not as an error.
    throw new TypeError(`not a hex colour: ${hex}`);
  }

  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** sRGB 0–255 -> linear 0–1, using the gamma curve WCAG specifies. */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(linearize) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Symmetric — argument order does not matter. Range 1–21. */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

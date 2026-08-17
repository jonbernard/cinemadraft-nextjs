import { describe, expect, it } from 'vitest';

import { contrastRatio, parseHex, relativeLuminance } from './contrast';
import { palettes } from './tokens';

/**
 * 🔴 The gate named in §6.4. No component may consume a token until this
 * passes.
 *
 * It asserts *pairs*, not colours. A palette entry is not right or wrong on
 * its own — it is readable, or not, against the surface it sits on. A genuine
 * failure here means a spec token is wrong: report it, do not lower the
 * threshold.
 */

/** WCAG AA. */
const TEXT = 4.5;

describe('known values', () => {
  it.each([
    ['#FFFFFF', 1],
    ['#000000', 0],
  ])('luminance of %s', (hex, expected) => {
    expect(relativeLuminance(hex)).toBeCloseTo(expected, 5);
  });

  it('black on white is the maximum 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 2);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#0B0D10', '#E8E6E1')).toBeCloseTo(
      contrastRatio('#E8E6E1', '#0B0D10'),
      10,
    );
  });

  it('expands three-digit hex', () => {
    expect(parseHex('#abc')).toEqual(parseHex('#aabbcc'));
  });

  it.each(['', '#12345', 'rebeccapurple', '#gggggg'])('rejects %s', (bad) => {
    expect(() => parseHex(bad)).toThrow(TypeError);
  });
});

describe.each(['dark', 'light'] as const)('%s palette meets WCAG AA', (scheme) => {
  const p = palettes[scheme];

  it.each([
    ['primary on base', p.text.primary, p.bg.base, TEXT],
    ['primary on surface', p.text.primary, p.bg.surface, TEXT],
    ['primary on raised', p.text.primary, p.bg.raised, TEXT],
    ['secondary on base', p.text.secondary, p.bg.base, TEXT],
    ['secondary on surface', p.text.secondary, p.bg.surface, TEXT],
    ['secondary on raised', p.text.secondary, p.bg.raised, TEXT],
    // 🔴 `on raised` is the pair that failed on the first pass at 3.87 and is
    // the reason dim moved to #8C8598. Deleting this row would let it back in.
    ['dim on base', p.text.dim, p.bg.base, TEXT],
    ['dim on surface', p.text.dim, p.bg.surface, TEXT],
    ['dim on raised', p.text.dim, p.bg.raised, TEXT],
    ['accent text on base', p.accent.text, p.bg.base, TEXT],
    ['accent text on surface', p.accent.text, p.bg.surface, TEXT],
    ['accent text on raised', p.accent.text, p.bg.raised, TEXT],
    ['brass text on base', p.brass.text, p.bg.base, TEXT],
    ['brass text on surface', p.brass.text, p.bg.surface, TEXT],
    ['brass text on raised', p.brass.text, p.bg.raised, TEXT],
    ['beam on base', p.beam, p.bg.base, TEXT],
    ['beam on raised', p.beam, p.bg.raised, TEXT],
    // A hairline divider is not UI a user must perceive to operate the app,
    // so it is held to visibility rather than to the 3:1 non-text threshold.
    ['rule on base', p.border.rule, p.bg.base, 1.2],
    // 🔴 The score colours are held to the *text* threshold, not the 3:1
    // non-text one, because the number is printed in them. That is what makes
    // the chip readable in greyscale and to a colour-blind reader — the colour
    // is a second signal, never the only one (§6.7, a11y `color-not-only`).
    ['score high on base', p.score.high, p.bg.base, TEXT],
    ['score mid on base', p.score.mid, p.bg.base, TEXT],
    ['score low on base', p.score.low, p.bg.base, TEXT],
    ['score high on surface', p.score.high, p.bg.surface, TEXT],
    ['score mid on surface', p.score.mid, p.bg.surface, TEXT],
    ['score low on surface', p.score.low, p.bg.surface, TEXT],
    ['score high on raised', p.score.high, p.bg.raised, TEXT],
    ['score mid on raised', p.score.mid, p.bg.raised, TEXT],
    ['score low on raised', p.score.low, p.bg.raised, TEXT],
    // The one correct use of accent.fill: as a fill, with white on it.
    ['white on accent fill', '#FFFFFF', p.accent.fill, TEXT],
    // 🔴 The whole point of brass.contrast. Dark ink is 7.55 on the dark
    // theme's bright brass and 2.65 on the light theme's dark brass — so the
    // contrast text differs per scheme. This is a token pair, not a component
    // branch, so D15 ("no component branches on theme") still holds.
    ['brass contrast on brass fill', p.brass.contrast, p.brass.fill, TEXT],
  ])('%s', (_label, fg, bg, threshold) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(threshold);
  });
});

describe('the §6.4 corrections stay corrected', () => {
  it('rejects carmine fill as dark-mode text', () => {
    // 3.79:1. This is the entire reason accent.text exists as a separate
    // token — if this ever passes, someone widened a palette by accident.
    expect(contrastRatio(palettes.dark.accent.fill, palettes.dark.bg.base)).toBeLessThan(
      TEXT,
    );
  });

  it.each([
    ['#7C8089 as light secondary', '#7C8089', palettes.light.bg.base],
    ['#6E757F as dark mono label', '#6E757F', palettes.dark.bg.base],
  ])('%s was replaced because it failed', (_label, rejected, bg) => {
    expect(contrastRatio(rejected, bg)).toBeLessThan(TEXT);
  });
});

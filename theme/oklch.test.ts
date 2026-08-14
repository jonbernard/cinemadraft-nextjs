import { describe, expect, it } from 'vitest';
import { contrastRatio, parseHex } from './contrast';
import { clampAccent, hexToOklch, oklchToHex } from './oklch';
import { type ColorScheme, palettes } from './tokens';

/**
 * A fixed linear congruential generator (Numerical Recipes constants).
 *
 * `Math.random()` would make a failure unreproducible, and this test exists
 * precisely to catch the one poster colour in ten thousand that breaks the
 * clamp — a failure nobody can re-run is worthless.
 */
function* pseudoRandomHexes(count: number, seed = 1): Generator<string> {
  let state = seed >>> 0;
  for (let i = 0; i < count; i += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    yield `#${(state & 0xffffff).toString(16).padStart(6, '0')}`;
  }
}

const SWEEP = [...pseudoRandomHexes(256)];

/** Deliberately hostile: pure black, pure white and fully saturated primaries
 * are all real poster dominant colours, not synthetic edge cases. */
const HOSTILE = [
  '#000000',
  '#FFFFFF',
  '#FF0000',
  '#00FF00',
  '#0000FF',
  '#7F7F7F',
  '#1A1A1A',
];

/** Shortest angular distance in degrees — 359 and 1 are two degrees apart. */
function hueDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

describe('oklch conversion', () => {
  it.each([...HOSTILE, '#A8323E', '#7FA6B8', '#0B0D10', ...SWEEP.slice(0, 64)])(
    'round-trips %s within one 8-bit step per channel',
    (hex) => {
      const before = parseHex(hex);
      const after = parseHex(oklchToHex(hexToOklch(hex)));
      for (const i of [0, 1, 2]) {
        expect(Math.abs(before[i] - after[i])).toBeLessThanOrEqual(1);
      }
    },
  );

  it('normalises hue into [0, 360)', () => {
    for (const hex of SWEEP) {
      const [, , hue] = hexToOklch(hex);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it('reports near-zero chroma for greys', () => {
    for (const hex of ['#000000', '#FFFFFF', '#7F7F7F', '#333333']) {
      expect(hexToOklch(hex)[1]).toBeLessThan(0.001);
    }
  });
});

describe.each(['dark', 'light'] as const)(
  'clampAccent against the %s ground',
  (scheme: ColorScheme) => {
    const ground = palettes[scheme].bg.base;

    it.each(HOSTILE)('%s clears 4.5:1', (hex) => {
      expect(contrastRatio(clampAccent(hex, scheme), ground)).toBeGreaterThanOrEqual(4.5);
    });

    it('clears 4.5:1 across a deterministic sweep of 256 colours', () => {
      // Reported rather than asserted one-by-one: a single failure should name
      // the offending hex, which `it.each` over 256 cases would bury in noise.
      const failures = SWEEP.map((hex) => ({
        hex,
        ratio: contrastRatio(clampAccent(hex, scheme), ground),
      })).filter(({ ratio }) => ratio < 4.5);
      expect(failures).toEqual([]);
    });

    it('clears 4.5:1 across a stride of the whole 24-bit space', () => {
      // A stride catches structure an LCG's uniform scatter can miss — every
      // sampled point shares low-order bit patterns, including the greys.
      const failures: string[] = [];
      for (let n = 0; n < 0x1000000; n += 0x4321) {
        const hex = `#${n.toString(16).padStart(6, '0')}`;
        if (contrastRatio(clampAccent(hex, scheme), ground) < 4.5) {
          failures.push(hex);
        }
      }
      expect(failures).toEqual([]);
    });

    it('preserves hue for inputs with meaningful chroma', () => {
      // Below ~0.04 chroma the hue angle is mostly quantisation noise, so it
      // is not something the clamp can meaningfully promise to keep.
      const drifted = SWEEP.map((hex) => {
        const [, chroma, hue] = hexToOklch(hex);
        const [, , out] = hexToOklch(clampAccent(hex, scheme));
        return { hex, chroma, delta: hueDelta(hue, out) };
      }).filter(({ chroma, delta }) => chroma >= 0.04 && delta > 12);
      expect(drifted).toEqual([]);
    });

    it('keeps a red poster red', () => {
      const [, , hue] = hexToOklch(clampAccent('#B01020', scheme));
      expect(hueDelta(hue, hexToOklch('#B01020')[2])).toBeLessThan(12);
    });

    it('gives greyscale posters a neutral accent rather than a phantom tint', () => {
      // A black-and-white poster must not come back faintly green because
      // atan2 of two rounding errors happened to point that way.
      for (const hex of ['#000000', '#FFFFFF', '#7F7F7F', '#1A1A1A']) {
        expect(hexToOklch(clampAccent(hex, scheme))[1]).toBeLessThan(0.01);
      }
    });

    it('preserves relative lightness — a brighter poster gives a brighter accent', () => {
      const dim = hexToOklch(clampAccent('#3A1418', scheme))[0];
      const bright = hexToOklch(clampAccent('#F2A6B0', scheme))[0];
      // If this ever collapses to equality, every film's accent has identical
      // lightness and only hue distinguishes one from another.
      expect(bright).toBeGreaterThan(dim);
    });

    it('is deterministic', () => {
      for (const hex of ['#A8323E', '#00FF00', '#000000']) {
        expect(clampAccent(hex, scheme)).toBe(clampAccent(hex, scheme));
      }
    });

    it('rejects malformed input rather than rendering something arbitrary', () => {
      expect(() => clampAccent('not-a-colour', scheme)).toThrow(TypeError);
      expect(() => clampAccent('#12345', scheme)).toThrow(TypeError);
      expect(() => clampAccent('', scheme)).toThrow(TypeError);
    });

    it('accepts the three-digit shorthand parseHex allows', () => {
      expect(clampAccent('#f00', scheme)).toBe(clampAccent('#ff0000', scheme));
    });
  },
);

import { describe, expect, it } from 'vitest';

import { clerkAppearance } from './clerk';
import { contrastRatio, parseHex, relativeLuminance } from './contrast';
import { type ColorScheme, flatPalette, palettes } from './tokens';

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

/**
 * WCAG 2.1 AA for non-text contrast (1.4.11). A focus ring has to be
 * perceivable against whatever it is drawn on; nobody reads it.
 */
const NON_TEXT = 3;

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
    ['primary on ground', p.text.primary, p.bg.ground, TEXT],
    ['primary on panel', p.text.primary, p.bg.panel, TEXT],
    ['primary on surface', p.text.primary, p.bg.surface, TEXT],
    ['secondary on ground', p.text.secondary, p.bg.ground, TEXT],
    ['secondary on panel', p.text.secondary, p.bg.panel, TEXT],
    ['secondary on surface', p.text.secondary, p.bg.surface, TEXT],
    // 🔴 `on surface` is the pair that failed on the first pass at 3.87 and is
    // the reason dim moved to #8C8598. Deleting this row would let it back in.
    ['dim on ground', p.text.dim, p.bg.ground, TEXT],
    ['dim on panel', p.text.dim, p.bg.panel, TEXT],
    ['dim on surface', p.text.dim, p.bg.surface, TEXT],
    ['accent text on ground', p.accent.text, p.bg.ground, TEXT],
    ['accent text on panel', p.accent.text, p.bg.panel, TEXT],
    ['accent text on surface', p.accent.text, p.bg.surface, TEXT],
    ['brass text on ground', p.brass.text, p.bg.ground, TEXT],
    ['brass text on panel', p.brass.text, p.bg.panel, TEXT],
    ['brass text on surface', p.brass.text, p.bg.surface, TEXT],
    ['beam on ground', p.beam, p.bg.ground, TEXT],
    // 🔴 The season rail's next chip steps down to `panel` inside a `surface`
    // box, like its neutral siblings (P17.T20). This is that pair.
    ['beam on panel', p.beam, p.bg.panel, TEXT],
    ['beam on surface', p.beam, p.bg.surface, TEXT],
    // A hairline divider is not UI a user must perceive to operate the app,
    // so it is held to visibility rather than to the 3:1 non-text threshold.
    ['rule on ground', p.border.rule, p.bg.ground, 1.2],
    // 🔴 The score colours are held to the *text* threshold, not the 3:1
    // non-text one, because the number is printed in them. That is what makes
    // the chip readable in greyscale and to a colour-blind reader — the colour
    // is a second signal, never the only one (§6.7, a11y `color-not-only`).
    ['score high on ground', p.score.high, p.bg.ground, TEXT],
    ['score mid on ground', p.score.mid, p.bg.ground, TEXT],
    ['score low on ground', p.score.low, p.bg.ground, TEXT],
    ['score high on panel', p.score.high, p.bg.panel, TEXT],
    ['score mid on panel', p.score.mid, p.bg.panel, TEXT],
    ['score low on panel', p.score.low, p.bg.panel, TEXT],
    ['score high on surface', p.score.high, p.bg.surface, TEXT],
    ['score mid on surface', p.score.mid, p.bg.surface, TEXT],
    ['score low on surface', p.score.low, p.bg.surface, TEXT],
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
    expect(
      contrastRatio(palettes.dark.accent.fill, palettes.dark.bg.ground),
    ).toBeLessThan(TEXT);
  });

  it.each([
    ['#7C8089 as light secondary', '#7C8089', palettes.light.bg.ground],
    ['#6E757F as dark mono label', '#6E757F', palettes.dark.bg.ground],
  ])('%s was replaced because it failed', (_label, rejected, bg) => {
    expect(contrastRatio(rejected, bg)).toBeLessThan(TEXT);
  });
});

/**
 * 🔴 The Clerk appearance map, held to the same threshold as the palette.
 *
 * This is the gate the fill-only rule never had. `app/providers.tsx` used to
 * declare the map inline, where no test could see it, and it drifted: the
 * primary button's label was pinned to `text.primary`, which is near-black in
 * light, and the links inherited `colorPrimary`, which is a fill. Both shipped.
 *
 * The rows below are not decoration — each one names a pair Clerk actually
 * paints. Adding a `color*` variable to `theme/clerk.ts` without adding its
 * pair here puts a colour into the sign-in card that nothing checks.
 */
function resolve(value: string, scheme: ColorScheme): string {
  const name = /^var\(--color-([a-z-]+)\)$/.exec(value)?.[1];
  if (!name) throw new TypeError(`not a colour token: ${value}`);
  const hex = flatPalette(palettes[scheme]).get(name);
  if (!hex) throw new TypeError(`unknown colour token: --color-${name}`);
  return hex;
}

describe.each(['dark', 'light'] as const)(
  'the Clerk appearance map meets WCAG AA in %s',
  (scheme) => {
    const v = clerkAppearance.variables;
    const linkColor = clerkAppearance.elements?.footerActionLink;
    const elements = clerkAppearance.elements as unknown as Record<
      string,
      Record<string, string>
    >;
    // Read back out of the map rather than restated here: a row that names its
    // own colour proves the arithmetic and nothing about what ships.
    const socialBackground = elements.socialButtonsBlockButton.background;

    it.each([
      // 🔴 The pair that shipped at 2.45:1 in light and 4.44:1 in dark. Clerk
      // paints colorPrimaryForeground ON colorPrimary — solid primary buttons,
      // per the Variables doc comment in @clerk/react.
      ['the primary button label on its fill', v.colorPrimaryForeground, v.colorPrimary],
      ['card text on the card', v.colorForeground, v.colorBackground],
      ['muted text on the card', v.colorMutedForeground, v.colorBackground],
      ['field text on the field', v.colorInputForeground, v.colorInput],
      ['error text on the card', v.colorDanger, v.colorBackground],
      // "Continue with Google" sits on `bg-surface` rather than on the card,
      // the same step the email field takes — Clerk's own edge for this button
      // is its neutral at 7%, which is black at 7% on the dark ground and drew
      // nothing at all. A surface step is how this system separates (D67), and
      // this is the pair that step creates.
      ['the social button label on its surface', v.colorForeground, socialBackground],
    ])('%s', (_label, fg, bg) => {
      expect(
        contrastRatio(resolve(fg, scheme), resolve(bg, scheme)),
      ).toBeGreaterThanOrEqual(TEXT);
    });

    // 🔴 Two grounds, not one. The card is bg.panel, but the footer action —
    // "Register" / "Log in" — renders *outside* the card on the auth layout's
    // bg.ground. Measured in the browser: the shipped link was 3.51:1 on the card
    // and 3.79:1 on the ground. Asserting only the card would miss the worse of
    // the two.
    it.each([
      ['the footer link on the card', 'colorBackground'],
      ['the footer link on the page ground', 'bg-ground'],
    ])('%s', (_label, ground) => {
      const bg =
        ground === 'colorBackground'
          ? resolve(v.colorBackground, scheme)
          : palettes[scheme].bg.ground;
      expect(linkColor).toBeDefined();
      expect(
        contrastRatio(resolve((linkColor as { color: string }).color, scheme), bg),
      ).toBeGreaterThanOrEqual(TEXT);
    });

    /**
     * 🔴 The focus ring, on all three grounds it can land on.
     *
     * Tabbed through the real card in both schemes: the Clerk controls drew
     * their own ring from `colorRing` — the neutral at 15%, i.e. black at 15%
     * on a near-black card — and "Register" drew none at all and fell through
     * to Chrome's default, measured `outline-style: auto` in rgb(153, 200, 255)
     * dark and rgb(0, 95, 204) light. The ring is carmine now, and a 2px
     * outline at a 2px offset is drawn on the panel for a control inside the
     * card, on the surface where it overlaps a field, and on the ground for the
     * lockup link above the panel.
     *
     * Dark on surface is the tight one at 3.18:1. If a palette moves and this
     * row goes red, the ring needs a token of its own — not a lower threshold.
     */
    it.each(['ground', 'panel', 'surface'] as const)(
      'the focus ring is perceivable on the %s',
      (surface) => {
        const outline = elements.formButtonPrimary['&:focus-visible'] as unknown as {
          outline: string;
        };
        const token = /var\(--color-[a-z-]+\)/.exec(outline.outline)?.[0];
        expect(token).toBeDefined();
        expect(
          contrastRatio(resolve(token as string, scheme), palettes[scheme].bg[surface]),
        ).toBeGreaterThanOrEqual(NON_TEXT);
      },
    );
  },
);

describe('the P17.T9 corrections stay corrected', () => {
  it('rejects text.primary as a foreground on accent.fill', () => {
    // 2.45:1 light, 4.44:1 dark — what shipped. If either of these ever passes,
    // somebody has changed a palette and this pair needs re-measuring, not
    // deleting.
    expect(
      contrastRatio(palettes.light.text.primary, palettes.light.accent.fill),
    ).toBeLessThan(TEXT);
    expect(
      contrastRatio(palettes.dark.text.primary, palettes.dark.accent.fill),
    ).toBeLessThan(TEXT);
  });

  it('accent.contrast is the pairing accent.fill was measured for', () => {
    expect(
      contrastRatio(palettes.dark.accent.contrast, palettes.dark.accent.fill),
    ).toBeGreaterThanOrEqual(TEXT); // 5.23
    expect(
      contrastRatio(palettes.light.accent.contrast, palettes.light.accent.fill),
    ).toBeGreaterThanOrEqual(TEXT); // 7.33
  });
});

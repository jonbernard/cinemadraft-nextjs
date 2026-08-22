import { describe, expect, it } from 'vitest';

import { contrastRatio } from './contrast';
import { theme } from './index';
import { type ColorScheme, palettes } from './tokens';

/**
 * These assert the *wiring*, not the colours — contrast.test.ts owns whether a
 * value is readable. What can break here is the theme quietly falling back to
 * MUI's defaults: a typo in a scheme key leaves you with Material blue and a
 * white ground, which still renders and still passes a build.
 */
describe('MUI theme is built from the tokens', () => {
  it('defaults to dark (D15)', () => {
    expect(theme.defaultColorScheme).toBe('dark');
  });

  it('switches on the same attribute Tailwind binds its dark: variant to', () => {
    // If these two ever disagree, the toggle moves MUI and leaves every
    // Tailwind utility on the dark values — a half-themed page.
    expect(theme.colorSchemeSelector).toBe('data-mui-color-scheme');
  });

  it.each(['dark', 'light'] as const)(
    '%s palette matches tokens.ts',
    (name: ColorScheme) => {
      const p = theme.colorSchemes[name]?.palette;
      expect(p?.background?.default).toBe(palettes[name].bg.base);
      expect(p?.background?.paper).toBe(palettes[name].bg.surface);
      expect(p?.text?.primary).toBe(palettes[name].text.primary);
      expect(p?.divider).toBe(palettes[name].border.rule);
    },
  );

  it.each(['dark', 'light'] as const)(
    '%s primary is carmine with white on it',
    (name) => {
      const primary = theme.colorSchemes[name]?.palette?.primary;
      expect(primary?.main).toBe(palettes[name].accent.fill);
      // Restates the one correct use of a fill-only token, at the point where a
      // future edit would most plausibly break it.
      expect(primary?.contrastText).toBe('#FFFFFF');
      expect(contrastRatio('#FFFFFF', primary?.main as string)).toBeGreaterThanOrEqual(
        4.5,
      );
    },
  );

  it('holds motion inside the 150-200ms budget (§6.8)', () => {
    expect(theme.transitions.duration.shortest).toBe(150);
    expect(theme.transitions.duration.standard).toBe(200);
  });
});

describe('the retired treatments are gone', () => {
  it('no typography variant is uppercase', () => {
    // Object-valued entries are variants (h1, button, overline, ...);
    // fontFamily/fontSize/fontWeight*/htmlFontSize/pxToRem are not. Deriving
    // the list from theme.typography itself — rather than a hand-written
    // array — also catches a future MUI upgrade shipping a new uppercase
    // default.
    const variants = Object.entries(theme.typography).filter(
      (entry): entry is [string, Record<string, unknown>] =>
        typeof entry[1] === 'object' && entry[1] !== null,
    );
    expect(variants.length).toBeGreaterThan(0);
    for (const [name, value] of variants) {
      expect(value.textTransform, `${name}.textTransform`).not.toBe('uppercase');
    }
  });

  it('no variant requests a width axis', () => {
    expect(JSON.stringify(theme.typography)).not.toContain('wdth');
  });

  it('buttons are 6px, never square and never pill', () => {
    expect(theme.shape.borderRadius).toBe(6);
  });
});

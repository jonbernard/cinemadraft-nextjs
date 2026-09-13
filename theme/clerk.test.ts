import { describe, expect, it } from 'vitest';

import { authCardAppearance, clerkAppearance } from './clerk';

/**
 * 🔴 The controls Clerk draws are the only controls on the busiest form in the
 * product, and they are not ours to rebuild — only to configure.
 *
 * Measured on `/auth/login` before this map named a height: the Google button,
 * the email field and "Continue" all rendered **32px** tall at 1440 and at
 * 390, 12px under the 44px floor every other target in the app clears. The
 * assertion reads the map rather than the browser because the map is what
 * decides it, and a Clerk upgrade that renames an element key fails here
 * rather than in somebody's thumb.
 */
const CONTROLS = [
  'formButtonPrimary',
  'formFieldInput',
  'socialButtonsBlockButton',
  'otpCodeFieldInput',
] as const;

describe('every Clerk control', () => {
  it.each(CONTROLS)('%s clears the 44px touch target', (key) => {
    const element = clerkAppearance.elements[key] as { minHeight?: string };
    expect(Number.parseFloat(element.minHeight ?? '0')).toBeGreaterThanOrEqual(44);
  });

  it.each(CONTROLS)('%s draws a focus ring of its own', (key) => {
    // Without this, `footerActionLink` fell through to Chrome's default
    // `outline-style: auto` — rgb(153, 200, 255) dark, rgb(0, 95, 204) light —
    // measured by tabbing the real page. The same default is one renamed key
    // away for any of these.
    const element = clerkAppearance.elements[key] as {
      '&:focus-visible'?: { outline?: string };
    };
    expect(element['&:focus-visible']?.outline).toMatch(/^2px solid var\(--color-/);
  });
});

/**
 * The auth card is a layout box inside the page's own `Panel`, not a second
 * card. Clerk ships it with a 1px border and two drop shadows; this product
 * has neither (D67, D72), and the ground→panel step is the only separation on
 * the page.
 */
describe('the auth card', () => {
  it.each(['card', 'cardBox'] as const)('%s carries no shadow', (key) => {
    expect((authCardAppearance.elements[key] as { boxShadow?: string }).boxShadow).toBe(
      'none',
    );
  });

  it('fills the panel rather than shrink-wrapping its content', () => {
    // Measured: with the card's own 400px width dropped and nothing in its
    // place, the form collapsed to 253px inside a 400px panel — narrower than
    // the sentence above it.
    for (const key of ['rootBox', 'cardBox', 'card'] as const) {
      expect((authCardAppearance.elements[key] as { width?: string }).width).toBe('100%');
    }
  });

  /**
   * 🔴 The flattening is the auth pages' own, not the provider's.
   *
   * `ClerkProvider`'s appearance reaches every Clerk surface in the app,
   * including the `UserButton` popover in the shell's strip — which floats
   * over a page rather than sitting in a `Panel`. A transparent, shadowless
   * card there is text on top of whatever is underneath it.
   */
  it.each(['rootBox', 'cardBox', 'card', 'footer'] as const)(
    'does not flatten %s for every other Clerk surface',
    (key) => {
      expect(clerkAppearance.elements).not.toHaveProperty(key);
    },
  );
});

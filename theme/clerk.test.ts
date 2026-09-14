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
   * 🔴 The focus ring paints outside the field, so the card may not clip.
   *
   * The owner reported the carmine ring on `/auth/login`'s email field cut off
   * (P14.T17). `FOCUS_RING` is a 2px outline at a 2px offset — 4px beyond the
   * border box — and `card` sets `padding: 0`, so every full-width control
   * spans the card edge to edge. Measured in a production build at 1440 with
   * the field focused: `cardBox` computed `overflow: hidden`, and the ring
   * overhung that clip by 5px left and 3px right on the Google button, the
   * email field and "Continue" alike.
   *
   * 🔴 **This pin is not the geometry.** It reads the map, which is what
   * decides the property, and it goes red if the property is dropped — but
   * nothing here renders a browser, so it cannot see a ring. The geometric
   * assertion lives in `e2e/auth.spec.ts`, which the default suite **skips**:
   * the e2e server boots with no Clerk at all (D82/D84), and `/auth/login`
   * there renders the error boundary rather than a form. Running it takes a
   * server with real Clerk keys and `E2E_TEST_AUTH` unset, as that file says.
   * This is the half that runs on every commit.
   */
  it('does not clip the focus ring off the fields', () => {
    expect((authCardAppearance.elements.cardBox as { overflow?: string }).overflow).toBe(
      'visible',
    );
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

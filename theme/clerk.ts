import type { ClerkProvider } from '@clerk/nextjs';
import type { ComponentProps } from 'react';

/**
 * Clerk's `appearance`, as its own public prop type.
 *
 * 🔴 The plan for P17.T9 named `Appearance` from `@clerk/types`, and neither
 * exists in this install: there is no `@clerk/types` package, and
 * `@clerk/nextjs` does not re-export the type. The nearest named type is
 * `ClerkAppearanceTheme` in `@clerk/shared/types`, which is a *transitive*
 * dependency — reaching into one for a type breaks the moment Clerk reshuffles
 * its internals. Reading the prop off `ClerkProvider` is the same type by
 * construction and stays correct through any repackaging.
 */
type Appearance = NonNullable<ComponentProps<typeof ClerkProvider>['appearance']>;

/**
 * The app's focus ring, on a Clerk control (§6.7).
 *
 * 🔴 Measured in the browser: Clerk's own focus treatment is `colorRing` — its
 * neutral at 15% — and the footer's "Register" link had **no** Clerk ring at
 * all, so it fell through to Chrome's default `outline-style: auto` in
 * `rgb(153, 200, 255)` dark / `rgb(0, 95, 204)` light. That is the same defect
 * `ThemeToggle` records, on the one page where every control beside it is
 * Clerk's. 2px carmine at a 2px offset is what the rest of the app draws.
 */
const FOCUS_RING = {
  '&:focus-visible': {
    outline: '2px solid var(--color-accent-fill)',
    outlineOffset: '2px',
  },
} as const;

/**
 * 44px, the floor every touch target in this product clears (D73's shapes
 * note). Clerk's buttons, inputs and OTP boxes render at **32px** on their own
 * — measured on `/auth/login` at 1440 and at 390 — which is 12px under, on the
 * one form every member has to complete on a phone before they can use
 * anything.
 */
const TOUCH_TARGET = { minHeight: '44px', ...FOCUS_RING } as const;

/**
 * Clerk's appearance, as data.
 *
 * 🔴 It lives here rather than inline in `app/providers.tsx` so that
 * `theme/contrast.test.ts` can read it. The fill-only rule — carmine is a
 * background, never a foreground — was written in `tokens.ts`'s comments and
 * enforced nowhere, and this map broke it in two places at once: it handed
 * `colorPrimaryForeground` a token that flips with the scheme, and it let
 * `colorPrimary` colour the links as well as the button fill. Light "Continue"
 * measured 2.45:1, dark "Continue" 4.44:1, dark "Register" 3.79:1 — the only
 * contrast failures in the product (P17.T9).
 *
 * Every colour is a `var(--color-…)` string on purpose: Clerk reads the custom
 * properties at render, so the theme toggle drives this map with no second
 * theme context and no branch on the scheme (D36, D37). The test resolves the
 * same strings back through `flatPalette` and asserts the pairs.
 */
export const clerkAppearance = {
  variables: {
    colorBackground: 'var(--color-bg-panel)',
    colorPrimary: 'var(--color-accent-fill)',
    // 🔴 White, not text.primary. This slot is a pairing with a fill, and
    // text.primary flips with the scheme — near-white in dark, near-black in
    // light, which is how the light "Continue" button reached 2.45:1. White on
    // carmine is 5.23:1 dark and 7.33:1 light, and it is the pairing
    // accent.fill was measured for. `theme/index.ts` already does this for
    // MUI's primary.contrastText; this makes Clerk agree with it.
    colorPrimaryForeground: 'var(--color-accent-contrast)',
    colorForeground: 'var(--color-text-primary)',
    colorMutedForeground: 'var(--color-text-secondary)',
    colorInput: 'var(--color-bg-surface)',
    colorInputForeground: 'var(--color-text-primary)',
    colorBorder: 'var(--color-border-rule)',
    colorDanger: 'var(--color-accent-text)',
    // Buttons are always 6px, never the 2px Clerk shipped with (D73).
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-archivo)',
  },
  /**
   * 🔴 Clerk has no link colour. `colorPrimary` drives the primary button's
   * fill *and* every link in the card, and carmine as text is 3.79:1 on the
   * ground — the fill-only rule, broken by an API with one variable for two
   * jobs. Re-pointing them by selector is the only way to keep the fill
   * carmine and give the links the token built for carmine text.
   *
   * All four link elements, not just the one the review measured: the review
   * saw `footerActionLink` because that is what the sign-in card shows first,
   * and the other three inherit from exactly the same variable.
   */
  elements: {
    footerActionLink: { color: 'var(--color-accent-text)', ...FOCUS_RING },
    formResendCodeLink: { color: 'var(--color-accent-text)', ...FOCUS_RING },
    backLink: { color: 'var(--color-accent-text)', ...FOCUS_RING },
    footerPagesLink: { color: 'var(--color-accent-text)', ...FOCUS_RING },

    formButtonPrimary: TOUCH_TARGET,
    formFieldInput: TOUCH_TARGET,
    otpCodeFieldInput: TOUCH_TARGET,
    // 🔴 A surface step, not an outline — which is both what D67 asks for and
    // the only thing that survives. Clerk draws this button's edge as a 1px
    // box-shadow from `colorNeutral` at 7%, which on the dark ground is black
    // at 7%, so the Google button had no visible edge at all; and Clerk's own
    // rule wins over both `border` and `boxShadow` from this map (measured:
    // `border-top-width: 0px` carrying the token's colour, Clerk's shadow
    // still first). `background` does land, and `bg-surface` is the step this
    // control shares with the email field directly below it.
    socialButtonsBlockButton: {
      ...TOUCH_TARGET,
      background: 'var(--color-bg-surface)',
    },
    // Same 7%-of-black problem: the "or" rule between the two ways in was
    // invisible on the dark scheme. `border-rule` is the token for a line
    // whose whole job is to divide.
    dividerLine: { background: 'var(--color-border-rule)' },
  },
} satisfies Appearance;

/**
 * The extra appearance the **auth pages** pass to `SignIn` and `SignUp`.
 *
 * 🔴 Deliberately not in the map above, which `ClerkProvider` applies to every
 * Clerk surface in the app — the `UserButton` popover included. Flattening a
 * card is right when the card is already inside one of ours (the `Panel` in
 * `app/auth/layout.tsx`); doing it to a popover that floats over a page would
 * leave transparent text with nothing behind it. Clerk deep-merges a
 * component's `appearance` onto the provider's, so these are additions rather
 * than a second copy.
 *
 * What it fixes, measured on `/auth/login` at 1440 before the change: a 12px
 * radius on `cardBox` and an 8px one on `card`, where D73 gives the system
 * exactly one (6px); a 1px border and two drop shadows — `0 5px 15px` plus
 * `0 0 2px` — in a system that says in as many words that it has no shadows
 * and that no card wears a border; and a centred header inside a left-aligned
 * page. Separation on this page is the ground→panel step, once.
 */
export const authCardAppearance = {
  elements: {
    // 🔴 All three widths, or none. Clerk's card carries a 400px width of its
    // own; drop it without a replacement and the whole thing shrink-wraps to
    // its content — measured 253px inside a 400px panel, narrower than the
    // sentence above it.
    rootBox: { width: '100%' },
    cardBox: { width: '100%', boxShadow: 'none', borderRadius: 'var(--radius-sm)' },
    card: {
      width: '100%',
      padding: 0,
      boxShadow: 'none',
      background: 'transparent',
      // One axis for the page. The heading and the orientation line are
      // left-aligned like every other page in the app; a centred card header
      // between them is the seam you can see without measuring.
      textAlign: 'left',
    },
    // The footer keeps its top rule — that line divides, which is the one job
    // a border is allowed here (D67) — and drops the 32px inset that started
    // "Don't have an account?" well right of the form it belongs to.
    footer: { background: 'transparent', padding: 0 },
    footerAction: { paddingLeft: 0, paddingRight: 0 },
    footerItem: { paddingLeft: 0, paddingRight: 0 },
  },
} satisfies Appearance;

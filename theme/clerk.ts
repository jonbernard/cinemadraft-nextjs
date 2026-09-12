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
    colorBackground: 'var(--color-bg-surface)',
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
    colorInput: 'var(--color-bg-raised)',
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
    footerActionLink: { color: 'var(--color-accent-text)' },
    formResendCodeLink: { color: 'var(--color-accent-text)' },
    backLink: { color: 'var(--color-accent-text)' },
    footerPagesLink: { color: 'var(--color-accent-text)' },
  },
} satisfies Appearance;

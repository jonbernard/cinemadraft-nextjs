'use client';

import { ClerkProvider } from '@clerk/nextjs';
import CssBaseline from '@mui/material/CssBaseline';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { ThemeProvider } from '@mui/material/styles';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import type { ReactNode } from 'react';

import { SIGN_IN_URL, SIGN_UP_URL } from '@/lib/auth-routes';
import { theme } from '@/theme';
import { clerkAppearance } from '@/theme/clerk';

/**
 * `enableCssLayer` is what puts emotion's output into the `mui` cascade layer
 * declared in globals.css. Without it MUI's styles are emitted unlayered,
 * and unlayered CSS beats every layered rule — so every Tailwind utility
 * would silently lose to MUI. See D29.
 *
 * `InitColorSchemeScript` runs before paint and stamps the stored scheme onto
 * <html>. Without it a returning user on the light theme gets a frame of the
 * dark ground first, which on this palette is a black flash. It is also why
 * layout.tsx needs suppressHydrationWarning — the attribute it writes makes
 * the server markup and first client render legitimately differ.
 *
 * Clerk's `appearance` is expressed entirely as design tokens, so its inputs
 * and buttons follow the theme toggle along with everything else and no colour
 * is written here (D37). Clerk reads the CSS custom properties at render, so
 * this needs no theme branch — the same one-attribute switch drives it (D36).
 */
export function Providers({ children }: { children: ReactNode }) {
  // 🔴 No publishable key, no ClerkProvider (D84). The e2e run boots with Clerk
  // absent entirely and signs in through a test cookie instead, and mounting
  // the provider without a key is a hard render failure, not a degraded one.
  //
  // Deliberately keyed on the *publishable* key rather than on
  // `isTestAuthEnabled()`: this is a client component, and the flag lives in
  // the server environment. The difference is safe here because the worst a
  // missing key can do at this layer is fail to render the sign-in UI. Route
  // protection is the dangerous one, and `proxy.ts` guards that on the flag.
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return <Shell>{children}</Shell>;

  return (
    <ClerkProvider
      // The same two routes the proxy redirects to, from one source, so the
      // server's answer and the client's cannot drift. See lib/auth-routes.ts.
      signInUrl={SIGN_IN_URL}
      signUpUrl={SIGN_UP_URL}
      // 🔴 Clerk's components say "Sign in" and "Sign out" out of the box; the
      // app says "log in" and "log out" (D61). Its component *names* stay as
      // they are — `SignIn`, `UserButton` — because those are its API, not our
      // vocabulary. Only what a member reads is overridden.
      localization={{
        formButtonPrimary: 'Continue',
        signIn: {
          start: {
            // The instance runs the combined sign-in-or-up flow (P15.T4), so
            // this one card is both doors: a title that said only "Log in"
            // would read as the wrong place to a member who has never
            // registered — which is every member, until their first visit.
            title: 'Log in or register',
            subtitle: 'to continue to Cinemadraft',
            // Default is "Don't have an account? Sign up" — "Sign up" is the
            // one word that has to change; the question itself is fine.
            actionLink: 'Register',
          },
        },
        signUp: {
          start: {
            title: 'Register',
            subtitle: 'to continue to Cinemadraft',
            // Default is "Already have an account? Sign in".
            actionLink: 'Log in',
          },
        },
        userButton: { action__signOut: 'Log out' },
      }}
      appearance={clerkAppearance}
    >
      <Shell>{children}</Shell>
    </ClerkProvider>
  );
}

/**
 * Everything that is not Clerk. Extracted so the two branches above cannot
 * drift: the MUI providers, the layer option and the colour-scheme default are
 * the app's own and are identical with Clerk mounted or absent.
 */
function Shell({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <InitColorSchemeScript attribute="data-mui-color-scheme" defaultMode="dark" />
      {/* `defaultMode` must be set here as well as on the script above, and
        must match it. The theme's `defaultColorScheme` only names which
        palette CSS falls back to — the *mode* defaults to "system", so
        without this a first-time visitor whose OS is set to light gets the
        light theme. D15 makes dark the default regardless of the OS; the
        visitor can still choose, and their choice is what gets stored. */}
      <ThemeProvider theme={theme} defaultMode="dark">
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}

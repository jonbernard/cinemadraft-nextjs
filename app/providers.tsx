'use client';

import { ClerkProvider } from '@clerk/nextjs';
import CssBaseline from '@mui/material/CssBaseline';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { ThemeProvider } from '@mui/material/styles';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import type { ReactNode } from 'react';

import { theme } from '@/theme';

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
  return (
    <ClerkProvider
      // 🔴 Clerk's components say "Sign in" and "Sign out" out of the box; the
      // app says "log in" and "log out" (D61). Its component *names* stay as
      // they are — `SignIn`, `UserButton` — because those are its API, not our
      // vocabulary. Only what a member reads is overridden.
      localization={{
        formButtonPrimary: 'Continue',
        signIn: {
          start: { title: 'Log in', subtitle: 'to continue to Cinemadraft' },
        },
        signUp: {
          start: { title: 'Register', subtitle: 'to continue to Cinemadraft' },
        },
        userButton: { action__signOut: 'Log out' },
      }}
      appearance={{
        variables: {
          colorBackground: 'var(--color-bg-surface)',
          colorPrimary: 'var(--color-accent-fill)',
          // White on carmine is 6.58:1; carmine as text on the ground is
          // 2.96:1 and fails, which is why accent.fill is fill-only.
          colorPrimaryForeground: 'var(--color-text-primary)',
          colorForeground: 'var(--color-text-primary)',
          colorMutedForeground: 'var(--color-text-secondary)',
          colorInput: 'var(--color-bg-raised)',
          colorInputForeground: 'var(--color-text-primary)',
          colorBorder: 'var(--color-border-rule)',
          colorDanger: 'var(--color-accent-text)',
          borderRadius: '2px',
          fontFamily: 'var(--font-archivo)',
        },
      }}
    >
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
    </ClerkProvider>
  );
}

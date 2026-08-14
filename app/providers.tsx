'use client';

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
 */
export function Providers({ children }: { children: ReactNode }) {
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

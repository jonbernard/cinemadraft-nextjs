'use client';

import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { ReactNode } from 'react';

import { theme } from '@/theme';

/**
 * `enableCssLayer` is what puts emotion's output into the `mui` cascade layer
 * declared in globals.css. Without it MUI's styles are emitted unlayered,
 * and unlayered CSS beats every layered rule — so every Tailwind utility
 * would silently lose to MUI. See D29.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}

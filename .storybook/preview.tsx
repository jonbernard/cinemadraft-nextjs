// 🔴 First import. @layer order is fixed by first declaration, and this file
// is what establishes `theme, base, mui, components, utilities` inside the
// Storybook iframe.
import '../app/globals.css';

import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { Preview } from '@storybook/nextjs-vite';
import { useEffect } from 'react';
import { theme } from '../theme';
import { fontVariables } from '../theme/fonts';
import { SyncMode } from './SyncMode';

/**
 * Storybook never renders the root layout, so the font variables never reach
 * <html> and every `var(--font-archivo)` resolves to nothing. They are applied
 * to `document.documentElement` rather than a wrapper div because stories
 * render inside an iframe whose <html> is not ours.
 *
 * The loaders are imported from theme/fonts.ts rather than called again here —
 * calling a `next/font` loader a second time is a reported source of breakage,
 * and importing the real module is also what keeps Storybook from drifting
 * away from the app.
 */
function useFontVariables() {
  useEffect(() => {
    const root = document.documentElement;
    const classes = fontVariables.split(' ').filter(Boolean);
    root.classList.add(...classes);
    return () => root.classList.remove(...classes);
  }, []);
}

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: 'error' },
  },
  globalTypes: {
    colorScheme: {
      description: 'MUI colour scheme',
      toolbar: {
        title: 'Scheme',
        icon: 'contrast',
        items: [
          { value: 'dark', title: 'Dark' },
          { value: 'light', title: 'Light' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { colorScheme: 'dark' },
  decorators: [
    (Story, context) => {
      useFontVariables();
      const mode = context.globals.colorScheme as 'dark' | 'light';
      return (
        // 🔴 forceThemeRerender is required. With cssVariables: true MUI
        // deliberately does not re-render on a mode switch, so anything
        // branching on palette.mode in JS would not update in the toolbar.
        <ThemeProvider theme={theme} forceThemeRerender>
          <CssBaseline />
          <SyncMode mode={mode} />
          <div className="bg-bg-base text-text-primary p-6">
            <Story />
          </div>
        </ThemeProvider>
      );
    },
  ],
};

export default preview;

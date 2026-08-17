import { useColorScheme } from '@mui/material/styles';
import { useEffect } from 'react';

/**
 * 🔴 The only place allowed to set the colour scheme in Storybook.
 *
 * MUI *owns* `data-mui-color-scheme` — it is `InitColorSchemeScript`'s default
 * attribute. `@storybook/addon-themes`' `withThemeByDataAttribute` writes that
 * attribute directly, which creates two sources of truth: `useColorScheme()`
 * goes stale, `localStorage['mui-mode']` is never updated, and MUI can
 * overwrite the attribute on mount. Calling `setMode` keeps one source of
 * truth, and Tailwind's `@custom-variant dark` — which is bound to the same
 * attribute — then works with no extra plumbing.
 */
export function SyncMode({ mode }: { mode: 'dark' | 'light' }) {
  const { setMode } = useColorScheme();
  useEffect(() => {
    setMode(mode);
  }, [mode, setMode]);
  return null;
}

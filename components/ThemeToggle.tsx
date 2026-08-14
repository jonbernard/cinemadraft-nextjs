'use client';

import { useColorScheme } from '@mui/material/styles';
import { useCallback } from 'react';

/**
 * The light/dark switch (D15).
 *
 * `mode` is undefined until the client mounts — MUI cannot know the stored
 * scheme during SSR, and guessing would produce the flash
 * `InitColorSchemeScript` exists to prevent. Rendering the button disabled at
 * the same size holds the layout and stops a click landing before the handler
 * knows what it is switching from.
 */
export function ThemeToggle() {
  const { mode, setMode } = useColorScheme();
  const next = mode === 'dark' ? 'light' : 'dark';
  const toggle = useCallback(() => setMode(next), [setMode, next]);

  return (
    <button
      type="button"
      disabled={!mode}
      onClick={toggle}
      aria-label={mode ? `Switch to ${next} theme` : 'Theme'}
      className="border-border-rule text-text-secondary hover:text-text-primary min-w-24 border px-3 py-1 font-mono text-xs uppercase"
    >
      {mode ? `→ ${next}` : ' '}
    </button>
  );
}

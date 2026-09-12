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
 *
 * 🔴 The focus ring is explicit because without it this control fell back to
 * Chrome's default — measured `outline-style: auto`, `rgb(0, 95, 204)` — on a
 * palette where every neighbouring control in the same strip draws a 2px
 * carmine outline. `min-h-11` is the 44px target the same strip's buttons
 * already carry; this one rendered at 28px, which matters most in `MoreSheet`,
 * where it is pressed with a thumb.
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
      className="text-text-secondary hover:text-text-primary focus-visible:outline-accent-fill rounded-sm flex min-h-11 min-w-24 items-center justify-center px-3 py-1 text-sm focus-visible:outline-2"
    >
      {mode ? `→ ${next}` : ' '}
    </button>
  );
}

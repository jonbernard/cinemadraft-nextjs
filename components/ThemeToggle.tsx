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
 *
 * 🔴 **An icon, not the words "→ light".** The arrow-and-word form said what
 * would happen next, which reads as an instruction rather than a control and
 * cost 96px of a 52px-tall strip. The icon shows the *destination* — a moon
 * when a click would take you to dark, a sun when it would take you to light —
 * and the accessible name still says it in words, because an icon alone is a
 * guess. Drawn rather than an emoji: 🌙 and ☀️ render as somebody else's
 * artwork at somebody else's weight, and this product draws its own marks.
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
      title={mode ? `Switch to ${next} theme` : undefined}
      className="text-text-secondary hover:text-text-primary focus-visible:outline-accent-fill flex min-h-11 min-w-11 items-center justify-center rounded-sm focus-visible:outline-2"
    >
      {mode === 'dark' ? <SunIcon /> : mode === 'light' ? <MoonIcon /> : null}
    </button>
  );
}

/** Where a click would take you: the lit scheme. */
function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

/** Where a click would take you: the dark scheme. */
function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13.2A8.2 8.2 0 0 1 10.8 4a8.4 8.4 0 1 0 9.2 9.2Z" />
    </svg>
  );
}

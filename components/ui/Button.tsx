'use client';

import MuiButton, { type ButtonProps } from '@mui/material/Button';
import { forwardRef } from 'react';

/**
 * The one button.
 *
 * 🔴 Two accents, two jobs (D69). `carmine` is urgency — submit, deadline,
 * destructive. `brass` is awards — anything about a nomination or a win. A
 * brass "Delete league" or a carmine "Winner" is a bug, and having the prop
 * named after the job rather than the colour is what makes that reviewable.
 *
 * Radius is pinned at 6px here as well as in the theme: a theme value is a
 * default, and the brief named squared buttons specifically, so this one is
 * not left to a default that a later change could move.
 */
export const Button = forwardRef<
  HTMLButtonElement,
  ButtonProps & { accent?: 'carmine' | 'brass' }
>(function Button({ accent = 'carmine', sx, ...props }, ref) {
  return (
    <MuiButton
      ref={ref}
      variant={props.variant ?? 'contained'}
      disableElevation
      sx={{
        borderRadius: 'var(--radius-sm)',
        ...(accent === 'brass' && {
          backgroundColor: 'var(--color-brass-fill)',
          color: 'var(--color-brass-contrast)',
          '&:hover': {
            backgroundColor: 'var(--color-brass-fill)',
            filter: 'brightness(1.08)',
          },
        }),
        ...sx,
      }}
      {...props}
    />
  );
});

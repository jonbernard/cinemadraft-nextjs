import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useColorScheme = vi.hoisted(() => vi.fn());
vi.mock('@mui/material/styles', () => ({ useColorScheme }));

import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  const setMode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows where a press would take you, not where you are', () => {
    // 🔴 The icon is the destination. In dark it offers the sun, because a
    // press lights the room — an icon of the *current* scheme would be a
    // status light on a control, which is the commonest way this widget is
    // built wrong.
    useColorScheme.mockReturnValue({ mode: 'dark', setMode });
    const { unmount } = render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
    expect(screen.getByRole('button').querySelector('circle')).not.toBeNull();
    unmount();

    useColorScheme.mockReturnValue({ mode: 'light', setMode });
    render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
    // The moon is a single path; the sun carries a circle and its rays.
    expect(screen.getByRole('button').querySelector('circle')).toBeNull();
  });

  it('says in words what the icon shows, because an icon alone is a guess', () => {
    useColorScheme.mockReturnValue({ mode: 'dark', setMode });
    render(<ThemeToggle />);

    const button = screen.getByRole('button');
    expect(button).toHaveAccessibleName('Switch to light theme');
    // Every glyph inside is decorative; the name comes from the label.
    for (const svg of button.querySelectorAll('svg')) {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('holds its place and refuses the press before the scheme is known', () => {
    // `mode` is undefined until the client mounts. A control that changed
    // size on hydration would shift the strip it sits in.
    useColorScheme.mockReturnValue({ mode: undefined, setMode });
    render(<ThemeToggle />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.className).toMatch(/min-h-11/);
    expect(button.className).toMatch(/min-w-11/);
  });
});

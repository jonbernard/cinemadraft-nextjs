import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TopBar } from './TopBar';

describe('TopBar', () => {
  it('is the wordmark, linked home', () => {
    render(<TopBar />);
    const link = screen.getByRole('link', { name: /cinemadraft, home/i });
    expect(link).toHaveAttribute('href', '/');
    // 🔴 The full lockup, not the mark alone — the mark alone in the bottom
    // bar is the thing being replaced.
    expect(screen.getByRole('img', { name: 'Cinemadraft' })).toBeInTheDocument();
  });

  it('is the phone and tablet bar only', () => {
    // The rail carries identity from `xl` up; two wordmarks at once is a
    // duplicate landmark and a duplicate link to `/`.
    const { container } = render(<TopBar />);
    expect(container.firstElementChild?.className).toContain('xl:hidden');
  });

  it('carries the TV-mode hook', () => {
    // 🔴 Without it, TV mode leaves a bar on screen at any width a browser can
    // be made full-screen at (D112).
    const { container } = render(<TopBar />);
    expect(container.firstElementChild).toHaveAttribute('data-app-chrome');
  });

  it('reserves its own height rather than overlapping the page', () => {
    // `sticky`, not `fixed`: a fixed bar would put the first heading of every
    // page underneath it and need a compensating padding-top on `<main>` —
    // a second number to keep in step. The bottom bar already owns one.
    // 🔴 This reads a class name. jsdom lays nothing out, so it cannot see a
    // `sticky` silently degraded to `static` by an ancestor's `overflow` or
    // `transform`. `getComputedStyle(bar).position` in a production build is
    // the real check; this only stops the class being dropped.
    const { container } = render(<TopBar />);
    const className = container.firstElementChild?.className ?? '';
    expect(className).toContain('sticky');
    expect(className).not.toContain('fixed');
  });

  it('gives the link a 44px target', () => {
    render(<TopBar />);
    expect(screen.getByRole('link', { name: /cinemadraft, home/i }).className).toMatch(
      /min-h-11/,
    );
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs', () => ({
  UserButton: () => <button type="button">Account</button>,
}));

import { TopBar } from './TopBar';

function renderBar(over: Partial<Parameters<typeof TopBar>[0]> = {}) {
  return render(
    <TopBar isSignedIn={false} onSearch={vi.fn()} searchId="search" {...over} />,
  );
}

// 🔴 `AccountControl` renders Clerk's `UserButton` only when a publishable key
// is present (D84), so each case states its world rather than inheriting
// whichever `.env.local` the machine has — CI has none.
beforeEach(() => vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', ''));
afterEach(() => vi.unstubAllEnvs());

describe('TopBar', () => {
  it('is the wordmark, linked home', () => {
    renderBar();
    const link = screen.getByRole('link', { name: /cinemadraft, home/i });
    expect(link).toHaveAttribute('href', '/');
    // 🔴 The full lockup, not the mark alone — the mark alone in the bottom
    // bar is the thing being replaced.
    expect(screen.getByRole('img', { name: 'Cinemadraft' })).toBeInTheDocument();
  });

  it('is the phone and tablet bar only', () => {
    // The rail carries identity from `xl` up; two wordmarks at once is a
    // duplicate landmark and a duplicate link to `/`.
    const { container } = renderBar();
    expect(container.firstElementChild?.className).toContain('xl:hidden');
  });

  it('carries the TV-mode hook', () => {
    // 🔴 Without it, TV mode leaves a bar on screen at any width a browser can
    // be made full-screen at (D112).
    const { container } = renderBar();
    expect(container.firstElementChild).toHaveAttribute('data-app-chrome');
  });

  it('reserves its own height rather than overlapping the page', () => {
    // `sticky`, not `fixed`: a fixed bar would put the first heading of every
    // page underneath it and need a compensating padding-top on `<main>` —
    // a second number to keep in step. The bottom bar already owns one.
    // 🔴 This reads a class name. jsdom lays nothing out, so it cannot see a
    // `sticky` silently degraded to `static` by an ancestor's `overflow` or
    // `transform`. `e2e/nav.spec.ts` reads `getComputedStyle(bar).position` in
    // a production build; this only stops the class being dropped.
    const { container } = renderBar();
    const className = container.firstElementChild?.className ?? '';
    expect(className).toContain('sticky');
    expect(className).not.toContain('fixed');
  });

  // 🔴 D128: the owner moved both here from the bottom bar. Every control in
  // the row, not just the link, has the 44px floor.
  it('gives every control a 44px target', () => {
    renderBar();
    for (const control of [
      screen.getByRole('link', { name: /cinemadraft, home/i }),
      screen.getByRole('button', { name: 'Search' }),
      screen.getByRole('link', { name: 'Log in' }),
    ]) {
      expect(control.className).toMatch(/min-h-11/);
    }
  });

  it('opens the search panel through the caller', async () => {
    const onSearch = vi.fn();
    renderBar({ onSearch });
    const search = screen.getByRole('button', { name: 'Search' });
    expect(search).toHaveAttribute('aria-haspopup', 'dialog');
    expect(search).toHaveAttribute('aria-controls', 'search');
    await userEvent.click(search);
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it('offers a signed-out reader a way in', () => {
    renderBar();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/auth/login',
    );
  });

  it('shows a signed-in reader their account control instead', () => {
    renderBar({ isSignedIn: true });
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it("shows Clerk's account menu when Clerk is configured", () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_topbar');
    renderBar({ isSignedIn: true });
    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
  });

  // The wordmark first, then search, then the account control: the reading
  // order is the visual order, left to right.
  it('puts the chrome after the wordmark, account last', () => {
    const { container } = renderBar();
    const order = [...container.querySelectorAll('a, button')].map(
      (element) => element.getAttribute('aria-label') ?? element.textContent?.trim(),
    );
    expect(order).toEqual(['Cinemadraft, home', 'Search', 'Log in']);
  });
});

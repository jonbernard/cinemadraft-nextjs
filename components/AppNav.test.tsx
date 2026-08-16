import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const usePathname = vi.hoisted(() => vi.fn(() => '/'));
vi.mock('next/navigation', () => ({ usePathname }));
vi.mock('@clerk/nextjs', () => ({
  UserButton: () => <button type="button">Account</button>,
}));

import { AppNav } from '@/components/AppNav';

/**
 * The shell that makes everything else reachable.
 *
 * Both presentations render at once in jsdom — no CSS decides which is
 * visible — so assertions are scoped to one of the two `<nav>` elements the
 * same way `DraftBoard`'s are (D49).
 */
const desktop = () => screen.getAllByRole('navigation')[0] as HTMLElement;
const phone = () => screen.getAllByRole('navigation')[1] as HTMLElement;

describe('AppNav', () => {
  it('🔴 offers four destinations, not the source app’s seven (§6.9)', () => {
    // Browse, Watchlist and Draft List are views of one idea and live under
    // Films; Rules & Scoring is contextual help in the ledger.
    usePathname.mockReturnValue('/');
    render(<AppNav isSignedIn={false} />);

    const labels = within(desktop())
      .getAllByRole('link')
      .map((link) => link.textContent?.trim())
      // The wordmark links home too, and is not a destination.
      .filter((label) => label !== 'Cinemadraft' && label !== 'Log in');

    expect(labels).toEqual(['Home', 'Films', 'Award shows', 'Leagues']);
  });

  it('renders the same destinations on a phone', () => {
    usePathname.mockReturnValue('/');
    render(<AppNav isSignedIn={false} />);

    expect(within(phone()).getAllByRole('link')).toHaveLength(4);
  });

  it('🔴 marks the current page for assistive technology, not by colour alone', () => {
    usePathname.mockReturnValue('/leagues/1');
    render(<AppNav isSignedIn />);

    const current = within(desktop())
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');

    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain('Leagues');
  });

  it('treats Home as current only on the dashboard itself', () => {
    // `startsWith` would make "/" match every page in the app.
    usePathname.mockReturnValue('/films');
    render(<AppNav isSignedIn />);

    const current = within(desktop())
      .getAllByRole('link')
      .find((link) => link.getAttribute('aria-current') === 'page');

    expect(current?.textContent).toContain('Films');
  });

  it('🔴 every target clears the 44px minimum', () => {
    // Tailwind's min-h-11 is 2.75rem = 44px; min-h-14 is 56px. Asserted on the
    // class because jsdom computes no layout — the point is that the rule is
    // present and cannot be dropped silently.
    usePathname.mockReturnValue('/');
    render(<AppNav isSignedIn />);

    for (const link of within(desktop()).getAllByRole('link')) {
      if (link.textContent?.trim() === 'Cinemadraft') continue;
      expect(link.className).toMatch(/min-h-(11|14)/);
    }
    for (const link of within(phone()).getAllByRole('link')) {
      expect(link.className).toMatch(/min-h-(11|14)/);
    }
  });

  it('every destination carries a visible label beside its icon', () => {
    // Icon-only navigation harms discoverability, and most members open this
    // app once a year.
    usePathname.mockReturnValue('/');
    render(<AppNav isSignedIn />);

    for (const link of within(phone()).getAllByRole('link')) {
      expect(link.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it('shows the account menu when signed in', () => {
    usePathname.mockReturnValue('/');
    render(<AppNav isSignedIn />);

    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
  });

  it('🔴 shows a signed-out visitor the whole nav, plus a way in', () => {
    // The dashboard and league boards are public (D44) — a visitor on a shared
    // link must be able to move around, not be stranded on one page.
    usePathname.mockReturnValue('/');
    render(<AppNav isSignedIn={false} />);

    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(within(phone()).getAllByRole('link')).toHaveLength(4);
  });
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const usePathname = vi.hoisted(() => vi.fn(() => '/'));
vi.mock('next/navigation', () => ({ usePathname }));
vi.mock('@clerk/nextjs', () => ({
  UserButton: () => <button type="button">Account</button>,
}));

import { AppNav } from '@/components/AppNav';
import { NAV_LINKS } from '@/lib/nav/links';

/**
 * The shell that makes everything else reachable.
 *
 * Both presentations render at once in jsdom — no CSS decides which is
 * visible — so assertions are scoped: the header is the `<nav>`, the drawer is
 * the `<dialog>`, the same way `DraftBoard`'s two presentations are (D49).
 */
const header = () => screen.getByRole('navigation');
const drawer = () => screen.getByLabelText('Main menu');

/** Destinations whose pages exist today; the rest are still owed. */
const READY = NAV_LINKS.filter((link) => link.ready).map((link) => link.label);

/**
 * Open the drawer before reading it.
 *
 * A closed `<dialog>` hides its contents from the accessibility tree — correct
 * behaviour, and the reason a query for its links finds nothing until it is
 * opened. Asserting through the real interaction is the more honest test.
 */
async function openDrawer() {
  await userEvent.setup().click(screen.getByRole('button', { name: 'Menu' }));
  return drawer();
}

describe('AppNav', () => {
  it('🔴 carries the source app’s seven destinations (D62)', () => {
    // §6.9 proposed consolidating to four; the owner kept the seven the league
    // already knows the app by. Entries appear as their pages are built, so
    // this asserts the full set exists rather than that all seven render.
    expect(NAV_LINKS.map((link) => link.label)).toEqual([
      'Home',
      'Leagues',
      'Browse',
      'Award shows',
      'Watchlist',
      'Draft list',
      'Rules & scoring',
    ]);
  });

  it('🔴 links only to pages that exist', () => {
    // A nav entry pointing at a 404 is worse than a missing one.
    usePathname.mockReturnValue('/');
    render(<AppNav isSignedIn={false} />);

    const labels = within(header())
      .getAllByRole('link')
      .map((link) => link.textContent?.trim())
      .filter((label) => label !== 'Cinemadraft' && label !== 'Log in');

    expect(labels).toEqual(READY);
  });

  it('offers the same destinations in the drawer', async () => {
    usePathname.mockReturnValue('/');
    render(<AppNav isSignedIn={false} />);

    const panel = await openDrawer();

    expect(within(panel).getAllByRole('link')).toHaveLength(READY.length);
  });

  it('🔴 the trigger reports whether the drawer is open', async () => {
    usePathname.mockReturnValue('/');
    render(<AppNav isSignedIn={false} />);
    const trigger = screen.getByRole('button', { name: 'Menu' });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await openDrawer();

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes when a destination is chosen', async () => {
    // A drawer left open across a navigation covers the page it just reached.
    usePathname.mockReturnValue('/');
    render(<AppNav isSignedIn={false} />);
    const panel = await openDrawer();

    await userEvent.setup().click(within(panel).getAllByRole('link')[0] as HTMLElement);

    expect(panel).not.toHaveAttribute('open');
  });

  it('🔴 the phone menu is a native dialog, so Escape and focus are the platform’s job', () => {
    // Seven items will not fit a bottom bar at 44px targets, so this is a
    // drawer — and a <dialog> supplies the focus trap, Escape and the inert
    // background that a hand-rolled one usually gets wrong.
    usePathname.mockReturnValue('/');
    render(<AppNav isSignedIn={false} />);

    expect(drawer().tagName).toBe('DIALOG');
  });

  it('🔴 marks the current page for assistive technology, not by colour alone', () => {
    usePathname.mockReturnValue('/leagues/1');
    render(<AppNav isSignedIn />);

    const current = within(header())
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');

    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain('Leagues');
  });

  it('treats Home as current only on the dashboard itself', () => {
    // `startsWith` would make "/" match every page in the app.
    usePathname.mockReturnValue('/leagues');
    render(<AppNav isSignedIn />);

    const current = within(header())
      .getAllByRole('link')
      .find((link) => link.getAttribute('aria-current') === 'page');

    expect(current?.textContent).toContain('Leagues');
  });

  it('🔴 every target clears the 44px minimum', async () => {
    // Tailwind's min-h-11 is 2.75rem = 44px; min-h-14 is 56px. Asserted on the
    // class because jsdom computes no layout — the point is that the rule is
    // present and cannot be dropped silently.
    usePathname.mockReturnValue('/');
    render(<AppNav isSignedIn />);

    for (const link of within(header()).getAllByRole('link')) {
      if (link.textContent?.trim() === 'Cinemadraft') continue;
      expect(link.className).toMatch(/min-h-(11|14)/);
    }
    for (const link of within(await openDrawer()).getAllByRole('link')) {
      expect(link.className).toMatch(/min-h-(11|12|14)/);
    }
  });

  it('every destination carries a visible label beside its icon', async () => {
    // Icon-only navigation harms discoverability, and most members open this
    // app once a year.
    usePathname.mockReturnValue('/');
    render(<AppNav isSignedIn />);

    for (const link of within(await openDrawer()).getAllByRole('link')) {
      expect(link.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it('shows the account menu when signed in', () => {
    usePathname.mockReturnValue('/');
    render(<AppNav isSignedIn />);

    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
  });

  it('🔴 shows a logged-out visitor the whole nav, plus a way in', async () => {
    // The dashboard and league boards are public (D44) — a visitor on a shared
    // link must be able to move around, not be stranded on one page.
    usePathname.mockReturnValue('/');
    render(<AppNav isSignedIn={false} />);

    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(within(await openDrawer()).getAllByRole('link')).toHaveLength(READY.length);
  });
});

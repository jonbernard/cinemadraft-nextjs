import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const usePathname = vi.hoisted(() => vi.fn(() => '/'));
vi.mock('next/navigation', () => ({ usePathname }));
vi.mock('@clerk/nextjs', () => ({
  UserButton: () => <button type="button">Account</button>,
}));

import { AppShell } from '@/components/AppShell';
import { PRIMARY_LINKS } from '@/lib/nav/links';

/**
 * The shell that makes everything else reachable.
 *
 * Both presentations — the desktop rail/strip and the phone tabs/sheet —
 * render at once in jsdom; no CSS decides which is visible. Assertions scope
 * to a named navigation the same way `AppNav`'s own test scoped to its header
 * vs. its drawer (D49's pattern, carried forward).
 */
const rail = () => screen.getByRole('navigation', { name: 'Main' });
const tabs = () => screen.getByRole('navigation', { name: 'Primary, mobile' });
const sheet = () => screen.getByLabelText('More');

/** Destinations whose pages exist today; `NavRail` only shows these. */
const READY_PRIMARY = PRIMARY_LINKS.filter((link) => link.ready).map(
  (link) => link.label,
);

/**
 * Open the sheet before reading it.
 *
 * A closed `<dialog>` hides its contents from the accessibility tree —
 * correct behaviour, and the reason a query for its links finds nothing until
 * it is opened.
 */
async function openMore() {
  await userEvent.setup().click(screen.getByRole('button', { name: 'More' }));
  return sheet();
}

describe('AppShell', () => {
  it('renders the children inside the content panel', () => {
    render(
      <AppShell isSignedIn={false}>
        <p>Board</p>
      </AppShell>,
    );
    expect(screen.getByText('Board')).toBeInTheDocument();
  });

  it('renders exactly one main landmark', () => {
    render(<AppShell isSignedIn={false}>content</AppShell>);
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  // Both navigations exist in the DOM at once; CSS decides which is visible.
  // Two elements with the same accessible name would make the landmark list
  // ambiguous for a screen reader, so they are named apart.
  it('names its two navigations distinctly', () => {
    render(<AppShell isSignedIn={false}>content</AppShell>);
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Primary, mobile' }),
    ).toBeInTheDocument();
  });

  it('🔴 links only to pages that exist', () => {
    // A nav entry pointing at a 404 is worse than a missing one.
    usePathname.mockReturnValue('/');
    render(<AppShell isSignedIn={false}>content</AppShell>);

    const labels = within(rail())
      .getAllByRole('link')
      .map((link) => link.textContent?.trim())
      .filter((label) => label !== 'Cinemadraft');

    expect(labels).toEqual(READY_PRIMARY);
  });

  it('🔴 the More trigger reports whether the sheet is open', async () => {
    usePathname.mockReturnValue('/');
    render(<AppShell isSignedIn={false}>content</AppShell>);
    const trigger = screen.getByRole('button', { name: 'More' });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await openMore();

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes the sheet after a navigation', async () => {
    // A sheet left open across a navigation would cover the page it just
    // reached. Unlike AppNav's old drawer, MoreSheet's links carry no
    // onClick-to-close — closing is driven by the pathname changing
    // underneath it, ported verbatim from AppNav's useEffect.
    usePathname.mockReturnValue('/');
    const { rerender } = render(<AppShell isSignedIn={false}>content</AppShell>);
    await openMore();
    expect(sheet()).toHaveAttribute('open');

    usePathname.mockReturnValue('/leagues');
    rerender(<AppShell isSignedIn={false}>content</AppShell>);

    expect(sheet()).not.toHaveAttribute('open');
  });

  it('🔴 the phone sheet is a native dialog, so Escape and focus are the platform’s job', () => {
    usePathname.mockReturnValue('/');
    render(<AppShell isSignedIn={false}>content</AppShell>);

    expect(sheet().tagName).toBe('DIALOG');
  });

  it('🔴 marks the current page for assistive technology, not by colour alone', () => {
    usePathname.mockReturnValue('/leagues/1');
    render(<AppShell isSignedIn>content</AppShell>);

    const current = within(rail())
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');

    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain('Leagues');
  });

  it('treats Home as current only on the dashboard itself', () => {
    // `startsWith` would make "/" match every page in the app.
    usePathname.mockReturnValue('/leagues');
    render(<AppShell isSignedIn>content</AppShell>);

    const current = within(rail())
      .getAllByRole('link')
      .find((link) => link.getAttribute('aria-current') === 'page');

    expect(current?.textContent).toContain('Leagues');
  });

  it('🔴 every target clears the 44px minimum', async () => {
    // Tailwind's min-h-11 is 2.75rem = 44px. Asserted on the class because
    // jsdom computes no layout — the point is that the rule is present and
    // cannot be dropped silently.
    usePathname.mockReturnValue('/');
    render(<AppShell isSignedIn>content</AppShell>);

    for (const link of within(rail()).getAllByRole('link')) {
      if (link.textContent?.trim() === 'Cinemadraft') continue;
      expect(link.className).toMatch(/min-h-(11|14)/);
    }
    for (const link of within(tabs()).getAllByRole('link')) {
      expect(link.className).toMatch(/min-h-(11|12|14)/);
    }
  });

  it('every destination carries a visible label beside its icon', () => {
    // Icon-only navigation harms discoverability, and most members open this
    // app once a year.
    usePathname.mockReturnValue('/');
    render(<AppShell isSignedIn>content</AppShell>);

    for (const link of within(rail()).getAllByRole('link')) {
      if (link.textContent?.trim() === 'Cinemadraft') continue;
      expect(link.textContent?.trim().length).toBeGreaterThan(0);
    }
    for (const link of within(tabs()).getAllByRole('link')) {
      expect(link.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it('shows the account menu when signed in', () => {
    usePathname.mockReturnValue('/');
    render(<AppShell isSignedIn>content</AppShell>);

    expect(screen.getAllByRole('button', { name: 'Account' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
  });

  it('🔴 shows a logged-out visitor the whole nav, plus a way in', () => {
    // The dashboard and league boards are public (D44) — a visitor on a
    // shared link must be able to move around, not be stranded on one page.
    usePathname.mockReturnValue('/');
    render(<AppShell isSignedIn={false}>content</AppShell>);

    expect(screen.getAllByRole('link', { name: 'Log in' }).length).toBeGreaterThan(0);
    expect(within(rail()).getAllByRole('link').length).toBeGreaterThan(1);
  });
});

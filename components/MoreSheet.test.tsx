import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs', () => ({
  UserButton: () => <button type="button">Account</button>,
}));

import type { NavLink } from '@/lib/nav/links';
import { MoreSheet } from './MoreSheet';

// A module-level constant rather than a literal on the JSX attribute: Biome's
// useUniqueElementIds rule flags any hardcoded `id="..."` regardless of
// whether the component actually renders more than once, and this render is
// scoped to one test each (`afterEach(cleanup)` in vitest.setup.ts).
const MORE_ID = 'more';

// All three real `yours` links are `ready: false` until Phase 10 ships one,
// so the populated group is otherwise unreachable here — the same fixture
// `NavRail.stories.tsx` injects for the same reason.
const readyYours: NavLink[] = [
  {
    href: '/watchlist',
    label: 'Watchlist',
    ready: true,
    path: 'M6 3h12v18l-6-4.5L6 21z',
    group: 'yours',
  },
  {
    href: '/list',
    label: 'Draft list',
    ready: true,
    path: 'M4 6h16M4 12h16M4 18h10M18 16v5M15.5 18.5h5',
    group: 'yours',
  },
  {
    href: '/rules-and-scoring',
    label: 'Rules & scoring',
    ready: true,
    path: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 8v5M12 16h.01',
    group: 'yours',
  },
];

/** The same three, as they were before any of their pages existed. */
const unreadyYours: NavLink[] = readyYours.map((link) => ({ ...link, ready: false }));

/**
 * Structure only. jsdom implements neither `showModal()` nor the focus trap,
 * so open/close behaviour, focus trapping and Escape are Task 17's job in a
 * real browser — this only asserts what is always present in the DOM.
 *
 * The dialog is closed in every test (no `open` attribute), so its contents
 * are hidden from the accessibility tree by default — correct behaviour, and
 * the reason every query below passes `{ hidden: true }` rather than
 * asserting through a real `showModal()` open, which jsdom cannot do.
 */
describe('MoreSheet', () => {
  it('is a dialog with an accessible name', () => {
    render(<MoreSheet id={MORE_ID} ref={createRef()} pathname="/" isSignedIn={false} />);
    // A closed dialog carries no implicit ARIA role, so this queries by its
    // `aria-label` directly rather than by role — the same reason `AppNav`'s
    // own drawer test finds its dialog by `getByLabelText` instead.
    expect(screen.getByLabelText('More').tagName).toBe('DIALOG');
  });

  it('renders the three yours destinations when they are ready', () => {
    render(
      <MoreSheet
        id={MORE_ID}
        ref={createRef()}
        pathname="/"
        isSignedIn={false}
        yours={readyYours}
      />,
    );
    for (const label of ['Watchlist', 'Draft list', 'Rules & scoring']) {
      expect(screen.getByRole('link', { hidden: true, name: label })).toBeInTheDocument();
    }
  });

  // 🔴 A nav entry pointing at a 404 is worse than a missing one, and the
  // heading must not float above an empty list either — the trap Task 14 hit.
  // Injected rather than read off the real data, which now has `/list` ready.
  it('hides the yours group entirely while every destination is unready', () => {
    render(
      <MoreSheet
        id={MORE_ID}
        ref={createRef()}
        pathname="/"
        isSignedIn={false}
        yours={unreadyYours}
      />,
    );
    expect(screen.queryByText('Yours')).toBeNull();
    for (const label of ['Watchlist', 'Draft list', 'Rules & scoring']) {
      expect(screen.queryByRole('link', { hidden: true, name: label })).toBeNull();
    }
    // The theme toggle and account control are unconditional — only the
    // yours group and its divider are gated.
    expect(
      screen.getByRole('button', { hidden: true, name: /theme/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { hidden: true, name: 'Log in' }),
    ).toBeInTheDocument();
  });

  it('renders the theme toggle', () => {
    render(<MoreSheet id={MORE_ID} ref={createRef()} pathname="/" isSignedIn={false} />);
    expect(
      screen.getByRole('button', { hidden: true, name: /theme/i }),
    ).toBeInTheDocument();
  });

  it('shows a log in link when signed out', () => {
    render(<MoreSheet id={MORE_ID} ref={createRef()} pathname="/" isSignedIn={false} />);
    expect(
      screen.getByRole('link', { hidden: true, name: 'Log in' }),
    ).toBeInTheDocument();
  });

  it('shows the account control when signed in', () => {
    render(<MoreSheet id={MORE_ID} ref={createRef()} pathname="/" isSignedIn />);
    expect(
      screen.getByRole('button', { hidden: true, name: 'Account' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { hidden: true, name: 'Log in' })).toBeNull();
  });
});

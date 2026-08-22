import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs', () => ({
  UserButton: () => <button type="button">Account</button>,
}));

import { MoreSheet } from './MoreSheet';

// A module-level constant rather than a literal on the JSX attribute: Biome's
// useUniqueElementIds rule flags any hardcoded `id="..."` regardless of
// whether the component actually renders more than once, and this render is
// scoped to one test each (`afterEach(cleanup)` in vitest.setup.ts).
const MORE_ID = 'more';

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

  it('renders the three yours destinations', () => {
    render(<MoreSheet id={MORE_ID} ref={createRef()} pathname="/" isSignedIn={false} />);
    for (const label of ['Watchlist', 'Draft list', 'Rules & scoring']) {
      expect(screen.getByRole('link', { hidden: true, name: label })).toBeInTheDocument();
    }
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

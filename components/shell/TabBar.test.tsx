import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs', () => ({
  UserButton: () => <button type="button">Account</button>,
}));

import { TabBar } from './TabBar';

const tabs = () => screen.getByRole('navigation', { name: 'Primary, mobile' });

function renderBar(over: Partial<Parameters<typeof TabBar>[0]> = {}) {
  return render(
    <TabBar pathname="/" onMore={vi.fn()} isMoreOpen={false} moreId="more" {...over} />,
  );
}

// 🔴 The bar renders no `AccountControl` since D127, and the Clerk mock and key
// stay so that if one comes back it renders the same shape on every machine:
// `vitest.setup.ts` loads `.env.local`, which supplies a real key on a
// developer's machine and none on CI.
beforeEach(() => vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', ''));
afterEach(() => vi.unstubAllEnvs());

describe('TabBar', () => {
  // 🔴 D75. Five slots is the ceiling before 44px touch targets stop fitting on
  // a 390px phone, which is why the seventh, sixth and fifth destinations moved
  // behind More rather than being dropped.
  it('the navigation landmark holds four destinations plus More, and nothing else', () => {
    renderBar();
    expect(within(tabs()).getAllByRole('link')).toHaveLength(4);
    expect(within(tabs()).getByRole('button', { name: 'More' })).toBeInTheDocument();
    expect(within(tabs()).getAllByRole('button')).toHaveLength(1);
  });

  // 🔴 D127. The owner moved search and the account control to `TopBar`:
  // "move the search button and the user auth menu/profile image button from
  // the bottom nav to the top nav". Asserted on the whole bar, not the
  // landmark — they used to sit beside the `<nav>`, outside it, so a check
  // scoped to the landmark would pass with them still here.
  it("carries no search and no account control — they are TopBar's now", () => {
    renderBar();
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Account' })).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  // 🔴 P14.T16 moved the identity to `components/shell/TopBar.tsx`, and this
  // asserts it did not stay here as well. Deleting the case instead would let
  // the mark come back and leave the app with two links home below `xl` — a
  // duplicate on every phone and tablet. The `markOnly` square this replaces
  // was `hidden sm:flex`, so below `sm` there was no wordmark in the
  // application at all, which is the defect the owner reported.
  it("does not carry the wordmark — it is TopBar's now", () => {
    renderBar();
    expect(screen.queryByRole('link', { name: 'Cinemadraft, home' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'Cinemadraft' })).toBeNull();
  });

  it('every tab still carries a text label, not an icon alone', () => {
    renderBar();
    for (const label of ['Home', 'Leagues', 'Browse', 'Award shows']) {
      expect(within(tabs()).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('reports the sheet state', async () => {
    const onMore = vi.fn();
    renderBar({ onMore });
    const more = within(tabs()).getByRole('button', { name: 'More' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(more).toHaveAttribute('aria-controls', 'more');
    await userEvent.click(more);
    expect(onMore).toHaveBeenCalledOnce();
  });
});

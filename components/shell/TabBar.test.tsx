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
    <TabBar
      pathname="/"
      onMore={vi.fn()}
      isMoreOpen={false}
      moreId="more"
      isSignedIn={false}
      onSearch={vi.fn()}
      searchId="search"
      {...over}
    />,
  );
}

// 🔴 `AccountControl` renders Clerk's `UserButton` only when a publishable key
// is present (D84). `vitest.setup.ts` loads `.env.local`, which supplies a real
// key on a developer's machine and none on CI — so the world is stated here
// rather than inherited, the same way `AppShell.test.tsx` states it.
beforeEach(() => vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', ''));
afterEach(() => vi.unstubAllEnvs());

describe('TabBar', () => {
  // 🔴 D75. Five slots is the ceiling before 44px touch targets stop fitting on
  // a 390px phone, which is why the seventh, sixth and fifth destinations moved
  // behind More rather than being dropped. The bar now carries chrome as well,
  // and this is the assertion that keeps the chrome from becoming a sixth
  // destination: it is scoped to the landmark, and the landmark holds
  // destinations only.
  it('the navigation landmark holds four destinations plus More, and nothing else', () => {
    renderBar();
    expect(within(tabs()).getAllByRole('link')).toHaveLength(4);
    expect(within(tabs()).getByRole('button', { name: 'More' })).toBeInTheDocument();
    expect(within(tabs()).getAllByRole('button')).toHaveLength(1);
  });

  it('the chrome sits outside the landmark, so it is not a sixth tab', () => {
    renderBar();

    // Present on the bar...
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();

    // ...and neither of them inside the destination list.
    expect(within(tabs()).queryByRole('button', { name: 'Search' })).toBeNull();
    expect(within(tabs()).queryByRole('link', { name: 'Log in' })).toBeNull();
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

  it('no chrome control ever claims to be the current page', () => {
    renderBar({ pathname: '/' });
    expect(screen.getByRole('link', { name: 'Log in' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('button', { name: 'Search' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  // 🔴 Measured, not assumed (P17.T2 Step 1). At 390px "Award shows" renders
  // 64.8px wide and the five slots have 78px each — 390px of bar with no slack
  // in it. Subtracting even two 44px chrome squares drops a slot to 60.4px, the
  // label wraps to two lines and the bar grows from 48.5px to 65px, which is
  // the one thing folding the chrome in was chosen to avoid. So the chrome is
  // `hidden sm:flex`: it exists from 640px up, which covers the 1024–1280px
  // dead zone P17.T2 was about, and below `sm` the phone bar is untouched and
  // search and the account control stay in the More sheet where D75 put them.
  // Two squares now, not three — P14.T16 took the mark out to `TopBar`, which
  // is the one piece of that group a phone could not do without.
  // The class is the only part of that a jsdom test can see; `e2e/nav.spec.ts`
  // measures the geometry.
  it('keeps the chrome off the bar below sm, where it does not fit', () => {
    renderBar();
    for (const element of [
      screen.getByRole('button', { name: 'Search' }),
      screen.getByRole('link', { name: 'Log in' }).parentElement,
    ]) {
      expect(element?.className).toMatch(/\bhidden\b/);
      expect(element?.className).toMatch(/\bsm:flex\b/);
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

  it('shows a signed-in reader their account control instead of a way in', () => {
    renderBar({ isSignedIn: true });
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
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

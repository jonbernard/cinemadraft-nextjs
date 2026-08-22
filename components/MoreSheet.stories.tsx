import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect, useRef } from 'react';

import type { NavLink } from '@/lib/nav/links';
import { MoreSheet } from './MoreSheet';

const meta = {
  title: 'Existing/MoreSheet',
  component: MoreSheet,
  args: {
    id: 'more',
    pathname: '/',
    isSignedIn: false,
  },
  /**
   * `showModal()` renders the dialog in the top layer, which Storybook's own
   * iframe would then have to compete with — so the story sets the `open`
   * attribute directly instead. That paints the sheet's contents in place
   * without the browser's modal machinery, which is exactly what a story
   * needs: something to look at, not something to interact with as a real
   * dialog. Task 17's Playwright suite is where `showModal()` itself gets
   * exercised.
   */
  render: (args) => {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
      ref.current?.setAttribute('open', '');
    }, []);
    return <MoreSheet {...args} ref={ref} />;
  },
} satisfies Meta<typeof MoreSheet>;

export default meta;

// All three real `yours` links are `ready: false` until Phase 10 ships one, so
// the populated "Yours" group is otherwise unreachable in Storybook. This
// fixture makes the gated group visible — the same fixture `NavRail.stories`
// injects for the same reason.
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

// 🔴 No `SignedIn` story: `UserButton` throws outside a `<ClerkProvider>`,
// and Storybook's preview has none — the same reason `AppNav`, which renders
// the same component, has no story of its own. `isSignedIn` is exercised in
// `MoreSheet.test.tsx`, where `@clerk/nextjs` is mocked.
export const SignedOut: StoryObj<typeof meta> = {
  args: {
    isSignedIn: false,
    yours: readyYours,
  },
};

// The real default: every `yours` link is still `ready: false`, so the
// "Yours" heading and its divider are gated away entirely rather than left
// floating above an empty list.
export const NothingReadyYet: StoryObj<typeof meta> = {
  args: {
    isSignedIn: false,
  },
};

import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { TabBar } from './TabBar';

const meta = {
  title: 'Existing/TabBar',
  component: TabBar,
  args: {
    pathname: '/',
    onMore: () => {},
    isMoreOpen: false,
    moreId: 'more',
    isSignedIn: false,
    onSearch: () => {},
    searchId: 'search',
  },
} satisfies Meta<typeof TabBar>;

export default meta;

export const Home: StoryObj<typeof meta> = {
  args: {
    pathname: '/',
  },
};

export const Leagues: StoryObj<typeof meta> = {
  args: {
    pathname: '/leagues',
  },
};

export const MoreOpen: StoryObj<typeof meta> = {
  args: {
    pathname: '/browse',
    isMoreOpen: true,
  },
};

/**
 * 390px, where the chrome is deliberately absent.
 *
 * P17.T2 measured it: five slots of 78px with "Award shows" at 64.8px leaves
 * the row no slack, and two 44px chrome squares drop a slot to 60.4px, wrap
 * that label and take the bar from 48.5px to 65px. So the chrome is
 * `hidden sm:flex` and this story is what that looks like — the bar a phone
 * gets, unchanged, with search and the account control in the More sheet. Every
 * other story here is the `sm`+ shape, with the mark, search and the way in.
 *
 * 🔴 No signed-in story: `AccountControl` renders Clerk's `UserButton` when a
 * publishable key is present, and that throws outside a `<ClerkProvider>` —
 * the same reason `AppShell.stories.tsx` has none. `TabBar.test.tsx` covers the
 * signed-in shape, with the key stubbed away.
 */
export const Phone: StoryObj<typeof meta> = {
  globals: {
    viewport: { value: 'mobile1' },
  },
};

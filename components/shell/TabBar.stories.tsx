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
 * 390px: five slots of 78px, and nothing else on the row.
 *
 * P17.T2 measured it: "Award shows" renders 64.8px, so the row has no slack.
 * Search and the account control are `TopBar`'s since D127 — see
 * `TopBar.stories.tsx`'s `Phone`, the row above this one — and the bar is the
 * same five destinations at every width below `xl`.
 */
export const Phone: StoryObj<typeof meta> = {
  globals: {
    viewport: { value: 'mobile1' },
  },
};

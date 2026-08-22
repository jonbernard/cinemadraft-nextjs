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

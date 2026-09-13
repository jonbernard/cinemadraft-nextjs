import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { NavLink } from '@/lib/nav/links';
import { NavRail } from './NavRail';

const meta = {
  title: 'Existing/NavRail',
  component: NavRail,
  args: {
    pathname: '/',
  },
} satisfies Meta<typeof NavRail>;

export default meta;

export const Home: StoryObj<typeof meta> = {
  args: {
    pathname: '/',
  },
};

export const InsideALeague: StoryObj<typeof meta> = {
  args: {
    pathname: '/leagues/1',
  },
};

export const AwardShows: StoryObj<typeof meta> = {
  args: {
    pathname: '/award-shows',
  },
};

// All three real `yours` links are `ready: false` until Phase 10 ships one, so
// the grouped "Yours" heading is otherwise unreachable in Storybook. This
// story injects a ready link to make D75's grouping visible.
const readyYours: NavLink[] = [
  {
    href: '/watchlist',
    label: 'Watchlist',
    ready: true,
    path: 'M6 3h12v18l-6-4.5L6 21z',
    group: 'yours',
  },
];

export const WithYours: StoryObj<typeof meta> = {
  args: {
    pathname: '/watchlist',
    yours: readyYours,
  },
};

// The default stories render the rail with no surrounding column, so `h-full`
// collapses to the content height there. This one gives it the column the
// shell gives it, which is the only place the class does anything.
export const InItsColumn: StoryObj<typeof meta> = {
  name: 'Full height, as the shell renders it',
  decorators: [
    (Story) => (
      <div className="bg-bg-base flex h-[720px] gap-2 p-3">
        <Story />
        <div className="bg-bg-surface rounded-md flex-1" />
      </div>
    ),
  ],
};

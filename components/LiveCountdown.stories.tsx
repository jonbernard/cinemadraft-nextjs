import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LiveCountdown } from './LiveCountdown';

/**
 * Fixed instants rather than offsets from `Date.now()`, so the three stories
 * are stable: a story computed from the current clock changes what it shows
 * every time the docs are rebuilt, and "Upcoming" would eventually be the one
 * that is under way.
 */
const meta = {
  title: 'Live/LiveCountdown',
  component: LiveCountdown,
} satisfies Meta<typeof LiveCountdown>;

export default meta;

export const Upcoming: StoryObj<typeof meta> = {
  args: { startsAt: Date.UTC(2099, 2, 14, 1, 0) },
};

export const UnderWay: StoryObj<typeof meta> = {
  args: { startsAt: Date.UTC(2020, 1, 9, 1, 0) },
};

export const Unscheduled: StoryObj<typeof meta> = {
  args: { startsAt: null },
};

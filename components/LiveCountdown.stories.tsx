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

/**
 * `day` is the ceremony's UTC midnight and `startsAt` is the instant, which is
 * 25.5 hours later for a US evening broadcast — the two are deliberately on
 * different UTC dates here, because that is the case the component exists to
 * get right.
 */
export const Upcoming: StoryObj<typeof meta> = {
  args: { day: Date.UTC(2099, 2, 14), startsAt: Date.UTC(2099, 2, 14) + 91_800_000 },
};

export const UnderWay: StoryObj<typeof meta> = {
  args: { day: Date.UTC(2020, 1, 9), startsAt: Date.UTC(2020, 1, 9) + 91_800_000 },
};

export const Unscheduled: StoryObj<typeof meta> = {
  args: { day: null, startsAt: null },
};

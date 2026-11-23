import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { HeadToHead } from './HeadToHead';
import { CROSS_GROUP, LEADER, SAME_GROUP } from './head-to-head-fixtures';

/** Two seats compared from the standings (P16.T24). Both schemes come from the toolbar. */
const meta = {
  title: 'Leagues/HeadToHead',
  component: HeadToHead,
  args: { h2h: CROSS_GROUP, closeHref: '/leagues/1' },
} satisfies Meta<typeof HeadToHead>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The reader against the seat above, across groups: 415 of 810 shared. */
export const CrossGroup: Story = {};

/** Same group: "no film is on both teams", never an empty band. */
export const SameGroup: Story = { args: { h2h: SAME_GROUP } };

/** A follower on the leader's row: first against second. */
export const Leader: Story = { args: { h2h: LEADER } };

export const Narrow: Story = { globals: { viewport: { value: 'mobile1' } } };

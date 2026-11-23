import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LeagueTabs } from './LeagueTabs';

/** A league's views (P16.T19). */
const meta = {
  title: 'Leagues/LeagueTabs',
  component: LeagueTabs,
  args: { leagueId: 1, year: 2026, activeYear: 2026, current: 'board' },
} satisfies Meta<typeof LeagueTabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Board: Story = {};

export const Standings: Story = { args: { current: 'standings' } };

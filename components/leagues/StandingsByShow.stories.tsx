import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { StandingsByShow } from './StandingsByShow';
import { SHOWS, sixteenSeats } from './standings-fixtures';

/** League 1's shape: sixteen seats across seven shows (P16.T19). */
const meta = {
  title: 'Leagues/StandingsByShow',
  component: StandingsByShow,
  args: { rows: sixteenSeats(), shows: SHOWS },
} satisfies Meta<typeof StandingsByShow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SixteenSeats: Story = {};

/** Below `lg`: the list, with each seat's shows behind "By show". */
export const Narrow: Story = {
  globals: { viewport: { value: 'mobile1' } },
};

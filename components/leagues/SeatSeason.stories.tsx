import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SeatSeason } from './SeatSeason';
import { seatView } from './standings-fixtures';

/** One seat's season (P16.T21). Both schemes come from the toolbar. */
const meta = {
  title: 'Leagues/SeatSeason',
  component: SeatSeason,
  args: { view: seatView() },
} satisfies Meta<typeof SeatSeason>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Wide: Story = {};

/** Below `lg`: one card per film, only the shows it scored at. */
export const Narrow: Story = { globals: { viewport: { value: 'mobile1' } } };

/** A seat that has not drafted yet. */
export const NoPoints: Story = { args: { view: seatView(0) } };

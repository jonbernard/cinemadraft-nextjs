import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { RaceChart } from './RaceChart';
import { raceFixture } from './race-fixtures';

/** League 1's shape: sixteen seats across a season's 17 moments (P16.T22). */
const meta = {
  title: 'Leagues/RaceChart',
  component: RaceChart,
  args: { race: raceFixture(), leagueId: 1 },
} satisfies Meta<typeof RaceChart>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Every moment dated (D134): steps at their dates, ticked by month. */
export const DatedSeason: Story = {};

/**
 * A season lacking `event_dates` rows: evenly spaced, ticked by show, with the
 * caption. Since the 2017–2026 backfill this is only a scratch year or one the
 * award-entry skill's `set-dates` has not reached.
 */
export const OrderOnlyPastSeason: Story = {
  args: { race: raceFixture({ dated: false }) },
};

/** Everyone level all season: every seat is a leader, and nobody changes lead. */
export const FlatSeason: Story = {
  args: { race: raceFixture({ flat: true }) },
};

export const Narrow: Story = {
  globals: { viewport: { value: 'mobile1' } },
};

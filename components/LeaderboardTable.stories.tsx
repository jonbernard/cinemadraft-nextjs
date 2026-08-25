import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LeaderboardTable } from './LeaderboardTable';

/** The same shape the test builds: enough rows to exercise the reveal. */
function leaderboardOf(count: number) {
  return {
    year: 2026,
    events: [
      { abbreviation: 'oscars', name: 'Academy Awards' },
      { abbreviation: 'gg', name: 'Golden Globes' },
    ],
    rows: Array.from({ length: count }, (_, index) => ({
      movieId: index + 1,
      title: `Film ${index + 1}`,
      events: { oscars: count - index, gg: Math.max(0, count - index - 2) },
      total: count - index + Math.max(0, count - index - 2),
    })),
  };
}

const meta = {
  title: 'Existing/LeaderboardTable',
  component: LeaderboardTable,
  args: {
    leaderboard: leaderboardOf(7),
  },
} satisfies Meta<typeof LeaderboardTable>;

export default meta;

/** Seven rows — under the page size, so there is no reveal button. */
export const Short: StoryObj<typeof meta> = {};

/** Twenty-five rows: ten shown, and the button counts what is left. */
export const Long: StoryObj<typeof meta> = {
  args: { leaderboard: leaderboardOf(25) },
};

export const Empty: StoryObj<typeof meta> = {
  args: { leaderboard: { year: 2026, events: [], rows: [] } },
};

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

/**
 * 🔴 Twelve shows — the real count, and the case the sticky film column and
 * the legend both exist for. At 1024px twelve per-show columns overflow the
 * content panel; inside this story's frame the table scrolls and Film stays.
 */
export const TwelveShows: StoryObj<typeof meta> = {
  args: {
    leaderboard: {
      year: 2026,
      events: [
        { abbreviation: 'gg', name: 'Golden Globes' },
        { abbreviation: 'dga', name: 'Directors Guild' },
        { abbreviation: 'bafta', name: 'BAFTA' },
        { abbreviation: 'ace', name: 'ACE Eddie' },
        { abbreviation: 'adg', name: 'Art Directors Guild' },
        { abbreviation: 'pga', name: 'Producers Guild' },
        { abbreviation: 'sag', name: 'Screen Actors Guild' },
        { abbreviation: 'wga', name: 'Writers Guild' },
        { abbreviation: 'asc', name: 'American Society of Cinematographers' },
        { abbreviation: 'raz', name: 'Razzies' },
        { abbreviation: 'oscars', name: 'Academy Awards' },
        { abbreviation: 'afi', name: 'American Film Institute' },
      ],
      rows: Array.from({ length: 6 }, (_, index) => {
        const events = Object.fromEntries(
          [
            'gg',
            'dga',
            'bafta',
            'ace',
            'adg',
            'pga',
            'sag',
            'wga',
            'asc',
            'raz',
            'oscars',
            'afi',
          ].map((abbreviation, column) => [
            abbreviation,
            (column + index) % 4 === 0 ? 0 : 5 * (6 - index),
          ]),
        );
        return {
          movieId: index + 1,
          title: `Film ${index + 1}`,
          events,
          total: Object.values(events).reduce((sum, points) => sum + points, 0),
        };
      }),
    },
  },
};

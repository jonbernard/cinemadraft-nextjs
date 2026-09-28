import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LeagueMomentLine, SeasonAgenda } from './SeasonAgenda';
import { DAY_BEFORE_OSCARS, season2026 } from './season-fixtures';

/**
 * The season on `/award-shows` (P16.T15), from the 2026 season as the
 * restored copy holds it. Both schemes come from the toolbar's global.
 */
const meta = {
  title: 'Awards/SeasonAgenda',
  component: SeasonAgenda,
  args: {
    months: season2026(DAY_BEFORE_OSCARS).months,
    year: 2026,
    nextKey: season2026(DAY_BEFORE_OSCARS).next?.key ?? null,
  },
} satisfies Meta<typeof SeasonAgenda>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Signed out, the day before the Oscars: counts and headline films, no seat. */
export const SignedOut: Story = {};

/** October: the finished season, every moment done. */
export const OffSeason: Story = {
  args: { months: season2026().months, nextKey: null },
};

/** Signed in: each finished moment's line for the reader's league (P16.T16). */
export const SignedIn: Story = {
  args: {
    aside: new Map(
      season2026(DAY_BEFORE_OSCARS)
        .months.flatMap((month) => month.moments)
        .filter((moment) => moment.state === 'finished')
        .map((moment, index) => [
          moment.key,
          <LeagueMomentLine
            key={moment.key}
            name="Racso award"
            points={(index * 35) % 180}
            position={index < 2 ? 13 : 16}
            move={index === 1 ? -3 : 0}
          />,
        ]),
    ),
  },
};

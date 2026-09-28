import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AtStake, SeasonUpNext } from './SeasonUpNext';
import { DAY_BEFORE_OSCARS, season2026 } from './season-fixtures';

/**
 * "Up next" on `/award-shows` (P16.T15). Both schemes come from the
 * toolbar's global.
 */
const meta = {
  title: 'Awards/SeasonUpNext',
  component: SeasonUpNext,
  args: { view: season2026(DAY_BEFORE_OSCARS), now: DAY_BEFORE_OSCARS },
} satisfies Meta<typeof SeasonUpNext>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The Oscars tomorrow: ten films nominated, eight named, "and 2 more". */
export const UpNextCapped: Story = {};

/** The RAZZIE nominations are next: no films yet, and when they are due. */
export const BeforeNominations: Story = {
  args: { view: season2026(Date.UTC(2026, 0, 18)), now: Date.UTC(2026, 0, 18) },
};

/** October: the season is done and the next one has no dates yet. */
export const OffSeason: Story = {
  args: {
    view: { ...season2026(), activeYear: 2027, offSeason: true },
    now: Date.UTC(2026, 9, 1),
  },
};

/** Signed in: what the reader has riding on the Oscars (P16.T16). */
export const SignedInAtStake: Story = {
  args: {
    children: (
      <AtStake
        year={2026}
        abbreviation="oscars"
        atStake={{
          films: [
            ['Frankenstein', 'Best Picture'],
            ['Frankenstein', 'Cinematography'],
            ['Frankenstein', 'Production Design'],
            ['Frankenstein', 'Costume Design'],
            ['Blue Moon', 'Actor in a Leading Role'],
            ['Blue Moon', 'Writing Original Screenplay'],
            ['Song Sung Blue', 'Actress in a Leading Role'],
            ['If I Had Legs I’d Kick You', 'Actress in a Leading Role'],
          ].map(([title, category]) => ({
            title: title as string,
            tmdbId: null,
            category: category as string,
          })),
          points: 170,
          more: 5,
        }}
      />
    ),
  },
};

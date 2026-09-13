import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ScoringTable } from './ScoringTable';

const meta = {
  title: 'Phase 18/ScoringTable',
  component: ScoringTable,
} satisfies Meta<typeof ScoringTable>;

export default meta;

/**
 * The four real levels, in the order `groupPointsByLevel` produces (descending
 * by the level's highest value). A story fixture may carry real values — it is
 * not shipped to a reader — but the page never does: every number there comes
 * from the `points` table.
 */
export const Default: StoryObj<typeof meta> = {
  args: {
    levels: [
      {
        level: 'Oscars',
        tiers: [
          { tier: 1, points: 20 },
          { tier: 2, points: 15 },
          { tier: 3, points: 10 },
        ],
      },
      {
        level: 'Golden Globes',
        tiers: [
          { tier: 1, points: 15 },
          { tier: 2, points: 10 },
          { tier: 3, points: 5 },
        ],
      },
      {
        level: 'Alphabet',
        tiers: [
          { tier: 1, points: 5 },
          { tier: 2, points: 5 },
          { tier: 3, points: 5 },
        ],
      },
      {
        level: 'Razzies',
        tiers: [
          { tier: 1, points: -20 },
          { tier: 2, points: -15 },
          { tier: 3, points: -10 },
        ],
      },
    ],
  },
};

export const UnknownTier: StoryObj<typeof meta> = {
  name: 'A tier the copy has no name for',
  args: {
    levels: [
      {
        level: 'Oscars',
        tiers: [
          { tier: 1, points: 20 },
          { tier: 4, points: 3 },
        ],
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'The `points` table is editable. A tier this component has no copy ' +
          'for renders as "Tier 4" rather than vanishing.',
      },
    },
  },
};

export const Empty: StoryObj<typeof meta> = {
  name: 'No levels at all',
  args: { levels: [] },
  parameters: {
    docs: {
      description: {
        story: 'Renders nothing, rather than an empty shell with headings.',
      },
    },
  },
};

import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { type ExampleRow, WorkedExample } from './WorkedExample';

/**
 * The same shape the test builds, and deliberately not the real point values:
 * a component that printed a hardcoded "15" or "× 2" would look right against
 * real numbers and wrong here.
 */
const bestPicture: ExampleRow = {
  nominationId: 1,
  awardName: 'Best Picture',
  eventName: 'Academy Awards',
  points: 7,
  won: true,
  earned: 14,
};

const mixed: ExampleRow[] = [
  bestPicture,
  {
    nominationId: 2,
    awardName: 'Best Director',
    eventName: 'Golden Globes',
    points: 3,
    won: false,
    earned: 3,
  },
  {
    nominationId: 3,
    awardName: 'Outstanding Performance by a Cast',
    eventName: 'Screen Actors Guild',
    points: 5,
    won: true,
    earned: 10,
  },
];

const meta = {
  title: 'Phase 18/WorkedExample',
  component: WorkedExample,
  args: {
    title: 'A Very Long Film Title That Wraps',
    posterUrl: null,
    total: 27,
    lines: mixed,
  },
} satisfies Meta<typeof WorkedExample>;

export default meta;

/** Wins and nominations together — the page's main example. */
export const Winner: StoryObj<typeof meta> = {};

/** Nominated everywhere, won nothing: no chips, no multipliers. */
export const NominationsOnly: StoryObj<typeof meta> = {
  args: {
    total: 10,
    lines: mixed.map((line) => ({ ...line, won: false, earned: line.points })),
  },
};

/**
 * 🔴 The season's biggest loser, with a negative total. The phase's hook, and
 * the case the layout must absorb without flinching: right-aligned tabular
 * figures, so the minus sign costs no column width.
 */
export const RazzieCasualty: StoryObj<typeof meta> = {
  args: {
    title: 'The Worst Film of the Season',
    total: -35,
    lines: [
      {
        nominationId: 4,
        awardName: 'Worst Picture',
        eventName: 'Razzies',
        points: -10,
        won: true,
        earned: -20,
      },
      {
        nominationId: 5,
        awardName: 'Worst Director',
        eventName: 'Razzies',
        points: -10,
        won: false,
        earned: -10,
      },
      {
        nominationId: 6,
        awardName: 'Worst Screen Combo',
        eventName: 'Razzies',
        points: -5,
        won: false,
        earned: -5,
      },
    ],
  },
};

/** One line only — what a film with a single nomination looks like. */
export const SingleLine: StoryObj<typeof meta> = {
  args: { total: 14, lines: [bestPicture] },
};

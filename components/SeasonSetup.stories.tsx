import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SeasonSetup, type SetupSeatView } from './SeasonSetup';

/**
 * The owner's season console, in its three states.
 *
 * The reason it has a story at all is P19.T1: the draft gained an end, and the
 * Phase 3.5 gate says a new control is reviewed in Storybook rather than by
 * being described. `Running` is the state that was a dead end until this phase.
 */
const seats: SetupSeatView[] = [
  {
    draftId: 1,
    name: 'Ada Lovelace',
    isDummy: false,
    group: 1,
    order: 1,
    hasPicks: true,
  },
  {
    draftId: 2,
    name: 'Grace Hopper',
    isDummy: false,
    group: 1,
    order: 2,
    hasPicks: true,
  },
  {
    draftId: 3,
    name: 'Katherine Johnson',
    isDummy: true,
    group: 2,
    order: 1,
    hasPicks: false,
  },
  {
    draftId: 4,
    name: 'Mary Jackson',
    isDummy: false,
    group: 2,
    order: 2,
    hasPicks: false,
  },
];

const meta = {
  title: 'Phase 10/SeasonSetup',
  component: SeasonSetup,
  parameters: { layout: 'padded' },
  args: {
    leagueId: 1,
    year: 2026,
    seats,
    groups: [1, 2],
    suggestedGroupCount: 2,
  },
} satisfies Meta<typeof SeasonSetup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Before the draft: seats, groups and the way in. */
export const Arranging: Story = { args: { status: 'pending' } };

/** 🔴 Mid-draft. Until P19.T1 this state offered a sentence and nothing else. */
export const Running: Story = { args: { status: 'active' } };

/** After: no controls, because there is nothing left to arrange or to end. */
export const Finished: Story = { args: { status: 'complete' } };

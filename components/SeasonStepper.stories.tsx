import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { SeasonPhase } from './SeasonStepper';
import { SeasonStepper } from './SeasonStepper';

const DAY = 86_400_000;

/** A season of `shows` shows, each contributing nominations and a ceremony. */
function season(
  shows: number,
  { dated = true }: { dated?: boolean } = {},
): SeasonPhase[] {
  const start = Date.now() - shows * 10 * DAY;
  return Array.from({ length: shows }, (_, index) => index).flatMap((index) => {
    const nom = start + index * 20 * DAY;
    const ceremony = nom + 14 * DAY;
    return [
      {
        key: `${index}-nominations`,
        eventId: index,
        phase: 'nominations' as const,
        name: `Show ${index + 1}`,
        abbreviation: `s${index}`,
        date: dated ? nom : null,
        complete: dated && nom < Date.now(),
      },
      {
        key: `${index}-ceremony`,
        eventId: index,
        phase: 'ceremony' as const,
        name: `Show ${index + 1}`,
        abbreviation: `s${index}`,
        date: dated ? ceremony : null,
        complete: dated && ceremony < Date.now(),
      },
    ];
  });
}

const meta = {
  title: 'Existing/SeasonStepper',
  component: SeasonStepper,
  args: { phases: season(12) },
} satisfies Meta<typeof SeasonStepper>;

export default meta;

/** Twenty-four boxes: opens at the end, and both buttons do something. */
export const FullSeason: StoryObj<typeof meta> = {};

/** Four boxes — the window holds them all, so there is nothing to step. */
export const EarlySeason: StoryObj<typeof meta> = {
  args: { phases: season(2) },
};

/** A calendar that has not been published yet: every box says "Date TBA". */
export const Unscheduled: StoryObj<typeof meta> = {
  args: { phases: season(3, { dated: false }) },
};

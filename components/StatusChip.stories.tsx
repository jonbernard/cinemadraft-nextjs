import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { StatusChip } from './StatusChip';

const meta = {
  title: 'Existing/StatusChip',
  component: StatusChip,
} satisfies Meta<typeof StatusChip>;

export default meta;

// Brass is awards — a nomination or a win.
export const Winner: StoryObj<typeof meta> = {
  args: {
    tone: 'brass',
    children: 'Winner',
  },
};

// Carmine is urgency — a deadline, live, on the clock.
export const OnTheClock: StoryObj<typeof meta> = {
  args: {
    tone: 'carmine',
    children: 'On the clock',
  },
};

// Beam is scheduled and not yet — ink, not a fill. Labelled with the season
// rail's next chip, which is where it renders first (P17.T20).
export const NextDateTba: StoryObj<typeof meta> = {
  args: {
    tone: 'beam',
    children: 'Next · date TBA',
  },
};

// Neutral is for states that are neither an award nor urgent.
export const Unclaimed: StoryObj<typeof meta> = {
  args: {
    tone: 'neutral',
    children: 'Unclaimed',
  },
};

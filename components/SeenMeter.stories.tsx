import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SeenMeter } from './SeenMeter';

const meta = {
  title: 'Watchlist/SeenMeter',
  component: SeenMeter,
} satisfies Meta<typeof SeenMeter>;

export default meta;

export const PartlySeen: StoryObj<typeof meta> = {
  args: { seen: 8, total: 20 },
};

export const Nominations: StoryObj<typeof meta> = {
  args: { seen: 2, total: 26, unit: 'nominations' },
};

export const NothingSeen: StoryObj<typeof meta> = {
  args: { seen: 0, total: 123 },
};

export const Complete: StoryObj<typeof meta> = {
  args: { seen: 20, total: 20 },
};

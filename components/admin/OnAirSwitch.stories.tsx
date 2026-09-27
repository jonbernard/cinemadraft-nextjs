import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { OnAirSwitch } from './OnAirSwitch';

const meta = {
  title: 'Admin/OnAirSwitch',
  component: OnAirSwitch,
  args: { eventId: 1, onAir: false },
} satisfies Meta<typeof OnAirSwitch>;

export default meta;

export const OffAir: StoryObj<typeof meta> = {};

export const OnAir: StoryObj<typeof meta> = { args: { onAir: true } };

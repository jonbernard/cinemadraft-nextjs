import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LiveSwitch } from './LiveSwitch';

const meta = {
  title: 'Admin/LiveSwitch',
  component: LiveSwitch,
  args: {
    checked: false,
    onChange: () => {},
    description:
      'On air, /live streams this show and the dashboard links to it. Saved with the show.',
  },
} satisfies Meta<typeof LiveSwitch>;

export default meta;

export const OffAir: StoryObj<typeof meta> = {};

export const OnAir: StoryObj<typeof meta> = {
  args: { checked: true },
};

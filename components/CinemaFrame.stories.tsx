import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CinemaFrame } from './CinemaFrame';

const meta = {
  title: 'Existing/CinemaFrame',
  component: CinemaFrame,
} satisfies Meta<typeof CinemaFrame>;

export default meta;

export const Default: StoryObj<typeof meta> = {
  args: {
    children: <div className="bg-bg-raised h-full w-full" />,
  },
};

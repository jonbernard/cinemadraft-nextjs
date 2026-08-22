import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Eyebrow } from './Eyebrow';

const meta = {
  title: 'Existing/Eyebrow',
  component: Eyebrow,
  args: {
    children: 'Rounds 1–7',
  },
} satisfies Meta<typeof Eyebrow>;

export default meta;

export const Brass: StoryObj<typeof meta> = {
  args: {
    tone: 'brass',
  },
};

export const Dim: StoryObj<typeof meta> = {
  args: {
    tone: 'dim',
  },
};

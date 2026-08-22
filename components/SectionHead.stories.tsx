import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SectionHead } from './SectionHead';

const meta = {
  title: 'Existing/SectionHead',
  component: SectionHead,
  args: {
    children: 'Roster',
  },
} satisfies Meta<typeof SectionHead>;

export default meta;

export const Structure: StoryObj<typeof meta> = {};

export const Named: StoryObj<typeof meta> = {
  args: {
    name: true,
    children: 'Sarah Powers',
  },
};

export const WithMetadata: StoryObj<typeof meta> = {
  args: {
    eyebrow: 'Seat 01 · Rounds 1–7',
    right: '955 pts',
  },
};

import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Button } from './Button';

const meta = {
  title: 'Existing/Button',
  component: Button,
  args: {
    children: 'Create league',
  },
} satisfies Meta<typeof Button>;

export default meta;

// The default: carmine, the urgency accent — submit, deadline, destructive.
export const Carmine: StoryObj<typeof meta> = {
  args: {
    accent: 'carmine',
  },
};

// The awards accent — a nomination or a win, never a destructive action.
export const Brass: StoryObj<typeof meta> = {
  args: {
    accent: 'brass',
    children: 'Confirm winner',
  },
};

export const Outlined: StoryObj<typeof meta> = {
  args: {
    variant: 'outlined',
  },
};

export const Text: StoryObj<typeof meta> = {
  args: {
    variant: 'text',
  },
};

export const Disabled: StoryObj<typeof meta> = {
  args: {
    disabled: true,
  },
};

export const Loading: StoryObj<typeof meta> = {
  args: {
    loading: true,
  },
};

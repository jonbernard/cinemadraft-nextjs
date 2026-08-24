import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ShowLogo } from './ShowLogo';

const meta = {
  title: 'Existing/ShowLogo',
  component: ShowLogo,
} satisfies Meta<typeof ShowLogo>;

export default meta;

export const Small: StoryObj<typeof meta> = {
  args: {
    name: 'Academy Awards',
    imageUrl: 'https://image.tmdb.org/t/p/w92/placeholder.jpg',
  },
};

export const Missing: StoryObj<typeof meta> = {
  args: { name: 'Academy Awards', imageUrl: null },
};

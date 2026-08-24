import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { RemoteImage } from './RemoteImage';

const meta = {
  title: 'Existing/RemoteImage',
  component: RemoteImage,
} satisfies Meta<typeof RemoteImage>;

export default meta;

export const Poster: StoryObj<typeof meta> = {
  args: {
    src: 'https://image.tmdb.org/t/p/w185/kqjL17yufvn9OVLyXYpvtyrFfak.jpg',
    alt: '',
    width: 185,
    height: 278,
  },
};

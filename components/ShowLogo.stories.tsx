import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ShowLogo } from './ShowLogo';

const meta = {
  title: 'Existing/ShowLogo',
  component: ShowLogo,
} satisfies Meta<typeof ShowLogo>;

export default meta;

export const Small: StoryObj<typeof meta> = {
  args: {
    // Blob-shaped, not TMDB: award-show logos are the unoptimized-vs-optimized
    // opposite of posters (lib/images.ts), and a TMDB URL here would exercise
    // the wrong branch of RemoteImage.
    imageUrl:
      'https://5d9wubvvsbkemktm.public.blob.vercel-storage.com/award-shows/oscars.jpg',
  },
};

export const Missing: StoryObj<typeof meta> = {
  args: { imageUrl: null },
};

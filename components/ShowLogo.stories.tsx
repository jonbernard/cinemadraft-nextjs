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

export const OnAPlate: StoryObj<typeof meta> = {
  name: 'Dark mark on the neutral plate',
  args: {
    size: 'lg',
    imageUrl:
      'https://5d9wubvvsbkemktm.public.blob.vercel-storage.com/award-shows/oscars.jpg',
  },
  parameters: {
    docs: {
      description: {
        story:
          'The plate stays white in both schemes. These marks are third-party ' +
          'artwork drawn dark-on-transparent; a plate that followed the theme ' +
          'rendered them dark on near-black in dark mode.',
      },
    },
  },
};

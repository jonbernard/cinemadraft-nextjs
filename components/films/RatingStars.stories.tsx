import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { RatingStars } from './RatingStars';

const meta = {
  title: 'Phase 10/RatingStars',
  component: RatingStars,
} satisfies Meta<typeof RatingStars>;

export default meta;

export const FullStars: StoryObj<typeof meta> = {
  args: { rating: 4 },
};

/** The case the whole 0.5 precision exists for. */
export const HalfStar: StoryObj<typeof meta> = {
  args: { rating: 3.5 },
};

export const Lowest: StoryObj<typeof meta> = {
  args: { rating: 0.5 },
};

export const Highest: StoryObj<typeof meta> = {
  args: { rating: 5 },
};

/** Beside a title, where the stars are an aside rather than the subject. */
export const Small: StoryObj<typeof meta> = {
  args: { rating: 2.5, size: 'sm' },
};

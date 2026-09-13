import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { SaveReview } from './ReviewForm';
import { YourReview } from './YourReview';

const accept: SaveReview = async (input) => ({
  ok: true,
  data: { rating: input.rating, review: input.review, updatedAt: new Date() },
});

const meta = {
  title: 'Phase 10/YourReview',
  component: YourReview,
  args: {
    tmdbId: '1061474',
    title: 'One Battle After Another',
    onSave: accept,
    onDelete: async () => ({ ok: true as const, data: null }),
  },
} satisfies Meta<typeof YourReview>;

export default meta;

/** Nothing written yet: no card above the disclosure, which offers to write one. */
export const Unwritten: StoryObj<typeof meta> = {
  args: { review: null },
};

export const Written: StoryObj<typeof meta> = {
  args: {
    review: {
      rating: 3.5,
      review: 'Better than the trailer promised.',
      updatedAt: new Date('2026-08-14T00:00:00Z'),
    },
  },
};

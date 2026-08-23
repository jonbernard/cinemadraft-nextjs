import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ReviewForm, type SaveReview } from './ReviewForm';

const accept: SaveReview = async (input) => ({
  ok: true,
  data: { rating: input.rating, review: input.review, updatedAt: new Date() },
});

const refuse: SaveReview = async () => ({
  ok: false,
  code: 'INVALID',
  message: 'add a rating or a few words',
});

const meta = {
  title: 'Phase 10/ReviewForm',
  component: ReviewForm,
  args: {
    tmdbId: '1061474',
    title: 'One Battle After Another',
    onSave: accept,
    onDelete: async () => ({ ok: true as const, data: null }),
  },
} satisfies Meta<typeof ReviewForm>;

export default meta;

/** Nothing written yet: no Remove, and the button offers to save. */
export const FirstReview: StoryObj<typeof meta> = {
  args: { review: null },
};

export const Editing: StoryObj<typeof meta> = {
  args: {
    review: {
      rating: 3.5,
      review: 'Better than the trailer promised.',
      updatedAt: new Date('2026-08-14T00:00:00Z'),
    },
  },
};

export const Refused: StoryObj<typeof meta> = {
  args: { review: null, onSave: refuse },
};

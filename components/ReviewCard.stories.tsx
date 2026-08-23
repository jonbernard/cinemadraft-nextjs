import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ReviewCard } from './ReviewCard';

const SAVED = new Date('2026-08-14T00:00:00Z');

const meta = {
  title: 'Phase 10/ReviewCard',
  component: ReviewCard,
} satisfies Meta<typeof ReviewCard>;

export default meta;

export const RatingAndWords: StoryObj<typeof meta> = {
  args: {
    review: {
      rating: 4.5,
      review:
        'The projection was bad and I still could not look away.\n\nThe last twenty minutes earn everything before them.',
      updatedAt: SAVED,
    },
  },
};

/** A score with nothing said about it — both columns are nullable. */
export const RatingOnly: StoryObj<typeof meta> = {
  args: { review: { rating: 2, review: null, updatedAt: SAVED } },
};

/** Words without a score, which the source's form could also produce. */
export const WordsOnly: StoryObj<typeof meta> = {
  args: {
    review: {
      rating: null,
      review: 'Not for me, and I cannot say why.',
      updatedAt: SAVED,
    },
  },
};

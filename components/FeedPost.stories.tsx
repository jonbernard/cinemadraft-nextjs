import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { FeedFilm, FeedItem } from '@/lib/services/profile';
import { FeedPost } from './FeedPost';

const film = (movieId: number, title: string): FeedFilm => ({
  movieId,
  tmdbId: String(1000 + movieId),
  title,
  posterUrl: null,
});

const drafted: FeedItem = {
  id: 90,
  // Names in this column are real member names in production; these are not.
  message: 'Vera drafted these movies in the 2024 Racso award league.',
  link: '',
  createdAt: new Date('2023-12-02T01:24:44.169Z'),
  attachments: [
    {
      kind: 'draft',
      key: 'draft-110',
      draftId: 110,
      films: [
        film(1, 'Oppenheimer'),
        film(2, 'Poor Things'),
        film(3, 'Killers of the Flower Moon'),
        film(4, 'Anatomy of a Fall'),
        film(5, 'The Zone of Interest'),
      ],
      more: 4,
    },
  ],
};

const reviewed: FeedItem = {
  id: 91,
  message: 'Vera posted a review of The Brutalist.',
  link: '',
  createdAt: new Date('2026-01-18T12:00:00Z'),
  attachments: [
    {
      kind: 'review',
      key: 'review-4',
      film: film(6, 'The Brutalist'),
      rating: 4.5,
      review: 'Three and a half hours and not one of them wasted.',
      updatedAt: new Date('2026-01-18T12:00:00Z'),
    },
  ],
};

const meta = {
  title: 'Phase 10/FeedPost',
  component: FeedPost,
  args: { item: drafted },
} satisfies Meta<typeof FeedPost>;

export default meta;

export const Drafted: StoryObj<typeof meta> = {};

export const Reviewed: StoryObj<typeof meta> = { args: { item: reviewed } };

/** Prose alone — what a member typing into the composer produces. */
export const PlainMessage: StoryObj<typeof meta> = {
  args: {
    item: {
      id: 92,
      message: 'Finally caught up on the season.',
      link: '',
      createdAt: new Date('2026-08-20T09:00:00Z'),
      attachments: [],
    },
  },
};

/** Only the author is offered the control; the action re-checks it anyway. */
export const Own: StoryObj<typeof meta> = {
  args: { onDelete: async () => ({ ok: true as const, data: null }) },
};

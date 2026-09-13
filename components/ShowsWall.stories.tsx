import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ShowsWall } from './ShowsWall';

const meta = {
  title: 'Phase 18/ShowsWall',
  component: ShowsWall,
} satisfies Meta<typeof ShowsWall>;

export default meta;

const BLOB = 'https://5d9wubvvsbkemktm.public.blob.vercel-storage.com/award-shows';

/**
 * Blob-shaped URLs, not TMDB: award-show marks are the unoptimized-vs-optimized
 * opposite of posters (`lib/images.ts`), and a TMDB URL would exercise the
 * wrong branch of `RemoteImage`.
 */
export const Default: StoryObj<typeof meta> = {
  args: {
    groups: [
      {
        level: 'Alphabet',
        tiers: [
          { tier: 1, points: 5 },
          { tier: 2, points: 5 },
          { tier: 3, points: 5 },
        ],
        shows: [
          {
            eventId: 1,
            name: 'Writers Guild Awards',
            abbreviation: 'wga',
            imageUrl: null,
          },
          {
            eventId: 2,
            name: 'Directors Guild Awards',
            abbreviation: 'dga',
            imageUrl: null,
          },
          {
            eventId: 3,
            name: 'Producers Guild Awards',
            abbreviation: 'pga',
            imageUrl: null,
          },
        ],
      },
      {
        level: 'Oscars',
        tiers: [
          { tier: 1, points: 20 },
          { tier: 2, points: 15 },
          { tier: 3, points: 10 },
        ],
        shows: [
          {
            eventId: 4,
            name: 'Academy Awards',
            abbreviation: 'oscars',
            imageUrl: `${BLOB}/oscars.jpg`,
          },
        ],
      },
      {
        level: 'Razzies',
        tiers: [
          { tier: 1, points: -20 },
          { tier: 2, points: -15 },
          { tier: 3, points: -10 },
        ],
        shows: [
          {
            eventId: 5,
            name: 'Golden Raspberry Awards',
            abbreviation: 'razzies',
            imageUrl: null,
          },
        ],
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Flat, tiered and negative are read off each level’s own point ' +
          'values, never off its name. The Razzies are set apart by a heading, ' +
          'a chip and a sentence — no colour is involved in the distinction.',
      },
    },
  },
};

export const NoMarks: StoryObj<typeof meta> = {
  name: 'A show with no mark and no abbreviation',
  args: {
    groups: [
      {
        level: 'Oscars',
        tiers: [{ tier: 1, points: 20 }],
        shows: [
          { eventId: 9, name: 'Newly added show', abbreviation: null, imageUrl: null },
        ],
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          '`events.image` is nullable and `ShowLogo` renders nothing rather ' +
          'than an empty frame; a show with no abbreviation has no page to ' +
          'link to, so the card is not a link. Both still print the name.',
      },
    },
  },
};

export const Empty: StoryObj<typeof meta> = {
  name: 'No shows at all',
  args: { groups: [] },
  parameters: {
    docs: {
      description: {
        story:
          'Renders nothing. A level with no shows is dropped too, so a fresh ' +
          'database cannot produce a row of empty headings.',
      },
    },
  },
};

import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LiveBoard } from './LiveBoard';

const seats = [
  {
    draftId: 10,
    name: 'Zoe Ahmadi',
    isViewer: true,
    earned: 30,
    films: [
      {
        movieId: 1,
        title: 'Sinners',
        posterUrl: 'https://image.tmdb.org/t/p/w342/ypP0ETKMjUIbdE73IkZpuS77ROf.jpg',
        earned: 20,
        status: 'won' as const,
      },
      {
        movieId: 2,
        title: 'Marty Supreme',
        posterUrl: null,
        earned: 10,
        status: 'nominated' as const,
      },
    ],
  },
  {
    draftId: 11,
    name: 'Grace Okafor',
    isViewer: false,
    earned: 10,
    films: [
      {
        movieId: 3,
        title: 'Anora',
        posterUrl: null,
        earned: 10,
        status: 'nominated' as const,
      },
    ],
  },
  // The common state, and the reason the empty branch exists: twelve shows a
  // season, and most seats are not in most of them.
  { draftId: 12, name: 'Bo Lindqvist', isViewer: false, earned: 0, films: [] },
];

const meta = {
  title: 'Live/LiveBoard',
  component: LiveBoard,
} satisfies Meta<typeof LiveBoard>;

export default meta;

export const Ranked: StoryObj<typeof meta> = {
  args: { league: { id: 1, name: 'The Main League', total: 40, seats } },
};

/** Before a single category has resolved: everyone nominated, nobody won. */
export const NothingResolvedYet: StoryObj<typeof meta> = {
  args: {
    league: {
      id: 1,
      name: 'The Main League',
      total: 20,
      seats: seats.map((seat) => ({
        ...seat,
        earned: seat.films.length * 10,
        films: seat.films.map((film) => ({
          ...film,
          earned: 10,
          status: 'nominated' as const,
        })),
      })),
    },
  },
};

/**
 * A league nobody in the room holds a seat in — what a stranger handed
 * `?league=<id>` sees. No seat is marked, which is the P14.T2 privacy line.
 */
export const NobodysSeat: StoryObj<typeof meta> = {
  args: {
    league: {
      id: 2,
      name: 'Work League',
      total: 40,
      seats: seats.map((seat) => ({ ...seat, isViewer: false })),
    },
  },
};

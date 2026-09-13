import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LiveAward } from './LiveAward';

const poster = (path: string) => `https://image.tmdb.org/t/p/w342${path}`;

const nominees = [
  {
    nominationId: 1,
    title: 'Sinners',
    posterUrl: poster('/ypP0ETKMjUIbdE73IkZpuS77ROf.jpg'),
    detailName: null,
    isWinner: true,
  },
  {
    nominationId: 2,
    title: 'Anora',
    posterUrl: poster('/qeeuVOo1z7cWBPLOtsfJZEoTZOM.jpg'),
    detailName: null,
    isWinner: false,
  },
  {
    nominationId: 3,
    title: 'Marty Supreme',
    posterUrl: poster('/9PXZIUsSDh4alB80jheWX4fhZmy.jpg'),
    detailName: null,
    isWinner: false,
  },
  {
    nominationId: 4,
    title: 'Nickel Boys',
    posterUrl: poster('/nRlSjAcRKrKlFhTBqBpQBTEpFqN.jpg'),
    detailName: null,
    isWinner: false,
  },
];

const meta = {
  title: 'Live/LiveAward',
  component: LiveAward,
} satisfies Meta<typeof LiveAward>;

export default meta;

export const Decided: StoryObj<typeof meta> = {
  args: { name: 'Best Picture', points: 20, nominees },
};

/** The ordinary state for most of a ceremony: five up, none marked. */
export const StillOpen: StoryObj<typeof meta> = {
  args: {
    name: 'Best Original Screenplay',
    points: 14,
    nominees: nominees.map((nominee) => ({ ...nominee, isWinner: false })),
  },
};

/**
 * A person category, where two nominees can be the same film — the names are
 * what tells them apart.
 */
export const People: StoryObj<typeof meta> = {
  args: {
    name: 'Actor in a Supporting Role',
    points: 14,
    nominees: [
      { ...nominees[0], nominationId: 10, detailName: 'Delroy Lindo', isWinner: true },
      { ...nominees[0], nominationId: 11, detailName: 'Miles Caton', isWinner: false },
      { ...nominees[1], nominationId: 12, detailName: 'Yura Borisov', isWinner: false },
    ],
  },
};

/**
 * 🔴 Artwork is not guaranteed. A category whose films have no posters must
 * still be a row of named frames, never an empty strip.
 */
export const NoArtwork: StoryObj<typeof meta> = {
  args: {
    name: 'Documentary Feature',
    points: 10,
    nominees: nominees.map((nominee) => ({ ...nominee, posterUrl: null })),
  },
};

/** A category entered before its nominations were. Words, not a blank row. */
export const NothingEnteredYet: StoryObj<typeof meta> = {
  args: { name: 'Casting', points: 10, nominees: [] },
};

/**
 * The ceremony reveal: the seal arrives over the poster, holds while the room
 * looks up, then stamps itself into the corner it will live in.
 */
export const WinnerRevealed: StoryObj<typeof meta> = {
  args: { name: 'Best Picture', points: 20, nominees, reveal: true },
};

import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { PosterFrame } from './PosterFrame';
import { Shelf } from './Shelf';

const films = [
  { title: 'Dune: Part Two', round: 1, points: 87 },
  { title: 'Oppenheimer', round: 2, points: 74 },
  { title: 'Poor Things', round: 3, points: 61 },
  { title: 'The Zone of Interest', round: 4, points: 55 },
  { title: 'Killers of the Flower Moon', round: 5, points: 49 },
  { title: 'Anatomy of a Fall', round: 6, points: 42 },
] as const;

const meta = {
  title: 'Existing/Shelf',
  component: Shelf,
  args: {
    heading: 'Roster',
    children: (
      <>
        {films.map((film) => (
          <li key={film.title}>
            <PosterFrame
              title={film.title}
              posterUrl={null}
              round={film.round}
              points={film.points}
            />
          </li>
        ))}
      </>
    ),
  },
} satisfies Meta<typeof Shelf>;

export default meta;

export const Default: StoryObj<typeof meta> = {};

export const Linked: StoryObj<typeof meta> = {
  args: {
    href: '/leagues/1',
  },
};

export const WithMetadata: StoryObj<typeof meta> = {
  args: {
    eyebrow: 'Seat 01 · Rounds 1–7',
    right: '955 pts',
  },
};

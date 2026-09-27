import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { PersonPicker } from './PersonPicker';

/**
 * The film's own credits, cast then crew — the shape `fetchTmdbFilmPeople`
 * returns. Real names from a real slate (Best Supporting Actor 2026), which
 * is the case the picker exists for: one film, two people nominated.
 */
const PEOPLE = [
  {
    id: 10859,
    name: 'Leonardo DiCaprio',
    kind: 'cast',
    character: 'Bob Ferguson',
    jobs: null,
  },
  {
    id: 2228,
    name: 'Sean Penn',
    kind: 'cast',
    character: 'Col. Steven J. Lockjaw',
    jobs: null,
  },
  {
    id: 1121,
    name: 'Benicio del Toro',
    kind: 'cast',
    character: 'Sensei Sergio St. Carlos',
    jobs: null,
  },
  { id: 3897137, name: 'Chase Infiniti', kind: 'cast', character: 'Willa', jobs: null },
  {
    id: 4762,
    name: 'Paul Thomas Anderson',
    kind: 'crew',
    character: null,
    jobs: 'Director, Screenplay, Producer',
  },
  {
    id: 1447,
    name: 'Jonny Greenwood',
    kind: 'crew',
    character: null,
    jobs: 'Original Music Composer',
  },
] as const;

const meta = {
  title: 'Admin/PersonPicker',
  component: PersonPicker,
  args: {
    people: [...PEOPLE],
    onSelect: () => {},
    onCancel: () => {},
  },
} satisfies Meta<typeof PersonPicker>;

export default meta;

export const CastAndCrew: StoryObj<typeof meta> = {};

// Sean Penn is already up for this film in this category: named, not just
// dimmed, and not choosable.
export const OneAlreadyNominated: StoryObj<typeof meta> = {
  args: { isUnavailable: (person) => person.id === 2228 },
};

export const Saving: StoryObj<typeof meta> = {
  args: { busy: true },
};

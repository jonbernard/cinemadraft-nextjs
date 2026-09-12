import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { BrowseMonth } from '@/lib/services/browse';
import { BrowseList } from './BrowseList';

/**
 * The shelf as it looks before the reader has scrolled — the sentinel is below
 * the fold of the story frame, and appending hits the live Server Action, so
 * only a Storybook running against the app will actually grow this list.
 *
 * Real TMDB poster paths, because `RemoteImage` branches on the host
 * (`lib/images.ts`) and a placeholder URL would exercise the optimizer path
 * these posters deliberately skip.
 */
function month(label: string, titles: readonly [string, string][]): BrowseMonth {
  return {
    label,
    films: titles.map(([title, poster]) => ({
      tmdbId: poster,
      title,
      posterUrl: `https://image.tmdb.org/t/p/w342${poster}`,
      releaseDate: new Date(`${label.slice(3)}-${label.slice(0, 2)}-01T00:00:00Z`),
      watched: false,
    })),
  };
}

const months = [
  month('10/2026', [
    ['Sinners', '/jHPMirFDvzMMDlYhBv9y2rqQhHR.jpg'],
    ['The Brutalist', '/vSRmmalVWF4Ck9DJIjNfrPqhbBw.jpg'],
  ]),
  month('09/2026', [['Dune: Part Two', '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg']]),
];

const meta = {
  title: 'Existing/BrowseList',
  component: BrowseList,
  args: {
    when: 'past' as const,
    isSignedIn: false,
    initial: { when: 'past' as const, page: 1, pageCount: 9, months },
  },
} satisfies Meta<typeof BrowseList>;

export default meta;

export const Shelf: StoryObj<typeof meta> = {};

/** The last page: no sentinel, so the list simply ends. */
export const LastPage: StoryObj<typeof meta> = {
  args: { initial: { when: 'past', page: 9, pageCount: 9, months } },
};

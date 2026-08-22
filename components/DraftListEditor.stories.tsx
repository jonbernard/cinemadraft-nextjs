import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { ActionResult } from '@/actions/result';
import { DraftListEditor, type DraftListRow } from './DraftListEditor';

const entries: DraftListRow[] = [
  {
    entryId: 1,
    movieId: 11,
    title: 'One Battle After Another',
    posterUrl: null,
    releaseYear: 2025,
    status: 'none',
  },
  {
    entryId: 2,
    movieId: 12,
    title: 'Sinners',
    posterUrl: null,
    releaseYear: 2025,
    status: 'selected',
  },
  {
    entryId: 3,
    movieId: 13,
    title: 'Hamnet',
    posterUrl: null,
    releaseYear: 2025,
    status: 'unavailable',
  },
  {
    entryId: 4,
    movieId: 14,
    title: 'Marty Supreme',
    posterUrl: null,
    releaseYear: 2025,
    status: 'none',
  },
];

const accept = async (): Promise<ActionResult<null>> => ({ ok: true, data: null });

const meta = {
  title: 'Phase 10/DraftListEditor',
  component: DraftListEditor,
  args: {
    entries,
    onSearch: async () => ({
      ok: true as const,
      data: [
        { id: 21, tmdbId: '1', title: 'Frankenstein', year: 2025, posterUrl: null },
        { id: 12, tmdbId: '2', title: 'Sinners', year: 2025, posterUrl: null },
      ],
    }),
    onAdd: accept,
    onRemove: accept,
    onSetStatus: accept,
    onReorder: accept,
  },
} satisfies Meta<typeof DraftListEditor>;

export default meta;

export const Prepared: StoryObj<typeof meta> = {};

/** What a member sees the first time they open the page. */
export const NothingYet: StoryObj<typeof meta> = {
  args: { entries: [] },
};

/** Every mark at once, so both words and both tones are visible together. */
export const Marked: StoryObj<typeof meta> = {
  args: {
    entries: entries.map((entry, index) => ({
      ...entry,
      status: index % 2 === 0 ? 'selected' : 'unavailable',
    })),
  },
};

/** A reorder the server refuses: the list snaps back and says why. */
export const RefusedReorder: StoryObj<typeof meta> = {
  args: {
    onReorder: async () => ({
      ok: false,
      code: 'CONFLICT',
      message: 'that ordering does not match your list',
    }),
  },
};

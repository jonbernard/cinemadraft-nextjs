import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { ActionResult } from '@/actions/result';
import { ReorderableList } from './ReorderableList';

type Row = { id: number; label: string };

const accept = async (): Promise<ActionResult<null>> => ({ ok: true, data: null });

const items: Row[] = [
  { id: 1, label: 'One Battle After Another' },
  { id: 2, label: 'Sinners' },
  { id: 3, label: 'Hamnet' },
];

/**
 * The shell both hand-arranged lists in the app are built on — the draft
 * console's picks and a member's private shortlist. What varies is the row, so
 * that is the render prop; the drag, the keyboard, the optimism and the
 * snap-back are not the caller's business.
 */
const meta = {
  title: 'Phase 10/ReorderableList',
  component: ReorderableList<Row>,
  args: {
    items,
    getId: (item: Row) => item.id,
    label: 'Films — drag or use space and the arrow keys to reorder',
    itemClassName: 'border-border-rule border-b',
    empty: <p className="text-text-dim text-xs">Nothing here yet.</p>,
    onReorder: accept,
    children: (item: Row, row) => (
      <div {...row.handleProps} className="flex min-h-11 items-center gap-3 px-2">
        <span className="text-text-dim tabular w-6 font-mono text-xs">
          {String(row.index + 1).padStart(2, '0')}
        </span>
        <span className="text-text-primary font-serif text-sm">{item.label}</span>
      </div>
    ),
  },
} satisfies Meta<typeof ReorderableList<Row>>;

export default meta;

export const Default: StoryObj<typeof meta> = {};

export const Empty: StoryObj<typeof meta> = {
  args: { items: [] },
};

/** The server refuses: the row returns to where it was and says why. */
export const Refused: StoryObj<typeof meta> = {
  args: {
    onReorder: async () => ({
      ok: false,
      code: 'CONFLICT',
      message: 'that ordering does not match your list',
    }),
  },
};

'use client';

import type { ActionResult } from '@/actions/result';
import { ReorderableList } from './ReorderableList';

export type ListPick = {
  pickId: number;
  round: number;
  title: string;
  posterUrl: string | null;
};

/**
 * One seat's picks, reorderable.
 *
 * The round a film was taken in is real information — round 1 cost more than
 * the last round — and the owner sometimes has to correct it after the fact,
 * usually because a pick was entered against the wrong round mid-call.
 *
 * The drag, keyboard, optimism and snap-back are `ReorderableList`'s; what is
 * here is the row. Snapping back is the honest thing for this list in
 * particular: the board is what the league sees, and it now disagrees.
 */
export function PickList({
  picks,
  onReorder,
  className,
}: {
  picks: readonly ListPick[];
  onReorder: (pickIds: number[]) => Promise<ActionResult<unknown>>;
  className?: string;
}) {
  return (
    <ReorderableList
      items={picks}
      getId={pickId}
      droppableId="picks"
      label="Picks, in draft order — drag or use space and the arrow keys to reorder"
      itemClassName="border-border-rule border-b"
      empty={<p className="text-text-dim text-xs">No picks yet.</p>}
      onReorder={onReorder}
      className={className}
    >
      {(pick, row) => (
        <div {...row.handleProps} className="flex items-center gap-3 px-2 py-2">
          {/* The position in the list, not the stored round: while a drag is in
              flight the two differ, and the number under the cursor has to be
              the one that will be saved. */}
          <span className="text-text-dim tabular w-6 font-mono text-xs">
            {String(row.index + 1).padStart(2, '0')}
          </span>
          {pick.posterUrl ? (
            // biome-ignore lint/performance/noImgElement: swapped for next/image in Phase 11 with the media migration
            <img src={pick.posterUrl} alt="" className="h-10 w-7 object-cover" />
          ) : null}
          <span className="text-text-primary flex-1 text-sm">{pick.title}</span>
        </div>
      )}
    </ReorderableList>
  );
}

function pickId(pick: ListPick): number {
  return pick.pickId;
}

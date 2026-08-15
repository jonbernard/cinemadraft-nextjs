'use client';

import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import { useCallback, useEffect, useState, useTransition } from 'react';

import type { ActionResult } from '@/actions/result';
import { cn } from '@/lib/utils/cn';
import { reorder } from '@/lib/utils/reorder';

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
 * 🔴 **Keyboard reordering is not optional** (a11y: `gesture-alternative`).
 * `@hello-pangea/dnd` gives it for free: tab to a pick, space to lift, arrows
 * to move, space to drop — so this component's job is to not disable it.
 * `react-beautiful-dnd`, which the source app used, is unmaintained and does
 * not run under React 19; this is its maintained fork (D28).
 *
 * **Optimistic, reconciled on the response.** A drag that waits for a round
 * trip before the item moves feels broken, so the list moves immediately and
 * snaps back if the server refuses. The props remain the source of truth: when
 * new ones arrive — including, later, over a live connection (D48) — they
 * replace the local order rather than merging with it.
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
  const [order, setOrder] = useState<readonly ListPick[]>(picks);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // The server's answer wins. Without this the list would keep showing a stale
  // optimistic order after a pick was added or removed elsewhere on the page.
  useEffect(() => {
    setOrder(picks);
  }, [picks]);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      // No destination means the drag was cancelled or dropped outside.
      if (!result.destination) return;
      // Dropped where it started. `reorder` would return an equal list, but
      // sending it would still be a write, and a write the league sees.
      if (result.destination.index === result.source.index) return;

      const previous = order;
      const next = reorder(order, result.source.index, result.destination.index);

      setOrder(next);
      setMessage(null);

      startTransition(async () => {
        const outcome = await onReorder(next.map((pick) => pick.pickId));
        if (!outcome.ok) {
          // Snapping back is the honest thing: the board is what the league
          // sees, and it now disagrees with this list.
          setOrder(previous);
          setMessage(outcome.message);
        }
      });
    },
    [order, onReorder],
  );

  if (order.length === 0) {
    return <p className={cn('text-text-dim text-xs', className)}>No picks yet.</p>;
  }

  return (
    <div className={className}>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="picks">
          {(droppable) => (
            <ul
              ref={droppable.innerRef}
              {...droppable.droppableProps}
              className="flex flex-col"
              aria-label="Picks, in draft order — drag or use space and the arrow keys to reorder"
            >
              {order.map((pick, index) => (
                <Draggable
                  key={pick.pickId}
                  draggableId={String(pick.pickId)}
                  index={index}
                >
                  {(draggable, snapshot) => (
                    <li
                      ref={draggable.innerRef}
                      {...draggable.draggableProps}
                      className={cn(
                        'border-border-rule border-b',
                        snapshot.isDragging && 'bg-bg-raised',
                      )}
                    >
                      {/* The handle is the row's contents, not the `li`
                          itself: the library puts `role="button"` on whatever
                          carries these props, and on the `li` that would
                          replace the list semantics a screen reader uses to
                          say "3 of 8". */}
                      <div
                        {...draggable.dragHandleProps}
                        className="flex items-center gap-3 px-2 py-2"
                      >
                        {/* The position in the list, not the stored round:
                            while a drag is in flight the two differ, and the
                            number under the cursor has to be the one that will
                            be saved. */}
                        <span className="text-text-dim tabular w-6 font-mono text-xs">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        {pick.posterUrl ? (
                          // biome-ignore lint/performance/noImgElement: swapped for next/image in Phase 11 with the media migration
                          <img
                            src={pick.posterUrl}
                            alt=""
                            className="h-10 w-7 object-cover"
                          />
                        ) : null}
                        <span className="text-text-primary flex-1 text-sm">
                          {pick.title}
                        </span>
                      </div>
                    </li>
                  )}
                </Draggable>
              ))}
              {droppable.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>

      <p aria-live="polite" className="text-text-secondary min-h-5 text-xs">
        {message ?? ''}
      </p>
    </div>
  );
}

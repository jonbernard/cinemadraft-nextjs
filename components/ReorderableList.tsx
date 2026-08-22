'use client';

import {
  DragDropContext,
  Draggable,
  type DraggableProvidedDragHandleProps,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';

import type { ActionResult } from '@/actions/result';
import { cn } from '@/lib/utils/cn';
import { reorder } from '@/lib/utils/reorder';

/** What a row needs from the drag machinery to render itself. */
export type ReorderableRow = {
  /** Position in the list as it currently reads, not the stored one. */
  index: number;
  isDragging: boolean;
  /**
   * Spread on whichever element is the handle — deliberately not on the `<li>`,
   * which this component owns. The library puts `role="button"` on whatever
   * carries these props, and on the `li` that would replace the list semantics
   * a screen reader uses to say "3 of 8".
   *
   * A row with its own controls spreads these on the part that is *not* a
   * control, so a button never sits inside the handle.
   */
  handleProps: DraggableProvidedDragHandleProps | null | undefined;
};

/**
 * A list somebody arranges by hand.
 *
 * 🔴 **Keyboard reordering is not optional** (a11y: `gesture-alternative`).
 * `@hello-pangea/dnd` gives it for free: tab to a row, space to lift, arrows to
 * move, space to drop — so this component's job is to not disable it.
 * `react-beautiful-dnd`, which the source app used, is unmaintained and does not
 * run under React 19; this is its maintained fork (D28).
 *
 * **Optimistic, reconciled on the response.** A drag that waits for a round trip
 * before the item moves feels broken, so the list moves immediately and snaps
 * back if the server refuses. `items` remains the source of truth: when new
 * props arrive — including, later, over a live connection (D48) — they replace
 * the local order rather than merging with it.
 *
 * Two lists in this app are arranged by hand: a seat's draft picks, which the
 * league sees, and a member's private shortlist, which nobody does. They differ
 * only in what a row shows, so the drag, keyboard, optimism and snap-back live
 * here once and each caller supplies its own row.
 */
export function ReorderableList<T>({
  items,
  getId,
  label,
  empty,
  droppableId = 'reorderable',
  onReorder,
  itemClassName,
  className,
  children,
}: {
  items: readonly T[];
  /** The row's stable id — what `onReorder` is given, in order. */
  getId: (item: T) => number;
  /** The accessible name of the list, which must say how to reorder it. */
  label: string;
  empty?: ReactNode;
  droppableId?: string;
  onReorder: (ids: number[]) => Promise<ActionResult<unknown>>;
  itemClassName?: string;
  className?: string;
  children: (item: T, row: ReorderableRow) => ReactNode;
}) {
  const [order, setOrder] = useState<readonly T[]>(items);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // The server's answer wins. Without this the list would keep showing a stale
  // optimistic order after an item was added or removed elsewhere on the page.
  useEffect(() => {
    setOrder(items);
  }, [items]);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      // No destination means the drag was cancelled or dropped outside.
      if (!result.destination) return;
      // Dropped where it started. `reorder` would return an equal list, but
      // sending it would still be a write.
      if (result.destination.index === result.source.index) return;

      const previous = order;
      const next = reorder(order, result.source.index, result.destination.index);

      setOrder(next);
      setMessage(null);

      startTransition(async () => {
        const outcome = await onReorder(next.map(getId));
        if (!outcome.ok) {
          setOrder(previous);
          setMessage(outcome.message);
        }
      });
    },
    [order, onReorder, getId],
  );

  if (order.length === 0) {
    return <div className={className}>{empty}</div>;
  }

  return (
    <div className={className}>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId={droppableId}>
          {(droppable) => (
            <ul
              ref={droppable.innerRef}
              {...droppable.droppableProps}
              className="flex flex-col"
              aria-label={label}
            >
              {order.map((item, index) => (
                <Draggable
                  key={getId(item)}
                  draggableId={String(getId(item))}
                  index={index}
                >
                  {(draggable, snapshot) => (
                    <li
                      ref={draggable.innerRef}
                      {...draggable.draggableProps}
                      className={cn(snapshot.isDragging && 'bg-bg-raised', itemClassName)}
                    >
                      {children(item, {
                        index,
                        isDragging: snapshot.isDragging,
                        handleProps: draggable.dragHandleProps,
                      })}
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

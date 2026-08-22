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
 * `@hello-pangea/dnd` gives it for free, so this component's job is to not
 * disable it. `react-beautiful-dnd`, which the source app used, does not run
 * under React 19; this is its maintained fork (D28).
 *
 * The move is optimistic and snaps back if the server refuses. `items` stays the
 * source of truth: new props — including, later, ones arriving over a live
 * connection (D48) — replace the local order rather than merging with it.
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

  // Without this the list keeps a stale optimistic order after an item is added
  // or removed elsewhere on the page.
  useEffect(() => {
    setOrder(items);
  }, [items]);

  const onDragEnd = useCallback(
    (result: DropResult) => {
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

  // No wrapper: a caller whose `className` tunes the empty state's own type has
  // to be able to reach it.
  if (order.length === 0) return <>{empty}</>;

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
                      className={cn(itemClassName, snapshot.isDragging && 'bg-bg-raised')}
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

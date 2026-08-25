import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';
import { Eyebrow } from './Eyebrow';

/**
 * The `LetterboxRule` replacement (D74).
 *
 * The rules are gone and separation comes from space. What the rules could not
 * do, the eyebrow can: carry the metadata a reader actually wants at a section
 * boundary. The right-hand slot gives every section a scannable right edge —
 * points, counts, a link.
 *
 * `as` exists because heading level is a document-structure decision the
 * caller owns: a section header inside an already-h2 region has to be an h3 or
 * the page outline breaks for screen readers.
 *
 * `name` is D70 made mechanical: the serif renders things that have names, and
 * everything structural is Archivo. Passing `name` for "Roster" or omitting it
 * for a member's name are both bugs a reviewer can see.
 */
export function SectionHead({
  eyebrow,
  children,
  as: Tag = 'h2',
  name = false,
  right,
  rightStacksOnMobile = false,
  className,
}: {
  eyebrow?: ReactNode;
  children: ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'h4';
  name?: boolean;
  right?: ReactNode;
  /**
   * Drops the right slot beneath the heading below `sm`.
   *
   * The default row layout assumes the right slot is a short count. A wide one
   * — the season's year links — renders over a heading that has wrapped to two
   * lines on a phone, which is the defect D79 records. Opt-in rather than
   * automatic: a mono count on the right *is* the design at every width, and
   * stacking it would cost every section its scannable right edge.
   */
  rightStacksOnMobile?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex gap-4 pb-3',
        rightStacksOnMobile
          ? 'flex-col items-start sm:flex-row sm:items-end sm:justify-between'
          : 'items-end justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <Eyebrow className="mb-1">{eyebrow}</Eyebrow> : null}
        <Tag
          className={cn(
            'text-text-primary',
            name
              ? 'font-serif text-2xl tracking-[-0.02em]'
              : 'font-sans text-[17px] font-semibold tracking-[-0.01em]',
          )}
        >
          {children}
        </Tag>
      </div>
      {right ? (
        <div
          className={cn(
            'text-text-dim font-mono tabular text-sm',
            rightStacksOnMobile ? 'sm:shrink-0' : 'shrink-0',
          )}
        >
          {right}
        </div>
      ) : null}
    </div>
  );
}

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';
import { Eyebrow } from './Eyebrow';

/**
 * 🔴 28 / 20 / 17, keyed to the heading level (decided 2026-09-12).
 *
 * Every `SectionHead` used to render at 17px whatever `as` said, so the page's
 * own `h1` was visibly outranked by any league name — which is 24px serif. 28
 * is chosen for exactly that: an `h1` has to outrank a name.
 *
 * 🔴 **This is not a D70 change.** D70 assigns *faces* semantically — serif for
 * proper nouns, Archivo for structure — and says nothing about size. An
 * Archivo `h1` at 28px honours it exactly, and the serif `name` variant below
 * stays 24px on its own axis: the face rule is not the hierarchy.
 *
 * `h4` shares `h3`'s 17px. Three sizes for four levels is deliberate — a
 * fourth step below 17 would collide with body text once P17.T18 moves that to
 * 15px, and nothing in the app nests four heading levels deep today.
 *
 * 🔴 Note for P17.T18 and P17.T23, which both sweep these components: the gap
 * between the 17px `h3` and body text is 3px today and 2px after T18. That is
 * intended at this size — an `h3` is a label, not a headline — but if the
 * sweep makes them indistinguishable, the `h3` moves, not the body.
 */
const SIZE = {
  h1: 'text-[28px] tracking-[-0.02em]',
  h2: 'text-[20px] tracking-[-0.015em]',
  h3: 'text-[17px] tracking-[-0.01em]',
  h4: 'text-[17px] tracking-[-0.01em]',
} as const;

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
              : cn('font-sans font-semibold', SIZE[Tag]),
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

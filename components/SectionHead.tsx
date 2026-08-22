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
  className,
}: {
  eyebrow?: ReactNode;
  children: ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'h4';
  name?: boolean;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-end justify-between gap-4 pb-3', className)}>
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
        <div className="text-text-dim font-mono tabular shrink-0 text-sm">{right}</div>
      ) : null}
    </div>
  );
}

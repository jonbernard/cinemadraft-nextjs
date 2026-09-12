import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';
import { SectionHead } from './SectionHead';

/**
 * A horizontal poster row.
 *
 * 🔴 Scrolling rather than compressing is the mitigation for the rail's width
 * cost (spec §11.4): at 1280px the rail leaves 966px where the old container
 * gave 1152px, so a 10-seat roster cannot be laid out flat. A shelf that
 * scrolls holds any seat count at any width; a grid that compresses does not.
 *
 * `overflow-x-auto` with `snap-x` and per-item `snap-start`, so a flick lands
 * on a poster edge rather than mid-image.
 */
export function Shelf({
  as = 'h2',
  eyebrow,
  heading,
  href,
  right,
  children,
  className,
}: {
  /**
   * h2, not h3. A shelf is a top-level section of the page it sits on — `/`
   * ran h1 → h3 → h2, which skips a level and then steps back up. It was
   * invisible while every heading rendered at 17px and became a visible mess
   * the moment P17.T1 gave them sizes.
   *
   * 🔴 The prop exists because one consumer really is nested: `DraftBoard`
   * renders a shelf per seat under a `Group N` h2, and h2 there would put a
   * seat beside the group that holds it. Every call site on `/` is top-level
   * and takes the default.
   */
  as?: 'h2' | 'h3';
  eyebrow?: ReactNode;
  heading: ReactNode;
  href?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('min-w-0', className)}>
      <SectionHead as={as} eyebrow={eyebrow} right={right}>
        {href ? (
          <Link
            href={href}
            className="focus-visible:outline-accent-fill hover:text-accent-text inline-flex items-center gap-1 focus-visible:outline-2"
          >
            {heading}
            <span aria-hidden="true">→</span>
          </Link>
        ) : (
          heading
        )}
      </SectionHead>
      <ul className="snap-x scroll-px-1 flex gap-3 overflow-x-auto pb-2 [&>li]:snap-start [&>li]:shrink-0">
        {children}
      </ul>
    </section>
  );
}

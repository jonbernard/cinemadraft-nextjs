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
  eyebrow,
  heading,
  href,
  right,
  children,
  className,
}: {
  eyebrow?: ReactNode;
  heading: ReactNode;
  href?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('min-w-0', className)}>
      <SectionHead as="h3" eyebrow={eyebrow} right={right}>
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

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * The one piece of `LetterboxRule` worth keeping (D74): 2.39:1, cinema's
 * widest common ratio, as a *layout unit* rather than a decorative rule.
 *
 * `aspect-ratio` rather than a padding hack — every browser the project
 * supports has it, and the padding trick fights `object-fit` on the banner
 * images this wraps.
 */
export function CinemaFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('relative w-full overflow-hidden', className)}
      style={{ aspectRatio: '2.39 / 1' }}
    >
      {children}
    </div>
  );
}

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * The only place `--radius-pill` is allowed (D73). A pill button reads as a
 * consumer app; a pill *status* reads as a badge, which is what this is.
 *
 * Brass is awards, carmine is urgency (D69). `neutral` exists for states that
 * are neither — "Unclaimed", "Not started" — which previously borrowed the
 * urgency red and made every board look like something was wrong.
 */
export function StatusChip({
  children,
  tone = 'neutral',
  icon,
  className,
}: {
  children: ReactNode;
  tone?: 'brass' | 'carmine' | 'neutral';
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'font-sans inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold',
        tone === 'brass' && 'bg-brass-fill text-brass-contrast',
        tone === 'carmine' && 'bg-accent-fill text-white',
        tone === 'neutral' && 'bg-bg-raised text-text-secondary',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

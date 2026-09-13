import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * The only place `--radius-pill` is allowed (D73). A pill button reads as a
 * consumer app; a pill *status* reads as a badge, which is what this is.
 *
 * Brass is awards, carmine is urgency (D69). `neutral` exists for states that
 * are neither — "Unclaimed", "Not started" — which previously borrowed the
 * urgency red and made every board look like something was wrong.
 *
 * 🔴 `beam` is scheduled-and-not-yet: the next show on the season rail, a date
 * TBA, a countdown (D69, P17.T20). Deliberately NOT `carmine` — that is
 * urgency, a deadline you can miss, and nobody misses an award show's date —
 * and deliberately NOT `brass`, which is an award. It is ink rather than a fill
 * because `theme/contrast.test.ts` proves beam readable as text on the app's
 * surfaces in both schemes, and proves nothing about white or black on top of
 * it; a beam fill would owe a `beam.contrast` token and its own rows first.
 */
export function StatusChip({
  children,
  tone = 'neutral',
  icon,
  className,
}: {
  children: ReactNode;
  tone?: 'brass' | 'carmine' | 'beam' | 'neutral';
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'font-sans inline-flex items-center gap-2 rounded-pill px-3 py-1 text-xs font-semibold',
        tone === 'brass' && 'bg-brass-fill text-brass-contrast',
        tone === 'carmine' && 'bg-accent-fill text-white',
        tone === 'beam' && 'bg-bg-surface text-beam',
        tone === 'neutral' && 'bg-bg-surface text-text-secondary',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

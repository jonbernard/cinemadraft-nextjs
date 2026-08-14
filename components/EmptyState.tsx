import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * An empty screen is an invitation to act, not an apology.
 *
 * The three states this app actually has are different situations and need
 * different words, which is why the copy is the caller's rather than a
 * `variant` prop with a lookup table inside:
 *
 *   - **No league.** The member can fix this right now; give them the action.
 *   - **In a league, not drafted yet.** They can do nothing until the draft
 *     opens. The job is to say so, and name the date if there is one, so the
 *     page does not read as broken.
 *   - **Drafted, nothing scored.** Not an empty state at all — the roster and
 *     the season rail both have plenty to look at, so the dashboard renders
 *     them and says the season has not started.
 *
 * No apologies and no exclamation marks: nothing has gone wrong in any of
 * these cases.
 */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: ReactNode;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border-rule bg-bg-surface flex flex-col items-start gap-3 border p-6',
        className,
      )}
    >
      <h3 className="font-display text-text-primary text-sm font-bold uppercase tracking-wide [font-variation-settings:'wdth'_118]">
        {title}
      </h3>

      {children ? (
        <p className="text-text-secondary max-w-prose text-sm leading-relaxed">
          {children}
        </p>
      ) : null}

      {action ? (
        <Link
          href={action.href}
          // Carmine as a fill with white on it — 6.58:1. The same colour as
          // text on the ground is 2.96:1 and fails, which is why accent.fill
          // is fill-only (§6.2).
          className="bg-accent-fill mt-1 px-4 py-2 text-sm font-medium text-white"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

import Link from 'next/link';

import { cn } from '@/lib/utils/cn';

/**
 * The way in and out of TV mode (P14.T6).
 *
 * 🔴 **TV mode is a URL, not component state.** `?tv=1` is what makes the
 * screen a league puts on a television shareable — one person opens the link
 * and casts it, and a reload during a three-hour ceremony comes back the same
 * way it went. State would survive neither, and a link is also what lets the
 * server render the mode into the first paint, so the chrome never flashes on
 * before something hides it.
 *
 * 🔴 **It is visible in both directions, in the same place, always.** A
 * control that hides itself once the mode is on is a trap: the reader is on a
 * television with a remote, not a keyboard, so there is no Escape to press and
 * no shortcut to know. This is a focusable link in the page's own header, so a
 * D-pad reaches it exactly the way it reaches everything else on the screen —
 * and the label says what pressing it will do, not what mode is currently on.
 *
 * A plain server component: no hooks, no `useSearchParams`, nothing that could
 * re-render the tree the live room's `EventSource` is mounted in.
 */
export function TvModeLink({
  href,
  active,
  className,
}: {
  href: string;
  active: boolean;
  /** Placement only — `/live` pushes it to the end of its row with `ml-auto`. */
  className?: string;
}) {
  return (
    <Link
      href={href}
      // 🔴 The league page's `SecondaryAction` treatment, verbatim, and the
      // `Button` primitive's 6px radius with it. It used to be the strip's
      // square "Start a league" box, and on the league page it sat beside
      // three rounded controls as the one squared button in the row — which
      // the Phase 3.5 brief forbids by name. 44px, the smallest thing worth
      // aiming a remote at.
      className={cn(
        'border-border-rule text-text-primary hover:bg-bg-surface focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm border px-4 text-sm focus-visible:outline-2',
        className,
      )}
    >
      {active ? 'Leave TV mode' : 'TV mode'}
    </Link>
  );
}

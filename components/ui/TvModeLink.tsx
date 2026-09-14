import Link from 'next/link';

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
export function TvModeLink({ href, active }: { href: string; active: boolean }) {
  return (
    <Link
      href={href}
      // The strip's "Start a league" treatment, verbatim — a 44px bordered
      // target, which is also the smallest thing worth aiming a remote at.
      className="border-border-rule text-text-primary hover:bg-bg-surface focus-visible:outline-accent-fill ml-auto flex min-h-11 items-center gap-2 border px-4 text-sm focus-visible:outline-2"
    >
      {active ? 'Leave TV mode' : 'TV mode'}
    </Link>
  );
}

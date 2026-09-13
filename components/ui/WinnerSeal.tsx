import { cn } from '@/lib/utils/cn';

/**
 * The mark that says a film won: a brass disc with a star punched out of it.
 *
 * 🔴 **It replaced a corner fold, and the reason is the ceremony.** The fold —
 * a triangle clipped into the frame's top-right corner — is a page-corner flag,
 * which is the right weight at 24px on a roster read from a desk. It cannot be
 * the live page's mark, because that screen reveals a winner by bringing the
 * mark up over the poster and settling it, and a folded corner has nothing to
 * grow into: at 3.6× it is a brass wedge across the artwork and means nothing.
 * A star means "won" at any size, which is the whole requirement.
 *
 * Brass because a win is an award outcome and brass is what that means (D99).
 * Drawn, not an emoji and not an icon font: ⭐ renders as somebody else's
 * artwork at somebody else's weight, and in this product the marks are ours.
 *
 * The star is `brass.contrast` rather than a hole, so the mark reads the same
 * over a bright poster as over a dark one — a knocked-out star shows whatever
 * is behind it, which on film artwork is anything at all.
 */
export function WinnerSeal({ className }: { className?: string }) {
  return (
    <svg
      // Decorative: every caller states the win in words beside it — the
      // "Winner" badge on the live page, the accessible name on `PosterFrame`.
      // A second announcement would read the same fact twice.
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 48 48"
      className={cn('text-brass-fill', className)}
    >
      <circle cx="24" cy="24" r="22" fill="currentColor" />
      <path
        d="M24 9.5l4.3 8.7 9.7 1.4-7 6.8 1.7 9.6L24 31.5l-8.7 4.5 1.7-9.6-7-6.8 9.7-1.4z"
        className="fill-brass-contrast"
      />
    </svg>
  );
}

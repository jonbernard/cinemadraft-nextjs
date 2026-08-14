import { PosterFrame, type PosterStatus } from '@/components/PosterFrame';
import { cn } from '@/lib/utils/cn';

export type RosterFilm = {
  id: number;
  title: string;
  posterUrl: string | null;
  /** Draft round, from 1. */
  round: number;
  points: number;
  /** Share of the seat's total, 0–1. */
  share: number;
  accent?: string;
  status?: PosterStatus;
};

/**
 * A seat's drafted films (§6.7).
 *
 * 🔴 **No count is assumed anywhere (D34).** Every year the number of picks is
 * decided on the fly and every league sets its own — the production data
 * already runs 7, 8 and 9 across seasons with no constraint enforcing any of
 * them, and 6 or 30 are equally valid. So the strip lays out whatever it is
 * handed.
 *
 * That is why the grid **wraps** rather than fitting everything on one line.
 * A single row that divides by the film count looks tidy at eight and becomes
 * unreadable slivers at thirty; wrapping keeps every poster the same legible
 * size and spends vertical space instead, which a page has more of.
 *
 * The column count comes from a **minimum frame width**, not from
 * breakpoints. §6.7 asks for 8 across on desktop and a two-line title clamp,
 * and those two rules conflict: at 1440px, eight columns leave each frame
 * around 130px, which is not enough for a 24-character title in two lines —
 * "One Battle After Another" clipped, which is the exact defect this redesign
 * exists to fix. `auto-fill` with a 10rem floor fits as many frames as will
 * stay readable and no more, so the strip honours the intent of the spec (as
 * many as fit) rather than its arithmetic. Caught by the E2E gate at 1440px;
 * 375 and 768 already passed, which is why a fixed rule looked fine.
 *
 * Ordering is the caller's: the service sorts by draft round, and this must
 * not re-sort. Snake order is real information — round 1 cost more than the
 * last round — and sorting by points here would silently destroy it.
 */
export function RosterStrip({
  films,
  className,
}: {
  films: readonly RosterFilm[];
  className?: string;
}) {
  if (films.length === 0) {
    return (
      <p className={cn('text-text-secondary text-sm', className)}>
        No films drafted yet.
      </p>
    );
  }

  return (
    <ul
      className={cn(
        'grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4',
        className,
      )}
      // The list is ordered by draft round, and that order carries meaning,
      // so it is announced as a list rather than a bag of figures.
      aria-label="Drafted films, in draft order"
    >
      {films.map((film) => (
        <li key={film.id}>
          <PosterFrame
            title={film.title}
            posterUrl={film.posterUrl}
            round={film.round}
            points={film.points}
            share={film.share}
            accent={film.accent}
            status={film.status}
          />
        </li>
      ))}
    </ul>
  );
}

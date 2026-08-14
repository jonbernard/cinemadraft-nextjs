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
 * size and spends vertical space instead, which a page has more of. The
 * breakpoints are fixed (2 / 4 / 8 across) precisely so they do not depend on
 * how many films there are.
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
      className={cn('grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8', className)}
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

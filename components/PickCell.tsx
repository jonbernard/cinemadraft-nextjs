import { type LedgerRow, PointsLedger } from '@/components/PointsLedger';
import { RemoteImage } from '@/components/RemoteImage';
import { cn } from '@/lib/utils/cn';

export type PickCellFilm = {
  title: string;
  posterUrl: string | null;
  points: number;
  /** Per-award breakdown; empty for a film that scored nothing. */
  ledger?: readonly LedgerRow[];
};

/**
 * One cell of the draft board (§6.7).
 *
 * "Scan by image, confirm by text" — during a draft call the owner needs to
 * know whether a film is gone in the time it takes to glance, and reading
 * twelve titles to find out is too slow. So the artwork carries the
 * recognition and the title only confirms it.
 *
 * An empty cell is rendered explicitly rather than omitted. A seat with fewer
 * picks than the longest in its group is normal (D34), and a missing cell
 * would collapse the grid and misalign every round after it.
 */
export function PickCell({
  film,
  round,
  className,
}: {
  film?: PickCellFilm;
  round: number;
  className?: string;
}) {
  if (!film) {
    return (
      <div
        className={cn(
          'poster-radius bg-bg-base/40 light:border-border-rule flex aspect-[2/3] items-center justify-center light:border light:border-dashed',
          className,
        )}
      >
        {/* Says "nothing here yet" rather than looking like a failed image. */}
        <span className="text-text-dim tabular font-mono text-xs">
          {String(round).padStart(2, '0')}
        </span>
      </div>
    );
  }

  return (
    <figure className={cn('flex flex-col gap-1', className)}>
      <div className="poster-radius bg-bg-raised light:border-border-rule relative aspect-[2/3] overflow-hidden light:border">
        {film.posterUrl ? (
          <RemoteImage
            src={film.posterUrl}
            alt=""
            fill
            sizes="96px"
            className="object-cover"
          />
        ) : (
          <span className="text-text-dim absolute inset-0 grid place-items-center font-mono text-xs">
            {film.title.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="text-text-dim tabular absolute left-1 top-1 font-mono text-[0.65rem]">
          {String(round).padStart(2, '0')}
        </span>
      </div>

      <figcaption className="flex flex-col">
        <span className="text-text-primary line-clamp-2 text-xs leading-tight">
          {film.title}
        </span>
        {/* The number explains itself in place (§6.7): the board stays
            scannable, and the answer to "why" is one interaction away rather
            than on another page. */}
        <PointsLedger total={film.points} lines={film.ledger ?? []} label={film.title} />
      </figcaption>
    </figure>
  );
}

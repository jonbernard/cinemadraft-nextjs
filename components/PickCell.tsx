import { cn } from '@/lib/utils/cn';

export type PickCellFilm = {
  title: string;
  posterUrl: string | null;
  points: number;
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
          'border-border-rule bg-bg-base/40 flex aspect-[2/3] items-center justify-center border border-dashed',
          className,
        )}
      >
        {/* Says "nothing here yet" rather than looking like a failed image. */}
        <span className="text-text-dim font-mono text-xs">
          {String(round).padStart(2, '0')}
        </span>
      </div>
    );
  }

  return (
    <figure className={cn('flex flex-col gap-1', className)}>
      <div className="bg-bg-raised border-border-rule relative aspect-[2/3] overflow-hidden border">
        {film.posterUrl ? (
          // biome-ignore lint/performance/noImgElement: swapped for next/image in Phase 11 with the media migration
          <img src={film.posterUrl} alt="" className="h-full w-full object-cover" />
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
        <span className="text-text-secondary tabular font-mono text-[0.65rem]">
          {film.points}
        </span>
      </figcaption>
    </figure>
  );
}

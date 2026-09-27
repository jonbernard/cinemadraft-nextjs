import { type LedgerRow, PointsLedger } from '@/components/awards/PointsLedger';
import { RemoteImage } from '@/components/ui/RemoteImage';
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
 *
 * 🔴 The empty cell's round number and the initials placeholder stay `dim`
 * (P17.T34). Both are text a reader never needs to read: one says "nothing here
 * yet" without looking like a failed image, the other stands in for artwork that
 * has not arrived. That is what `dim` is for. The round badge over a real
 * poster is also still `dim`, and by the same rule it is information — the
 * round this pick was taken in. Moving it was outside T34's named sites; it is
 * flagged, not decided.
 */
export function PickCell({
  film,
  round,
  tv = false,
  className,
}: {
  film?: PickCellFilm;
  round: number;
  /**
   * TV sizing (D124). Three things change and nothing else:
   *
   * 🔴 **The box is `3/4`, not `2/3`** — a deliberate 12.5% squat. The board's
   * binding constraint is height (four seats down 1080), so the poster's height
   * is fixed by arithmetic no matter what; the only thing a ratio buys is
   * *width*, and 3:4 buys 12.5% of it for an 11% centre crop under
   * `object-cover`. The owner asked for exactly this trade: "if you need to
   * scale things down vertically, scale down the posters."
   *
   * 🔴 **The caption is one line, on one row.** Two 12px lines plus a points
   * line cost 50px of every row — 200px of the 1080, taken off the posters.
   *
   * 🔴 **No disclosure.** `PointsLedger` opens a panel in flow; a row sized to
   * the pixel would be blown apart by one, and a remote has no good way to shut
   * it again. The total still shows — see the call below.
   */
  tv?: boolean;
  className?: string;
}) {
  if (!film) {
    return (
      <div
        className={cn(
          'poster-radius bg-bg-ground/40 light:border-border-rule flex items-center justify-center light:border light:border-dashed',
          tv ? 'aspect-[3/4]' : 'aspect-[2/3]',
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
      <div
        className={cn(
          'poster-radius bg-bg-surface light:border-border-rule relative overflow-hidden light:border',
          tv ? 'aspect-[3/4]' : 'aspect-[2/3]',
        )}
      >
        {film.posterUrl ? (
          <RemoteImage
            src={film.posterUrl}
            alt=""
            fill
            // A television renders these two to three times the size a desktop
            // board does; asking for the 96px source there is a blurred poster.
            sizes={tv ? '256px' : '96px'}
            className="object-cover"
          />
        ) : (
          <span className="text-text-dim absolute inset-0 grid place-items-center font-mono text-xs">
            {film.title.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="text-text-dim tabular absolute left-1 top-1 font-mono text-xs">
          {String(round).padStart(2, '0')}
        </span>
      </div>

      <figcaption
        className={cn('flex', tv ? 'items-baseline justify-between gap-2' : 'flex-col')}
      >
        <span
          // 🔴 `leading-tight` rides along inside each branch rather than
          // sitting in the shared prefix. `cn` is `twMerge`, and twMerge treats
          // a font size as conflicting with a line height — a later `text-xs`
          // deletes an earlier `leading-tight`. Hoisting it silently added 1px
          // a line to every caption on the ORDINARY board, which is how this
          // was caught: 5728px of page became 5780.
          className={cn(
            'text-text-primary',
            tv
              ? 'line-clamp-1 text-sm leading-tight'
              : 'line-clamp-2 text-xs leading-tight',
          )}
        >
          {film.title}
        </span>
        {/* The number explains itself in place (§6.7): the board stays
            scannable, and the answer to "why" is one interaction away rather
            than on another page.

            🔴 On a television there are no lines to give it, which is how the
            disclosure is turned off — `PointsLedger` with no lines renders the
            bare total, which is the whole of what a room across the sofa can
            read anyway. */}
        <PointsLedger
          total={film.points}
          lines={tv ? [] : (film.ledger ?? [])}
          label={film.title}
        />
      </figcaption>
    </figure>
  );
}

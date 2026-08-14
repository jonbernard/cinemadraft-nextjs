import { cn } from '@/lib/utils/cn';

export type PosterStatus = 'none' | 'nominated' | 'won';

export type PosterFrameProps = {
  title: string;
  posterUrl: string | null;
  /** Draft round, rendered from 01. There is no roster size (D34). */
  round: number;
  points: number;
  /** This film's share of the team total, 0–1. Drives the contribution bar. */
  share?: number;
  /**
   * The film's own accent, already passed through `clampAccent`. Raw
   * `Movie.accentHex` must never be handed straight to this prop — an
   * unclamped poster colour can be near-black on the dark ground, rendering
   * the contribution bar invisible, which reads as "scored nothing".
   */
  accent?: string;
  status?: PosterStatus;
  className?: string;
};

/**
 * A single drafted film — the atom the roster strip and draft board are built
 * from (§6.7).
 *
 * Three rules here each fix a defect in the current app:
 *
 * The title sits BELOW the frame at full width. The current app overlays it on
 * the artwork, which truncates to "One Ba…", "Is This …", "Wake …" — the film
 * becomes unidentifiable at exactly the moment you are scanning for it.
 *
 * One signal per fact. A win is a carmine corner seal; a live nomination is a
 * top hairline. The current app marks a winner with both a size change and a
 * green check, and green reads as validation state rather than victory.
 *
 * Never greyed out by score. The strip is ordered by draft position, not
 * performance — a last pick may be the best pick, and dimming it asserts
 * otherwise.
 */
export function PosterFrame({
  title,
  posterUrl,
  round,
  points,
  share = 0,
  accent,
  status = 'none',
  className,
}: PosterFrameProps) {
  // A share outside 0–1 is a caller bug, but clamping beats overflowing: a bar
  // wider than its track breaks the grid for every sibling.
  const width = Math.min(100, Math.max(0, share * 100));

  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      {/* The hairline border is required by §6.3 and is not decoration. The
          dark theme is a room that contains a poster on its own; warm paper is
          not, and without an edge the frame dissolves into the ground. It is a
          token, so it swaps with the theme and no branch is needed (D15) — in
          dark it reads as a barely-there seam, which is the intent. */}
      <div
        className={cn(
          'bg-bg-raised border-border-rule relative aspect-[2/3] overflow-hidden border',
          status === 'nominated' && 'border-t-accent-fill border-t-2',
        )}
      >
        {posterUrl ? (
          // biome-ignore lint/performance/noImgElement: swapped for next/image in Phase 5, which needs the remote host allowlist configured first
          <img src={posterUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-text-dim absolute inset-0 grid place-items-center font-mono text-xs">
            {title.slice(0, 2).toUpperCase()}
          </span>
        )}

        <span className="text-text-dim tabular absolute left-1 top-1 font-mono text-xs">
          {String(round).padStart(2, '0')}
        </span>

        {status === 'won' && (
          <span
            aria-label="Winner"
            role="img"
            className="bg-accent-fill absolute right-0 top-0 h-6 w-6 [clip-path:polygon(100%_0,100%_100%,0_0)]"
          />
        )}
      </div>

      <figcaption className="flex flex-col gap-1">
        <span className="text-text-primary line-clamp-2 text-sm leading-tight">
          {title}
        </span>
        <span className="text-text-secondary tabular font-mono text-xs">{points}</span>
        {/* Hierarchy without resizing frames: every frame stays the same size,
            so the grid holds, and the bar carries the magnitude. */}
        <span className="bg-bg-raised block h-0.5 w-full" aria-hidden="true">
          <span
            className="block h-full"
            style={{
              width: `${width}%`,
              backgroundColor: accent ?? 'var(--color-accent-fill)',
            }}
          />
        </span>
      </figcaption>
    </figure>
  );
}

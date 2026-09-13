import { RemoteImage } from '@/components/RemoteImage';
import { cn } from '@/lib/utils/cn';

export type PosterStatus = 'none' | 'nominated' | 'won';

export type PosterFrameProps = {
  title: string;
  posterUrl: string | null;
  /**
   * Draft round, rendered from 01. There is no roster size (D34).
   *
   * Optional because a poster is not always a pick: an award-show nominee has
   * no draft position and no score of its own, and passing a placeholder `0`
   * to satisfy the type would print `00` beside every nominee.
   */
  round?: number;
  points?: number;
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
  /**
   * Preload this poster instead of lazy-loading it.
   *
   * 🔴 For the one or two frames that are the page's LCP, and nothing else.
   * `priority` emits a `<link rel="preload">` per image, so setting it on a
   * whole shelf makes twelve preloads race for the same connections and the
   * LCP gets slower, not faster. Measured in a production build: the
   * dashboard's LCP element is the first `In cinemas now` frame and every
   * TMDB request went out at `Low`. This is the answer to that, applied
   * narrowly by the page that knows which frame is first.
   *
   * 🔴 Never pass this together with a `loading` value — `next/image` rejects
   * the pair at runtime.
   */
  priority?: boolean;
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
 * One signal per fact. A win is a **brass** corner seal; a live nomination is
 * a top hairline. The current app marks a winner with both a size change and a
 * green check, and green reads as validation state rather than victory.
 *
 * 🔴 The seal was carmine from Phase 3.5 until 2026-09-13. D99 then settled
 * what brass means — an award outcome, and nothing else — and a win is the
 * award outcome the whole product is about, so carmine here was the palette
 * arguing with itself: the same red marked a deadline, the viewer's own seat,
 * and a victory. The owner's ruling was that the sitewide rule wins over the
 * local choice. Nothing else about the seal moved.
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
  priority = false,
  className,
}: PosterFrameProps) {
  // A share outside 0–1 is a caller bug, but clamping beats overflowing: a bar
  // wider than its track breaks the grid for every sibling.
  const width = Math.min(100, Math.max(0, share * 100));

  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      {/* The hairline border is required by §6.3 and is not decoration, but
          only in light: the dark theme is a room that contains a poster on
          its own, while warm paper is not, and without an edge the frame
          dissolves into the ground. Radius is proportional, not a token —
          posters are excluded from the 3/6/10/16/pill scale so a percentage
          resolves against each frame's own box.

          The top edge is split from the other three: measuring in a real
          browser showed Tailwind emits `light:` utilities after plain ones
          regardless of source order, so a single `light:border` shorthand
          silently outranks the nomination marker's plain `border-t-2` /
          `border-t-accent-fill` on light mode's top edge (border-top-width
          came back 1px grey instead of 2px carmine). Keeping `light:border-t`
          mutually exclusive with the nominated branch means the two rules
          for the top edge never coexist, so there is nothing for the
          cascade to arbitrate. */}
      <div
        className={cn(
          'poster-radius bg-bg-surface relative aspect-[2/3] overflow-hidden',
          'light:border-x light:border-b light:border-x-border-rule light:border-b-border-rule',
          status === 'nominated'
            ? 'border-t-accent-fill border-t-2'
            : 'light:border-t light:border-t-border-rule',
        )}
      >
        {posterUrl ? (
          <RemoteImage
            src={posterUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 50vw"
            priority={priority}
            className="object-cover"
          />
        ) : (
          <span className="text-text-dim absolute inset-0 grid place-items-center font-mono text-xs">
            {title.slice(0, 2).toUpperCase()}
          </span>
        )}

        {round == null ? null : (
          <span className="text-text-dim tabular absolute left-1 top-1 font-mono text-xs">
            {String(round).padStart(2, '0')}
          </span>
        )}

        {status === 'won' && (
          // 🔴 CSS, not a client component. PosterFrame is a Server Component
          // and cannot read matchMedia; `motion-reduce:` compiles to the media
          // query, so a reader who asked for less motion gets the seal present
          // in its final state immediately — the GroupCeremony contract in two
          // classes rather than a state machine.
          //
          // One run, then the static mark this has always rendered. A seal is
          // permanent; anything that loops would read as "pending".
          <span
            aria-label="Winner"
            role="img"
            className="bg-brass-fill animate-stamp motion-reduce:animate-none absolute right-0 top-0 h-6 w-6 [clip-path:polygon(100%_0,100%_100%,0_0)]"
          />
        )}
      </div>

      <figcaption className="flex flex-col gap-1">
        <span className="text-text-primary line-clamp-2 font-serif text-sm leading-tight">
          {title}
        </span>
        {points == null ? null : (
          <span className="text-text-secondary tabular font-mono text-xs">{points}</span>
        )}
        {/* Hierarchy without resizing frames: every frame stays the same size,
            so the grid holds, and the bar carries the magnitude. Omitted with
            the score, because a bar showing a share of nothing is noise. */}
        {points == null ? null : (
          <span className="bg-bg-surface block h-0.5 w-full" aria-hidden="true">
            <span
              className="block h-full"
              style={{
                width: `${width}%`,
                backgroundColor: accent ?? 'var(--color-accent-fill)',
              }}
            />
          </span>
        )}
      </figcaption>
    </figure>
  );
}

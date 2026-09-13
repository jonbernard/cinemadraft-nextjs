import { cn } from '@/lib/utils/cn';

/**
 * Metacritic's three bands, ported exactly.
 *
 * From `server/routes/movie/movie.js:117`: 61 and above is green, 40 and above
 * yellow, below that red. It is Metacritic's own rule and readers know it from
 * their site — inventing a different threshold would make the same film look
 * better here than there.
 */
function band(score: number): 'high' | 'mid' | 'low' {
  if (score >= 61) return 'high';
  if (score >= 40) return 'mid';
  return 'low';
}

const COLOUR = {
  high: 'text-score-high border-score-high',
  mid: 'text-score-mid border-score-mid',
  low: 'text-score-low border-score-low',
} as const;

/**
 * One critic score, named and numbered.
 *
 * 🔴 **Colour is the second signal, never the only one** (§6.7, a11y
 * `color-not-only`). The number is printed inside the chip and the source is
 * named beside it, so the chip reads correctly in greyscale, to a colour-blind
 * viewer, and in print. The source app's version was a bare coloured square
 * with a number in it and no label at all — the reader had to know that green
 * meant Metacritic and the neighbouring tomato meant Rotten Tomatoes.
 *
 * 🔴 **A hairline chip rather than Metacritic's filled box.** Filling would
 * force all three band colours dark enough to carry white text at 4.5:1, which
 * makes them muddy and mutually indistinguishable — destroying the one thing a
 * traffic light is for. As text on the app's own surface they stay bright and
 * legible, and the hairline is the border that carries this chip's own
 * meaning — the traffic-light band — rather than decoration. See `theme/tokens.ts`.
 *
 * `out of 100` is spelled out rather than shown as `94/100`: the denominator is
 * the same for both sources this renders, and a slash reads as a fraction of
 * something the reader has to work out.
 */
export function RatingChip({
  label,
  score,
  className,
}: {
  label: string;
  /** 0–100. */
  score: number;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span
        className={cn(
          'tabular flex h-11 w-11 shrink-0 items-center justify-center border font-mono text-base',
          COLOUR[band(score)],
        )}
      >
        {score}
      </span>
      <span className="flex flex-col">
        <span className="text-text-primary text-sm">{label}</span>
        <span className="text-text-dim text-xs">out of 100</span>
      </span>
    </div>
  );
}

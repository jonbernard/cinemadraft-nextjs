import { cn } from '@/lib/utils/cn';

/**
 * A 0.5–5 star rating, drawn and also written out.
 *
 * 🔴 Not `RatingChip`. That renders a 0–100 critic score in a coloured band; a
 * member's own rating is a different scale and a different claim, and reusing
 * the band would say "82% fresh" where the data says "four and a half stars".
 *
 * Stars alone would be shape-only, which §6.7 rules out for the same reason as
 * colour-only — a half-filled glyph at 16px is not a value anyone can read
 * back. The figure beside them is the fact; the stars are the treatment.
 * Neutral ink rather than brass: brass means an award, and nobody nominated
 * this.
 */
export function RatingStars({
  rating,
  size = 'md',
  className,
}: {
  rating: number;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const box = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';

  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span aria-hidden="true" className="flex items-center gap-0.5">
        {[0, 1, 2, 3, 4].map((index) => (
          <span key={index} className={cn('relative block', box)}>
            <Star className="text-border-rule absolute inset-0" />
            <span
              // The test's handle on how much of this star is filled — the
              // width is the whole behaviour of a half star and there is no
              // layout in jsdom to measure it any other way.
              data-fill=""
              className="absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${Math.min(Math.max(rating - index, 0), 1) * 100}%` }}
            >
              <Star className={cn('text-text-primary absolute top-0 left-0', box)} />
            </span>
          </span>
        ))}
      </span>
      <span className="text-text-secondary tabular font-mono text-sm">
        {rating.toFixed(1)}
        <span className="sr-only"> out of 5</span>
      </span>
    </span>
  );
}

function Star({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn('h-full w-full', className)}
    >
      <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.45 6.19 20.5l1.11-6.47L2.6 9.45l6.5-.95z" />
    </svg>
  );
}

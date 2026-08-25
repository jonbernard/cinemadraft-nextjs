import { cn } from '@/lib/utils/cn';

/**
 * The Cinemadraft lockup: the mark, then the name (P15.T5, D83).
 *
 * 🔴 **One accessible name for the pair.** The group carries `role="img"` and
 * `aria-label="Cinemadraft"`, and the text is `aria-hidden`, so a screen
 * reader says the name once instead of announcing an unnamed graphic followed
 * by the word. That is also why the mark's own `<svg>` is hidden rather than
 * labelled: two labels here would be read twice.
 *
 * **The mark is inline SVG, not `app/icon.svg`.** It has to inherit
 * `currentColor` so the rail's ink and a dark-on-light print both work from
 * one file; an `<img>` cannot. The icon route conventions carry their own copy
 * of the same geometry, with the colours baked in — those are served to a
 * browser chrome this app does not control, which is the one place inheriting
 * makes no sense.
 *
 * **Sora, and only here (D83).** The wordmark is the single place in the app
 * that is not Archivo, Instrument Serif, Newsreader or Plex Mono. See
 * `theme/fonts.ts` for why it must not spread.
 */
export function Wordmark({
  size = 'md',
  markOnly = false,
  className,
}: {
  /** `sm` is the rail and the strip; `md` is a page header or an OG card. */
  size?: 'sm' | 'md';
  /** The mark alone, for a square slot. Still carries the full name for AT. */
  markOnly?: boolean;
  className?: string;
}) {
  const mark = size === 'sm' ? 26 : 34;

  return (
    <span
      role="img"
      aria-label="Cinemadraft"
      className={cn(
        'inline-flex items-center',
        size === 'sm' ? 'gap-2' : 'gap-3',
        className,
      )}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 32 32"
        width={mark}
        height={mark}
        className="shrink-0"
      >
        {/* A reel whose ring breaks on the right: the same shape reads as a
            film reel and as the C of the name. Geometry is duplicated in
            `app/icon.svg` — the two must be changed together. */}
        <circle
          cx="16"
          cy="16"
          r="10.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="6.4"
          strokeDasharray="46.18 21.68"
          transform="rotate(57.5 16 16)"
        />
        <circle cx="16" cy="16" r="4" className="fill-accent-fill" />
      </svg>

      {markOnly ? null : (
        <span
          aria-hidden="true"
          className={cn(
            'font-wordmark leading-none tracking-[-0.035em]',
            size === 'sm' ? 'text-[20px]' : 'text-[27px]',
          )}
        >
          Cinemadraft
        </span>
      )}
    </span>
  );
}

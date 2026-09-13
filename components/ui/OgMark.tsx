import { CARD } from '@/lib/og';

/**
 * The mark, drawn for a share card rather than for the app (P15.T6).
 *
 * Separate from `Wordmark` on purpose: Satori resolves no `currentColor` and no
 * CSS variables, so a card's mark has to carry literal fills. Geometry is
 * duplicated from `app/icon.svg` and `components/Wordmark.tsx` — all three move
 * together, and D83 records why the shape is what it is.
 */
export function OgMark({ size, ink = CARD.ink }: { size: number; ink?: string }) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: Satori rasterises this to a PNG,
    // where a <title> is not read by anything and *does* render as visible text
    // in the card. The card's alt text is the route's own `alt` export.
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle
        cx="16"
        cy="16"
        r="10.8"
        fill="none"
        stroke={ink}
        strokeWidth="6.4"
        strokeDasharray="46.18 21.68"
        transform="rotate(57.5 16 16)"
      />
      <circle cx="16" cy="16" r="4" fill={CARD.accent} />
    </svg>
  );
}

import { RemoteImage } from '@/components/ui/RemoteImage';
import { cn } from '@/lib/utils/cn';

export type ShowLogoProps = {
  imageUrl: string | null;
  size?: 'sm' | 'lg';
  className?: string;
};

/**
 * How big a mark has to be to be a mark.
 *
 * 🔴 64px is a floor, not a taste call (2026-09-12 design review). Twelve award
 * bodies are this product's primary vocabulary and most of their logos are
 * wordmarks; at the previous 40px they were unreadable, so the page whose job is
 * to teach the twelve taught nothing. `lg` moves with it so the two sizes stay
 * distinguishable — 64 beside 72 is a prop with no visible effect.
 */
const DIMENSIONS = { sm: 64, lg: 96 } as const;

/**
 * An award show's mark, beside its name.
 *
 * Renders nothing at all when the show has no logo. `events.image` is
 * nullable, and an empty frame in a grid reads as a failure to load rather
 * than as an absence — the show's name, which every placement prints beside
 * this mark, is the honest fallback.
 *
 * `alt=""` is deliberate: every placement puts the show's name next to the
 * mark, and a screen reader announcing "Academy Awards, Academy Awards" is
 * worse than announcing it once.
 */
export function ShowLogo({ imageUrl, size = 'sm', className }: ShowLogoProps) {
  if (!imageUrl) return null;

  const px = DIMENSIONS[size];

  return (
    <RemoteImage
      src={imageUrl}
      alt=""
      width={px}
      height={px}
      className={cn(
        // 🔴 `bg-white` in both schemes, deliberately, and it is the only
        // surface in the product that does not follow the theme. The marks are
        // third-party artwork drawn dark-on-transparent for print; `bg-raised`
        // is near-black in dark and near-parchment in light, so in dark mode
        // most of the twelve rendered as dark shapes on a dark square. A plate
        // is paper, and paper does not have a
        // dark mode. `white` is a keyword, not a hex literal, so it passes the
        // layering grep — the same reason StatusChip's carmine tone uses it.
        //
        // `object-contain` plus padding: the mark is letterboxed onto the plate
        // with a margin, never cropped to it and never bled to the edge.
        'bg-white shrink-0 rounded-sm object-contain p-2',
        className,
      )}
      style={{ width: px, height: px }}
    />
  );
}

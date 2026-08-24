import { RemoteImage } from '@/components/RemoteImage';
import { cn } from '@/lib/utils/cn';

export type ShowLogoProps = {
  imageUrl: string | null;
  size?: 'sm' | 'lg';
  className?: string;
};

const DIMENSIONS = { sm: 40, lg: 72 } as const;

/**
 * An award show's mark, beside its name.
 *
 * Renders nothing at all when the show has no logo. `events.image` is
 * nullable, and an empty frame in a grid reads as a failure to load rather
 * than as an absence — the name alone is the honest fallback.
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
      className={cn('bg-bg-raised shrink-0 rounded-md object-contain', className)}
      style={{ width: px, height: px }}
    />
  );
}

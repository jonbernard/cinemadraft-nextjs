import Image, { type ImageProps } from 'next/image';

import { shouldOptimize } from '@/lib/images';

export type RemoteImageProps = Omit<ImageProps, 'src' | 'unoptimized'> & {
  /** An absolute URL. Local assets should use `next/image` directly. */
  src: string;
};

/**
 * `next/image` with the per-host optimization rule applied.
 *
 * Every remote image in the app goes through here, so the decision about what
 * Vercel optimizes lives in `lib/images.ts` and nowhere else. A call site that
 * reached for `next/image` directly would silently opt its page into billed
 * transformations for TMDB artwork — which is exactly the mistake this
 * component exists to make impossible.
 */
export function RemoteImage({ src, alt, ...rest }: RemoteImageProps) {
  return <Image alt={alt} {...rest} src={src} unoptimized={!shouldOptimize(src)} />;
}

import { matchRemotePattern } from 'next/dist/shared/lib/match-remote-pattern';
import { describe, expect, it } from 'vitest';

import nextConfig from './next.config';

/**
 * One URL per shape that exists in the production database, measured
 * 2026-08-24: 323 `img.clerk.com`, 51 `s.gravatar.com`, 4 `googleusercontent`,
 * plus TMDB artwork on every film surface.
 *
 * A host missing from `remotePatterns` is not a build failure — it is a 400
 * from `/_next/image` on the one page that renders it, which is why this is a
 * test and not something to eyeball.
 */
const PRODUCTION_IMAGE_URLS = [
  'https://image.tmdb.org/t/p/w500/kqjL17yufvn9OVLyXYpvtyrFfak.jpg',
  'https://img.clerk.com/eyJ0eXBlIjoiZGVmYXVsdCIsImlpZCI6Imluc18zSHNSUDRPeUhkUWlNZXNMMmdWWEJlIn0',
  'https://s.gravatar.com/avatar/12b5fcf15a6c8314007bdb3840999f68?s=480&r=pg&d=mp',
  'https://lh6.googleusercontent.com/-hFz9f6lgKus/AAAAAAAAAAI/photo.jpg',
];

describe('images.remotePatterns', () => {
  it.each(PRODUCTION_IMAGE_URLS)('allows %s', (url) => {
    const patterns = nextConfig.images?.remotePatterns ?? [];
    expect(patterns.some((pattern) => matchRemotePattern(pattern, new URL(url)))).toBe(
      true,
    );
  });

  it('does not allow an arbitrary host', () => {
    const patterns = nextConfig.images?.remotePatterns ?? [];
    expect(
      patterns.some((pattern) =>
        matchRemotePattern(pattern, new URL('https://evil.test/avatar.png')),
      ),
    ).toBe(false);
  });
});

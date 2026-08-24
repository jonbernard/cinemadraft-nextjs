import { describe, expect, it } from 'vitest';

import { shouldOptimize } from './images';

describe('shouldOptimize', () => {
  // TMDB serves pre-sized variants, and browse renders dozens at once — this
  // is where a per-transformation bill would land.
  it('passes TMDB artwork through untouched', () => {
    expect(shouldOptimize('https://image.tmdb.org/t/p/w500/abc.jpg')).toBe(false);
  });

  it('optimizes Blob-hosted logos', () => {
    expect(
      shouldOptimize(
        'https://example.public.blob.vercel-storage.com/award-shows/sag.jpg',
      ),
    ).toBe(true);
  });

  it('optimizes avatars, whichever host issued them', () => {
    expect(shouldOptimize('https://img.clerk.com/eyJ0eXBlIjoiZGVmYXVsdCJ9')).toBe(true);
    expect(shouldOptimize('https://s.gravatar.com/avatar/abc?s=480&r=pg&d=mp')).toBe(
      true,
    );
    expect(shouldOptimize('https://lh6.googleusercontent.com/-hFz9/photo.jpg')).toBe(
      true,
    );
  });

  // 🔴 `events.image` held `/images/awards/sag.jpg` before this phase, and a
  // row that escapes the migration must not throw inside a render. Refusing to
  // optimize is the safe answer: the browser fetches the URL as written.
  it('refuses to optimize a value that is not an absolute URL', () => {
    expect(shouldOptimize('/images/awards/sag.jpg')).toBe(false);
    expect(shouldOptimize('')).toBe(false);
  });
});

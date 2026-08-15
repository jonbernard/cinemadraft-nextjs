import { describe, expect, it } from 'vitest';

import { posterUrl } from './poster';

describe('posterUrl', () => {
  it('builds a TMDB url from a stored path', () => {
    expect(posterUrl('/4Iu5f2nv7huqvuYkmZvSPOtbFjs.jpg')).toBe(
      'https://image.tmdb.org/t/p/w185/4Iu5f2nv7huqvuYkmZvSPOtbFjs.jpg',
    );
  });

  it('takes the size from the caller', () => {
    expect(posterUrl('/a.jpg', 'w342')).toContain('/w342/a.jpg');
  });

  it('returns null for a film with no poster', () => {
    // A real state: films added by hand have no artwork. The cell falls back
    // to initials rather than rendering a broken image.
    expect(posterUrl(null)).toBeNull();
  });

  it('tolerates a path without its leading slash', () => {
    expect(posterUrl('a.jpg')).toBe('https://image.tmdb.org/t/p/w185/a.jpg');
  });
});

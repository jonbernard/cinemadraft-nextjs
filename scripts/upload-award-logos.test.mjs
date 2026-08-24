import { describe, expect, it } from 'vitest';

import { contentTypeOf, sourceFileFor } from './upload-award-logos.mjs';

const FILES = ['ace.jpg', 'afi.jpg', 'oscars.jpg', 'raz.jpg'];

describe('sourceFileFor', () => {
  it('takes the basename of an app-relative path', () => {
    expect(
      sourceFileFor({ abbreviation: 'ace', image: '/images/awards/ace.jpg' }, FILES),
    ).toBe('ace.jpg');
  });

  // 🔴 raz hotlinks GQ's CDN rather than holding a local path. Falling back to
  // the abbreviation is what stops this phase leaving one show pointed at a
  // third party.
  it('falls back to the abbreviation for a remote URL', () => {
    expect(
      sourceFileFor(
        { abbreviation: 'raz', image: 'https://media.gq.com/photos/x/the-razzies.jpg' },
        FILES,
      ),
    ).toBe('raz.jpg');
  });

  it('returns null when no file matches, rather than guessing', () => {
    expect(sourceFileFor({ abbreviation: 'nope', image: null }, FILES)).toBe(null);
  });

  // Idempotence: a second run must not re-upload or rewrite what is done.
  it('skips a row already holding a Blob URL', () => {
    expect(
      sourceFileFor(
        {
          abbreviation: 'ace',
          image: 'https://x.public.blob.vercel-storage.com/award-shows/ace.jpg',
        },
        FILES,
      ),
    ).toBe(null);
  });
});

describe('contentTypeOf', () => {
  // 🔴 afi.jpg is PNG data behind a .jpg name.
  it('reads PNG from the magic bytes, not the extension', () => {
    expect(
      contentTypeOf(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe('image/png');
  });

  it('reads JPEG from the magic bytes', () => {
    expect(contentTypeOf(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
  });

  it('refuses anything else', () => {
    expect(contentTypeOf(Uint8Array.from([0x00, 0x01, 0x02, 0x03]))).toBe(null);
  });
});

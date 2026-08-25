import { describe, expect, it } from 'vitest';

import { canonical, SITE_URL } from './seo';

describe('canonical', () => {
  it('resolves a path against the site origin', () => {
    expect(canonical('/films/550')).toBe(`${SITE_URL.origin}/films/550`);
  });

  it('drops query strings, so ?year= and ?page= do not compete with the page', () => {
    expect(canonical('/browse?when=future&page=3')).toBe(`${SITE_URL.origin}/browse`);
  });

  it('never returns a preview origin', () => {
    // VERCEL_URL is per-deployment; a canonical pointing at it would tell a
    // crawler the preview is the real page.
    expect(canonical('/')).not.toContain('vercel.app');
  });
});

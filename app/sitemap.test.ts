// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import sitemap from './sitemap';

afterAll(async () => {
  await db.$disconnect();
});

describe('sitemap', () => {
  it('lists only routes that are public by D44', async () => {
    const entries = await sitemap();
    const paths = entries.map((entry) => new URL(entry.url).pathname);

    expect(paths).toContain('/');
    expect(paths).toContain('/browse');
    expect(paths).toContain('/award-shows');
    // Session-scoped pages must never appear: /leagues (the index), /list,
    // /watchlist, /admin, /members/*.
    expect(paths.some((path) => path.startsWith('/admin'))).toBe(false);
    expect(paths).not.toContain('/leagues');
    expect(paths).not.toContain('/watchlist');
  });

  it('🔴 lists no league, member or auth page at all', async () => {
    // The sitemap is the one file that can publish a private URL by accident,
    // so the guard is a prefix scan rather than three named paths.
    const entries = await sitemap();
    const paths = entries.map((entry) => new URL(entry.url).pathname);

    for (const path of paths) {
      expect(path).not.toMatch(/^\/(leagues|members|auth|list|watchlist|admin|join)/);
    }
  });

  // The film list itself is asserted in `sitemap.production.test.ts`: it needs
  // rows, and CI has the schema without them. Everything above holds on an
  // empty database, which is what makes it safe to run on every push.
});

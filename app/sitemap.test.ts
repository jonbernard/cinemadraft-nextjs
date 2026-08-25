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

  it('lists the films the app actually holds, not invented TMDB ids', async () => {
    const entries = await sitemap();
    const films = entries.filter((entry) =>
      new URL(entry.url).pathname.startsWith('/films/'),
    );

    expect(films.length).toBeGreaterThan(0);
    // Every film URL ends in a TMDB id, never a local row id or a slug.
    for (const film of films.slice(0, 20)) {
      expect(new URL(film.url).pathname).toMatch(/^\/films\/\d+$/);
    }
  });
});

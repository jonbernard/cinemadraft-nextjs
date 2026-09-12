// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import sitemap from './sitemap';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * The half of the sitemap's contract that only the restored data can answer.
 *
 * 🔴 Split out rather than weakened. "The film list is not empty" is the whole
 * point of the assertion — it is what catches a `listForSitemap` that silently
 * stops returning rows — so relaxing it to `toBeGreaterThanOrEqual(0)` to make
 * it pass on CI would leave a test that can never fail. CI has the schema and
 * no rows (`prisma migrate deploy`, no seed), so this file is excluded there,
 * exactly like `film.production.test.ts` and the rest.
 *
 * What CI still runs is `sitemap.test.ts` — the privacy guard, which is the
 * assertion that actually matters on every push, and which needs no data.
 */
describe('sitemap, against the restored catalogue', () => {
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

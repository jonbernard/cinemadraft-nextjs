// @vitest-environment node
//
// D133's known ceiling, measured. A link to a held film is spelled from the
// cached `movies.title`; the page's canonical from TMDB's title today. Where
// the two slug parts differ, every click on that link costs one 308, because
// D63 never refreshes a cached title.
//
// Restored data and a live TMDB key: excluded on CI ("reads league 1's
// drafted films and calls TMDB"). `vitest.setup.ts` deletes TMDB_API_KEY so
// that no test reaches TMDB by accident; this one does on purpose, so it
// reads the key from `.env.local` itself and skips, saying so, without one.

import { existsSync, readFileSync } from 'node:fs';

import { parse } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { fetchTmdbFilmPage } from '@/lib/external/tmdb-film';
import { filmSlugPart } from './film-href';

const KEY = existsSync('.env.local')
  ? parse(readFileSync('.env.local')).TMDB_API_KEY
  : undefined;

beforeAll(() => {
  if (KEY) process.env.TMDB_API_KEY = KEY;
});

afterAll(async () => {
  delete process.env.TMDB_API_KEY;
  await db.$disconnect();
});

/**
 * Measured 2026-09-27 against the restored copy: league 1's drafted films,
 * 2025 and 2026. Each is a link that redirects once. Named in D133.
 */
const KNOWN_STALE: string[] = [];

describe('cached titles against TMDB’s, for league 1’s recent drafts', () => {
  it.skipIf(!KEY)(
    'spell the same slug part, apart from the ones D133 names',
    async () => {
      const films = await db.$queryRaw<{ tmdbId: string; title: string | null }[]>`
        select distinct m.tmdb_id as "tmdbId", m.title
          from draft_picks p
          join drafts d on d.id = p.draft_id
          join movies m on m.id = p.movie_id
         where d.league_id = 1 and d.year in (2025, 2026) and m.tmdb_id is not null
         order by m.title`;
      expect(films.length).toBeGreaterThan(50);

      const stale: string[] = [];
      for (const film of films) {
        const tmdb = await fetchTmdbFilmPage(film.tmdbId);
        expect(tmdb, `TMDB has ${film.tmdbId}`).not.toBeNull();
        if (filmSlugPart(film.title) !== filmSlugPart(tmdb?.title))
          stale.push(`${film.tmdbId} ${film.title} → ${tmdb?.title}`);
      }
      expect(stale).toEqual(KNOWN_STALE);
    },
    120_000,
  );
});

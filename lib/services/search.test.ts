// @vitest-environment node

import { afterAll, describe, expect, it, vi } from 'vitest';

import { db } from '@/lib/db';
import { findFilms } from './search';
import type { Candidate } from './search-ranking';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * Against the real 1,355 restored films — the league's entire drafting and
 * nominating history, every one carrying a `tmdbId`.
 *
 * The ranking rule is tested exhaustively and without a database in
 * `search-ranking.test.ts`. What is tested here is the half that only the real
 * data can answer: that the query finds things, and that a typo still finds
 * them.
 *
 * 🔴 **TMDB is unreachable here on purpose.** `vitest.setup.ts` clears
 * `TMDB_API_KEY`, so the default remote source returns nothing and every
 * assertion below is about the local cache alone. Without that, supplying a
 * real key turned these into live network calls — which is how this suite
 * first started failing when one was set.
 */
const browse = { kind: 'browse' } as const;

/** A film in the restored data with a distinctive, stable title. */
const KNOWN = 'Oppenheimer';

describe('findFilms — local', () => {
  it('finds a film by a fragment of its title', async () => {
    const results = await findFilms('oppenheim', browse);

    expect(results.map((film) => film.title)).toContain(KNOWN);
  });

  it('🔴 still finds it with a transposed letter', async () => {
    // The reason the threshold is 0.5 rather than Postgres's default 0.6.
    // Transposition is the typo people make when typing at speed, and the
    // owner is typing what someone just said out loud.
    const results = await findFilms('oppenhiemer', browse);

    expect(results.map((film) => film.title)).toContain(KNOWN);
  });

  it('finds a film by a word that is not the first', async () => {
    const results = await findFilms('battle', browse);

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((film) => film.title.includes('Battle'))).toBe(true);
  });

  it('returns nothing for an empty query without touching the database', async () => {
    expect(await findFilms('   ', browse)).toEqual([]);
  });

  it('returns nothing for a query that matches no film', async () => {
    expect(await findFilms('zzzzzzqqqq', browse)).toEqual([]);
  });

  it('builds a poster url for films that have artwork', async () => {
    // §10 asks for poster-first results; a result with no image does not do
    // its job for an audience that recognises films by artwork.
    const results = await findFilms('oppenheim', browse);
    const found = results.find((film) => film.title === KNOWN);

    expect(found?.posterUrl).toMatch(/^https:\/\/image\.tmdb\.org\/t\/p\/w92\//);
  });

  it('marks every local result as local', async () => {
    const results = await findFilms('oppenheim', browse);

    expect(results.every((film) => film.isLocal)).toBe(true);
    expect(results.every((film) => film.id != null)).toBe(true);
  });
});

describe('findFilms — a draft in progress', () => {
  it('🔴 marks a taken film as taken rather than hiding it', async () => {
    const [first] = await findFilms('oppenheim', browse);
    const takenId = first?.id as number;

    const results = await findFilms('oppenheim', {
      kind: 'draft',
      year: 2026,
      takenMovieIds: [takenId],
    });

    const taken = results.find((film) => film.id === takenId);
    expect(taken?.isTaken).toBe(true);
  });
});

describe('findFilms — TMDB is the catalogue', () => {
  it('🔴 always asks TMDB, even when local results are plentiful', async () => {
    // `movies` is a *cache* of TMDB: a film enters it the first time somebody
    // drafts or nominates it. So the local table can only answer with films
    // the league has already used, and a query like "the" — which matches
    // plenty locally — would never surface the new release somebody is
    // actually trying to draft. Cheap answers are not the point; finding the
    // film is. The rate limit is handled by caching, not by declining to ask.
    const remote = vi.fn(async () => [] as Candidate[]);

    await findFilms('the', browse, remote);

    expect(remote).toHaveBeenCalledWith('the');
  });

  it('asks TMDB when local results are thin', async () => {
    const remote = vi.fn(async () => [] as Candidate[]);

    await findFilms('oppenheim', browse, remote);

    expect(remote).toHaveBeenCalledWith('oppenheim');
  });

  it('still answers from the cache when TMDB is unconfigured', async () => {
    // Degraded, not broken: existing films stay findable, and only a film
    // nobody has used before becomes unreachable.
    const results = await findFilms('oppenheim', browse, async () => []);

    expect(results.length).toBeGreaterThan(0);
  });

  it('🔴 does not narrow the TMDB query by the award year', async () => {
    // An award season honours the previous year's films — 507 of the 2026
    // season's 526 nominations are 2025 releases — so sending the season year
    // to TMDB hid almost every candidate. The season is applied by ranking
    // instead, where it boosts rather than excludes.
    const remote = vi.fn(async () => [] as Candidate[]);

    await findFilms('oppenheim', { kind: 'award-admin', year: 2026 }, remote);

    expect(remote).toHaveBeenCalledWith('oppenheim');
  });

  it('🔴 survives TMDB failing, and still returns the local films', async () => {
    // The owner is mid-draft and can see the film in the list. An error where
    // the results should be is strictly worse than a shorter list.
    const remote = vi.fn(async () => {
      throw new Error('TMDB is down');
    });

    const results = await findFilms('oppenheim', browse, remote);

    expect(results.map((film) => film.title)).toContain(KNOWN);
  });

  it('🔴 never returns the same film twice when TMDB knows it too', async () => {
    const [local] = await findFilms('oppenheim', browse);
    const duplicate: Candidate = {
      id: null,
      tmdbId: local?.tmdbId ?? null,
      title: local?.title ?? '',
      releaseYear: null,
      isLocal: false,
      nominatedYears: [],
      posterPath: null,
    };
    const remote = vi.fn(async () => [duplicate]);

    const results = await findFilms('oppenheim', browse, remote);

    const matching = results.filter((film) => film.tmdbId === local?.tmdbId);
    expect(matching).toHaveLength(1);
    expect(matching[0]?.isLocal).toBe(true);
  });

  it('includes a TMDB film the app has never ingested', async () => {
    const remote = vi.fn(
      async (): Promise<Candidate[]> => [
        {
          id: null,
          tmdbId: 'tmdb-never-seen',
          title: 'Oppenheim Unknown',
          releaseYear: 2026,
          isLocal: false,
          nominatedYears: [],
          posterPath: '/x.jpg',
        },
      ],
    );

    const results = await findFilms('oppenheim', browse, remote);
    const found = results.find((film) => film.tmdbId === 'tmdb-never-seen');

    expect(found?.isLocal).toBe(false);
    // It still carries artwork — TMDB supplies the path directly, because
    // there is no local row to look one up from.
    expect(found?.posterUrl).toContain('/x.jpg');
  });
});

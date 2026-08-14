// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { draftPickRepository } from '@/lib/repositories/draft-picks';
import { loadFixture } from '@/test/fixtures';
import { pointsForMovieIds } from './scoring';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * The loader, against restored production data — excluded from `test:ci`.
 *
 * Split from the pure rule deliberately. `scoring.test.ts` pins the
 * arithmetic and needs no database, so it runs on every push; this file pins
 * the *port* by reproducing the source API's own answer for a real draft, and
 * that evidence only exists where the data does.
 */
describe('pointsForMovieIds', () => {
  it('🔴 reproduces the source API totals for draft 124', async () => {
    // `fixtures/points-by-draft.json` is the old app's own answer for this
    // draft, captured from production. Matching it is the evidence that the
    // rule was ported rather than reinvented — and it is what would catch the
    // awards.points foreign-key trap, since summing that column instead
    // produces small, plausible-looking numbers that are all wrong.
    const expected = loadFixture<Record<string, number>>('points-by-draft');
    const picks = await draftPickRepository.findByDraftId(124);
    const movieIds = picks.flatMap((pick) =>
      pick.movieId == null ? [] : [pick.movieId],
    );

    const totals = await pointsForMovieIds(movieIds, 2025);

    expect(Object.keys(expected).length).toBeGreaterThan(0);
    for (const [movieId, points] of Object.entries(expected)) {
      expect(totals.get(Number(movieId)) ?? 0).toBe(points);
    }
  });

  it('returns an empty map for no movies rather than querying', async () => {
    expect((await pointsForMovieIds([], 2025)).size).toBe(0);
  });

  it('scopes to the season — a film scores nothing in a year it was not nominated', async () => {
    const picks = await draftPickRepository.findByDraftId(124);
    const movieIds = picks.flatMap((pick) =>
      pick.movieId == null ? [] : [pick.movieId],
    );

    // 1999 predates the data entirely.
    expect((await pointsForMovieIds(movieIds, 1999)).size).toBe(0);
  });
});

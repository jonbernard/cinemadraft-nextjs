// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { loadFixture } from '@/test/fixtures';

import { draftPickRepository } from './draft-picks';

afterAll(async () => {
  await db.$disconnect();
});

/** A pick as the source API nested it inside a draft. */
type FixturePick = {
  id: number;
  draftId: number;
  movieId: number;
  order: number;
  createdAt: string | null;
  updatedAt: string | null;
  movie: { id: number; title: string | null };
};

const draftById = loadFixture<{ id: number; picks: FixturePick[] }>('draft-by-id');
const pointsByDraft = loadFixture<Record<string, number>>('points-by-draft');

describe('draftPickRepository.findByDraftId', () => {
  it('returns every pick in the draft', async () => {
    const picks = await draftPickRepository.findByDraftId(draftById.id);
    expect(picks).toHaveLength(draftById.picks.length);
    expect(picks.every((p) => p.draftId === draftById.id)).toBe(true);
  });

  it('returns the same movies the captured draft did', async () => {
    // `/points/draft/124` keyed its scores by movie id, so the set of movies a
    // draft holds is load-bearing for scoring, not just for display.
    const picks = await draftPickRepository.findByDraftId(draftById.id);

    expect(new Set(picks.map((p) => p.movieId))).toEqual(
      new Set(Object.keys(pointsByDraft).map(Number)),
    );
  });

  it('orders by pick order, not by id or insertion time', async () => {
    // Pick order is the whole point of a draft: it is the round each movie was
    // taken in, it is what the board renders, and `avgDraftPos` on the movie
    // page averages it. Asserting against a JS sort would just re-run the
    // comparison in a second language; this checks the repository asked the
    // database for the right ORDER BY under the en_US.utf8 collation.
    const picks = await draftPickRepository.findByDraftId(draftById.id);

    const ordered = await db.$queryRaw<{ id: number }[]>`
      select id from draft_picks
      where draft_id = ${draftById.id}
      order by "order" asc, id asc
    `;

    expect(picks.map((p) => p.id)).toEqual(ordered.map((r) => r.id));
    expect(picks.map((p) => p.order)).toEqual(draftById.picks.map((p) => p.order));
  });

  it('returns every pick a seat holds, however many that is', async () => {
    // Worth pinning: a seat was documented as eight movies, and every 2025 seat
    // in league 1 holds nine (`order` runs 1..9 across all 1025 rows). Counts
    // across seasons run 7, 8 and 9, and no database constraint enforces any
    // of them.
    //
    // Per D34 there is no roster size anywhere in this app — not a column, not
    // a setting, not a constant. Each league picks its own number each season
    // and the app never learns it: a roster is whatever `draft_picks` holds,
    // whether that is 6, 8 or 30. This layer must never truncate, and no layer
    // above it may impose a cap.
    const picks = await draftPickRepository.findByDraftId(draftById.id);
    expect(picks).toHaveLength(9);
  });

  it('returns an empty array for a draft with no picks', async () => {
    expect(await draftPickRepository.findByDraftId(999_999)).toEqual([]);
  });
});

describe('draftPickRepository.findManyByDraftIds', () => {
  it('loads several drafts worth of picks in one query', async () => {
    // The league board renders every seat in a league-year at once. One query
    // per seat would be twelve round trips for a single page.
    const picks = await draftPickRepository.findManyByDraftIds([124, 136]);

    expect(new Set(picks.map((p) => p.draftId))).toEqual(new Set([124, 136]));
    expect(picks.length).toBeGreaterThan(draftById.picks.length);
  });

  it('orders by draft, then by pick order', async () => {
    const picks = await draftPickRepository.findManyByDraftIds([136, 124]);

    const ordered = await db.$queryRaw<{ id: number }[]>`
      select id from draft_picks
      where draft_id in (124, 136)
      order by draft_id asc, "order" asc, id asc
    `;

    expect(picks.map((p) => p.id)).toEqual(ordered.map((r) => r.id));
  });

  it('silently skips draft ids that do not resolve', async () => {
    const picks = await draftPickRepository.findManyByDraftIds([124, 999_999]);
    expect(picks.every((p) => p.draftId === 124)).toBe(true);
  });

  it('accepts bigint ids', async () => {
    const picks = await draftPickRepository.findManyByDraftIds([124n]);
    expect(picks).toHaveLength(draftById.picks.length);
  });

  it('returns an empty array for an empty request', async () => {
    expect(await draftPickRepository.findManyByDraftIds([])).toEqual([]);
  });
});

describe('draftPickRepository.findByMovieId', () => {
  it('returns every pick of that movie, across leagues and years', async () => {
    // This is what `avgDraftPos` on the movie page averages: movie 3 was taken
    // five times, first overall every time, and the captured
    // `/points/movie/313369` response reports avgDraftPos 1.
    const picks = await draftPickRepository.findByMovieId(3);

    expect(picks).toHaveLength(5);
    expect(picks.every((p) => p.order === 1)).toBe(true);
  });

  it('accepts a bigint id', async () => {
    // draft_picks.movie_id is bigint while movies.id is integer, so a caller
    // holding an id from either side must be able to ask.
    expect(await draftPickRepository.findByMovieId(3n)).toHaveLength(5);
  });

  it('returns an empty array for a movie nobody drafted', async () => {
    expect(await draftPickRepository.findByMovieId(999_999)).toEqual([]);
  });

  it('does not throw on an id larger than an integer column can hold', async () => {
    // No foreign keys anywhere in this schema, and the referencing column is
    // wider than the referenced one. A value that could never match a movie is
    // a legitimate question with an empty answer, not an error.
    expect(await draftPickRepository.findByMovieId(9_007_199_254_740_993n)).toEqual([]);
  });
});

describe('the DTO matches the captured contract', () => {
  const expected = draftById.picks[0];
  if (!expected) throw new Error('draft-by-id fixture carries no picks');

  it('carries the columns the source API returned, plus userId', async () => {
    // The captured pick nests `movie`; that join belongs to the service, which
    // batch-loads through movieRepository.findManyByIds. `userId` is a column
    // the source Sequelize model never declared (server/models/draftPicks.js),
    // so the API could not return it — see the note on the DTO.
    const picks = await draftPickRepository.findByDraftId(draftById.id);
    const pick = picks[0];
    if (!pick) throw new Error('draft 124 has no picks');

    expect(Object.keys(pick).sort()).toEqual(
      [...Object.keys(expected).filter((key) => key !== 'movie'), 'userId'].sort(),
    );
  });

  it('matches the captured values field for field', async () => {
    const picks = await draftPickRepository.findByDraftId(draftById.id);
    const pick = picks.find((p) => p.id === expected.id);
    if (!pick) throw new Error(`pick ${expected.id} is missing`);

    expect(pick.draftId).toBe(expected.draftId);
    expect(pick.movieId).toBe(expected.movieId);
    expect(pick.order).toBe(expected.order);
    expect(pick.createdAt?.toISOString()).toBe(expected.createdAt);
  });

  it('normalizes movieId from bigint to number', async () => {
    // draft_picks.movie_id is bigint, and Prisma hands back a JS bigint. A
    // bigint anywhere in a DTO makes JSON.stringify throw, which in a Server
    // Component means the page fails to serialize rather than failing to
    // render — a much harder error to read.
    const picks = await draftPickRepository.findByDraftId(draftById.id);

    for (const pick of picks) {
      expect(typeof pick.movieId).toBe('number');
    }
  });

  it('survives JSON.stringify', async () => {
    const picks = await draftPickRepository.findByDraftId(draftById.id);
    expect(() => JSON.stringify(picks)).not.toThrow();
  });

  it('stays inside the safe integer range', async () => {
    // Normalizing bigint to number is only sound because movie ids are small:
    // the table tops out in the low thousands. Guard the assumption rather
    // than trust it, since Number() on a genuinely large bigint loses
    // precision silently.
    const picks = await draftPickRepository.findManyByDraftIds([124, 136]);

    for (const pick of picks) {
      expect(Number.isSafeInteger(pick.movieId)).toBe(true);
    }
  });

  it('returns Date objects, not the strings JSON gave us', async () => {
    const picks = await draftPickRepository.findByDraftId(draftById.id);
    expect(picks[0]?.createdAt).toBeInstanceOf(Date);
  });

  it('returns no Prisma internals', async () => {
    const picks = await draftPickRepository.findByDraftId(draftById.id);
    expect(Object.getPrototypeOf(picks[0])).toBe(Object.prototype);
  });
});

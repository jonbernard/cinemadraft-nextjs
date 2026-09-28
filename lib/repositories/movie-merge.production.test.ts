// @vitest-environment node
//
// M2 (D132) against the restored production copy: what the merge did to the
// eight real pairs. Excluded on CI (vitest.ci.config.mts), because CI's
// database holds migrations and a seed, not these rows.
//
// The "before" figures are literals, taken on 2026-09-27 from a fresh
// `npm run agent:up` port (5440) after restoring `.local/baseline.dump` and
// BEFORE `20260928120000_movie_merge` ran:
//   movies 1355 · nominations 4559 · winners 734 · draft_picks 1025
//   lists 155 · reviews 0 · watchlists 2363
// and the C7 prediction on the same data: movies −8, watchlists −13,
// reviews −0, lists −0.
//
// Every count is of *restored* rows only (created before the 2026-08-14
// capture), so a browser run's scratch rows cannot make it flake.

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';

afterAll(async () => {
  await db.$disconnect();
});

const RESTORED = `created_at < '2026-08-14'`;

async function count(sql: string): Promise<number> {
  const [row] = await db.$queryRawUnsafe<{ n: number }[]>(sql);
  return row?.n ?? -1;
}

/** The proposal's eight pairs, measured before the merge: tmdb id → both ids. */
const PAIRS: Record<string, [number, number]> = {
  '1234731': [1950, 1951], // Anaconda
  '1339713': [1943, 1944], // Obsession
  '1368166': [1952, 1953], // The Housemaid
  '262504': [50, 117], // Allegiant
  '333339': [270, 331], // Ready Player One
  '348350': [258, 332], // Solo: A Star Wars Story
  '393559': [60, 177], // My Life as a Zucchini
  '936075': [1946, 1947], // Michael
};

const REFERENCING = [
  'nominations',
  'winners',
  'draft_picks',
  'lists',
  'reviews',
  'watchlists',
];

describe('the duplicate-film merge, on the restored data', () => {
  it('leaves no repeated tmdb_id', async () => {
    expect(
      await count(`select count(*)::int as n from (select tmdb_id from movies
        where tmdb_id is not null group by tmdb_id having count(*) > 1) d`),
    ).toBe(0);
  });

  it('removed exactly the eight losers: 1,355 → 1,347', async () => {
    expect(
      await db.movie.count({ where: { NOT: { title: { contains: 'e2e-' } } } }),
    ).toBe(1347);
  });

  it.each(REFERENCING)('leaves no %s row pointing at a missing film', async (table) => {
    expect(
      await count(`select count(*)::int as n from ${table} t
        left join movies m on m.id = t.movie_id
        where t.movie_id is not null and m.id is null`),
    ).toBe(0);
  });

  it('moved references rather than deleting them, except the doubled watchlist rows', async () => {
    const after: Record<string, number> = {};
    for (const table of REFERENCING) {
      after[table] = await count(
        `select count(*)::int as n from ${table} where ${RESTORED}`,
      );
    }
    expect(after).toEqual({
      nominations: 4559,
      winners: 734,
      draft_picks: 1025,
      lists: 155,
      reviews: 0,
      watchlists: 2363 - 13,
    });
  });

  it.each(Object.entries(PAIRS))(
    'tmdb %s keeps one row, the older id',
    async (tmdbId, [older]) => {
      const rows = await db.movie.findMany({ where: { tmdbId }, select: { id: true } });
      expect(rows).toEqual([{ id: older }]);
    },
  );
});

// @vitest-environment node
//
// M2's merge (D132), run inside a transaction that is always rolled back, so
// it needs no data and leaves none behind. CI-runnable: it seeds its own rows.
//
// The unique index has to go first, inside the transaction, or the duplicate
// it needs could not be inserted. The rollback puts it back.

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';

afterAll(async () => {
  await db.$disconnect();
});

class Rollback extends Error {}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
type Row = Record<string, unknown>;

async function inRolledBack(work: (tx: Tx) => Promise<void>) {
  await expect(
    db.$transaction(async (tx) => {
      await work(tx);
      throw new Rollback();
    }),
  ).rejects.toBeInstanceOf(Rollback);
}

const q = (tx: Tx, sql: string, ...values: unknown[]) =>
  tx.$queryRawUnsafe<Row[]>(sql, ...values);

/** Two rows for one TMDB film, the older (lower id) first. */
async function seedPair(tx: Tx) {
  await tx.$executeRawUnsafe('DROP INDEX movies_tmdb_id_key');
  const rows = await q(
    tx,
    `insert into movies (title, tmdb_id, created_at, updated_at)
     values ('e2e-merge a', '999000111', now(), now()),
            ('e2e-merge a', '999000111', now(), now())
     returning id`,
  );
  const [keeper, loser] = rows.map((row) => row.id as number).sort((a, b) => a - b);
  const [user] = await q(
    tx,
    `insert into users (uuid, email, created_at, updated_at)
     values (gen_random_uuid(), $1, now(), now()) returning id`,
    `merge-${Date.now()}@example.test`,
  );
  return { keeper, loser, userId: user?.id as number };
}

describe('merge_duplicate_movies', () => {
  it('keeps the older row, moves every reference, and coalesces the doubled watchlist row', async () => {
    await inRolledBack(async (tx) => {
      const { keeper, loser, userId } = await seedPair(tx);
      await q(
        tx,
        `insert into watchlists (movie_id, user_id, created_at, updated_at)
         values ($1, $3, now(), now()), ($2, $3, now(), now())`,
        keeper,
        loser,
        userId,
      );
      await q(
        tx,
        `insert into nominations (movie_id, award_id, year, created_at, updated_at)
         values ($1, 1, 2990, now(), now())`,
        loser,
      );

      const [result] = await q(tx, 'select merge_duplicate_movies() as removed');

      expect(result?.removed).toBe(1);
      expect(await q(tx, `select id from movies where tmdb_id = '999000111'`)).toEqual([
        { id: keeper },
      ]);
      expect(
        await q(
          tx,
          'select count(*)::int as n from watchlists where user_id = $1',
          userId,
        ),
      ).toEqual([{ n: 1 }]);
      expect(
        await q(
          tx,
          `select movie_id::int as movie_id from nominations
            where year = 2990 and movie_id in ($1, $2)`,
          keeper,
          loser,
        ),
      ).toEqual([{ movie_id: keeper }]);
    });
  });

  it('refuses when both copies are drafted in one league, season and group', async () => {
    await inRolledBack(async (tx) => {
      const { keeper, loser, userId } = await seedPair(tx);
      const [league] = await q(
        tx,
        `insert into leagues (name, owner, active_year, created_at, updated_at)
         values ('e2e-merge league', 'e2e', 2990, now(), now()) returning id`,
      );
      const drafts = await q(
        tx,
        `insert into drafts (user_id, league_id, year, "group", "order", created_at, updated_at)
         values ($1, $2, 2990, 1, 1, now(), now()), (null, $2, 2990, 1, 2, now(), now())
         returning id`,
        userId,
        league?.id,
      );
      await q(
        tx,
        `insert into draft_picks (draft_id, movie_id, "order", created_at, updated_at)
         values ($1, $3, 1, now(), now()), ($2, $4, 1, now(), now())`,
        drafts[0]?.id,
        drafts[1]?.id,
        keeper,
        loser,
      );

      await expect(q(tx, 'select merge_duplicate_movies()')).rejects.toThrow(
        /movie merge/,
      );
    });
  });
});

import { expect } from '@playwright/test';

/**
 * The scratch-data discipline every journey inherits.
 *
 * 🔴 The database this runs against locally is a **restored copy of
 * production**: league 1 is sixty real people's draft history, and
 * `lib/db.test.ts` asserts exact counts for the restored tables (1355 films, 60
 * users, 4559 nominations, 10 seasons). A journey that leaves one row behind
 * turns an unrelated contract test red, and trains the eye to ignore a red
 * suite.
 *
 * So: everything a journey writes carries its tag, and everything carrying its
 * tag is deleted afterwards — including on failure, which is why the cleanups
 * live in `afterAll` and not at the end of the test body.
 *
 * Raw `pg` rather than the Prisma client: Playwright does not resolve the `@/`
 * alias into `generated/prisma`, so importing `lib/db` here fails at require
 * time and takes the whole spec with it. Same reasoning as every spec in
 * `e2e/`. Those specs keep their own private copies of `withDb` — they are not
 * in this phase's diff and each documents why it opens its own client.
 */
export type Query = (sql: string, params?: unknown[]) => Promise<unknown[]>;

export async function withDb<T>(fn: (query: Query) => Promise<T>): Promise<T> {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(async (sql, params) => (await client.query(sql, params)).rows);
  } finally {
    await client.end();
  }
}

/**
 * The season every page defaults to.
 *
 * Read rather than hardcoded: a restored database and CI's seeded-empty one
 * both hold exactly one active row, and `scripts/seed-e2e.mjs` happens to make
 * it 2026 — but a journey that types 2026 breaks the day the owner moves the
 * season, and it would break as "the draft console is empty" rather than as a
 * stale literal.
 */
export async function activeYear(): Promise<number> {
  return withDb(async (query) => {
    const rows = (await query(
      'select year from available_years where is_active limit 1',
    )) as { year: number }[];
    const year = rows[0]?.year;
    if (year == null) throw new Error('no active season in this database');
    return year;
  });
}

/**
 * Remove a journey's league, its seats, its picks and its films.
 *
 * 🔴 **Picks first.** `draft_picks` has no foreign key, so rows deleted in the
 * other order are orphaned rather than removed — and an orphan is invisible to
 * every league-scoped query while still counting in `db.test.ts`.
 */
export async function cleanupLeague(tag: string): Promise<void> {
  await withDb(async (query) => {
    await query(
      `delete from draft_picks where draft_id in
         (select d.id from drafts d join leagues l on l.id = d.league_id
           where l.name like $1)`,
      [`${tag}%`],
    );
    await query(
      'delete from drafts where league_id in (select id from leagues where name like $1)',
      [`${tag}%`],
    );
    await query('delete from leagues where name like $1', [`${tag}%`]);
    await query('delete from movies where title like $1', [`${tag}%`]);
  });
}

/** Remove a journey's award show, its categories, nominations, wins and tier. */
export async function cleanupShow(tag: string): Promise<void> {
  await withDb(async (query) => {
    await query(
      `delete from winners where award_id in
         (select a.id from awards a join events e on e.id = a.event_id
           where e.abbreviation like $1)`,
      [`${tag}%`],
    );
    await query(
      `delete from nominations where award_id in
         (select a.id from awards a join events e on e.id = a.event_id
           where e.abbreviation like $1)`,
      [`${tag}%`],
    );
    await query(
      'delete from awards where event_id in (select id from events where abbreviation like $1)',
      [`${tag}%`],
    );
    await query('delete from events where abbreviation like $1', [`${tag}%`]);
    await query('delete from points where level like $1', [`${tag}%`]);
  });
}

/**
 * Remove a journey's throwaway identities and everything hanging off them.
 *
 * Scoped to the journey's own prefix, never to `@example.test` at large — the
 * specs run side by side and a blanket delete takes another one's signed-in
 * identity mid-journey.
 */
export async function cleanupUsers(tag: string): Promise<void> {
  await withDb(async (query) => {
    await query(
      `delete from watchlists where user_id in
         (select id from users where email like $1)`,
      [`${tag}-%@example.test`],
    );
    await query(
      `delete from lists where user_id in
         (select id from users where email like $1)`,
      [`${tag}-%@example.test`],
    );
    await query('delete from users where email like $1', [`${tag}-%@example.test`]);
  });
}

/**
 * Remove the `movies` row a journey caused to be ingested.
 *
 * 🔴 Marking a film watched, drafting it or nominating it **ingests it** (D63
 * draws the line: a person acting deliberately writes, a page render does not),
 * so a journey that touches a real film adds a row to `movies`.
 * `lib/db.test.ts` asserts the restored table still holds exactly 1355 films.
 * This is `e2e/browse.spec.ts`'s `forgetFilm`, verbatim — the existing pattern
 * for putting it back.
 *
 * Only ever deletes a film nothing references. The caller decides whether the
 * film was cached before the journey ran; this decides whether it is safe now.
 */
export async function forgetFilm(tmdbId: string): Promise<void> {
  await withDb(async (query) => {
    const rows = (await query(
      `select m.id from movies m
        where m.tmdb_id = $1
          and not exists (select 1 from watchlists w where w.movie_id = m.id)
          and not exists (select 1 from draft_picks d where d.movie_id = m.id)
          and not exists (select 1 from nominations n where n.movie_id = m.id)
          and not exists (select 1 from lists l where l.movie_id = m.id)`,
      [tmdbId],
    )) as { id: number }[];
    const id = rows[0]?.id;
    if (id) await query('delete from movies where id = $1', [id]);
  });
}

/**
 * The gate's "verified by count": nothing carrying this tag survives.
 *
 * 🔴 A tag count, not a table count. The gate requires these journeys to pass
 * against a **seeded-empty** database as well as the restored one, and "1355
 * films" is not true there and never will be. "Zero rows matching `e2e-j1%`"
 * is the same assertion in both worlds, and it is the assertion that actually
 * says the journey put the database back.
 *
 * Fails loudly with the table that leaked rather than a bare count mismatch,
 * because the interesting information is which delete was in the wrong order.
 */
export async function assertNoResidue(
  tag: string,
  years: readonly number[] = [],
): Promise<void> {
  const leftovers = await withDb(async (query) => {
    const count = async (sql: string, params: unknown[]) =>
      Number(((await query(sql, params)) as { count: string }[])[0]?.count ?? 0);

    return {
      leagues: await count('select count(*) from leagues where name like $1', [
        `${tag}%`,
      ]),
      movies: await count('select count(*) from movies where title like $1', [`${tag}%`]),
      users: await count('select count(*) from users where email like $1', [
        `${tag}-%@example.test`,
      ]),
      events: await count('select count(*) from events where abbreviation like $1', [
        `${tag}%`,
      ]),
      points: await count('select count(*) from points where level like $1', [`${tag}%`]),
      // Orphans count too: `draft_picks` has no foreign key, so a pick whose
      // draft row is gone is still a row.
      orphanPicks: await count(
        `select count(*) from draft_picks dp
          where not exists (select 1 from drafts d where d.id = dp.draft_id)`,
        [],
      ),
      seasons:
        years.length === 0
          ? 0
          : await count('select count(*) from available_years where year = any($1)', [
              [...years],
            ]),
    };
  });

  expect(leftovers).toEqual({
    leagues: 0,
    movies: 0,
    users: 0,
    events: 0,
    points: 0,
    orphanPicks: 0,
    seasons: 0,
  });
}

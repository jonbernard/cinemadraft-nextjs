import { test } from '@playwright/test';

/**
 * Skip this test unless the database is a restored copy of production.
 *
 * 🔴 WHY A SKIP AND NOT A SEED. Three specs read the restored data on purpose:
 * `scoring.spec.ts` reads league 1's real 2025 board, `dashboard.spec.ts` reads
 * member 6's real 2026 roster, and one test in `award-shows.spec.ts` reads the
 * real Oscars row and the logo uploaded to Blob against it. Every other spec in
 * this suite creates what it needs and deletes it again, and that is the rule —
 * but these three cannot, because the restored data *is* the thing under test:
 *
 *   - scoring's value is that the numbers on screen are the numbers sixty
 *     people actually played for. A scratch league proves the same arithmetic,
 *     and `awards-lifecycle.spec.ts` already does exactly that on scratch rows,
 *     end to end, and passes on CI. Seeding one here would delete the only
 *     difference between the two files.
 *   - dashboard's truncation tests derive the longest title on a real roster,
 *     precisely so the assertion points at the hardest real case rather than a
 *     string somebody chose. Choosing the string back makes them vacuous.
 *   - the Blob logo is production infrastructure. There is nothing to seed.
 *
 * Seeding any of these would mean inventing a fake version of sixty people's
 * history and then asserting against the invention — a green run that proves
 * the fixture, not the app.
 *
 * The gate is deliberately COARSE: it asks "is this the restored database",
 * not "does this spec's own row exist". A restored database missing user 6's
 * roster must FAIL, loudly, because that is a real regression — so the specs'
 * own assertions stay exactly as sharp as they were. This only decides whether
 * asking the question is meaningful at all.
 *
 * Call it from `test.beforeEach`, so the reason is attached to each test and
 * shows in the report rather than a file quietly contributing nothing — the
 * same way `hasTmdb` and `hasClerk` skip visibly elsewhere in this suite.
 */
export async function skipWithoutRestoredCorpus(): Promise<void> {
  test.skip(
    !(await restoredCorpusPresent()),
    'the restored production corpus is not in this database (CI runs on schema + seed only)',
  );
}

let present: Promise<boolean> | undefined;

/**
 * Two rows that only a restore puts there.
 *
 * The real Oscars event and league 1 arrive together or not at all — they come
 * out of the same dump — so one lookup answers for all three specs. Neither can
 * be produced by the suite itself: every scratch spec prefixes what it creates
 * with `e2e-`, and none of them writes league 1.
 *
 * Raw `pg` rather than the Prisma client, and cached for the process: Playwright
 * does not resolve the `@/` alias into `generated/prisma`, so importing
 * `lib/db` here fails at require time and takes the whole spec with it — the
 * same reason every spec in this directory opens its own client.
 */
function restoredCorpusPresent(): Promise<boolean> {
  present ??= (async () => {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      const { rows } = await client.query<{ restored: boolean }>(
        `select exists(select 1 from events where abbreviation = 'oscars')
            and exists(select 1 from leagues where id = 1) as restored`,
      );
      return rows[0]?.restored ?? false;
    } finally {
      await client.end();
    }
  })();
  return present;
}

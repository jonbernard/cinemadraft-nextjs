/**
 * The one row the app cannot boot without, for CI's empty database.
 *
 * 🔴 TEST-ONLY. Never point this at Neon, at a preview branch, or at the
 * restored copy of production on 5433. It is deliberately NOT `prisma/seed.ts`
 * — that filename is the one `prisma db seed` picks up, and `prisma migrate
 * reset` runs it without being asked, which is how a "seed" ends up executing
 * against a database somebody cared about. This file runs only when the e2e
 * workflow step names it.
 *
 * WHY IT EXISTS AT ALL. CI creates Postgres fresh and applies `migrate deploy`:
 * the schema, none of the data, deliberately (see `.github/workflows/ci.yml` —
 * sixty real people's names and emails stay off the runner). With no row in
 * `available_years`, `getActiveYear()` throws `no seasons exist` — correctly,
 * and by owner decision it keeps throwing: an empty production database is not
 * a state worth degrading gracefully into. But that throw is a 500 on `/` and
 * `/award-shows`, and those two pages are where `nav.spec.ts`, `errors.spec.ts`
 * and `dashboard.spec.ts` start. So CI needs the season, and nothing else: the
 * specs that need leagues, seats, films or shows all create their own and
 * delete them again.
 *
 * WHY NOT INVENT MORE. Every row seeded here is a row some future spec might
 * quietly lean on instead of creating what it needs — which is how a suite
 * stops proving anything on a fresh database. The rule is: if a spec can make
 * it, the spec makes it. Only what the app refuses to render without lives
 * here.
 */

import { Client } from 'pg';

/**
 * 2026, matching the `UPDATE ... WHERE year = 2026` in the app_columns
 * migration that flipped the restored data's active season. The number is not
 * load-bearing for any assertion — no spec reads it — but keeping CI and a
 * developer's restored copy on the same active year means a page that renders
 * one season here renders the same one there.
 */
const YEAR = 2026;

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  // 🔴 Two statements, not one upsert, because of `available_years_one_active`:
  // a partial unique index on (is_active) WHERE is_active, so exactly one row
  // in the whole table may be true. Inserting an active row while a different
  // year holds the flag violates it. Standing the others down first is the only
  // order that works — and makes the script idempotent, which matters because
  // `migrate deploy` is a no-op on a re-run but this is not.
  await client.query(
    'update available_years set is_active = false where is_active and year <> $1',
    [YEAR],
  );

  const { rows } = await client.query(
    `insert into available_years (year, is_active, created_at, updated_at)
       values ($1, true, now(), now())
       on conflict (year) do update set is_active = true, updated_at = now()
     returning id, year`,
    [YEAR],
  );

  console.log(
    `seeded active season ${rows[0]?.year} (available_years id ${rows[0]?.id})`,
  );
} finally {
  await client.end();
}

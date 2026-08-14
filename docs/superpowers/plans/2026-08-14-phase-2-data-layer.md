# Phase 2 — Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the restored production database into a typed, tested data access layer — Prisma schema mapped over snake_case identifiers, a client that works against both Neon and local Docker, typed errors, and one repository per live table, each TDD'd against the captured API fixtures.

**Architecture:** `lib/repositories/` is the only code that imports the Prisma client, and it returns plain DTOs so Prisma types never reach a component. Services compose repositories; Server Components and Server Actions call services. This preserves the source app's `routes → controllers → models` seams while removing the HTTP hop.

**Tech Stack:** Prisma 7.9.1 · `@prisma/adapter-neon` for Neon and `@prisma/adapter-pg` for local Docker (D32) · Neon Postgres 17.10 · Postgres 17 in Docker for development and tests · Vitest · TypeScript 5.9.3

> **Note on process.** T1–T4 and T11 were executed before this plan was written, which inverts the documented order. They are recorded below as completed, with what actually happened, rather than rewritten as if planned. Everything from T5 on follows the normal write-then-execute flow.

## Global Constraints

Every task inherits these, from `docs/PLAN.md` and the spec.

- **`lib/repositories/` is the only layer that may import the Prisma client.** Repositories return plain DTOs, never Prisma model instances.
- **Neon is Preview/Production only.** Local development and every test point at the Docker container on port 5433. A test that reaches Neon is a bug.
- **TypeScript strict.** No `any` without an inline justification.
- **Latest stable** (D28), except TypeScript, pinned to 5.x until after cutover (D30).
- **Prisma 7 config lives in `prisma.config.ts`** (D31). `datasource.url` in the schema is a hard error; env is not auto-loaded; a driver adapter is mandatory; the generator is `prisma-client` with a required `output`.
- **Never run `prisma db pull --force`** — it discards the `@@map`/`@map` attributes that the whole naming strategy depends on.
- **Never run `prisma migrate dev`/`reset` against Neon.** Neon holds the only restored copy of production data.
- One commit per task, prefixed with the task ID. Tick `docs/PROGRESS.md` as the final step.

---

## File Structure

| Path | Responsibility |
|---|---|
| `prisma.config.ts` | Prisma 7 CLI config — schema path, migrations path, datasource URL |
| `prisma/schema.prisma` | Datasource, generator, and the introspected models |
| `prisma/normalize.sql` | ✅ Generated identifier normalization (D27), re-applied at cutover |
| `prisma/migrations/` | `0_init` baseline, then forward migrations |
| `scripts/generate-normalize-sql.mjs` | ✅ Generates `normalize.sql` from a live schema |
| `scripts/pascalize-schema.mjs` | Post-processes introspection: PascalCase models, camelCase fields, `@@map`/`@map` |
| `lib/db.ts` | Prisma client singleton; driver adapter chosen by connection target (D32) |
| `lib/errors.ts` | `NotFoundError`, `ForbiddenError`, `ConflictError` |
| `lib/repositories/*.ts` | One per table; the only Prisma importers |
| `lib/repositories/*.test.ts` | Contract tests against `fixtures/` |
| `test/db.ts` | Test harness — connects to Docker Postgres, resets between suites |

---

## Task 1 ✅ Restore the dump into Neon

**Completed.** `pg_restore --no-owner --no-privileges` against `DATABASE_URL_UNPOOLED`.

Two things worth carrying forward. The dump was created by PostgreSQL 17.9 and this machine's default `pg_restore` is 15, which cannot read it — every invocation must use `$(brew --prefix libpq)/bin/pg_restore` (18.4). And the restore is **not** idempotent: a second run against a populated database produces ~98 "already exists" errors. That happened here, and the result was verified object-by-object against the schema inventory rather than trusted: 17 tables, 4 enums, 16 sequences, 17 primary keys, 3 uniques, 45 indexes, 142 base-table columns — all matching. A later clean restore into Docker ran with 0 errors, confirming the dump itself is sound.

## Task 2 ✅ Verify row counts

**Completed**, but not against the file originally specified.

The plan said to compare against `.local/prod-row-counts.txt`, captured from live production. That file was written twelve hours after the dump, and production is still taking writes — the dump holds 60 users and production held 61 by the next afternoon. Comparing a restore against live production counts tests the wrong thing and makes the result depend on incidental traffic.

`scripts/dump-row-counts.sh` now counts rows **inside** the dump by parsing its `COPY` blocks, and its output at `.local/dump-row-counts.tsv` is the canonical expected value. `scripts/row-counts.sh` emits the same format from a live database. Both lowercase table names so the check survives the PascalCase → snake_case rename; it asks whether rows were lost, and the rename is verified separately.

Both use exact `count(*)` via `query_to_xml`, never `pg_stat_user_tables.n_live_tup`, which is a stale estimate and was badly wrong on this database.

## Task 3 ✅ Write `prisma/normalize.sql`

**Completed** — generated by `scripts/generate-normalize-sql.mjs`, 164 statements.

Generated rather than hand-written because the schema has 142 columns, 45 indexes, 20 constraints, 16 sequences and 4 enums; hand-writing ~150 renames against production data invites exactly one typo. The camelCase → snake_case transform is checked against the names that actually bite: `tmdbId` → `tmdb_id` (not `tmdb_i_d`) and `Events_nomDate_awardsDate` → `events_nom_date_awards_date`, which a naive `lower()` would flatten to `events_nomdate_awardsdate`.

The generator excludes extension-owned objects — `pg_stat_statements` installs views into `public`, and a blanket rename would have taken them too.

## Task 4 ✅ Apply and re-verify

**Completed.** Rehearsed on the local Docker database first, then applied to Neon.

Verified on both: identical row counts before and after; zero camelCase columns, indexes, enums, sequences or tables remaining; `password` and `salt` dropped; `SequelizeMeta` dropped; sample rows read back correctly.

## Task 11 ✅ Local Docker database

**Completed early**, since restoring and normalizing locally was the rehearsal for the Neon apply. Postgres 17 on port 5433 holds the same normalized data, and is what contract tests run against.

---

## Task 5: Prisma installed and introspected

**Files:**
- Create: `prisma.config.ts`, `prisma/schema.prisma`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Produces: a `schema.prisma` whose models mirror the database exactly, and a `generated/prisma` client directory.

- [ ] **Step 1: Install**

```bash
npm i @prisma/client @prisma/adapter-neon
npm i -D prisma dotenv
npm run lock
```

`npm run lock` is not optional — see the macOS lockfile rule in `AGENTS.md`.

- [ ] **Step 2: Config, hand-written**

Do **not** run `prisma init`: it writes `.claude/skills/`, `.windsurf/skills/`, `.agents/skills/` and `skills-lock.json` into the repo root uninvited (D31).

`prisma.config.ts`:

```ts
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL },
});
```

- [ ] **Step 3: Schema header**

`prisma/schema.prisma` — note there is **no `url`** in the datasource block. In Prisma 7 that is a hard error (P1012), not a deprecation.

```prisma
datasource db {
  provider = "postgresql"
}

generator client {
  provider            = "prisma-client"
  output              = "../generated/prisma"
  moduleFormat        = "esm"
  importFileExtension = ""
}
```

`importFileExtension = ""` is required: the generator emits TypeScript whose internal imports otherwise carry explicit `.ts` extensions, which strict mode rejects without `allowImportingTsExtensions`.

`output` goes to `generated/prisma` at the repo root, deliberately not under `app/` where Next's route scan would reach it.

- [ ] **Step 4: Ignore generated output**

```bash
printf '\n/generated\n' >> .gitignore
npm pkg set scripts.postinstall="prisma generate"
```

Generated client is rebuilt from the schema, so it is not committed. `postinstall` ensures Vercel and CI generate it before building.

- [ ] **Step 5: Introspect against the local Docker database**

Point `DATABASE_URL` at Docker, never Neon, so a mistake cannot touch production data:

```bash
DATABASE_URL="postgresql://cinemadraft:local@localhost:5433/cinemadraft" npx prisma db pull
```

- [ ] **Step 6: Verify the introspection is complete**

Expect 16 models. Check that `Nominations.year` came through as `String` (it is `text` in the database while every other year column is `integer`), and that the four enums appear.

```bash
grep -c '^model ' prisma/schema.prisma   # expect 16
grep -c '^enum ' prisma/schema.prisma    # expect 4
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "P2.T5: Prisma 7 installed and schema introspected"
```

---

## Task 6: PascalCase models over snake_case tables

**Files:**
- Create: `scripts/pascalize-schema.mjs`
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: models named `Movie`, `AvailableYear`, … with camelCase fields, each carrying `@@map`/`@map` back to the snake_case database names.

Introspection names models after tables, so a snake_case database yields `available_years` as a model name and `created_at` as a field. We want idiomatic TypeScript over idiomatic SQL (D27): `user.providerId` in code, `users.provider_id` in the database.

This is the inverse of the transform in `generate-normalize-sql.mjs`, applied to ~16 models and ~142 fields — mechanical, and for the same reason as T3, scripted rather than hand-edited.

Prisma **preserves** `@@map`/`@map` across re-introspection, so this cost is paid once. It does not survive `db pull --force`, which is why that is banned in the global constraints.

- [ ] **Step 1: Write the transform with tests first**

`scripts/pascalize-schema.test.mjs` — assert the round trip, including the cases that bite:

```js
import { describe, expect, it } from 'vitest';
import { camel, pascalSingular } from './pascalize-schema.mjs';

describe('camel', () => {
  it('converts snake_case to camelCase', () => {
    expect(camel('created_at')).toBe('createdAt');
    expect(camel('tmdb_id')).toBe('tmdbId');
    expect(camel('requires_nominee_name')).toBe('requiresNomineeName');
  });
  it('leaves single words alone', () => {
    expect(camel('order')).toBe('order');
    expect(camel('uuid')).toBe('uuid');
  });
});

describe('pascalSingular', () => {
  it('singularises and pascalises table names', () => {
    expect(pascalSingular('available_years')).toBe('AvailableYear');
    expect(pascalSingular('draft_picks')).toBe('DraftPick');
    expect(pascalSingular('movies')).toBe('Movie');
    expect(pascalSingular('watchlists')).toBe('Watchlist');
  });
  it('handles words ending in s that are not plurals of -y', () => {
    expect(pascalSingular('lists')).toBe('List');
    expect(pascalSingular('points')).toBe('Point');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run scripts/pascalize-schema.test.mjs
```

- [ ] **Step 3: Implement, then re-run until green**

The script reads `prisma/schema.prisma`, renames each `model` block and its scalar fields, appends `@map("<original>")` to renamed fields and `@@map("<original>")` to each model, and rewrites relation references. Enums get the same treatment.

- [ ] **Step 4: Apply and validate**

```bash
node scripts/pascalize-schema.mjs
npx prisma validate
npx prisma generate
```

- [ ] **Step 5: Prove the mapping is lossless**

Re-introspect into a scratch copy and confirm Prisma reports no drift — that is what proves every `@map` points at a real column:

```bash
DATABASE_URL="postgresql://cinemadraft:local@localhost:5433/cinemadraft" \
  npx prisma migrate diff --from-schema prisma/schema.prisma --to-config-datasource --script
```

Expected: an empty diff. Any statement in the output is a mapping error.

- [ ] **Step 6: Commit**

---

## Task 7: Baseline the migration history

**Files:**
- Create: `prisma/migrations/0_init/migration.sql`

Neon and Docker already hold the schema; the baseline records that fact so future migrations apply forward without trying to recreate it.

- [ ] **Step 1: Generate the baseline**

```bash
mkdir -p prisma/migrations/0_init
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script \
  > prisma/migrations/0_init/migration.sql
```

Flag names changed in Prisma 7 — `--from-url`/`--to-url` became `--from-config-datasource`/`--to-config-datasource`, and `--shadow-database-url` is gone. Any invocation copied from Prisma 6 docs will fail.

- [ ] **Step 2: Mark it applied on both databases**

```bash
DATABASE_URL="postgresql://cinemadraft:local@localhost:5433/cinemadraft" npx prisma migrate resolve --applied 0_init
DATABASE_URL="<neon unpooled>" npx prisma migrate resolve --applied 0_init
```

- [ ] **Step 3: Verify status is clean on both**

```bash
npx prisma migrate status
```

Expected: "Database schema is up to date". Not "drift detected".

- [ ] **Step 4: Commit**

---

## Task 8: The client

**Files:**
- Create: `lib/db.ts`

The adapter is chosen by connection target, not by taste (D32). `@neondatabase/serverless` speaks Neon's WebSocket/HTTP protocol rather than the Postgres wire protocol, so it cannot reach the local Docker container — verified, the same query fails there and passes through `@prisma/adapter-pg`.

```ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

// Neon hostnames only exist for Preview and Production. Everything local —
// development and every test — is plain Postgres in Docker, which the Neon
// driver cannot speak to.
const isNeon = /\.neon\.tech/.test(connectionString);
const adapter = isNeon ? new PrismaNeon({ connectionString }) : new PrismaPg({ connectionString });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// The adapter is constructed inside the guard, not beside it: Prisma's own
// example builds one per module evaluation, which leaks a connection pool on
// every hot reload in development.
export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
```

Database tests must declare `// @vitest-environment node` — the Vitest default is jsdom, which is wrong for anything holding a socket.

- [ ] **Step 1: Write it**
- [ ] **Step 2: Prove it connects to Docker**, with a throwaway script that counts movies and expects 1355
- [ ] **Step 3: Confirm `lib/db.ts` is the only file importing `generated/prisma`** besides repositories — `grep -rn "generated/prisma" --include=*.ts .`
- [ ] **Step 4: Commit**

---

## Task 9: Forward migration — the three new columns

**Files:**
- Create: `prisma/migrations/<timestamp>_app_columns/migration.sql`
- Modify: `prisma/schema.prisma`

Three additions the ported app needs (D22, D25, and the poster accent in §6.6):

| Column | Purpose |
|---|---|
| `movies.accent_hex` | Cached poster-derived accent colour |
| `users.clerk_id` | Set when a Clerk identity claims an account (D25) |
| `available_years.is_active` | Active season as data, not config (D22) |

The active-year constraint is the interesting one. "At most one active year" is enforced by the database, not by application code:

```sql
CREATE UNIQUE INDEX available_years_one_active
  ON available_years (is_active) WHERE is_active;
```

- [ ] **Step 1: Add the fields to `schema.prisma`** with `@map` to snake_case
- [ ] **Step 2: Generate the migration** with `prisma migrate diff --from-config-datasource --to-schema --script`
- [ ] **Step 3: Hand-add the partial unique index** — Prisma cannot express a partial index in the schema, so it goes in the migration SQL and the schema records it in a comment
- [ ] **Step 4: Seed the active year** — set `is_active` on 2026, the current value of `NEXT_PUBLIC_ACTIVE_YEAR`
- [ ] **Step 5: Write the failing test** proving a second active year is rejected:

```ts
it('permits at most one active year', async () => {
  await expect(
    db.availableYear.update({ where: { year: 2025 }, data: { isActive: true } }),
  ).rejects.toThrow();
});
```

- [ ] **Step 6: Apply to Docker, run the test, then apply to Neon**
- [ ] **Step 7: Commit**

---

## Task 10: Typed errors

**Files:**
- Create: `lib/errors.ts`, `lib/errors.test.ts`

Repositories throw these; route segments catch them in `error.tsx`; Server Actions convert them to the `ActionResult` union rather than letting them cross the boundary.

- [ ] **Step 1: Write the failing test** — each error carries a machine-readable `code`, and `instanceof` works after serialization across the RSC boundary
- [ ] **Step 2: Implement** `NotFoundError`, `ForbiddenError`, `ConflictError`, each extending a common `AppError` with a `code` and correct `name`
- [ ] **Step 3: Green, then commit**

---

## Tasks 12–27: Repositories

One per live table, 16 total. Each is the same shape, so they parallelize — but the first one is written alone, reviewed, and becomes the template the rest follow.

**Order.** `movies` first (the most-used, and the one with the richest fixture), then `users`, `events`, `awards`, `nominations`, `winners`, `points`, `leagues`, `drafts`, `draft_picks`, `lists`, `watchlists`, `notifications`, `profile_feeds`, `available_years`, `reviews`.

`reviews` is last and may be dropped entirely — it has **0 rows in production** and the feature was never used. Phase 7 decides; do not build it on the assumption parity requires it.

**Each repository:**

- [ ] Write the contract test first, asserting against the matching file in `fixtures/`
- [ ] Run it, watch it fail
- [ ] Implement the repository — returns plain DTOs, never Prisma model instances
- [ ] Run it, watch it pass
- [ ] Commit

**Test harness** (`test/db.ts`) connects to Docker Postgres. Tests are read-only against the restored data wherever possible; any test that writes runs in a transaction that rolls back, so the suite is order-independent.

**The fixtures are the contract.** Where a repository's output disagrees with a fixture, the fixture wins unless the fixture encodes one of the source-app bugs recorded in `PROGRESS.md` — in which case the correct behaviour wins and the deviation is documented in the test.

---

## Phase gate

- [ ] `npm run lint && npm run typecheck && npm run test && npm run build` green
- [ ] `npx prisma migrate status` clean against both Docker and Neon
- [ ] 16 models in `schema.prisma`, every one carrying `@@map`, every renamed field carrying `@map`
- [ ] `prisma migrate diff` between schema and database is empty — no drift
- [ ] Row counts in Neon still match `.local/dump-row-counts.tsv`
- [ ] Every repository has a passing contract test
- [ ] `grep -rn "generated/prisma" --include=*.ts .` shows imports only in `lib/db.ts` and `lib/repositories/`
- [ ] No test connects to Neon

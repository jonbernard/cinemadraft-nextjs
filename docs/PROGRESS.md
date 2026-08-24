# Progress

**Read this first in a new session.** Find the first unchecked task, open its phase plan in `docs/superpowers/plans/`, and continue.

> 🔴 **Write the phase plan before executing any task in that phase. No exceptions.**
> Not when the first task looks obvious, not when it is "just" a restore or a config file.
> If the plan is missing, write it from `docs/PLAN.md` and the spec — using
> `superpowers:writing-plans` — and only then start work.
>
> This was violated once: P2.T1–T4 were executed before the Phase 2 plan existed. The
> restore looked mechanical and wasn't — the row-count gate was comparing against live
> production rather than the dump, which a plan would have caught before touching the
> database rather than after. If work has already begun before a plan exists, record what
> actually happened rather than rewriting it as though it had been planned.

One commit per task. Commit message starts with the task ID (`P4.T3: ...`).
Tick the box as the **final step** of each task.

- **Spec:** `docs/superpowers/specs/2026-08-13-cinemadraft-nextjs-conversion-design.md`
- **Decisions (locked):** `docs/DECISIONS.md`
- **Master plan:** `docs/PLAN.md`

---

## Phase 0 — Owner setup 🔴 blocks everything

Plan: `docs/superpowers/plans/2026-08-13-phase-0-owner-setup.md` — executed by Jon, not an agent.

- [x] P0.T0 Prerequisites — `libpq` 18.4 client tools installed and on PATH (no native Postgres server)
- [x] P0.T1 Vercel project `cinemadraft-nextjs` linked; staging domain `next.cinemadraft.com` live; apex still on Heroku
- [x] P0.T2 Neon provisioned via Marketplace; connectivity verified; empty and ready for restore
- [x] P0.T3 ~~Upstash Redis~~ — **removed**. Vercel Runtime Cache is included with the platform; nothing to provision (D23)
- [x] P0.T4 Vercel Blob store created; `BLOB_STORE_ID` + `BLOB_WEBHOOK_PUBLIC_KEY` attached; OIDC auth model understood; uploads will be **public** per D24
- [x] P0.T5 Clerk app created — **passwordless** (email code + Google, D26), webhook at `next.cinemadraft.com`, three keys in Vercel
- [x] P0.T6 ~~Auth0 Management app~~ — **removed**. No bulk import under D25; Auth0 needs nothing
- [x] P0.T7 🔴 Production dump + row counts + API contract fixtures captured
- [x] P0.T8 TMDB / OMDB / remaining env keys carried over
- [x] **Phase 0 complete.** Two follow-ups were moved to the phases that need them rather than held here: the Blob public hostname (Phase 11) and confirming Clerk account linking (Phase 4)

### Phase 0 notes

_Fill these in as you go — later phases read them._

- Heroku app name: `cinemadraft` (add-on `postgresql-fluffy-16646`, plan `essential-1`)
- Blob store id: `store_5d9WUBVvsBKE…` — `BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY` attached (non-sensitive)
- Blob public hostname: `________`
- Blob auth is **OIDC**, not a read-write token: `VERCEL_OIDC_TOKEN` + `BLOB_STORE_ID` must both be set. OIDC is per-environment and **Development must be enabled** in Settings → Security for local Blob work (phase 11)
- Local Blob access unresolved: OIDC tokens are environment-scoped and the store is connected to Production/Preview only. Settings → Security has no per-environment control. **Phase 11 fallback: run the media migration as a deployed one-shot route** rather than a local script — its OIDC identity is production-scoped and already authorized
- Auth0 users: 51 on `auth0|` (email+password, 36 active in past year), 9 dormant Firebase-era, **0 on google-oauth2**. 51 distinct emails, no duplicates
- Auth0 connections: `google-oauth2` (unused by anyone) and `Username-Password-Authentication`
- **Clerk is passwordless** (D26): email verification code + Google only. The 51 email+password users will receive a code instead — no password migration or reset
- Confirm Clerk **account linking** is enabled so one email does not produce two Clerk identities
- Vercel project: `cinemadraft-nextjs` (`prj_6AQy9PCklalfMLCMHSuRDtAgEzfK`), linked in repo mode
- Staging domain: `next.cinemadraft.com` — also the Clerk webhook host
- Neon attached to Production + Preview only (by design; Development uses Docker). Vars are Sensitive and cannot be `vercel env pull`ed — connection string comes from the Neon console into `.local/.env.neon`
- Neon Postgres version: `17.10` on `neondb` as `neondb_owner` — **same major as Heroku's 17.9**, so the restore is same-major
- Neon connection string kept locally at `.env.neon` (repo root, covered by the `.env*` ignore rule)
- Vercel function region: `________`
- Postgres client: libpq 18.4 at `/opt/homebrew/opt/libpq/bin`
- Heroku Postgres server version: `17.9` — libpq 18.4 reads it fine
- Production data size: `11.9 MB`, 17 tables (16 app tables + `SequelizeMeta`). Dump will be fast
- **Dead models — do NOT build repositories for these:** `session` and `moviesstats`. **Confirmed from the production dump** — it contains 17 tables and neither appears
- Dump contents: `AvailableYears Awards DraftPicks Drafts Events Leagues Lists Movies Nominations Notifications Points ProfileFeeds Reviews SequelizeMeta Users Watchlists Winners` — quoted **PascalCase**, plus 4 enum types and the `pg_stat_statements` extension
- Restore needs `--no-owner --no-privileges`: the dump's owner role `ub7c7u1vm0346s` does not exist in Neon
- **Live production row counts** were captured to `.local/prod-row-counts.txt` (2026-08-14 10:31). Use **exact** `count(*)` via `query_to_xml` — never `pg_stat_user_tables.n_live_tup`, which is a stale statistics estimate and was badly wrong here. Note this file is **not** the restore gate; see the entry below — it is a snapshot of live production, which drifts from the dump
- Production row counts: `AvailableYears 10 · Awards 100 · DraftPicks 1025 · Drafts 156 · Events 12 · Leagues 13 · Lists 155 · Movies 1355 · Nominations 4559 · Notifications 2124 · Points 12 · ProfileFeeds 125 · Reviews 0 · SequelizeMeta 18 · Users 60 · Watchlists 2363 · Winners 734`
- **`Reviews` is empty in production** — 0 rows. Table and Sequelize model exist; the feature was never used. Phase 7 decides whether it ships at all — do not assume parity requires it
- P2.T4 note: `normalize.sql` **drops `SequelizeMeta`** (D27), so the post-normalization comparison covers the remaining 16 tables. Every one must match exactly
- 🔴 **Verify the restore against counts derived from the dump, not from live production.** `.local/prod-row-counts.txt` was captured 2026-08-14 10:31; the dump was created 2026-08-13 22:17 EDT. Production is still taking writes — by 2026-08-14 12:0x the users table had gained a row (60 in the dump, 61 live). Comparing a restore against production counts therefore tests the wrong thing, and the result depends on how much traffic the old app happened to take in between
- `scripts/dump-row-counts.sh <dump>` counts rows **inside** a dump without restoring it, by parsing the COPY blocks. Its output is the canonical expected value, saved to `.local/dump-row-counts.tsv`. `scripts/row-counts.sh <conn>` produces the same format from a live database, so the two compare with `diff`. Both lowercase table names so a PascalCase and a snake_case schema stay comparable
- Live production counts as of 2026-08-14 12:0x are kept at `.local/prod-live-row-counts-2026-08-14.tsv` for cutover reference — the delta against the dump is the write volume the old app is still taking
- **Contract fixtures captured** 2026-08-14 — 32 GET endpoints, all HTTP 200, all valid JSON, 1.5 MB. Each `<name>.json` has a sibling `<name>.path` recording the URL it came from. Capture script is committed at `scripts/capture-fixtures.sh` and reads the bearer token from `$TOKEN` — never written to disk
- **Two copies of the fixtures, on purpose.** `.local/fixtures/` is the raw capture — gitignored, real user data, the thing to back up. `fixtures/` is the scrubbed copy, committed, and what contract tests and CI read. Regenerate the second from the first with `node scripts/scrub-fixtures.mjs`
- The scrubber enforces four properties and **fails the run** rather than warning: no email / avatar URL / uuid / Auth0 subject survives anywhere (including `.path` sidecars); nothing outside the scrubbed fields changes (masked diff against the raw); referential integrity holds across files; output is byte-identical on re-run. Name replacement is word-bounded and scoped to person-describing fields plus `message` prose — a global substring replace was tried first and corrupted movie titles. Fake name pools are filtered against every real name so a generated surname cannot reintroduce a real one
- A first name shared between a league member and a TMDB cast member is **not** a leak; the checks are scoped so they don't flag it. Award names, event names, cast names, titles, and all scoring numbers pass through untouched
- Fixtures were captured as **user id 3** (`jon@jonbernard.net`, role `admin`), uuid `19f25e89-6d1a-4b65-ad83-efb3b1a2fd46`. Params used: league `1`, draft `124` (2025), year `2025`, lists year `2024`, tmdbId `313369`, event `oscars`
- `review-by-tmdb` fixture is `{}` — consistent with `Reviews` having 0 rows. Not a capture failure

### Source-app bugs found while capturing fixtures

Carry these into Phase 7. Do **not** reproduce them in the port.

- **`GET /draft/users/:id` takes a *league* id, not a draft id.** The handler calls `Drafts.getUsersByLeagueId`. Passing a draft id returns `[]` rather than erroring, so the bug is silent. Rename the concept in the port
- **`GET /watchlist/:page?/:columnName?/:direction` only accepts `createdAt` and `releaseDate`.** `columnName` is passed straight into the Sequelize `order` array and only `releaseDate` is special-cased onto the joined `movie` table, so `title` / `sortTitle` raise Postgres `42703 errorMissingColumn`. Sortable columns must be a validated allowlist in the port
- 🔴 **The error handler leaks schema.** That 42703 response returns the full failing SQL, column list, and Postgres internals (`parse_relation.c`) to the client. The port must return an opaque error and log the detail server-side. See the typed error classes in P2.T10
- **`GET /points/league/:type(total|event)/:id/:year?` ignores `:type` entirely.** `getPointsByLeagueId` never reads `req.params.type`, so `total` and `event` return byte-identical responses — verified by diffing the two fixtures. The frontend only ever calls `total` (`components/Points/LeaguePointTotals.js:59`, `pages/league/viewPanel/panelLeague.js:56`), so `event` is **dead route surface**: declared, never implemented, never called. Drop it in the port — do not build a per-event leaderboard on the assumption it once existed
- 🔴 **`GET /winners` nests the wrong movie.** `server/models/winners.js` declares `Winners.hasOne(Movies, { foreignKey: 'id' })` with no `sourceKey`, so Sequelize joins `movies.id = winners.id` — the winner's own primary key — instead of `winners.movie_id`. Verified against the restored data: of 734 winners, 12 nest `null` because the winner id runs past the end of `movies`, and exactly **1** nests the right film by coincidence. The rest are near-misses only because the two sequences ran roughly in step. The fixture shows it plainly: winner 1 has `movieId: 675` and nests `movie: { id: 1, "Arrival" }`. Not reproduced; three tests in `winners.test.ts` document it
- **`GET /league/:id/:year?` ignores its year param.** The route calls `Drafts.getByLeagueId`, which filters on `leagueId` alone, so the fixture captured at `/league/1/2025` carries all 140 seats from 2017–2026. Same family as the `/draft/users/:id` bug. Split in the port into `findByLeagueId` (year-wide) and `findByLeagueIdAndYear`
- 🔴 **Watchlist paging sorts only within a page.** `findAndCountAll` switches to a subquery once the hasMany `reviews` include is present, so LIMIT/OFFSET applied to `watchlists` alone and the ORDER BY then reordered only the 25 rows already chosen. Every page arrived sorted within itself, the sequence across pages was meaningless, and changing the sort could not move a movie between pages. The port sorts before paging and breaks ties on `w.id` so a row cannot land on two pages or none; `watchlists.test.ts` reproduces the old shape in SQL so the deviation from `watchlist-paged.json` is documented rather than silently asserted
- **`GET /events` builds a graph it then throws away.** The controller eager-loads every event's awards, their points, their nominations for the requested year, and each nominated movie — and the route `R.omit`s the whole `awards` tree before responding. `event-by-abbr` keeps it, so the two routes differ only in whether the work was wasted. The port composes that in a service, on the read path that actually needs it
- **`Users.getByIds` asks for `displayName` and never gets it.** It lists the VIRTUAL `displayName` in `attributes` while also setting `raw: true`, and Sequelize computes VIRTUAL columns on the model instance that `raw` skips. That is why `draft-users` has no `displayName` and `profile-feed.user` — same virtual, no `raw` — does. Not carried over: display formatting goes through one formatter (see legacy fields below)

- **`GET /movie/:id/details` is `GET /movie/:id` plus exactly three OMDB fields** — `box_office_gross`, `omdb_mpaa`, `rt_link`. Both fixtures are ~184 KB and differ only in those keys. Two endpoints returning a 184 KB payload to vary by three fields is the wrong shape; the port should have one movie read path with optional enrichment. The payload size itself deserves scrutiny in Phase 8

### Legacy fields to consider dropping

- **`draft_picks.user_id` is a dead denormalized copy of `drafts.user_id`.** Populated 2017–2022, null for every row since 2024, and it never once disagrees with the owning draft (638 of 1025 rows populated, 0 conflicts). The source Sequelize model never declared it, so the API could not return it either. Kept in the DTO and documented; nothing should read it — use the owning draft
- **`fbId` appears across `Events`, `Leagues`, `Winners`, and others** — Firebase-era identifiers from before the Postgres migration. Out of scope for D27 (which dropped only `password`/`salt`), but Phase 7 should decide whether these carry forward. They are dead weight if nothing reads them; check before dropping, since some may still be joined against
- 🔴 **One restored account's email is stored mixed-case**, and there are zero case-insensitive duplicates across the table. Clerk returns a lower-cased address on a verified identity, so an exact-match claim would leave that person permanently locked out of their own account. `userRepository.findByEmail` and `.claim` fold case; `claim` throws `ConflictError` rather than guessing if the folded address ever stops being unique. Phase 4 must not reintroduce an exact match
- Some user records have unnormalized display data (e.g. `firstName: "seth"`, lowercase). Not a blocker, but the port should not assume `firstName`/`lastName` are presentation-ready — build the display name through a single formatter

---

## Phase 1 — Scaffold

Plan: `docs/superpowers/plans/2026-08-14-phase-1-scaffold.md`

- [x] P1.T1 `create-next-app`, TS strict, Node 24 pinned
- [x] P1.T2 MUI + Tailwind coexisting via cascade layers, verified in-browser
- [x] P1.T3 Biome (replaces ESLint + Prettier) with next/react/tailwind rule domains
- [x] P1.T4 Vitest + the cn class helper, TDD
- [x] P1.T5 Playwright asserting the MUI/Tailwind layer contract
- [x] P1.T6 GitHub Actions CI — lint, typecheck, test, build, e2e, plus a fixtures PII guard
- [x] P1.T7 Directory skeleton per spec §5 — 13 `.gitkeep` placeholders, route list unchanged
- [x] P1.T8 `docker-compose.local.yml` — Postgres 17.11 on port 5433, `db:up` / `db:down` / `db:psql`
- [x] P1.T9 First Vercel preview deploy green; CI green on `main`
- [x] **Phase 1 complete.** Gate verified by running it: lint, typecheck, unit, build, e2e, and a reachable local Postgres

### Phase 1 notes

- Versions pinned: **Next 16.3.1 · React 19.2.8 · MUI 9.3.1 · Tailwind 4.3.3 · Biome 2.5.8 · Vitest 4.1.10 · Playwright 1.62.1 · Postgres 17.11 (Docker)**. Node 24 in `.nvmrc` and `engines`
- **Biome replaces ESLint and Prettier** (owner decision during T3). Domains enabled: `next`, `react`, `tailwind`, `test`, `project`. Biome does **not** typecheck — `npm run typecheck` is separate and runs `next typegen` first
- Folder exclusion in `biome.json` must be written `"!fixtures"`. `"!fixtures/**"` works but trips `useBiomeIgnoreFolder`; `"!fixtures/"` satisfies that rule but **silently fails to exclude**. Formatting `fixtures/` would break the scrubber's byte-identical check
- `useComponentExportOnlyModules` needs `allowExportNames` for Next's route exports (`metadata`, `revalidate`, `dynamic`, …) or every layout errors
- 🔴 **Never regenerate `package-lock.json` on macOS — run `npm run lock`.** `lightningcss` (Tailwind 4, Vite) declares optional per-platform binaries. A macOS-generated lockfile breaks on Linux two different ways: npm 11.13 writes `lightningcss-darwin-x64` entries with **no `version` field** (npm 11.17 then rejects the file with `Invalid Version:`), and npm 11.17 **omits them entirely** (`npm ci` fails with `Missing: lightningcss-darwin-x64@1.32.0`). Both install fine locally and fail only in CI and on Vercel. A CI job now catches both by name
- `npm run typecheck` runs `next typegen` first. `LayoutProps`/`PageProps` are Next-generated; a bare `tsc` on a clean tree fails with `Cannot find name 'LayoutProps'` and passes only if a build already ran
- **GitHub Actions runs steps under `bash -e`.** Any `grep` that exits non-zero on no-match — the passing case for a guard — aborts the step silently. Guard each with `|| true`
- Playwright runs against the **production build**, not `next dev`: dev injects extra styling and does not exercise the same CSS pipeline. Production filenames are content-hashed, so the layer test scans all same-origin sheets rather than matching on `globals`
- Local Postgres is on **port 5433**, not 5432, to avoid colliding with anything on the default port. `db:psql` invokes the libpq client explicitly — this machine's `PATH` resolves `psql` to a postgresql@15 client, and an older client against a newer server is the mismatch that broke `pg_restore` in Phase 0
- Vercel preview URLs are behind **Deployment Protection** (302 to Vercel SSO). Expected; rendering is covered by the e2e suite against the production build

---

## Phase 2 — Data layer

Plan: `docs/superpowers/plans/2026-08-14-phase-2-data-layer.md`

- [x] P2.T1 Restore dump into Neon as-is (`--no-owner --no-privileges`, unpooled URL, libpq 18.4 `pg_restore`)
- [x] P2.T2 🔴 Row counts verified against `.local/dump-row-counts.tsv` — derived from the dump, **not** live production
- [x] P2.T3 `prisma/normalize.sql` — generated by `scripts/generate-normalize-sql.mjs`, 164 statements
- [x] P2.T4 🔴 Applied to Neon; row counts identical; zero camelCase identifiers remain
- [x] P2.T11 Local Docker database restored and normalized — done early, as the rehearsal for the Neon apply
- [x] P2.T5 Prisma 7 installed; `prisma.config.ts` and schema header hand-written (no `prisma init`, D31); `prisma db pull` against **Docker** produced 16 models and 4 enums
- [x] P2.T6 `scripts/pascalize-schema.mjs` — 16 PascalCase models, 81 field mappings, 20 block mappings; empty `migrate diff`; re-introspection verified byte-identical
- [x] P2.T7 Baseline `0_init` resolved as applied on both Docker and Neon; `migrate status` clean on both
- [x] P2.T8 `lib/db.ts` — client singleton; adapter chosen by connection target (D32); 6 tests
- [x] P2.T9 Migration: `movies.accent_hex`, `users.clerk_id` (unique), `available_years.is_active` + partial unique index; applied to Docker and Neon; 6 constraint tests
- [x] P2.T10 Typed error classes — `AppError` base, `NotFoundError`, `ForbiddenError`, `ConflictError`, plus `isAppError` for the serialization boundary

### Phase 2 notes

- **`.env` is for the Prisma CLI only** and points at the **local Docker** database. `prisma.config.ts` loads it via dotenv; the Next app reads `.env.local`. Neon operations pass `DATABASE_URL` explicitly on the command line, so reaching production data is always a deliberate act rather than whatever happened to be in a file
- Prisma 7 no longer auto-loads `.env` — hence the explicit `import 'dotenv/config'` in `prisma.config.ts`
- `generated/` is gitignored and rebuilt by the `postinstall` script, so CI and Vercel generate the client before building. It is also excluded from Biome — the generated TypeScript carries `@ts-nocheck` and is not ours to format
- 🔴 **`@prisma/adapter-neon` cannot talk to local Postgres.** `@neondatabase/serverless` speaks Neon's WebSocket/HTTP protocol rather than the Postgres wire protocol, so it fails against the Docker container. `lib/db.ts` selects `@prisma/adapter-pg` for local development and tests, and `@prisma/adapter-neon` for Neon (D32). Verified: identical query, fails in the Neon driver, passes through adapter-pg
- **Database tests must declare `// @vitest-environment node`.** The Vitest default is jsdom, which is wrong for anything holding a socket
- 🔴 **Vitest runs test files in parallel, and these tests share one database.** `fileParallelism: false` in `vitest.config.mts`. The active season is the sharpest case: `available_years_one_active` is a partial unique index, so exactly one row in the whole database may be active and there is no per-worker copy to isolate. `available-years.test.ts` moves it; `schema.test.ts` asserts on it; roughly one run in three failed before serializing. Any future test that mutates a global invariant is in the same position — sequence it, do not try to isolate it
- The generated client's internal imports are extensionless (`importFileExtension = ""`), which a bundler resolves but **raw `node` cannot**. Anything touching Prisma runs through Next or Vitest, never bare `node`
- `DATABASE_URL` now lives in **both** `.env` (Prisma CLI) and `.env.local` (Next app), both pointing at Docker, both gitignored
- Introspection confirmed the normalization landed: no `password`/`salt`, and `nominations.year` typed `String?` because it is `text` in the database while every other year column is `integer`

### Repositories (T12–T27)

One per live table, in this order. Each: contract test first against `fixtures/`, watch it fail, implement returning plain DTOs, watch it pass, commit.

- [x] P2.T12 `movies` — template repository, 17 tests
- [x] P2.T13 `users` — claim-on-signin depends on this (D25); 24 tests
- [x] P2.T14 `events` — award shows; 24 tests
- [x] P2.T15 `awards` — 🔴 `points` is an **FK into `points.id`**, not a value; exposed as `pointsId`; 23 tests
- [x] P2.T16 `nominations` — 4559 rows, the scoring input; 27 tests
- [x] P2.T17 `winners` — a win scores P a second time; 30 tests
- [x] P2.T18 `points` — the level/tier/points lookup; 23 tests
- [x] P2.T19 `leagues` — `owner` is JSON text; parsed to `ownerIds`; 19 tests
- [x] P2.T20 `drafts` — 26 tests
- [x] P2.T21 `draft_picks` — 1025 rows; 24 tests
- [x] P2.T22 `lists`
- [x] P2.T23 `watchlists` — 2363 rows; sortable columns are a closed union, killing the 42703 schema leak
- [x] P2.T24 `notifications`
- [x] P2.T25 `profile_feeds` — `message` is free text containing user names
- [x] P2.T26 `available_years` — active-year read path **and** transactional `setActive` (D22)
- [x] P2.T27 `reviews` — 🔴 **0 rows in production**, so the repository is unproven against real data — Phase 7 decides whether it ships at all; do not assume parity requires it

🔴 **A roster is not always 8 movies.** Picks per seat by season, counted from `draft_picks`: 2017 **7**, 2018 **7**, 2019 **8**, 2020 **7**, 2021 **7**, 2022 **7**, 2024 **7**, 2025 **9**, 2026 **7** (in progress). No database constraint enforces any of it, and per **D34** none ever will — roster size is not stored, not configured and not validated. A roster is whatever `draft_picks` holds for that seat, whether that is 6, 8 or 30. **Nothing may hardcode 8**, and nothing may read a roster-size setting, because there is none. Pinned by a test in `draft-picks.test.ts`.

**Careful which fixture fields you assert.** `scripts/scrub-fixtures.mjs` rewrites *every* key named `image`, so `events.json` shows `https://example.test/avatar/<hash>.png` where the real column holds `/images/awards/sag.jpg` — a path into the app's own `/public`, nothing to do with avatars or TMDB. Names, emails, uuids and avatars are scrubbed everywhere they appear. Ids survive. A test asserting a scrubbed value is asserting the scrubber; assert shape from the fixture and values from `db.$queryRaw`.

**The fixtures are the contract.** Where a repository disagrees with a fixture, the fixture wins — unless it encodes one of the source-app bugs recorded above, in which case the correct behaviour wins and the deviation is documented in the test.
## Phase 3 — Design system

Plan: [`docs/superpowers/plans/2026-08-14-phase-3-design-system.md`](superpowers/plans/2026-08-14-phase-3-design-system.md)

The plan groups the eight items below into seven executable tasks — T1+T2 are one task (both palettes are one file), and the plan adds the token gallery and the no-raw-hex CI check that `PLAN.md` names as the phase gate but the task list omitted.

- [x] P3.T1 Token types + dark palette — `theme/tokens.ts`; 3 tests
- [x] P3.T2 Light palette — same file. Spec gave no light `text.dim` or `beam`; dim reuses secondary, and beam is darkened to `#3F6273` (5.91:1 on paper — the dark theme's `#7FA6B8` is 1.9:1 there)
- [x] P3.T3 🔴 Contrast test — 34 assertions, both palettes. Computed values match the spec's own §6.4 table
- [x] P3.T4 Typography via `next/font`, tabular numerals. 🔴 **Archivo's `wdth` axis is retired** (D71); Instrument Serif and Newsreader were added in Phase 3.5
- [x] P3.T5 MUI theme assembly, dark default + light toggle; 8 tests
- [x] P3.T6 Poster accent luminance clamping + test — 108 tests
- [x] P3.T7 Letterbox rule component — 12 tests shared with T8. 🔴 **Retired in Phase 3.5** (D74): `LetterboxRule` is deleted and `SectionHead` replaced it
- [x] P3.T8 Poster frame component
- [x] P3.T9 Token gallery at `/tokens` + no-raw-hex CI check — the gate named in `PLAN.md`, which the task list had left unowned. 🔴 **`/tokens` is deleted** (D76): Storybook is the gallery and `scripts/layering.sh` carries the hex check

**Phase 3 complete.** 528 tests, 26 files. Typecheck, Biome, build and all five layering checks clean.

### Phase 3 notes

- **`--font-mono` is a name collision.** Tailwind's own theme key is `--font-mono`, so pointing it at a `next/font` variable of the same name is a CSS reference cycle. CSS resolves a cycle to the guaranteed-invalid value: the build passes, no warning is emitted, and every mono column silently falls back to the browser default. The font variable is `--font-plex-mono` for this reason.
- **`defaultColorScheme` is not the default mode.** It only names which palette CSS falls back to. The *mode* defaults to `system`, so dark-by-default (D15) additionally requires `defaultMode="dark"` on **both** `ThemeProvider` and `InitColorSchemeScript`. Caught in a browser, not by a test: a first-time visitor on a light-set OS got the light theme.
- **Testing Library was not cleaning up.** Auto-cleanup registers only when Vitest `globals` are enabled, and this project runs without them, so every `render` accumulated in one document. A test asserting *absence* found the previous test's element and failed; a test asserting *presence* would have passed for the wrong reason, silently. `afterEach(cleanup)` is now in `vitest.setup.ts` — required for every component test written from here on.
- **`theme/mui.d.ts` is load-bearing.** `createTheme` is typed as returning a plain `Theme` (its source carries the comment "cast type to skip module augmentation test"), so without augmenting `CssThemeVariables` the compiler cannot see `colorSchemes` or `defaultColorScheme` despite them existing at runtime — pushing every consumer toward an `as any`.
- Poster frames carry a hairline border in **both** themes. §6.3 requires it in light, where the frame otherwise dissolves into the paper ground; making it a token rather than a light-only rule keeps D15's "no component branches on theme" intact.

---

## Phase 4 — Auth 🔴 priority trio

Plan: [`docs/superpowers/plans/2026-08-14-phase-4-auth.md`](superpowers/plans/2026-08-14-phase-4-auth.md)

The plan adds one item the task list did not have: a **lazy sync in `getCurrentUser`**. A webhook is asynchronous, so a member can reach the dashboard before it lands — and Clerk can drop a delivery outright. Both paths call the same `syncClerkIdentity`, so the safety rules cannot hold on one and be forgotten on the other.

- [x] P4.T0 ✅ **Confirmed by the owner 2026-08-14** — account linking is enabled in the Clerk dashboard (Configure → Account linking). Without it one email can produce two Clerk identities. The claim guard means the second identity does *not* steal the account — it is refused and logged — but the member is then locked out of their own history until an admin relinks them. Linking prevents the situation rather than containing it. Nothing else blocks on this; the guard is what protects the data and it is tested regardless
- [x] P4.T1 Clerk installed, `proxy.ts` protecting the `(app)` segment
- [x] P4.T2 `lib/auth.ts` — session → `User` resolution, **with lazy claim**; 11 tests
- [x] P4.T3 Clerk webhook with signature verification — 10 tests, real svix signatures
- [x] P4.T4 Claim logic — `lib/services/clerk-identity.ts`, the single path (D25)
- [x] P4.T5 🔴 Claim safety tests — 10 tests, mutation-verified
- [x] P4.T6 Sign-in / sign-up at `/auth/*`, with returning-user copy
- [x] P4.T7 E2E: real production account claimed, history intact — 5 data-layer + 4 browser tests
- [x] P4.T8 Admin relink path for mismatched emails — 5 tests

**Phase 4 complete.** 569 unit tests across 31 files, plus 4 Playwright specs. Typecheck, Biome, build and all five layering checks clean.

### Phase 4 notes

- 🔴 **The two rules the whole phase exists for**, both in `lib/services/clerk-identity.ts`: only a **verified** address may claim, and a **claimed row is never reassigned**. Do not weaken their tests — if one fails, the implementation is wrong. Mutation-tested: accepting unverified addresses fails the suite immediately.
- **The collision guard is deliberately duplicated.** Deleting the service-level check leaves every test green, because `claim()` independently refuses via a conditional write. It stays because it names both ids for the admin who repairs the collision, and because the guarantee should not rest on one implementation. Each layer has its own test.
- **`getCurrentUser` claims lazily, and that is load-bearing.** The webhook posts to the deployed host, so a developer signing in locally never receives one. Without a page that resolves the session, no account is ever provisioned — this is exactly how the browser E2E first passed while creating no row at all.
- **Next 16 renamed `middleware.ts` to `proxy.ts`.** The old name still resolves but logs a deprecation warning, and having both files is a hard build error (E900). Clerk is unaffected — it detects itself via a request header, not the filename.
- **Clerk 7 renamed its appearance variables.** `colorText` → `colorForeground`, `colorTextSecondary` → `colorMutedForeground`, `colorInputBackground` → `colorInput`. The old names are a type error, not a silent no-op.
- **Playwright does not read `.env`.** Before `playwright.config.mts` loaded it, all four auth specs skipped themselves on missing Clerk keys — a green run that proved nothing. It also cannot resolve the `@/` alias into `generated/prisma`, so the teardown uses `pg` directly rather than the Prisma client.
- **Clerk test addresses need the subaddress to be exactly `+clerk_test`.** `e2e+clerk_test_1786…@example.com` is *not* recognised — Clerk tries to deliver a real email, no code is sent, and the form reports "You need to send a verification code before attempting to verify". Put the uniqueness before the `+`.
- **Wait on `prepare_verification`, not on the UI.** The OTP field submits as soon as it is full, so filling it when it appears races the send. Waiting for the resend countdown looked right and still failed about one run in three.
- **The E2E writes to the restored production database** and cleans up after itself. If that teardown is ever removed, test accounts accumulate against the 60 genuine users and any later assertion about that population silently starts measuring debris.
- One production account (`jon@jonbernard.net`, id 3) is used by `clerk-identity.production.test.ts` as the gate fixture: 10 drafts, 67 picks. It is restored to `clerk_id = null` in `afterAll`.
- 🔴 **E2E does not run in CI, by decision (D43).** The owner declined to put Clerk credentials in GitHub, and the app cannot render without them — `ClerkProvider` needs a publishable key and the proxy needs a secret key. The Playwright steps are therefore *skipped visibly* rather than run against absent keys, because a spec that skips itself is a green run that proved nothing. **`npm run test:e2e` is a local gate and part of the pre-cutover checklist (Phase 12), not something CI covers.** Run it before any release. The `smoke.spec.ts` cascade-layer assertions from Phase 1 are in the same boat.
- `NEXT_PUBLIC_ACTIVE_YEAR` is **deleted** — from `.env` (P5.T0) and from Vercel (owner, 2026-08-14). D22 is fully discharged; nothing may reintroduce it.

---

## Phase 5 — Dashboard 🔴 priority trio

Plan: [`docs/superpowers/plans/2026-08-14-phase-5-dashboard.md`](superpowers/plans/2026-08-14-phase-5-dashboard.md)

Two reconciliations the plan makes explicit: `PLAN.md` said the roster strip is "8 frames", which **D34 supersedes** — it renders whatever the seat drafted; and the **pure scoring rule ships in this phase** rather than Phase 9, because standings cannot exist without it (D41).

- [x] P5.T0 `lib/services/season.ts` — `getActiveYear()`; **`NEXT_PUBLIC_ACTIVE_YEAR` deleted** from `.env` and from Vercel. D22 discharged; 7 tests
- [x] P5.T1a `lib/services/scoring.ts` — the pure rule (D41); 12 tests, reproduces the source API's totals for draft 124
- [x] P5.T1 `lib/services/dashboard.ts` — 11 tests, verified against league 1
- [x] P5.T2 Dashboard RSC page — **with a public variant** (D44)
- [x] P5.T3 Season rail component — 14 tests
- [x] P5.T4 Roster strip component — 12 tests at 1/6/7/8/9/30 films (D34)
- [x] P5.T5 League standings panel — 11 tests
- [x] P5.T6 Empty states — 3 tests
- [x] P5.T7 E2E — 5 dashboard specs; **gate met: no truncated titles at 375/768/1440**

**Phase 5 complete.** 642 unit tests across 38 files (300 of them on CI), 13 Playwright specs. Typecheck, Biome, build and all five layering checks clean.

### Phase 5 notes

- 🔴 **Route visibility is now a per-page decision (D44), and the plan carries the inventory.** The source app was already public by default — `/`, browse, events, live, movie detail, rules, join-by-uuid **and league pages** were never guarded. Only pages about *you* were. Check `src/routes/index.js` before assuming a page should be private; treating league pages as private would have been a parity regression, not a hardening.
- **A public variant renders for a null user and omits what is about a person.** `getDashboard(null)` does not query leagues at all rather than querying with a sentinel id, so there is no code path on which the public page can resolve someone else's team. Three tests assert it.
- **The proxy still enumerates PUBLIC routes** (D45) even though most routes are public. Forgetting to list a public page makes it protected — visible and harmless. Enumerating protected routes instead means forgetting one exposes it silently.
- 🔴 **§6.7's "8 across" and its two-line title clamp are in conflict**, and the E2E gate caught it at 1440px: eight columns leave each frame ~130px, too narrow for a 24-character title in two lines, so it clipped — the exact defect the redesign exists to fix. The roster grid now sizes columns by a **minimum readable width** (`auto-fill`, 10rem floor) rather than a fixed count. 375 and 768 passed the whole time, which is why the fixed rule looked correct.
- **`getActiveYear` is deliberately uncached.** `PLAN.md` asked for cached-and-tagged, which in Next 16 means `'use cache'` and therefore `cacheComponents` — and that flag turns every uncached prerender read into a build error, so it needs Suspense boundaries around every session-dependent page. Verified: enabling it fails the build on `/leagues`. Revisit when those pages exist (D42 note in `season.ts`).
- **The scoring rule lives in `lib/services/scoring.ts` and is pure** (D41). Phase 9 materializes it and must call this same function — do not write a second copy. Its fixture test reproduces the source API's own totals for draft 124, and mutation-testing confirms it catches the `awards.points` foreign-key trap (169 instead of 370).
- **Seeing the signed-in dashboard in a browser requires attaching a throwaway Clerk identity to a real restored account** — a fresh sign-up has no leagues and only exercises the empty state. `e2e/dashboard.spec.ts` does this and restores the row in `afterAll`. If that teardown is ever removed, a test identity stays attached to real production data.
- Posters render as initials placeholders. `Movie.poster` holds a TMDB path; the media migration is Phase 11.

---

## Phase 6 — Draft 🔴 priority trio

Plan: [`docs/superpowers/plans/2026-08-15-phase-6-draft.md`](superpowers/plans/2026-08-15-phase-6-draft.md)

🔴 **The owner enters every pick, by design (D46, confirmed 2026-08-15).** The draft runs on a video call: the owner keeps the selection on the right player, that player says their pick, and the owner searches for the film and assigns it. There is no clock and none is missing. **The UI optimises for the call** — whose turn it is, fast search, fewest actions per pick, because twelve people are waiting on each one. A self-service timed draft is a possible future enhancement, not planned work.

🔴 **This phase fixes a real authorization bug (D47):** every pick, reorder and delete is guarded by `league.owner.includes(user.id)` against a TEXT column holding `[3]` — a substring match, so `"[31]".includes(3)` admits a stranger.

- [x] P6.T1 `lib/services/league-access.ts` — 🔴 the parsed ownership check (D47)
- [x] P6.T2 `lib/services/draft.ts` — league-year → groups → seats → picks
- [x] P6.T3 `DraftBoard` / `PickCell` — two presentations from one set of props (D49)
- [x] P6.T4 Server Actions: add, remove, reorder, all behind `canManageLeague`
- [x] P6.T5a `DraftConsole` + `/leagues/[id]/draft` — the owner's page
- [x] P6.T5 Reordering with `@hello-pangea/dnd`, keyboard included
- [x] P6.T6 `/leagues/[id]` — the public board (D44), proxy updated (D45)
- [x] P6.T7 E2E and close-out

**Gate met.** 17 E2E green in a real browser; 739 unit tests; a taken film shows
its artwork on the board and is labelled Taken in the console.

### What the next phase needs to know

- 🔴 **The draft order is a snake, and it was measured rather than assumed.**
  Rebuilding every pick sequence from `draft_picks.created_at`: 2024 84/84,
  2025 108/108, 2026 116/117 match a snake; 2017–2022 do not, and their
  timestamps arrive in clumps that do not describe a live draft at all. The one
  2026 exception is a pick taken out of sequence — the "someone missed their
  turn" case — which is why `nextSeatId` derives the turn as *the seats behind
  this round, in snake order* rather than counting, and why the owner can
  overrule it. `lib/services/draft-order.ts`.
- 🔴 **A film may be taken once per group, not once per league.** Measured
  across all 1025 production picks: no film ever repeats inside a group, while
  25 films in league 1's 2017 season were each taken five times across its
  groups. Each group is its own draft. `addPick` enforces the group scope; the
  source app enforced nothing.
- 🔴 **`actions/draft/guard.ts` derives the league from the seat.** The source
  route authorized against a client-supplied `leagueId` while writing to a
  client-supplied `draftId` — two facts from the same untrusted body that
  nothing checked agreed. Never accept both.
- **Reordering takes an ordered list of pick ids, not `{id, order}` pairs.** A
  duplicate or missing position is then not representable, and the action
  checks the list is a permutation of the seat's own picks before writing them
  in one transaction.
- **Server Actions return `ActionResult`, they do not throw** (`actions/result.ts`).
  An exception out of a Server Action reaches the client as an opaque digest,
  and "you do not own this league" and "that film is gone" are both ordinary
  outcomes the owner reads mid-call. Genuine bugs still throw.
- **Actions revalidate with `revalidatePath(path, 'layout')`** so the console
  and the public board refresh together — the console is a child route of the
  board.
- **`lib/utils/poster.ts` builds TMDB urls.** `movies.poster` is a bare path;
  the host and size belong to the renderer. Phase 11 turns this into a
  `next/image` loader.
- **E2E specs are serial and clean up only their own prefix.** They sign up
  real Clerk identities, and both a blanket `+clerk_test` delete and parallel
  sign-ups fail as broken auth flows rather than as the fixture collisions they
  are. `e2e/draft.spec.ts` builds a scratch league rather than writing into
  league 1 — it makes picks, and league 1 is sixty people's real history.
- **`lib/services/draft.test.ts` and `draft-console.test.ts` are excluded from
  CI** (restored data). The rules they rest on — `draft-order.test.ts` and
  every refusal in `actions/draft/draft-actions.test.ts` — seed their own rows
  and run on every push.
- Reordering is only reachable from the console, on the seat that is picking.
  A seat's list is not editable from the public board, by design.

---

## Phase 7 — Parity audit 🔴 gates cutover

Plan: [`docs/superpowers/plans/2026-08-15-phase-7-parity-audit.md`](superpowers/plans/2026-08-15-phase-7-parity-audit.md)

🔴 **The unit of parity is the capability, not the endpoint.** D8 removed the
HTTP layer, so an endpoint-for-endpoint audit would mark the whole application
deficient while being true of nothing. Each endpoint, controller and page is
reduced to what a person can *do*, and that carries the verdict.

🔴 **Three verdicts, no fourth.** ported / deficient / dropped. A capability
that half works is deficient — a green row has to mean someone can be told
"yes, that works".

**The audit changes no application code.** Findings become rows and Phase 10
tasks; a bug found here is filed, not fixed in an audit commit. The exception
is a security finding on the live Heroku app, which goes to the owner the same
day.

- [x] P7.T1 Enumerate the source routes — 19 files, **71 endpoints**
- [x] P7.T2 Enumerate the source controllers — 17 modules, **81 exported functions**
- [x] P7.T3 Enumerate the source pages — **24 routes, 9 sub-views**
- [x] P7.T4 Classify ported / deficient / dropped
- [x] P7.T5 Write [`docs/PARITY.md`](PARITY.md)
- [x] P7.T6 Decompose deficiencies into Phase 10 tasks — **P10.T1–T50**
- [x] 🔴 **P7 Owner review of the matrix — approved 2026-08-15.** The owner
  accepted the classifications and asked to revisit the matrix later in the
  process rather than row-by-row now. **Cutover is still blocked while any row
  is open** — approval was of the audit, not of shipping with 43 gaps.

**Result: 83 capabilities — 18 ported, 50 deficient, 15 dropped.**

### What the next phase needs to know

- 🔴 **26 of the 50 open rows already have their repository** and need only a
  page; **22 need a repository written first.** That split is the `Data` column
  in the matrix and it is the real measure of what is left — reads are broadly
  covered, writes almost entirely are not.
- 🔴 **Six writes on the live app have no authentication at all** — nominations
  and winners create/delete, `POST /movie`, `POST /years`. Those are the
  *scoring inputs*, so anyone with curl can change every league's standings.
  Verified: no global auth middleware exists (`server/index.js:81` mounts the
  router with only a rate limiter). The owner has decided the source stays
  untouched, so this is closed by P10.T28/T29 shipping admin-gated, and the
  exposure stands until cutover.
- 🔴 **`Winners.movie` joins on the wrong key in the source** —
  `hasOne(Movies, { foreignKey: 'id' })` with no `sourceKey`, so it matches
  `Movies.id = Winners.id`. **Measured: 733 of 734 winner rows resolve to the
  wrong film.** The port is unaffected; do not "restore parity" here.
- **Ten source bugs are deliberately not ported**, listed with evidence in
  `PARITY.md`. Read that section before closing any Phase 10 row, or one will
  come back as a bug fix.
- **Eight shape traps** are listed there too. The `awards.points` foreign key
  is already handled (D41); `award.pointsData` being an array in one query and
  an object in another is not, and Phase 10 must not "normalise" it blindly.
- **39 of 71 endpoints have no captured fixture.** Where a task depends on a
  response shape, capture it from Heroku *before* porting — the app is still
  running, and after cutover that evidence is gone.
- **The audit did not cover** the websocket layer, TMDB/OMDb field-by-field
  shapes, or email. Named in `PARITY.md` so the gaps are known rather than
  assumed.

---

## Phase 8 — Award shows + search

Plan: [`docs/superpowers/plans/2026-08-15-phase-8-award-shows-search.md`](superpowers/plans/2026-08-15-phase-8-award-shows-search.md)

🔴 **This is the phase that creates data.** Nominations and winners are the
inputs to scoring — a wrong winner changes every standing on the site (§12).
The source app left both endpoints open to the entire internet (`PARITY.md`
bug 1); here they are admin-gated and the refusals are tested before the
successes.

🔴 **There is no recompute to trigger.** `PLAN.md` says marking a winner fires
the phase 9 recompute and a correction reverses it. Neither exists: scoring is
a pure function computed on read (D41) and there is no materialized total. So a
correction is consistent by construction today — and this phase writes the test
that proves points move anyway, because **phase 9 inherits it as a constraint
it must not break**.

🔴 **TMDB is the film catalogue; `movies` is a cache of it.** A film enters the
local table the first time somebody drafts or nominates it — which is why all
1,355 rows carry a `tmdbId`. So a `TMDB_API_KEY` is **required**, not optional:
without one the app can only find films the league has already used, and no new
release can be drafted or nominated at all. Search always asks TMDB, and both
write paths ingest a film that is not cached yet (`lib/services/film-ingest.ts`,
ported from the source's `saveFilm`).

- [x] P8.T1 `lib/services/search-ranking.ts` — the pure ranking rule, three contexts
- [x] P8.T2 Trigram index + local-first `lib/services/search.ts`
- [x] P8.T3 TMDB as an optional source, cached, failure-tolerant
- [x] P8.T4 `components/FilmSearch.tsx` — extracted from the draft console
- [x] P8.T5 Award show pages — public (D44), point values resolved through `pointsId`
- [x] P8.T6 Admin: attach and remove a nominee 🔴 admin-gated
- [x] P8.T7 Admin: mark and correct a winner 🔴 the phase gate
- [x] P8.T8 E2E and close-out

**Gate met.** 21 E2E green; 832 unit tests. All three search contexts return
the right top result, and a winner correction moves the points.

Closes `PARITY.md` **P10.T8, T22, T23, T24, T28, T29**. T26, T27 and T30
(editing a show, category CRUD, the needs-updating list) stay in phase 10 —
though the needs-updating list is in fact built, on `/award-shows`, so T30 is
narrower than the matrix says.

### What the next phase needs to know

- 🔴 **Phase 9 inherits a test it must not break.** `award-actions.test.ts`
  asserts that correcting a winner moves the points from the old film to the
  new one. It passes *by construction* today because scoring is computed on
  read (D41) — which is exactly why it was written now. The moment phase 9
  materializes totals, that test becomes the thing that catches a stale one.
- 🔴 **`PLAN.md` was wrong about the recompute** and has been corrected: there
  is nothing to trigger and nothing to reverse, because nothing is cached. Do
  not go looking for the recompute this phase was supposed to call.
- 🔴 **The trigram threshold is 0.5, and it is measured, not chosen.**
  `word_similarity` scores a transposed letter at 0.571 against the real
  titles; Postgres's default of 0.6 would reject it, and transposition is the
  typo people make at speed. The value lives in the predicate, not a session
  GUC, because a pooled connection may not carry the `SET`.
- 🔴 **TMDB is required and now configured locally.** `movies` is a *cache* of
  TMDB, so without a key the app finds only films the league has already used —
  which makes drafting or nominating a new release impossible. Search asks TMDB
  on every query, deliberately: an earlier version only asked when local
  results looked thin, which meant a query like "wicked" matched enough cached
  films to never reach TMDB and the new release stayed invisible. The rate
  limit is handled by caching identical queries, not by declining to ask.
- 🔴 **A season's films can be up to five years old, and the boost is graded**
  (D58). 96.5% of nominations are exactly one year before their season, but the
  tail is real and has a cause: shorts and foreign-language films carry a
  festival or home-country date. *This Is Endometriosis* is a 2022 film
  nominated for Best Short Film in 2026. Verified against the corpus — the same
  partial query reorders correctly for the 2018, 2021 and 2026 seasons.
- 🔴 **Never send the award year to TMDB.** An award season honours the
  *previous* year's films: of the 2026 season's 526 nominations, **507 are 2025
  releases and 7 are 2026 releases**. An early version passed the season as
  `primary_release_year`, which hid 96% of the candidates — an admin entering
  nominations would have found nothing. The season belongs to ranking, where it
  boosts the award year *and the year before*, and excludes nothing. Caught by
  the E2E test that nominates a real uncached film, not by a unit test.
- 🔴 **`vitest.setup.ts` clears `TMDB_API_KEY`.** Supplying a real key turned
  nine existing tests into live network calls and broke one immediately; worse,
  the suite began behaving differently depending on whether the developer had a
  key. Tests that are about TMDB set the variable themselves and stub `fetch`.
- **`lib/services/film-ingest.ts` is how a TMDB film becomes usable.** Every id
  the app deals in is a local `movies.id`, so a search result carrying only a
  `tmdbId` gets ingested on first use. It reproduces `saveFilm`'s field mapping
  exactly, including the two rules that look arbitrary: `imdbId` is stored
  without its `tt` prefix, and `sortTitle` drops a leading article. 1,355 rows
  follow both, and a new row that broke one would be the only one that did.
- **`getCache()` does not throw off-platform** — it logs once and falls back to
  its own in-process map. The first version of `lib/external/cache.ts`
  duplicated that with a hand-written fallback, which was both dead code and a
  bug (it cleared a map the cache was not using). Check before writing a
  fallback.
- **`lib/auth` now throws `ForbiddenError`,** not a bare `Error`, so a Server
  Action can turn a refusal into a readable failure. `actions/result.ts` still
  re-throws unknown exceptions on purpose.
- **`components/FilmSearch.tsx` is the one typeahead.** The draft console and
  the award admin both use it. It cancels superseded requests with a real
  `AbortController`; the console's old boolean flag discarded the result but
  left the request running.
- **Two E2E suites now build scratch data** rather than writing into the
  restored rows — a scratch league and a scratch award show. Anything that
  writes scoring inputs must do the same: a stray nomination against the real
  Oscars changes what every league is playing for.
- 🔴 **`e2e/global-teardown.ts` deletes test accounts from Clerk as well as the
  database.** Per-spec cleanup removed the local rows and left the Clerk
  identities behind, and they accumulated across runs until the development
  instance hit its **100-user ceiling** — at which point sign-up stopped
  working and four specs failed at once, looking exactly like a timeout. The
  real message was rendered inside the Clerk widget rather than raised. If
  sign-up ever hangs at the verification step again, check the user count
  before the code.

### ⚠️ Waiting on the owner

_Nothing outstanding._

- ✅ **`TMDB_API_KEY` is set locally and in Vercel for every environment**
  (2026-08-15), and verified end to end: searching "wicked" returns cached
  films first with TMDB filling the rest, and an admin nominated *Wicked City*
  — a real film absent from the restored data — straight from TMDB, with the
  row cached correctly.
- **The parity matrix still needs review** (Phase 7 gate). Cutover is blocked
  while any row is open.

---

## Phase 9 — Scoring pipeline

Plan: [`docs/superpowers/plans/2026-08-16-phase-9-scoring.md`](superpowers/plans/2026-08-16-phase-9-scoring.md)

🔴 **No materialized scores (D59).** Measured before deciding: a full 16-seat
league board costs **8 ms** including scoring, all 1,355 films 16 ms. The
spec's three derived tables plus reconciliation and cron would buy ~8 ms and
introduce drift. Scoring stays computed on read.

The phase is therefore the two things that were never about speed: **proving
the port scores what production scored** (four captured fixtures; only one was
previously checked), and **building the ledger** that explains any number on
screen (§6.7).

- [x] P9.T1 Verify against **all four** captured points fixtures 🔴 the gate
- [x] P9.T1b `test/query-count.ts` — the batching guard
- [x] P9.T2 `ledgerForMovies` — per-award lines from the same load as the totals
- [x] P9.T3 `components/PointsLedger.tsx` — total by default, lines on demand
- [x] P9.T4 Wired into the league board, batched
- [x] P9.T5 E2E and close-out

**Gate met.** Zero drift against production: the port reproduces the source
API's own numbers for a whole season (123 films), a whole league (12 team
totals) and a per-event breakdown (11 shows, 335 points). 872 unit tests, 435
on CI, 25 E2E.

### What the next phase needs to know

- 🔴 **A guard that cannot fail is worse than no guard.** `countQueries` first
  built its own `PrismaClient` and passed it to the callback — but every
  service imports the `db` singleton and ignored it, so it counted **zero**
  queries and every page-level assertion passed while measuring nothing. It now
  listens to the shared client (`lib/db.ts` enables query events under Vitest
  only), and the assertions require a non-zero count, because zero-equals-zero
  was exactly the vacuous pass that hid it. Verified it can fail: a deliberate
  N+1 shows 5 queries against 1 batched.
- **Every new score surface adds a case to `scoring.batching.test.ts`.** The
  board is 10 queries for 16 seats and 144 picks; an N+1 would be 144.
- **The ledger rides along free.** `ledgerForMovies` is the same load as the
  totals, so the board carries 1,353 ledger lines at 8.6 ms without a second
  query. Never fetch a ledger on expand.
- **`total` is `lines.reduce(...)`, never computed separately.** A ledger that
  disagrees with the number above it is worse than no ledger.
- **jsdom does not toggle `<details>` on Enter** — checked against a bare
  element. Component tests assert focusability; the toggle belongs to E2E.

🔴 **`nominations.year` is now an integer** (D60). It was the only TEXT year
column and it produced silent wrong answers three times during the port — most
recently a fixture carrying `"2017"`, which made a ledger test return nothing.
Fixed at the column, not at the ten call sites that were each converting.
Go-live rehearsed on a scratch database: restore → `migrate resolve --applied
0_init` → `migrate deploy` leaves the column an integer with data intact.

🔴 **Every score surface is inventoried and measured** in the plan — dashboard
7.2 ms, league board 4.9 ms, movie page 2.3 ms, season leaderboard 5.6 ms, live
rescore 5.0 ms, all 1,355 films 14.2 ms. Cost is **round trips, not
arithmetic**, so volume is nearly free and an N+1 is the only real danger.
`lib/services/scoring.batching.test.ts` counts queries rather than timing them
and asserts a *constant* bound — cost must not grow with league size. **Any new
surface that shows a score adds a case there.**

Plan: _not yet written_ — 7 tasks, see `docs/PLAN.md`

- [ ] P9 not started

---

## Phase 10 — Remaining features to parity

Plan: [`docs/superpowers/plans/2026-08-16-phase-10-parity.md`](superpowers/plans/2026-08-16-phase-10-parity.md)

🔴 **Review budget when executing a plan with subagents** (owner direction,
given twice — Phase 3.5 and again mid-Phase 10). Reviewer plus re-reviewer per
task ran to ~40% of each task's subagent tokens, and the budget runs out long
before the plan does. **No scoped re-reviews** — the controller verifies fix
rounds by reading the diff and running the gates. **A per-task reviewer only
where the task writes something security-bearing**; read-only pages get none.
**Batch same-shape tasks into one dispatch.** **One review at the end over the
whole branch**, not one per task.

The rigour that replaced those seats costs nothing, because it is prose in the
dispatch prompt, and it is what stopped the later batch-E tasks needing the fix
rounds the earlier ones did: require mutation testing **before** the commit
(delete the guard, run, confirm red, restore, verify byte-identical); name the
traps that produce tests which cannot fail; and require **fixture adequacy** —
a fixture with one of something cannot catch a missing predicate about that
something, so a query scoped by two columns needs two distinct values of each.
One task reported 18 of 18 mutations red and was still blind to a clause whose
removal would have deleted every review its caller had ever written.

🔴 **A mutation run can write to the restored production database.** A mutated
guard is exactly a guard that lets writes through. One run left a null-uuid row
in `profile_feeds`, caught only by `lib/db.test.ts`'s row count — so that test
must pass before any mutation round is reported, and any row count measured
during such a round must be re-measured after.

🔴 **The app had no navigation at all** until P10 batch A. Every page was an
island reachable only by typing its URL. The parity matrix could not see it —
it records capabilities, and navigation is what makes capabilities findable.

🔴 **Seven nav destinations — the source's, not spec §6.9's four** (D62).
Home · Browse · Award Shows · Leagues · Watchlist · Draft list · Rules &
scoring. Entries appear as their pages are built (`ready: false` in
`NAV_LINKS`), so the nav never links to a 404 — **flipping that flag is the
last step of the task that builds the page.**

🔴 **Seven items is why the phone gets a drawer, not a bottom bar.** A bottom
bar carries five at 44px targets. The drawer is a native `<dialog>`, so the
focus trap, Escape, inertness and backdrop are the platform's — verified in a
browser, since jsdom implements none of them.

🔴 **Vocabulary is log in / log out / register** (D61), including overrides for
Clerk's own strings.

🔴 **The app had no error boundary until A2.** An unhandled error in a Server
Component showed Next's overlay locally and a **blank page** in production.
Now: `app/error.tsx`, `app/(app)/error.tsx` (keeps the nav), `not-found.tsx` in
both places, and `global-error.tsx` for a failure in the root layout — that
last one is deliberately plain and self-contained, because the providers and
theme are exactly what may have failed.

**Batches E, F, G and H done — Phase 10's parity work is complete.**
`PARITY.md` reads **65 ported / 4 deficient / 15 dropped = 84**, and the four
deficient rows are all Phase 14 deferrals: T3 (the live banner, which is the
only route into the live page), T21, T31 and T32.

- Batch E closed the personal surfaces (draft list, watchlist, reviews,
  profiles and feeds), F the season surfaces (cinemas, the season leaderboard,
  league standings on the league page), G the admin and reference rows (show
  and category admin, notifications and broadcast, the active-season control,
  relink, rules and the scoring rulebook), H the ical feed.
- 🔴 **A row closes when a person can reach it** (D53). Two tasks shipped
  working, correctly-gated surfaces that nothing linked to — the profile rows,
  and then both admin control pages. Both needed a follow-up commit. **If a task
  builds a surface, its brief must say where a person reaches it from.**
- 🔴 **The ical feed is a public URL with no session.** It serves show names and
  dates only, pinned by a test that asserts on the whole serialized body with a
  member's email and uuid present in the database and reachable by a wrong join.
  A test that checks only the fields you did include cannot catch one you should
  not have.
- 🔴 **`awards.points` is a foreign key into `points.id`**, not a point value,
  and the category admin form is where that trap bites: writing a *value* there
  scores "Performance by an Ensemble" as 1 instead of 5 and corrupts every total
  silently. The admin picks a tier; the column stores that row's id.
- 🔴 **Deleting a category refuses rather than orphaning.** Orphaned nominations
  and winners do not vanish — they reach `scoring.ts`, whose `pointsByAward`
  lookup misses and scores them zero, quietly rewriting a past season.
- 🔴 **A throw from a segment layout escapes that segment's `error.tsx`.**
  Resolving the user in `(app)/layout.tsx` for an admin-only affordance meant a
  collided account lost every page under `(app)`, public ones included — the
  member T49 exists to repair. The layout now catches `AccountLinkError` and
  renders the shell signed-out.
- 🔴 **`{ not: true }` is not "unread".** Prisma compiles it to SQL `<> true`,
  and three-valued logic drops NULLs, so every never-touched notification was
  missing from the bell's badge. The fixture-backed test could not catch it
  because the user it seeds has no null rows.
- **The verdict header drifted from the table five times in this phase**, always
  the same direction: rows get edited, the header does not. It should be a CI
  check, not a rule in a brief.

**Batch D done — films are browsable and a film has a page.** `/films/[tmdbId]`
and `/browse`, plus the watched mark that browse is built around. Closes
`PARITY.md` T5, T6, T7, T9 and T34.

- 🔴 **The film route is keyed by the TMDB id, not ours.** `movies` holds only
  the 1,355 films this league has used, so a local id exists for almost none of
  the catalogue — and the owner's screenshots show the page working for exactly
  such a film.
- 🔴 **That page never writes** (D63). The straight port refreshes posters on a
  GET and `ensureFilm` was one line away; on a public route that is unbounded
  insert traffic from crawlers, and it would fill `movies` with films nobody
  drafted — breaking the invariant that a row means somebody used it. Marking a
  film watched *does* ingest, because that is a person pressing a button.
- 🔴 **A "watchlist" here is films you have *watched*** (D64), read out of the
  source rather than inferred from the table name: its button says "Mark as
  watched" and offers "Write a review" next. Getting this backwards would have
  shipped a feature that reads as the opposite of what it does.
- 🔴 **Three bugs the browser found and no test could.** The film title painted
  *behind* the backdrop (a positioned sibling beats a static one in paint order,
  whatever the source order). `PointsLedger` keyed rows on `awardId`, but La La
  Land holds two 2017 Best Original Song nominations under award 75 — React
  dropped one, so the ledger's rows summed to less than the total above them,
  which is the exact failure its "total is the sum of lines" rule exists to
  prevent. And TMDB's `/similar` answers La La Land with *The Tigger Movie*, so
  similar films now come from `/recommendations`.
- 🔴 **Browse's past and future sides are two different queries**, not one sort
  reversed. The past side keeps the source's `vote_count >= 200` floor; the
  future side must not, because an unreleased film has no votes and carrying it
  over returns an empty page — which is what copying only the sort would have
  shipped.
- 🔴 **Paging is in the URL** (D65). The source's infinite scroll meant a film
  could not be linked, Back lost the reader's place, and page 12 was unreachable
  from a keyboard.
- 🔴 **`data-testid` is now the only test handle** (D66), stripped from
  production output. A name-based locator cost real time on a bug that did not
  exist: marking a film changes the badge's accessible name by design, so the
  locator silently moved to the next film's badge and reported the wrong state.

**Batch C done — a season can be run.** Seats, placeholders, groups, start and
complete, stage next season, settings. Three source bugs (`PARITY.md` 4, 5, 6)
are each a test that fails if reintroduced.

- 🔴 **Group dealing is round-robin, never chunked.** 17 people into 4 chunks
  gives a group of two; dealt, it gives 5/4/4/4. A property test asserts no two
  groups ever differ by more than one, across 1–40 people and 1–6 groups.
- 🔴 **Group assignment is a `<select>` per seat, not drag-and-drop.** The
  source dragged, which is unusable without a mouse. `PickList` gets away with
  dragging only because `@hello-pangea/dnd` ships a keyboard path.
- 🔴 **A seat holding picks cannot be removed.** `draft_picks` has no foreign
  key, so nothing cascades — the picks would belong to nobody, dropped by the
  board and kept by scoring. The console does not offer the button at all.
- 🔴 **`npm run verify` before pushing.** Lint, typecheck, the five layering
  checks, both test suites and the build, in one command. It exists because two
  CI failures in a row were things I had "checked" — a lint run skipped, and a
  layering grep typed slightly differently by hand than the workflow types it.
  `npm run layering` runs the five checks alone.
- 🔴 **Run `npm run test:ci` against an EMPTY database before pushing**, not
  just the local one. CI migrates a fresh Postgres and has no data, so a seeded
  suite that quietly depends on restored rows passes locally and fails there —
  which is exactly what happened to the league actions: `getActiveYear()` reads
  `available_years`, empty on CI, and threw "no seasons exist". The check is
  one command:
  ```
  createdb ci_sim && DATABASE_URL=…/ci_sim npx prisma migrate deploy \
    && DATABASE_URL=…/ci_sim npx vitest run --config vitest.ci.config.mts
  ```
- **Seeding a season has to respect the partial unique index.** Only one
  `available_years` row may be active (`available_years_one_active`), and
  locally 2026 already is — so the fixture seeds only when there is no active
  season, and removes only what it added.
- **`lib/db.test.ts` now counts excluding test fixtures.** It asserted exact
  restore counts, which E2E residue turned red at random — a flake that trains
  the eye to ignore a failing suite. Fixtures are identifiable by construction
  (`+clerk_test`, `@example.test`, spec tags), so the check keeps its exactness
  without the flake.

**Batch B done — leagues can form.** Create, invite, join, and a real
`/leagues` list. 🔴 Until this landed no new league could be created at all.

- 🔴 **Joining is an explicit act, never a page load.** The first version
  joined during the render of `/join/[uuid]`; Next rejects a mutation during
  render outright, and it would also have meant that anything *fetching* the
  URL joins — a Slack unfurl, an iMessage preview, a prefetch. Pasting an
  invite into a group chat would have seated the sender before anyone clicked.
- 🔴 **The invite page names the league before asking anyone to register.**
  "Log in to continue" with no indication of what you are joining is
  indistinguishable from phishing, and every existing member was onboarded by
  exactly this flow.
- **The invite uuid is owner-only.** Holding it is what lets someone seat
  themselves, so showing it to every member would let every member re-share the
  league.
- **`/leagues` lists rather than redirects.** The source bounced to the first
  league, so no page ever answered "which leagues am I in".
- **`leagues.uuid` has no database default.** The source got one from
  Sequelize's `defaultValue: UUIDV4` — ORM behaviour the schema never carried —
  so `create` generates it, or the league would have no invite link at all.

- 🔴 **An unmatched URL sends a logged-out visitor to log in, not to a 404.**
  The proxy enumerates public routes and protects everything else (D45), and a
  path matching no page is protected like any other unknown path — which is
  what makes forgetting to list a new page harmless. The cost is that a typo'd
  URL shows a login page. Fixing it would mean a public catch-all, which is the
  fail-open behaviour D45 exists to prevent. Tested as the intended behaviour
  rather than papered over.
- **`ErrorPanel` takes a *kind*, never a message.** The source app returned
  Postgres errors verbatim, leaking SQL and column names on every error path;
  here the leak is impossible by construction.

Plan: _written before execution, driven by [`docs/PARITY.md`](PARITY.md)_

Every task below is one deficient row in the matrix, and the two lists are the
same list seen twice — if they can disagree, they will. A ticked line names the
batch that closed it; on an open one, `repo ready` means the repository method
exists and the work is a page, while `needs repository` means the data layer
comes first.

**23 of 50 done** — T1, T5–T9, T11–T19, T22–T24, T28–T30, T34, T50.
Remaining, grouped as the plan batches them:

| Batch | Tasks | What it is |
|---|---|---|
| **E** — personal | T20, T33, T35–T42 | The draft list, the watched-films page and its three progress views, reviews, profiles and feeds |
| **F** — season surfaces | T2, T3, T4, T10 | Films in cinemas, the live banner, the season leaderboard, league standings |
| **G** — admin and reference | T26, T27, T43–T49 | Show and category admin, notifications, the rules and scoring pages, the active-season and relink controls |
| **H** — the calendar feed | T25 | `/api/ical/[...slug]` |
| **Phase 14** | T21, T31, T32 | Realtime. Deferred by D23 and not on the cutover path |

- [x] **P10.T1** Join a league from an invite link — _batch B_
- [x] **P10.T2** Films in cinemas now — _batch F_
- [ ] **P10.T3** "Watch live" banner during a ceremony — _deficient; deferred to phase 14 with the live page (D48)_
- [x] **P10.T4** Season leaderboard by year — _batch F_
- [x] **P10.T5** A film's page — synopsis, cast, crew, trailers, images, ratings, box office — _batch D_
- [x] **P10.T6** A film's points by award show, and its average draft position — _batch D_
- [x] **P10.T7** Browse upcoming and recent releases — _batch D_
- [x] **P10.T8** Search for a film by title — _phase 8_
- [x] **P10.T9** Similar films — _batch D_
- [x] **P10.T10** A league's standings, on the league page — _batch F_
- [x] **P10.T11** Create a league — _batch B_
- [x] **P10.T12** Your leagues, and switching between them — _batch B_
- [x] **P10.T13** Copy the invite link — _batch B_
- [x] **P10.T14** Set up groups before a draft — drag members between groups, add a group, randomise the unassigned — _batch C_
- [x] **P10.T15** Add a seat, including a placeholder for someone with no account — _batch C_
- [x] **P10.T16** Remove or rename a seat — _batch C_
- [x] **P10.T17** Start the draft / mark it complete — _batch C_
- [x] **P10.T18** Stage next season's draft — _batch C_
- [x] **P10.T19** League settings — _batch C_
- [x] **P10.T20** A private ranked pre-draft list — add films, drag to rank, mark taken or unavailable — _batch E_
- [ ] **P10.T21** Live board updates while the draft runs — _deferred to phase 14 (D23)_
- [x] **P10.T22** Every award show — _phase 8_
- [x] **P10.T23** One show: its categories, point values, nominees and winners — _phase 8_
- [x] **P10.T24** Past seasons of a show — _phase 8_
- [x] **P10.T25** Subscribe to ceremony dates as a calendar — _batch H_
- [x] **P10.T26** Admin: edit a show's dates and live flags — _batch G_
- [x] **P10.T27** Admin: add or delete a category — _batch G_
- [x] **P10.T28** Admin: enter nominations — _phase 8_
- [x] **P10.T29** Admin: pick winners during the ceremony — _phase 8_
- [x] **P10.T30** Admin: which shows still need entering — _phase 8_
- [ ] **P10.T31** Watch results land in real time, with league standings beside them — _deferred to phase 14 (D23)_
- [ ] **P10.T32** The admin's selection drives every watcher's screen — _deferred to phase 14 (D23)_
- [x] **P10.T33** Your watched films, paged and sorted — _batch E_
- [x] **P10.T34** Mark a film watched, or unmark it — _batch D_
- [x] **P10.T35** Progress against this year's nominees, by show — _batch E_
- [x] **P10.T36** Progress against the year's nominated films — _batch E_
- [x] **P10.T37** Which drafted films you have seen — _batch E_
- [x] **P10.T38** Rate and review a film — _batch E_
- [x] **P10.T39** Read your own review — _batch E_
- [x] **P10.T40** A member's profile and activity feed — _batch E_
- [x] **P10.T41** Post to your feed — _batch E_
- [x] **P10.T42** Delete a feed item — _batch E_
- [x] **P10.T43** Your recent notifications — _batch G_
- [x] **P10.T44** Mark as read — _batch G_
- [x] **P10.T45** Admin: broadcast to everyone — _batch G_
- [x] **P10.T46** Rules and scoring explained — _batch G_
- [x] **P10.T47** The scoring rulebook by tier — _batch G_
- [x] **P10.T48** Admin: set the active season — _batch G_
- [x] **P10.T49** Admin: relink an account — _batch G_
- [x] **P10.T50** A 500 page — _batch A_
- [x] **Phase 10 complete.** Every row closed except the four Phase 14 deferrals — T3, T21, T31 and T32. `PARITY.md` reads **65 ported / 4 deficient / 15 dropped = 84**.


---

## Phase 3.5 — Design system refinement + Storybook

Spec: [`docs/superpowers/specs/2026-08-17-design-system-and-storybook-design.md`](superpowers/specs/2026-08-17-design-system-and-storybook-design.md)
Research: [`docs/reference/2026-08-17-design-research.md`](reference/2026-08-17-design-research.md)

Requested by the owner 2026-08-17, mid-Phase-10: the app read "too techy/nerdy",
naming the all-caps headings, the squared-off buttons and the desktop top nav.
Numbered 3.5 because it revises Phase 3's output rather than following Phase 10.
Decisions D67–D78.

- [x] P3.5.T1 Storybook 10 + `@storybook/nextjs-vite` — PostCSS object-form fix, font decorator, MUI `setMode` wiring, `addon-a11y`
- [x] P3.5.T2 Foundations — both palettes, type scale, radius, elevation, motion; `contrast.test.ts` + `tokens.test.ts` extended; `Styleguide.mdx`
- [x] P3.5.T3 Primitives — `SectionHead`, `Eyebrow`, `Shelf`, `Button`, `StatusChip`, `Panel`, `CinemaFrame`, each with stories and states
- [x] P3.5.T4 `AppShell`, `NavRail`, `TabBar`, `MoreSheet`; `AppNav` deleted; `e2e/nav.spec.ts` rewritten
- [x] P3.5.T5 Page sweep — 20 surfaces (spec §8)
- [x] P3.5.T6 Docs reconciled; `/tokens` deleted
- [~] P3.5.T6b Second Vercel project for Storybook — **dropped** (D78). Run it locally with `npm run storybook`.

**Phase 3.5 complete.** 86 files / 1207 tests. `npm run verify`, `npm run build-storybook`, `bash scripts/layering.sh` and `npm run typecheck` all clean. Decisions D67–D78.

Two gate clauses were dropped by owner direction mid-run and are still owed before cutover: the consolidated Storybook a11y pass over every story in both schemes, and the per-surface browser checks at 1440px/390px. `addon-a11y` is configured `test: 'error'`, but no Storybook test-runner is installed, so `build-storybook` runs no axe checks.

### What the next phase needs to know

Facts a later phase cannot re-derive by reading the code. Verified against the
code at the close of Phase 3.5, not copied from the spec.

**Storybook (spec §7.2 — five landmines, all still live)**

- `postcss.config.mjs` must use the **object** form. Next accepts
  `plugins: ["@tailwindcss/postcss"]`; Vite's `postcss-load-config` rejects it.
- `.storybook/preview` must be **`.tsx`, never `.ts`** — the `.ts` extension is
  a documented cause of `Cannot read properties of undefined (reading
  'className')` with `next/font`.
- Fonts reach `<html>` from a **decorator** importing `theme/fonts.ts`, applied
  to `document.documentElement`. Storybook never renders the root layout, and
  calling a `next/font` loader a second time inside `preview.tsx` breaks.
- 🔴 **Do not set `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` in CI.** Turbopack has no
  fallback for a mocked-response miss: an empty map fails every font with
  `Module not found: Can't resolve
  '@vercel/turbopack-next/internal/font/google/cssmodule.module.css'` and
  `url not found`. Only a map containing the exact CSS-API URL of every
  requested family works, and those URLs change with any font option. CI
  fetches from Google Fonts like every other build; the loader already retries
  three times.
- Drive MUI's `setMode()` from a toolbar global (`.storybook/SyncMode.tsx`).
  Never `withThemeByDataAttribute`: MUI *owns* `data-mui-color-scheme`, and an
  addon writing it makes `useColorScheme()` stale and `localStorage['mui-mode']`
  wrong.
- `forceThemeRerender` is required on `ThemeProvider`; with `cssVariables: true`
  MUI does not re-render on a mode switch.
- Two more, and the second is the one that costs time: `app/globals.css` must be
  the **first** import in `preview.tsx`, because `@layer` order is fixed by first
  declaration — and **Storybook injects its own preview styles un-layered, which
  outranks every layered rule.** If a story looks wrong *only* in Storybook,
  suspect that before suspecting the component.

**Primitive contracts — the traps, not the API**

- **`SectionHead`'s right-slot wrapper carries `font-mono`**, so a non-numeric
  child silently inherits monospace. This shipped a primary CTA in IBM Plex Mono
  before it was caught. Words in that slot need `font-sans` at the call site.
- **`SectionHead`'s non-`name` heading is `font-semibold`, and Instrument Serif
  ships weight 400 only**, so `font-serif` inside it is browser-synthesised into
  faux-bold. Needs `font-normal` at the call site.
- **`Shelf` hard-codes `as="h3"` and renders a bare `<ul>` with no
  accessible-name prop.** Three separate tasks each wanted a different widening
  of that contract, so it was deliberately left alone mid-sweep. It is a known
  gap, not an oversight — settle it once, with all call sites in view.
- **`components/EmptyState.tsx` and `components/SeasonRail.tsx` are shared
  across surfaces.** Changing their rendered output moves pages a task may not
  have in view (`SeasonRail` renders on both Home and Browse).

**Tokens and type**

- **Token *names* did not change; values did** (D77). The spec says
  `bg.void` / `bg.panel`; the code says `bg.base` / `bg.surface`. Translate.
- **`brass.contrast` differs per scheme** — `#241C05` on dark, `#FFFFFF` on
  light. Dark ink on *light* brass is 2.65:1 and fails, so this is a **token
  pair, not a component branch**; D15's "no component branches on theme" holds
  because the pair does the work.
- **Serif renders proper nouns only** (D70), and it is a *semantic* rule, not a
  dimensional one — which is what makes a single-weight face safe. A name that
  must be set below 15px renders in Archivo. That is the only exception.
- **`--font-serif` and `--font-mono` are Tailwind's own theme keys.** A
  `next/font` loader must never be given those variable names: the resulting
  self-reference is a CSS cycle, which resolves silently to the browser default
  with no warning and a passing build. Hence `--font-instrument-serif` and
  `--font-plex-mono`.

**Layout and process**

- **The rail is 208px and collapses at `xl` (1280px), not `lg`.** Measured, not
  estimated — see D67. §11.4's own arithmetic is wrong by ~25%: it predicts
  ~128px per poster on a 7-round board where the measured figure is 96.1px,
  because its sum ignores the board's ~114px seat column and the page's padding.
  The 28px the rail gave back is **not** what makes a 10-seat board legible; the
  desktop `DraftBoard` compressing instead of scrolling is (see Open questions).
- **Deleting a route leaves a stale `.next/dev/types/validator.ts`** that fails
  `npm run typecheck` with a "cannot find module" error naming the page you just
  deleted. `rm -rf .next/dev/types` fixes it.
- `scripts/layering.sh` covers `.storybook/` and `*.stories.tsx` as well as
  `components/` and `app/`; `app/global-error.tsx` is the only hex exemption. It
  does **not** grep for `uppercase`, `font-display` or `wdth` — those retired
  treatments are enforced by remembering, which is how two files no task owned
  shipped in violation with every gate green.

---

## Phase 11 — Media → Vercel Blob

Plan: [`docs/superpowers/plans/2026-08-24-phase-11-media.md`](superpowers/plans/2026-08-24-phase-11-media.md)

🔴 **There is no Cloudinary to migrate.** Measured against the Neon copy on
2026-08-24: `users.image` holds 323 `img.clerk.com`, 51 `s.gravatar.com` and 4
`googleusercontent` URLs, and **zero** Cloudinary values or bare public IDs —
the Clerk webhook has been writing `image_url` since Phase 4, so the avatars
migrated themselves. No upload UI exists in the port either. `PLAN.md` T2 and
T5 therefore have no work in them, and the phase is instead the two things that
are genuinely undone: `next/image` (eleven `noImgElement` ignores defer to this
phase, and `images.remotePatterns` is empty) and the twelve award-show logos,
which `events.image` points at as `/images/awards/*.jpg` — paths served from
the source app's `public/`, a directory this repo does not have.

- [ ] P11.T0 Record the Blob **public hostname** — needed for `next/image` `remotePatterns`. Read it off the first uploaded blob's URL
- [ ] P11.T1 The optimization rule, the remote-host allowlist, and `RemoteImage`
- [ ] P11.T2 Swap the eleven `<img>` sites to `next/image`
- [ ] P11.T3 Upload the twelve logos to Blob and rewrite `events.image`
- [ ] P11.T4 Render a show's mark on the index and the show page
- [ ] P11.T5 E2E, and close the phase

## Phase 12 — Parallel run

- [ ] P12 not started

## Phase 13 — Cutover

- [ ] P13 not started

## Phase 14 — Realtime

- [ ] P14 not started

## Phase 15 — New features

- [ ] P15 not started

---

## Open questions carried forward

- **`NEXT_PUBLIC_ACTIVE_YEAR` still set in Vercel.** Delete it once P5.T0 ships the database-backed read path (D22). It was last touched 510 days ago — this is the variable that forces an annual rebuild.
- **Neon injected unused auth variables.** `NEON_AUTH_BASE_URL` and `VITE_NEON_AUTH_URL` are Neon Auth (Stack Auth), which this project does not use — auth is Clerk (D7). Delete them so no one later infers a second auth system. The `VITE_` prefix is also wrong for a Next app.
- **`BLOB_WEBHOOK_PUBLIC_KEY` is not set in Development**, only Production/Preview. Only matters if Blob webhooks are handled locally; Phase 11 already routes around the OIDC environment constraint.
- **Clerk keys are Development instance (`pk_test_`) in all environments.** Correct for the build — the Production instance needs a verified domain. At release, create it, swap Production to `pk_live_`/`sk_live_`, and recreate the webhook (endpoints and signing secrets are per-instance).
- **Realtime transport undecided** — deferred to phase 14 by D23. Not on the cutover path.
- **Logo mark undecided.** Wordmark-only until resolved. See `docs/DECISIONS.md` → Still open.
- **The desktop `DraftBoard` compresses instead of scrolling.** A 10-seat board
  at 1280px inside the shell holds poster cells around 66–81px whatever the rail
  width — the table's `w-24` columns are a hint rather than a floor
  (`scrollWidth === clientWidth` at every width measured), and the league page
  sheds a further 64px to its own `max-w-6xl` and `p-8`. `Shelf` and
  `RosterStrip` both scroll or wrap and hold their 160px floor; the table is the
  one component that does neither. Three ways out, none chosen: the table
  scrolls horizontally like `Shelf`; the board sheds its own `max-w-6xl`/`p-8`
  inside the shell; or 10 seats is declared out of scope below 1440px. The
  design target is 1440px, so this is not on the cutover path. See
  `docs/DECISIONS.md` → Still open.
- **No a11y pass has run over the Storybook stories.** `addon-a11y` is
  configured `test: 'error'`, but no Storybook test-runner is installed, so
  `build-storybook` runs no axe checks — they need a real browser. One pass over
  every story in both schemes is owed before cutover, along with the per-surface
  browser checks at 1440px and 390px.
- **Retired treatments are enforced by memory, not by a gate.**
  `scripts/layering.sh` greps for raw hex and for layering violations, and for
  nothing else. Two files carrying `uppercase` that no task owned shipped in
  violation with every gate green until they were found by inventory. Consider
  adding `uppercase`, `font-display` and `font-variation-settings` greps —
  scoped so `Eyebrow` and `PickCell`'s two-letter initials are allowed.

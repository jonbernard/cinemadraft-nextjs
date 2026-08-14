# Progress

**Read this first in a new session.** Find the first unchecked task, open its phase plan in `docs/superpowers/plans/`, and continue. If the phase plan doesn't exist yet, write it first from `docs/PLAN.md` and the spec.

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
- [ ] P0.T8 TMDB / OMDB / remaining env keys carried over
- [ ] P0 completion checklist fully ticked

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
- **Row counts captured** to `.local/prod-row-counts.txt` (2026-08-14). Use **exact** `count(*)` via `query_to_xml` — never `pg_stat_user_tables.n_live_tup`, which is a stale statistics estimate and was badly wrong here. Query is in the Phase 0 runbook, Task 7 Step 4; run the identical query against Neon at P2.T2 and again at P2.T4
- Production row counts: `AvailableYears 10 · Awards 100 · DraftPicks 1025 · Drafts 156 · Events 12 · Leagues 13 · Lists 155 · Movies 1355 · Nominations 4559 · Notifications 2124 · Points 12 · ProfileFeeds 125 · Reviews 0 · SequelizeMeta 18 · Users 60 · Watchlists 2363 · Winners 734`
- **`Reviews` is empty in production** — 0 rows. Table and Sequelize model exist; the feature was never used. Phase 7 decides whether it ships at all — do not assume parity requires it
- P2.T4 note: `normalize.sql` **drops `SequelizeMeta`** (D27), so the post-normalization comparison covers the remaining 16 tables. Every one must match exactly
- **Contract fixtures captured** 2026-08-14 — 32 GET endpoints, all HTTP 200, all valid JSON, 1.5 MB, in `.local/fixtures/` (gitignored: they contain real user emails). Each `<name>.json` has a sibling `<name>.path` recording the URL it came from. Capture script is committed at `scripts/capture-fixtures.sh` and reads the bearer token from `$TOKEN` — it is never written to disk
- Fixtures were captured as **user id 3** (`jon@jonbernard.net`, role `admin`), uuid `19f25e89-6d1a-4b65-ad83-efb3b1a2fd46`. Params used: league `1`, draft `124` (2025), year `2025`, lists year `2024`, tmdbId `313369`, event `oscars`
- `review-by-tmdb` fixture is `{}` — consistent with `Reviews` having 0 rows. Not a capture failure

### Source-app bugs found while capturing fixtures

Carry these into Phase 7. Do **not** reproduce them in the port.

- **`GET /draft/users/:id` takes a *league* id, not a draft id.** The handler calls `Drafts.getUsersByLeagueId`. Passing a draft id returns `[]` rather than erroring, so the bug is silent. Rename the concept in the port
- **`GET /watchlist/:page?/:columnName?/:direction` only accepts `createdAt` and `releaseDate`.** `columnName` is passed straight into the Sequelize `order` array and only `releaseDate` is special-cased onto the joined `movie` table, so `title` / `sortTitle` raise Postgres `42703 errorMissingColumn`. Sortable columns must be a validated allowlist in the port
- 🔴 **The error handler leaks schema.** That 42703 response returns the full failing SQL, column list, and Postgres internals (`parse_relation.c`) to the client. The port must return an opaque error and log the detail server-side. See the typed error classes in P2.T10

---

## Phase 1 — Scaffold

Plan: _not yet written_

- [ ] P1.T1 `create-next-app`, TS strict, Node 24 pinned
- [ ] P1.T2 MUI v7 + `@mui/material-nextjs` + emotion cache provider
- [ ] P1.T3 ESLint + Prettier, `npm run lint` green
- [ ] P1.T4 Vitest config + smoke test
- [ ] P1.T5 Playwright config + smoke test
- [ ] P1.T6 GitHub Actions CI — lint, typecheck, test, build
- [ ] P1.T7 Directory skeleton per spec §5
- [ ] P1.T8 `docker-compose.local.yml` — local Postgres container + `db:up` / `db:down` scripts
- [ ] P1.T9 First Vercel preview deploy green

---

## Phase 2 — Data layer

Plan: _not yet written_

- [ ] P2.T1 Restore dump into Neon as-is (`--no-owner --no-privileges`, unpooled URL)
- [ ] P2.T2 🔴 Verify row counts against `.local/prod-row-counts.txt`
- [ ] P2.T3 Write `prisma/normalize.sql` — snake_case renames, drop dead columns (D27)
- [ ] P2.T4 🔴 Apply it, verify row counts **again** — must be identical
- [ ] P2.T5 `prisma db pull`, review every model in TablePlus
- [ ] P2.T6 Add `@@map` / `@map` so Prisma stays PascalCase/camelCase over snake_case
- [ ] P2.T7 Baseline migrations
- [ ] P2.T8 `lib/db.ts` — Prisma singleton + Neon adapter
- [ ] P2.T9 Migration: `Movie.accentHex`, `User.clerkId`, `AvailableYear.isActive` + partial unique index
- [ ] P2.T10 Typed error classes
- [ ] P2.T11 Load normalized data into the local Docker database for contract tests
- [ ] P2.T12+ One repository per live table, TDD'd against fixtures (16 total)

## Phase 3 — Design system

Plan: _not yet written_

- [ ] P3.T1 Token types + dark palette
- [ ] P3.T2 Light palette
- [ ] P3.T3 🔴 Contrast test — must exist before any component consumes tokens
- [ ] P3.T4 Typography via `next/font`, tabular numerals
- [ ] P3.T5 MUI theme assembly, dark default + light toggle
- [ ] P3.T6 Poster accent luminance clamping + test
- [ ] P3.T7 Letterbox rule component
- [ ] P3.T8 Poster frame component

---

## Phase 4 — Auth 🔴 priority trio

Plan: _not yet written_

- [ ] P4.T1 Clerk installed, middleware on `(app)` segment
- [ ] P4.T2 `lib/auth.ts` — session → `User` resolution
- [ ] P4.T3 Clerk webhook with signature verification
- [ ] P4.T4 Claim logic — verified-email match sets `clerkId`, else create (D25)
- [ ] P4.T5 🔴 Claim safety tests — unverified email can't claim; a second Clerk identity can't overwrite an existing `clerkId`
- [ ] P4.T6 Sign-in / sign-up pages, with returning-user copy
- [ ] P4.T7 E2E: claim a real production account, leagues intact
- [ ] P4.T8 Admin relink path for mismatched emails

---

## Phase 5 — Dashboard 🔴 priority trio

Plan: _not yet written_

- [ ] P5.T0 `lib/services/season.ts` — `getActiveYear()`, retires `NEXT_PUBLIC_ACTIVE_YEAR`
- [ ] P5.T1 `lib/services/dashboard.ts`
- [ ] P5.T2 Dashboard RSC page
- [ ] P5.T3 Season rail component
- [ ] P5.T4 Roster strip component
- [ ] P5.T5 League standings panel
- [ ] P5.T6 Empty states
- [ ] P5.T7 E2E

---

## Phase 6 — Draft 🔴 priority trio

Plan: _not yet written_

- [ ] P6.T1 `lib/services/draft.ts` — snake order, pick validation
- [ ] P6.T2 Snake board with poster thumbnails
- [ ] P6.T3 Draft pick Server Action
- [ ] P6.T4 Reordering with `@hello-pangea/dnd`
- [ ] P6.T5 Draft list / queue
- [ ] P6.T6 E2E

---

## Phase 7 — Parity audit 🔴 gates cutover

Plan: _not yet written_

- [ ] P7.T1 Enumerate 18 source route files
- [ ] P7.T2 Enumerate 17 source controllers
- [ ] P7.T3 Enumerate source pages
- [ ] P7.T4 Classify ported / deficient / dropped
- [ ] P7.T5 Write `docs/PARITY.md`
- [ ] P7.T6 Decompose deficiencies into phase 10 tasks
- [ ] P7 Owner review of the matrix

---

## Phase 8 — Award shows + search

Plan: _not yet written_ — 10 tasks, see `docs/PLAN.md`

- [ ] P8 not started

---

## Phase 9 — Scoring pipeline

Plan: _not yet written_ — 7 tasks, see `docs/PLAN.md`

- [ ] P9 not started

---

## Phase 10 — Remaining features to parity

Plan: _written after phase 7, driven by `docs/PARITY.md`_

- [ ] P10 not started

---

## Phase 11 — Media → Vercel Blob

- [ ] P11 not started

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

- **`NEXT_PUBLIC_ACTIVE_YEAR` still set in Vercel.** Delete it once P5.T0 ships the database-backed read path (D22).
- **Clerk keys are Development instance (`pk_test_`) in all environments.** Correct for the build — the Production instance needs a verified domain. At release, create it, swap Production to `pk_live_`/`sk_live_`, and recreate the webhook (endpoints and signing secrets are per-instance).
- **Realtime transport undecided** — deferred to phase 14 by D23. Not on the cutover path.
- **Logo mark undecided.** Wordmark-only until resolved. See `docs/DECISIONS.md` → Still open.

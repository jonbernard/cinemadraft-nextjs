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
- **`GET /movie/:id/details` is `GET /movie/:id` plus exactly three OMDB fields** — `box_office_gross`, `omdb_mpaa`, `rt_link`. Both fixtures are ~184 KB and differ only in those keys. Two endpoints returning a 184 KB payload to vary by three fields is the wrong shape; the port should have one movie read path with optional enrichment. The payload size itself deserves scrutiny in Phase 8

### Legacy fields to consider dropping

- **`fbId` appears across `Events`, `Leagues`, `Winners`, and others** — Firebase-era identifiers from before the Postgres migration. Out of scope for D27 (which dropped only `password`/`salt`), but Phase 7 should decide whether these carry forward. They are dead weight if nothing reads them; check before dropping, since some may still be joined against
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
- [ ] P2.T5 Prisma 7 installed; `prisma.config.ts` and schema header hand-written (no `prisma init`, D31); `prisma db pull` against **Docker**, not Neon
- [ ] P2.T6 `scripts/pascalize-schema.mjs` — PascalCase models and camelCase fields over snake_case, via `@@map`/`@map`; proven lossless by an empty `migrate diff`
- [ ] P2.T7 Baseline `0_init`, resolved as applied on both Docker and Neon; `migrate status` clean on both
- [ ] P2.T8 `lib/db.ts` — Prisma client singleton + Neon adapter
- [ ] P2.T9 Migration: `movies.accent_hex`, `users.clerk_id`, `available_years.is_active` + the partial unique index enforcing at most one active year (D22)
- [ ] P2.T10 Typed error classes — `NotFoundError`, `ForbiddenError`, `ConflictError`

### Repositories (T12–T27)

One per live table, in this order. Each: contract test first against `fixtures/`, watch it fail, implement returning plain DTOs, watch it pass, commit.

- [ ] P2.T12 `movies` — richest fixture; written first and reviewed, then becomes the template
- [ ] P2.T13 `users` — claim-on-signin depends on this (D25)
- [ ] P2.T14 `events` — award shows
- [ ] P2.T15 `awards` — carries the per-award point value
- [ ] P2.T16 `nominations` — 4559 rows, the scoring input
- [ ] P2.T17 `winners` — a win scores P a second time
- [ ] P2.T18 `points` — the level/tier/points lookup
- [ ] P2.T19 `leagues`
- [ ] P2.T20 `drafts`
- [ ] P2.T21 `draft_picks` — 1025 rows
- [ ] P2.T22 `lists`
- [ ] P2.T23 `watchlists` — 2363 rows
- [ ] P2.T24 `notifications`
- [ ] P2.T25 `profile_feeds` — `message` is free text containing user names
- [ ] P2.T26 `available_years` — active-year read path (D22)
- [ ] P2.T27 `reviews` — 🔴 **0 rows in production** — Phase 7 decides whether it ships at all; do not assume parity requires it

**The fixtures are the contract.** Where a repository disagrees with a fixture, the fixture wins — unless it encodes one of the source-app bugs recorded above, in which case the correct behaviour wins and the deviation is documented in the test.
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

- [ ] P4.T0 🔴 Confirm **account linking** is enabled in the Clerk dashboard — without it one email can produce two Clerk identities, which breaks the D25 claim flow
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

- [ ] P11.T0 Record the Blob **public hostname** — needed for `next/image` `remotePatterns`. Read it off the first uploaded blob's URL
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

- **`NEXT_PUBLIC_ACTIVE_YEAR` still set in Vercel.** Delete it once P5.T0 ships the database-backed read path (D22). It was last touched 510 days ago — this is the variable that forces an annual rebuild.
- **Neon injected unused auth variables.** `NEON_AUTH_BASE_URL` and `VITE_NEON_AUTH_URL` are Neon Auth (Stack Auth), which this project does not use — auth is Clerk (D7). Delete them so no one later infers a second auth system. The `VITE_` prefix is also wrong for a Next app.
- **`BLOB_WEBHOOK_PUBLIC_KEY` is not set in Development**, only Production/Preview. Only matters if Blob webhooks are handled locally; Phase 11 already routes around the OIDC environment constraint.
- **Clerk keys are Development instance (`pk_test_`) in all environments.** Correct for the build — the Production instance needs a verified domain. At release, create it, swap Production to `pk_live_`/`sk_live_`, and recreate the webhook (endpoints and signing secrets are per-instance).
- **Realtime transport undecided** — deferred to phase 14 by D23. Not on the cutover path.
- **Logo mark undecided.** Wordmark-only until resolved. See `docs/DECISIONS.md` → Still open.

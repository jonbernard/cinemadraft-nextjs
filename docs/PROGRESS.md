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
- [ ] P0.T2 Neon provisioned via Marketplace, free plan, preview branching on
- [ ] P0.T3 Upstash Redis provisioned, region matched to Vercel function region
- [ ] P0.T4 Vercel Blob store created
- [ ] P0.T5 Clerk app created — **connections matched to Auth0 exactly**, keys and webhook secret in Vercel
- [ ] P0.T6 Auth0 Management app created with `read:users` only
- [ ] P0.T7 🔴 Production dump + row counts + API contract fixtures captured
- [ ] P0.T8 TMDB / OMDB / remaining env keys carried over
- [ ] P0 completion checklist fully ticked

### Phase 0 notes

_Fill these in as you go — later phases read them._

- Heroku app name: `cinemadraft` (add-on `postgresql-fluffy-16646`, plan `essential-1`)
- Blob public hostname: `________`
- Auth0 user count at migration time: `________`
- Auth0 connections enabled (must match Clerk): `________`
- Vercel project: `cinemadraft-nextjs` (`prj_6AQy9PCklalfMLCMHSuRDtAgEzfK`), linked in repo mode
- Staging domain: `next.cinemadraft.com` — also the Clerk webhook host
- Neon attached to Production + Preview only (by design; Development uses Docker). Vars are Sensitive and cannot be `vercel env pull`ed — connection string comes from the Neon console into `.local/.env.neon`
- Neon Postgres version: `________`
- Vercel function region: `________`
- Postgres client: libpq 18.4 at `/opt/homebrew/opt/libpq/bin`
- Heroku Postgres server version: `17.9` — libpq 18.4 reads it fine
- Production data size: `11.9 MB`, 17 tables (16 app tables + `SequelizeMeta`). Dump will be fast
- **Dead models — do NOT build repositories for these:** `session` (no migration ever existed) and `moviesstats` (migration is entirely commented out). 18 model files, 16 live tables

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

- [ ] P2.T1 Restore dump into Neon, verify row counts against `.local/prod-row-counts.txt`
- [ ] P2.T2 `prisma db pull`, review every model (use TablePlus against `cinemadraft-neon` for the review)
- [ ] P2.T3 Baseline migrations
- [ ] P2.T4 Drop `SequelizeMeta`
- [ ] P2.T5 `lib/db.ts` — Prisma singleton + Neon adapter
- [ ] P2.T6 Migration: `Movie.accentHex`, `User.clerkId`, `AvailableYear.isActive` + partial unique index
- [ ] P2.T7 Typed error classes
- [ ] P2.T7a Load the production dump into the local Docker database for contract tests
- [ ] P2.T8+ One repository per domain, TDD'd against fixtures (16 repositories — enumerated when the plan is written)

---

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
- [ ] P4.T4 Auth0 → Clerk import script, dry-run mode
- [ ] P4.T5 🔴 Run import + backfill `clerkId` — **only after Clerk connections verified**
- [ ] P4.T6 Sign-in / sign-up pages
- [ ] P4.T7 E2E: migrated production user signs in with leagues intact

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
- **Logo mark undecided.** Wordmark-only until resolved. See `docs/DECISIONS.md` → Still open.

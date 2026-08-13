# Cinemadraft Conversion — Master Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement each phase plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CRA/Express/Heroku Cinemadraft app with a Next.js application on Vercel — Neon + Prisma, Clerk auth, Server Components and Server Actions — carrying a new visual identity, then cut `cinemadraft.com` over and retire Heroku.

**Spec:** `docs/superpowers/specs/2026-08-13-cinemadraft-nextjs-conversion-design.md`
**Decisions:** `docs/DECISIONS.md` — locked, do not re-litigate
**Progress ledger:** `docs/PROGRESS.md` — read this first in a new session

---

## How this plan is structured

This document is the **index**. Each phase has its own detail plan under `docs/superpowers/plans/`, written with full bite-sized TDD steps.

**Phase plans are written just-in-time, at the start of the phase.** Writing all sixteen up front would produce hundreds of steps that go stale as earlier phases teach us things. The index below is stable; the detail is not.

### Starting a session

1. Read `docs/PROGRESS.md`. Find the first unchecked task.
2. Open that task's phase plan in `docs/superpowers/plans/`.
3. If the phase plan does not exist yet, write it first using `superpowers:writing-plans`, from this index and the spec.
4. Work the task. One commit per task, message referencing the task ID (`P4.T3: ...`).
5. Tick the box in `PROGRESS.md` as the final step of the task.

---

## Global constraints

Every task inherits these. Values copied verbatim from the spec.

- **Node 22.** Package manager: npm.
- **All local databases run in Docker.** No native Postgres server on the dev machine. Local Postgres binaries are client-only (`libpq`: `psql`, `pg_dump`, `pg_restore`). Local dev and test databases are containers defined in `docker-compose.local.yml`, pinned to the same major version Neon provisions.
- **TypeScript strict.** No `any` in committed code without an inline justification comment.
- **Next.js 16 App Router**, React 19. No Pages Router.
- **MUI v7** with `@mui/material-nextjs`. No Tailwind, no shadcn (D3).
- **Prisma 6** with `@prisma/adapter-neon`. `lib/repositories/` is the **only** layer that may import `@prisma/client` (§5).
- **Repositories return plain DTOs**, never Prisma model instances.
- **No general `/api` layer** (D8). `/api` is permitted only for: `webhooks/clerk`, `live/[event]/stream`, `ical/[...]`.
- **Server Actions never throw across the boundary.** They return `{ ok: true; data: T } | { ok: false; error: string; field?: string }`.
- **Every color comes from a theme token.** No raw hex in components (§6.2, §6.3).
- **Scoring rule is defined in exactly one place:** `lib/services/scoring.ts`. Nomination = P, win = 2P total.
- **No secret is ever committed.** All credentials live in Vercel env, pulled locally with `vercel env pull`.
- **Reduced motion respected** on every animation.
- **Contrast:** every token pair meets WCAG AA — 4.5:1 text, 3:1 large text and non-text UI.

---

## Phases

Legend for gates: a phase is done when its gate is demonstrably true, verified by running the stated command or check — not by inspection.

### Phase 0 — Owner setup 🔴 blocks everything

**Plan:** `docs/superpowers/plans/2026-08-13-phase-0-owner-setup.md` ✅ written
**Executed by:** the owner, not an agent.

Provision Vercel, Neon, Upstash, Vercel Blob, Clerk and an Auth0 Management application. Capture a production database dump and the API contract fixtures while Heroku is still live.

**Gate:** `vercel env pull` produces a `.env.local` containing every required key; `.local/prod-dump.dump` and `fixtures/` exist locally.

**Why it blocks:** the contract fixtures and the database dump come from a Heroku app that gets retired in phase 13. They are unrecoverable if skipped.

---

### Phase 1 — Scaffold

Next 16 + TS strict + MUI v7 + ESLint/Prettier + Vitest + Playwright + CI. Directory skeleton per §5. Deploys to a Vercel preview.

- T1: `create-next-app` with TS, App Router; pin Node 22 in `package.json` engines and `.nvmrc`
- T2: MUI v7 + `@mui/material-nextjs` + emotion; App Router cache provider wired in `app/layout.tsx`
- T3: ESLint + Prettier config; `npm run lint` green
- T4: Vitest config + one passing smoke test
- T5: Playwright config + one passing smoke test against `next dev`
- T6: GitHub Actions CI running lint, typecheck, unit, build
- T7: Directory skeleton from §5 with a placeholder in each folder
- T8: `docker-compose.local.yml` — Postgres container matching Neon's major version; `npm run db:up` / `db:down` scripts
- T9: First Vercel preview deploy succeeds

**Gate:** `npm run lint && npm run typecheck && npm run test && npm run build` all green locally and in CI; `npm run db:up` brings up a reachable local Postgres container; preview URL loads.

---

### Phase 2 — Data layer

Restore production data to Neon, introspect, baseline, build repositories against captured fixtures.

- T1: Restore `.local/prod-dump.dump` into the Neon database; verify row counts against Heroku
- T2: `prisma db pull` → `schema.prisma`; review every model for correct `@@map` and types
- T3: Baseline: `prisma migrate diff` → `prisma migrate resolve --applied 0_init`
- T4: Drop `SequelizeMeta`
- T5: `lib/db.ts` — Prisma singleton with `@prisma/adapter-neon`
- T6: Migration adding `Movie.accentHex` and `User.clerkId` (unique, nullable)
- T7: Typed error classes (`NotFoundError`, `ForbiddenError`, `ConflictError`)
- T7a: Load the production dump into the **local Docker** database — this is what repository contract tests run against, never Neon
- T8–T23: One repository per live table, each TDD'd against its captured fixture — availableYears, awards, draft, draftPicks, events, leagues, lists, movies, nominations, notifications, points, profileFeeds, reviews, users, watchlist, winners (**16 total**)

> **Do not create repositories for `session` or `moviesstats`.** Both are dead Sequelize models with no table in production — `session` never had a migration, and `moviesstats` has its migration entirely commented out. `prisma db pull` will not produce models for them, and it should not.

**Gate:** every repository contract test passes against the golden fixtures captured in phase 0.

---

### Phase 3 — Design system

Tokens, both themes, typography, and the tests that keep them honest.

- T1: Token type definitions and the dark palette (§6.2)
- T2: Light palette (§6.3)
- T3: **Contrast test** — asserts every token pair in both themes meets its WCAG threshold. Must exist before any component consumes tokens
- T4: Typography scale via `next/font` — Archivo (variable, width axis) + IBM Plex Mono, tabular numerals
- T5: MUI v7 theme assembly from tokens; `ThemeProvider` with dark default and a light toggle
- T6: Poster accent luminance clamping (`lib/external/color.ts`) + unit test proving clamped output always clears 4.5:1
- T7: Letterbox rule component (the signature device, §6.1)
- T8: Poster frame component — 2:3, caption below, two-line clamp, seal and nominated states

**Gate:** design tests green; a token-gallery page renders both themes with no raw hex anywhere in `components/`.

---

### Phase 4 — Auth 🔴 priority trio

- T1: `@clerk/nextjs` installed; middleware protecting the `(app)` segment
- T2: `lib/auth.ts` — `getCurrentUser`, `requireUser`, `requireAdmin`; resolves Clerk session → `User` via `clerkId`, falling back to email
- T3: `/api/webhooks/clerk` — signature verification, `user.created` / `user.updated` upsert keyed on email
- T4: Auth0 → Clerk user import script (dry-run mode first, reporting what it *would* create)
- T5: Run the import against production users; backfill `User.clerkId`
- T6: Sign-in / sign-up pages styled with phase 3 tokens
- T7: E2E: sign in as a migrated production user

**Gate:** a real migrated user signs in and resolves to their existing `User` row with leagues intact.

**Watch item:** T5 must not run until the Auth0 social/passwordless connections are enabled in Clerk (phase 0). Otherwise those users get duplicate identities.

---

### Phase 5 — Dashboard 🔴 priority trio

Replaces the welcome-card home with state: standings position, next deadline, recent movement.

- T1: `lib/services/dashboard.ts` composing existing repositories
- T2: Dashboard RSC page
- T3: Season rail component (§6.7) — shows, dates, completed/next, countdown
- T4: Roster strip component (§6.7) — 8 frames, numbered by draft round, caption below, contribution bar, seal states, responsive 8→4→2
- T5: League standings panel with tabular figures
- T6: Empty states (no league, no draft yet)
- T7: E2E: dashboard renders for a user with a league

**Gate:** E2E green; no truncated titles at any breakpoint.

---

### Phase 6 — Draft 🔴 priority trio

- T1: `lib/services/draft.ts` — snake order derivation, pick validation, on-the-clock resolution
- T2: Snake board component — rounds down, owners across, reversal marker, poster thumbnails in filled cells (§6.7)
- T3: Draft pick Server Action + Zod schema; `revalidateTag`
- T4: Pick reordering with `@hello-pangea/dnd`
- T5: Draft list / queue surface
- T6: E2E: make a pick, verify it lands and the clock advances

**Gate:** E2E green; a taken film is unmistakable at a glance from artwork alone.

---

### Phase 7 — Parity audit 🔴 gates cutover

Not a formality. After the priority trio the app is visibly incomplete and the gap must be measured, not estimated.

- T1: Enumerate all 18 source route files and their endpoints
- T2: Enumerate all 17 source controllers and their exported functions
- T3: Enumerate every source page under `src/pages/`
- T4: Classify each as **ported** / **deficient** / **intentionally dropped**, with a one-line note on each dropped item
- T5: Write `docs/PARITY.md`
- T6: Decompose every deficient row into phase 10 tasks appended to this index

**Gate:** matrix complete and reviewed by the owner. **Cutover is blocked while any row is open.**

---

### Phase 8 — Award shows + search

The award show page is the input to the entire scoring pipeline; errors here propagate to every league (§12).

- T1: `lib/services/search.ts` — local-first `Movie` query with trigram/prefix index
- T2: TMDB fill-in, deduped on `tmdbId`, local row wins
- T3: Upstash caching keyed on query + year
- T4: Context-aware ranking — draft / browse / award-admin (§10)
- T5: Typeahead client component — 250 ms debounce, request cancellation, poster-first results
- T6: Award show page — categories, nominee grids
- T7: Admin: attach a nominee (uses award-admin search context)
- T8: Admin: mark a winner → triggers phase 9 recompute
- T9: Admin: **correct** a winner → fully reverses the prior recompute
- T10: E2E: attach nominee, mark winner, correct winner

**Gate:** all three search contexts return correct top results; a winner correction leaves no stale points.

---

### Phase 9 — Scoring pipeline

Replaces per-request Ramda recomputation in a route file with a tested rule and materialized results (§11).

- T1: `lib/services/scoring.ts` — pure function, no DB. Unit tests covering nomination = P, win = 2P
- T2: Migration adding `MovieScore`, `TeamScore`, `LeagueStanding`, each with `computedAt`
- T3: Bounded recompute: award → movies → teams → leagues → `revalidateTag`
- T4: Full recompute command (same code path, unbounded scope)
- T5: Reconciliation job — recompute from source, diff against stored, report mismatches
- T6: Vercel Cron schedule for nightly reconciliation during season
- T7: Points ledger UI — movie total by default, per-award lines on click (§6.7)

**Gate:** scoring unit tests green; reconciliation reports **zero drift** against restored production data.

---

### Phase 10 — Remaining features to parity

Driven entirely by `docs/PARITY.md` from phase 7. Tasks appended to this index at that point. Expected surfaces: films (browse + watchlist + list, consolidated per §6.9), leagues, live event on polling, reviews, users, admin, notifications, and the **ical calendar feed** (`/api/ical/[...]` — one of the three permitted `/api` routes under D8).

**Gate:** every row in `PARITY.md` closed; E2E green per feature.

---

### Phase 11 — Media

- T1: Vercel Blob client wrapper
- T2: Upload path switched from Cloudinary to Blob
- T3: Migration script for existing Cloudinary assets
- T4: Rewrite stored URLs
- T5: `next/image` configured for the Blob domain

**Gate:** images render from Blob; no Cloudinary request remains in the network log.

---

### Phase 12 — Parallel run

- T1: Deploy to a staging Vercel domain against a copy of production data
- T2: Manual verification pass, feature by feature, against `PARITY.md`
- T3: Measure Neon and Upstash free-tier headroom under realistic load
- T4: Load-test draft-day search
- T5: Fix everything found

**Gate:** full manual pass with zero blocking defects; free-tier headroom confirmed sufficient.

---

### Phase 13 — Cutover

- T1: Final `pg_dump` from Heroku → Neon
- T2: Point `cinemadraft.com` DNS at Vercel
- T3: Verify production sign-in, draft, and scoring
- T4: Monitor for 48 hours
- T5: Retire Heroku

**Gate:** site live on Vercel; Heroku scaled to zero.

---

### Phase 14 — Realtime

Replaces the polling fallback (D13).

- T1: Upstash pub/sub publisher in the winner-marking Server Action
- T2: `/api/live/[event]/stream` SSE route
- T3: Client subscription replacing the polling hook
- T4: Winner-seal stamp animation — the one orchestrated motion moment (§6.8)
- T5: Reconnection handling
- T6: E2E: two clients, admin marks winner, viewer receives it

**Gate:** live event works end to end with two concurrent clients.

---

### Phase 15 — New features

Per §7, all post-cutover.

- Season timeline rail (already built in phase 5 — extend to a full-season view)
- Points ledger (already built in phase 9 — extend)
- Head-to-head roster comparison, with shared vs unique picks called out
- Public logged-out league board replacing the welcome card

**Gate:** per-feature E2E green.

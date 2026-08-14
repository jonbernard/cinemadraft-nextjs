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
3. **If the phase plan does not exist yet, write it first** using `superpowers:writing-plans`, from this index and the spec. This is a hard rule — do not start a phase's first task because it looks mechanical. See the warning at the top of `docs/PROGRESS.md`.
4. Work the task. One commit per task, message referencing the task ID (`P4.T3: ...`).
5. Tick the box in `PROGRESS.md` as the final step of the task.

---

## Global constraints

Every task inherits these. Values copied verbatim from the spec.

- **Node 24** (current LTS), set in the Vercel project. Package manager: npm.
- **Latest stable, always** (D28). Check the npm registry before writing a version into a plan or a `package.json` — do not infer versions from memory. Recorded at Phase 1: Next 16.3.1, React 19.2.8, MUI 9.3.1, Prisma 7.9.1.
- **All local databases run in Docker.** No native Postgres server on the dev machine. Local Postgres binaries are client-only (`libpq`: `psql`, `pg_dump`, `pg_restore`). Local dev and test databases are containers defined in `docker-compose.local.yml`, pinned to the same major version Neon provisions.
- **TypeScript strict.** No `any` in committed code without an inline justification comment.
- **Next.js 16 App Router**, React 19. No Pages Router.
- **MUI (latest stable)** with `@mui/material-nextjs` for components; **Tailwind (latest stable) for custom styling** (D3, D29). No shadcn.
- **Cascade layer order is `@layer theme, base, mui, components, utilities`** and `AppRouterCacheProvider` runs with `enableCssLayer: true`. Never reach for `!important` to make a Tailwind class beat MUI — if that seems necessary, the layer order is wrong.
- **Prisma (latest stable)** with `@prisma/adapter-neon` at the matching major. `lib/repositories/` is the **only** layer that may import the Prisma client (§5).
- **Repositories return plain DTOs**, never Prisma model instances.
- **No general `/api` layer** (D8). `/api` is permitted only for: `webhooks/clerk`, `live/[event]/stream`, `ical/[...]`.
- **Server Actions never throw across the boundary.** They return `{ ok: true; data: T } | { ok: false; error: string; field?: string }`.
- **Every color comes from a theme token.** No raw hex in components (§6.2, §6.3).
- **Scoring rule is defined in exactly one place:** `lib/services/scoring.ts`. Nomination = P, win = 2P total.
- **No secret is ever committed.** Credentials live in Vercel env. Most are Sensitive and write-only, so local connection strings are copied from the provider console into the gitignored `.local/`.
- **Neon is Preview/Production only.** The Development `DATABASE_URL` points at the Docker container. Local shells and tests must never target Neon.
- **Reduced motion respected** on every animation.
- **Contrast:** every token pair meets WCAG AA — 4.5:1 text, 3:1 large text and non-text UI.

---

## Phases

Legend for gates: a phase is done when its gate is demonstrably true, verified by running the stated command or check — not by inspection.

### Phase 0 — Owner setup 🔴 blocks everything

**Plan:** `docs/superpowers/plans/2026-08-13-phase-0-owner-setup.md` ✅ written
**Executed by:** the owner, not an agent.

Provision Vercel, Neon, Vercel Blob, Clerk and an Auth0 Management application. Capture a production database dump and the API contract fixtures while Heroku is still live. Staging domain is `next.cinemadraft.com`; the apex stays on Heroku until phase 13.

**Gate:** `vercel env ls` lists every required key (Sensitive values cannot be pulled back — verify by presence); `.local/prod-dump.dump` and `fixtures/` exist locally.

**Why it blocks:** the contract fixtures and the database dump come from a Heroku app that gets retired in phase 13. They are unrecoverable if skipped.

---

### Phase 1 — Scaffold

Next 16 + TS strict + MUI v7 + ESLint/Prettier + Vitest + Playwright + CI. Directory skeleton per §5. Deploys to a Vercel preview.

- T1: `create-next-app` with TS, App Router; pin Node 24 in `package.json` `engines` and `.nvmrc`, matching the Vercel project setting
- T2: MUI (latest) + `@mui/material-nextjs` + emotion; App Router cache provider wired in `app/layout.tsx`
- T3: **Biome** (replaces ESLint + Prettier) with the `next`, `react` and `tailwind` rule domains; `npm run lint` green
- T4: Vitest config + one passing smoke test
- T5: Playwright config + one passing smoke test against `next dev`
- T6: GitHub Actions CI running lint, typecheck, unit, build
- T7: Directory skeleton from §5 with a placeholder in each folder
- T8: `docker-compose.local.yml` — Postgres container matching Neon's major version; `npm run db:up` / `db:down` scripts
- T9: First Vercel preview deploy succeeds

**Gate:** `npm run lint && npm run typecheck && npm run test && npm run build && npm run test:e2e` all green locally and in CI; `npm run db:up` brings up a reachable local Postgres container; preview URL loads.

---

### Phase 2 — Data layer

**Plan:** `docs/superpowers/plans/2026-08-14-phase-2-data-layer.md` ✅ written

Restore production data, normalize identifiers, introspect, then build repositories against the captured fixtures.

- T1: Restore into Neon **exactly as dumped** — `--no-owner --no-privileges` (the dump's owner role does not exist in Neon), over `DATABASE_URL_UNPOOLED` (`pg_restore` does not work through a pooler), using the **libpq 18.4** binary (the system `pg_restore` is 15 and cannot read a 17.9 dump)
- T2: Verify row counts against `.local/dump-row-counts.tsv` — counts derived **from the dump itself**, not from live production, which keeps taking writes
- T3: `prisma/normalize.sql`, **generated** by `scripts/generate-normalize-sql.mjs` (D27): plural snake_case tables, columns, enums, indexes, constraints and sequences; drops `users.password`, `users.salt` and `SequelizeMeta`. Committed and re-runnable — cutover re-dumps from Heroku's original schema and must apply the identical transformation
- T4: Apply it, then **verify row counts again**. Renames are catalog-only, so any difference is a bug
- T11: Load the normalized data into the **local Docker** database — what repository contract tests run against, never Neon. Done early, as the rehearsal for the Neon apply
- T5: Install Prisma 7; hand-write `prisma.config.ts` and the schema header (**no `prisma init`** — it writes agent-skill directories into the repo root, D31); `prisma db pull` against Docker
- T6: `scripts/pascalize-schema.mjs` — PascalCase singular models and camelCase fields over snake_case, via `@@map`/`@map`. Proven lossless by an empty `prisma migrate diff`
- T7: Baseline `0_init`, resolved as applied on both Docker and Neon
- T8: `lib/db.ts` — Prisma client singleton with `@prisma/adapter-neon`
- T9: Migration adding `movies.accent_hex`, `users.clerk_id` (unique, nullable) and `available_years.is_active`, with the partial unique index `available_years_one_active` enforcing at most one active year (D22)
- T10: Typed error classes (`NotFoundError`, `ForbiddenError`, `ConflictError`)
- T12–T27: One repository per live table, each TDD'd against its captured fixture, in dependency order: movies, users, events, awards, nominations, winners, points, leagues, drafts, draft_picks, lists, watchlists, notifications, profile_feeds, available_years, reviews (**16 total**)

> **Do not create repositories for `session` or `moviesstats`.** Both are dead Sequelize models, confirmed absent from the production dump.
>
> **`reviews` has 0 rows in production.** Build it last, and let Phase 7 decide whether it ships at all.

**Never** run `prisma db pull --force` (it discards the `@@map` attributes the naming strategy depends on) or `prisma migrate dev`/`reset` against Neon (it holds the only restored copy of production data).

**Gate:** row counts identical before and after normalization; `migrate diff` between schema and database empty; every repository contract test passing; Prisma imported only in `lib/db.ts` and `lib/repositories/`.

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
- T2: `lib/auth.ts` — `getCurrentUser`, `requireUser`, `requireAdmin`; resolves Clerk session → `User` via `clerkId`
- T3: `/api/webhooks/clerk` — signature verification (reject unsigned requests)
- T4: **Claim logic** — on `user.created` / `user.updated`, for each **verified** email match `lower(email)` against `User`; on match set `clerkId`, otherwise create a row (D25)
- T5: **Claim safety test suite** — (a) an unverified email must never claim an existing row; (b) a second Clerk identity must never overwrite a `clerkId` already set on a matched row. These are the security-critical tests in the project
- T6: Sign-in / sign-up pages styled with phase 3 tokens, with copy telling returning users to sign up with their original email
- T7: E2E: claim a real production account and confirm its leagues are intact
- T8: Admin relink path — for a user whose Clerk email differs from their historical one, and for resolving logged claim collisions

**Gate:** a real production account is claimed via a verified email and resolves with leagues intact; an unverified email provably cannot claim.

> **No bulk import, no Auth0 Management API, no password handling** (D25). All 51 Auth0 users are email+password and Auth0 does not export hashes without a support request.

---

### Phase 5 — Dashboard 🔴 priority trio

Replaces the welcome-card home with state: standings position, next deadline, recent movement.

- T0: `lib/services/season.ts` — `getActiveYear()`, cached and tagged `active-year`; replaces `NEXT_PUBLIC_ACTIVE_YEAR` (D22)
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
- T3: Vercel Runtime Cache for TMDB responses, keyed on query + year, tagged for invalidation
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

Driven entirely by `docs/PARITY.md` from phase 7. Tasks appended to this index at that point. Expected surfaces: films (browse + watchlist + list, consolidated per §6.9), leagues, live event on polling, reviews, users, admin (**including the `setActiveYear` Server Action and its control — D22**), notifications, and the **ical calendar feed** (`/api/ical/[...]` — one of the three permitted `/api` routes under D8).

**Gate:** every row in `PARITY.md` closed; E2E green per feature.

---

### Phase 11 — Media

- T1: Vercel Blob client wrapper; uploads use `access: 'public'` (D24); auth is OIDC, not a read-write token
- T2: Upload path switched from the Cloudinary widget to Blob
- T3: **Replace Cloudinary's on-the-fly resizing with `next/image`** — Blob does not transform images, and `useUserImage` currently requests a 128×128 fill from Cloudinary
- T4: Migration for existing assets. **Default to a deployed one-shot route**, not a local script — OIDC is environment-scoped and the Blob store is connected to Production/Preview only, so a local dev identity is unauthorized. Handles **both** stored forms — full URLs and bare Cloudinary public IDs (`useUserImage` branches on `startsWith('http')`)
- T5: Rewrite stored values to Blob URLs
- T6: `next/image` `remotePatterns` configured for the Blob hostname

**Gate:** images render from Blob; no Cloudinary request remains in the network log.

---

### Phase 12 — Parallel run

- T1: Deploy to `next.cinemadraft.com` against a copy of production data
- T2: Manual verification pass, feature by feature, against `PARITY.md`
- T3: Measure Neon free-tier headroom and Runtime Cache hit rate under realistic load
- T4: Load-test draft-day search
- T5: Fix everything found

**Gate:** full manual pass with zero blocking defects; free-tier headroom confirmed sufficient.

---

### Phase 13 — Cutover

- T1: Swap Clerk to its Production instance — create it for `cinemadraft.com`, add DNS records, set `pk_live_`/`sk_live_` in Vercel Production, recreate the webhook and its signing secret (all per-instance)
- T2: Final `pg_dump` from Heroku → Neon
- T2: Add `cinemadraft.com` to the Vercel project and point its DNS at Vercel; add or repoint the Clerk webhook to the apex
- T3: Verify production sign-in, draft, and scoring
- T4: Monitor for 48 hours
- T5: Retire Heroku

**Gate:** site live on Vercel; Heroku scaled to zero.

---

### Phase 14 — Realtime

Replaces the polling fallback (D13).

- T0: **Choose the realtime transport** (D23 deferred this) — evaluate Upstash direct, Pusher, Ably, and Postgres `LISTEN`/`NOTIFY`, then record the decision
- T1: Publisher wired into the winner-marking Server Action
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

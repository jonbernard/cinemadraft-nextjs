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
- T5: MUI theme assembly from tokens (MUI 9 per D28); `ThemeProvider` with dark default and a light toggle, switched by `data-mui-color-scheme` so Tailwind's `dark:` variant and MUI share one signal
- T6: Poster accent luminance clamping (`theme/oklch.ts` — a pure theme function, not an external-service client) + unit test proving clamped output always clears 4.5:1
- T7: Letterbox rule component (the signature device, §6.1)
- T8: Poster frame component — 2:3, caption below, two-line clamp, seal and nominated states

**Gate:** design tests green; the gallery renders every token in both themes, and no raw hex exists outside the token system. ✅ **Met, then re-satisfied by Phase 3.5** — **Storybook is the gallery** (`.storybook/Styleguide.mdx`, which reads the live custom properties so it cannot drift) and **`scripts/layering.sh` is what enforces the hex rule**, over `components/`, `app/`, `.storybook/` and `*.stories.tsx`, with `app/global-error.tsx` the one exemption (D37, D76). The `/tokens` page that originally met this gate is deleted.

🔴 **Revised by Phase 3.5** (2026-08-17). T1–T8 stay ticked — they were met as written — but their *content* was superseded: the palette, the type treatment, the shape language and the letterbox device were all revised. **T7's `LetterboxRule` no longer exists** (D74; `SectionHead` replaced it) and **T4's Archivo `wdth` axis is retired** (D71). Read T1–T8 as history, not as a description of the code. See D67–D77.

---

### Phase 3.5 — Design system refinement + Storybook

Spec: [`docs/superpowers/specs/2026-08-17-design-system-and-storybook-design.md`](superpowers/specs/2026-08-17-design-system-and-storybook-design.md)

Requested by the owner mid-Phase-10: the app read "too techy/nerdy". Five faults were measured in the running app; the three the owner named were two of them. Ten reference products were measured live before anything was proposed. Decisions D67–D77.

Sequenced in six sub-phases, each ending green:

- T1: Storybook 10 + `@storybook/nextjs-vite` stands up — PostCSS object-form fix, font decorator, MUI `setMode` wiring, `addon-a11y`
- T2: Foundations — both palettes (every pair re-verified), type scale, radius, elevation, motion; `contrast.test.ts` and `tokens.test.ts` extended; `Styleguide.mdx` foundations
- T3: Primitives — `SectionHead`, `Eyebrow`, `Shelf`, `Button`, `StatusChip`, `Panel`, `CinemaFrame`, with stories and every state
- T4: `AppShell`, `NavRail`, `TabBar`, `MoreSheet`; `AppNav` deleted; `e2e/nav.spec.ts` rewritten (D75)
- T5: The page sweep — 20 surfaces, enumerated in the spec's §8
- T6: Docs reconciled; `/tokens` deleted — done
- T6b: Second Vercel project for Storybook — 🔴 **still outstanding**, blocked on the owner

🔴 **Blocked on the owner for deployment only** — the Vercel Git integration is disconnected (`sourceless`, zero webhooks), so no project builds until it is reconnected. T1–T5 proceed locally regardless.

**Gate:** `npm run verify` and E2E green; every page renders in both themes; Storybook builds and every primitive story is a11y-clean. ⚠️ **Partially met.** `npm run verify` and `npm run build-storybook` are green and every surface was swept, but two clauses were dropped by owner direction mid-run ("you're doing too much reviewing of your work, and don't focus too much on e2e testing"): the consolidated a11y pass over every story, and the per-task browser checks at 1440px/390px. Both remain worth one pass before cutover — `addon-a11y` is configured `test: 'error'` but no Storybook test-runner is installed, so `build-storybook` runs no axe checks at all.

---

### Phase 4 — Auth 🔴 priority trio

- T1: `@clerk/nextjs` installed; middleware protecting the `(app)` segment
- T2: `lib/auth.ts` — `getCurrentUser`, `requireUser`, `requireAdmin`; resolves Clerk session → `User` via `clerkId`, and **syncs lazily when the webhook has not landed** — both paths share one `syncClerkIdentity` so the safety rules cannot diverge
- T3: `/api/webhooks/clerk` — signature verification (reject unsigned requests)
- T4: **Claim logic** — on `user.created` / `user.updated`, for each **verified** email match `lower(email)` against `User`; on match set `clerkId`, otherwise create a row (D25)
- T5: **Claim safety test suite** — (a) an unverified email must never claim an existing row; (b) a second Clerk identity must never overwrite a `clerkId` already set on a matched row. These are the security-critical tests in the project
- T6: Sign-in / sign-up pages styled with phase 3 tokens, with copy telling returning users to sign up with their original email
- T7: E2E: claim a real production account and confirm its leagues are intact
- T8: Admin relink path — for a user whose Clerk email differs from their historical one, and for resolving logged claim collisions

**Gate:** a real production account is claimed via a verified email and resolves with leagues intact; an unverified email provably cannot claim. ✅ **Met** — `lib/services/clerk-identity.production.test.ts` claims a genuine restored row (10 drafts, 67 picks) and asserts every count unchanged, that an unverified address cannot claim it, and that a second identity cannot take it afterwards; `e2e/auth.spec.ts` proves the browser flow.

> **No bulk import, no Auth0 Management API, no password handling** (D25). All 51 Auth0 users are email+password and Auth0 does not export hashes without a support request.

---

### Phase 5 — Dashboard 🔴 priority trio

Replaces the welcome-card home with state: standings position, next deadline, recent movement.

- T0: `lib/services/season.ts` — `getActiveYear()`, cached and tagged `active-year`; replaces `NEXT_PUBLIC_ACTIVE_YEAR` (D22)
- T1: `lib/services/dashboard.ts` composing existing repositories
- T1a: `lib/services/scoring.ts` — **the pure rule ships here**, because standings cannot exist without it. Phase 9 keeps its scope: materialized results and bounded recompute, calling this same function (D41)
- T2: Dashboard RSC page
- T3: Season rail component (§6.7) — shows, dates, completed/next, countdown
- T4: Roster strip component (§6.7) — **however many frames the seat drafted (D34; the original "8 frames" is superseded)**, numbered by draft round, caption below, contribution bar, seal states; wraps 8→4→2 rather than compressing
- T5: League standings panel with tabular figures
- T6: Empty states (no league, no draft yet)
- T7: E2E: dashboard renders for a user with a league

**Gate:** E2E green; no truncated titles at any breakpoint. ✅ **Met** — `e2e/dashboard.spec.ts` asserts the longest title on a real member's roster is complete in the DOM and unclipped at 375, 768 and 1440. It failed at 1440 on the first run, which is what forced the roster grid onto a minimum-frame-width rule instead of a fixed 8 columns.

---

### Phase 6 — Draft 🔴 priority trio

> 🔴 **The owner enters every pick, by design (D46).** The draft runs on a video call: the owner keeps the selection on the right player, they say their pick, the owner searches and assigns it. So the UI optimises for *that* — whose turn it is, fast search, fewest actions per pick — not for a clock. There is no timer and no on-the-clock cell, and none is missing.

- T1: `lib/services/draft.ts` — league-year → groups → seats → picks; **`lib/services/league-access.ts` fixes the ownership check** (D47)
- T2: Draft board component — seats down, rounds across, poster thumbnails in filled cells (§6.7), padded to the longest seat in the group (D34)
- T3: Draft pick Server Action + Zod schema; `revalidatePath(path, 'layout')` rather than `revalidateTag` — tags require `cacheComponents`, which is deferred (D42), and the console is a child route of the board so both must refresh together
- T4: Pick reordering with `@hello-pangea/dnd`
- T5: Draft list / queue surface
- T6: E2E: make a pick as the owner, verify it lands in the right seat and round; reorder and verify it persists; confirm a non-owner has no controls

**Gate:** E2E green; a taken film is unmistakable at a glance from artwork alone. ✅ **Met** — 17 E2E green, including the owner drafting onto the seat that is picking, a taken film refused, a pointer drag that survives a reload, and a signed-out stranger who sees the board and gets a 404 from the console.

Delivered as T1 ownership, T2 service, T3 board, T4 actions, T5a console, T5 reordering, T6 public league page, T7 E2E — the console (T5a) was added once the owner confirmed the video-call workflow (D46), and "draft list / queue" turned out to be that console rather than a separate surface.

---

### Phase 7 — Parity audit 🔴 gates cutover

Not a formality. After the priority trio the app is visibly incomplete and the gap must be measured, not estimated.

- T1: Enumerate all 18 source route files and their endpoints
- T2: Enumerate all 17 source controllers and their exported functions
- T3: Enumerate every source page under `src/pages/`
- T4: Classify each as **ported** / **deficient** / **intentionally dropped**, with a one-line note on each dropped item
- T5: Write `docs/PARITY.md`
- T6: Decompose every deficient row into phase 10 tasks appended to this index

**Gate:** matrix complete and reviewed by the owner. **Cutover is blocked while any row is open.** ✅ **Met** — matrix complete and approved by the owner 2026-08-15, to be revisited later in the process. **Matrix complete** — 83 capabilities, 18 ported, 50 deficient, 15 dropped, plus 10 source bugs deliberately not ported and 8 shape traps. **Awaiting owner review**, which is the gate itself.

---

### Phase 8 — Award shows + search

The award show page is the input to the entire scoring pipeline; errors here propagate to every league (§12).

- T1: `lib/services/search.ts` — local-first `Movie` query with trigram/prefix index
- T2: TMDB always consulted, deduped on `tmdbId`, local row wins — 🔴 *not* a "fill-in" as originally written: gating the remote call on thin local results hides exactly the new releases search exists to find
- T3: Vercel Runtime Cache for TMDB responses, keyed on query + year, tagged for invalidation
- T4: Context-aware ranking — draft / browse / award-admin (§10)
- T5: Typeahead client component — 250 ms debounce, request cancellation, poster-first results
- T6: Award show page — categories, nominee grids
- T7: Admin: attach a nominee (uses award-admin search context)
- T8: Admin: mark a winner
- T9: Admin: **correct** a winner — the same action as marking one, because winners are entered live from a stage announcement and getting one wrong is ordinary (§12)
- T10: E2E: attach nominee, mark winner, correct winner

🔴 **T8 and T9 as originally written were wrong: there is no recompute.** Scoring is a pure function computed on read (D41) and nothing is materialized, so a correction is consistent by construction and there is nothing to reverse. The phase wrote the test that proves the points move anyway — **phase 9 inherits it as a constraint it must not break**, which is the whole value of writing it while it was still easy to pass.

**Gate:** all three search contexts return correct top results; a winner correction leaves no stale points. ✅ **Met** — 21 E2E green, 832 unit tests. Ranking is a pure function with its own suite; the correction test asserts points move from the old winner to the new one.

✅ **`TMDB_API_KEY` is configured** locally and in Vercel across all environments. 🔴 **TMDB is required.** `movies` is a cache of TMDB — a film enters it the first time somebody drafts or nominates it — so search always asks TMDB and both write paths ingest an uncached film (`lib/services/film-ingest.ts`, ported from the source's `saveFilm`). Without `TMDB_API_KEY` the app degrades to searching its own history and no new release can be drafted or nominated. *(Key supplied 2026-08-15.)*

---

### Phase 9 — Scoring pipeline

Replaces per-request Ramda recomputation in a route file with a tested rule (§11).

Plan: [`docs/superpowers/plans/2026-08-16-phase-9-scoring.md`](superpowers/plans/2026-08-16-phase-9-scoring.md)

🔴 **T2–T6 are cancelled (D59).** Measurement killed them: a full 16-seat league board costs **8 ms** including scoring, and all 1,355 films at once cost 16 ms. Three derived tables, a recompute trigger on every write, a reconciliation job and a nightly cron would buy ~8 ms and introduce drift — a second copy of the truth that can silently disagree with it. Scoring stays the pure function it already is, computed on read.

- T1: `lib/services/scoring.ts` — pure function, no DB. ✅ **Done in Phase 5** (D41), including the `awards.points` foreign-key trap
- ~~T2–T6: materialized tables, bounded recompute, reconciliation, cron~~ — **cancelled, D59**
- T1′: 🔴 Verify scoring against **all four** captured points fixtures — a whole season, a whole league, and the per-event breakdown. Only `points-by-draft` was checked before
- T2′: `ledgerForMovies` — per-award line items from the same inputs as the totals
- T3′: Points ledger UI — movie total by default, per-award lines on demand (§6.7)
- T4′: Wire it into the league board, batched
- T5′: E2E and close-out

**Gate:** ✅ **Met.** Scoring unit tests green; **zero drift against the captured production fixtures** — a whole season (123 films), a whole league (12 team totals) and a per-event breakdown (11 shows, 335 points) all reproduce the source API exactly. **Zero drift against the captured production fixtures** — which is the honest reading of the original gate, since the drift that matters is between the port and the app people have used for ten years, not between two copies of our own data.

---

### Phase 10 — Remaining features to parity

Driven entirely by [`docs/PARITY.md`](PARITY.md). **P10.T1–T50**, listed in `docs/PROGRESS.md`.

The audit confirmed the surfaces guessed here — films (browse + watchlist + list, consolidated per §6.9), leagues, live event, reviews, users, admin (**including the `setActiveYear` control — D22**), notifications and the **ical feed** (`/api/ical/[...]`, one of the three `/api` routes D8 permits) — and added ones this line did not name: **joining a league by invite link**, **creating a league**, **setting up groups before a draft**, **seating a placeholder player**, starting and completing a draft, the **rules and scoring page**, and an **error boundary**, which the port has no equivalent of at all.

🔴 **The shape of the work is not what this line assumed.** 26 of the 50 open rows already have their repository and need only a page; 22 need a repository written first, and those are almost all *writes* — the port's data layer is nearly complete for reads and nearly empty for writes.

**The four surfaces Phase 3.5 leaves to build**, and what each is built from. Flipping a link's `ready` flag in
`lib/nav/links.ts` is the **last step** of the task that builds it — `NavRail`, `TabBar` and `MoreSheet` all read that
flag, so nothing else has to change, and until it flips the nav cannot link to a 404.

| Page | Owed by | Built from |
|---|---|---|
| `/watchlist` | P10.T33–T37 | `Shelf`, `SectionHead`, `EmptyState` |
| `/list` (draft list) | P10.T20 | `Shelf`, `StatusChip`, drag-and-drop as already specced |
| `/rules-and-scoring` | P10.T46 | `Panel`, `SectionHead`, `font-prose` |
| `/live/[abbr]` | P10.T31 — phase 14 (D23) | `CinemaFrame`, carmine `StatusChip`, `Shelf` |

**Gate:** every row in `PARITY.md` closed; E2E green per feature.

🔴 **Also gated, from Phase 3.5:** every new surface is built from the Phase 3.5 primitives — `SectionHead`, `Panel`, `Shelf`, `Button`, `StatusChip`, `Eyebrow`, `CinemaFrame`, `PosterFrame` — and carries a Storybook story. No new component may introduce a hairline card border, an all-caps heading outside `Eyebrow`, a squared or pill button, or a machine-formatted date. `LetterboxRule`, `font-display`, the Archivo `wdth` axis and the `/tokens` page no longer exist (D69–D77); do not reach for any of them.

---

### Phase 11 — Media

- T1: Vercel Blob client wrapper; uploads use `access: 'public'` (D24); auth is OIDC, not a read-write token
- T2: Upload path switched from the Cloudinary widget to Blob
- T3: **Replace Cloudinary's on-the-fly resizing with `next/image`** — Blob does not transform images, and `useUserImage` currently requests a 128×128 fill from Cloudinary
- T4: Migration for existing assets. **Default to a deployed one-shot route**, not a local script — OIDC is environment-scoped and the Blob store is connected to Production/Preview only, so a local dev identity is unauthorized. Handles **both** stored forms — full URLs and bare Cloudinary public IDs (`useUserImage` branches on `startsWith('http')`)
- T5: Rewrite stored values to Blob URLs
- T6: `next/image` `remotePatterns` configured for the Blob hostname

**Gate:** images render from Blob; no Cloudinary request remains in the network log.

🔴 **Also gated, from Phase 3.5:** every new surface is built from the Phase 3.5 primitives — `SectionHead`, `Panel`, `Shelf`, `Button`, `StatusChip`, `Eyebrow`, `CinemaFrame`, `PosterFrame` — and carries a Storybook story. No new component may introduce a hairline card border, an all-caps heading outside `Eyebrow`, a squared or pill button, or a machine-formatted date. `LetterboxRule`, `font-display`, the Archivo `wdth` axis and the `/tokens` page no longer exist (D69–D77); do not reach for any of them.

---

### Phase 12 — Parallel run

- T1: Deploy to `next.cinemadraft.com` against a copy of production data
- T2: Manual verification pass, feature by feature, against `PARITY.md`
- T3: Measure Neon free-tier headroom and Runtime Cache hit rate under realistic load
- T4: Load-test draft-day search
- T5: Fix everything found

**Gate:** full manual pass with zero blocking defects; free-tier headroom confirmed sufficient.

🔴 **Also gated, from Phase 3.5:** every new surface is built from the Phase 3.5 primitives — `SectionHead`, `Panel`, `Shelf`, `Button`, `StatusChip`, `Eyebrow`, `CinemaFrame`, `PosterFrame` — and carries a Storybook story. No new component may introduce a hairline card border, an all-caps heading outside `Eyebrow`, a squared or pill button, or a machine-formatted date. `LetterboxRule`, `font-display`, the Archivo `wdth` axis and the `/tokens` page no longer exist (D69–D77); do not reach for any of them.

---

### Phase 13 — Cutover

- T1: Swap Clerk to its Production instance — create it for `cinemadraft.com`, add DNS records, set `pk_live_`/`sk_live_` in Vercel Production, recreate the webhook and its signing secret (all per-instance)
- T2: Final `pg_dump` from Heroku → Neon
- T2: Add `cinemadraft.com` to the Vercel project and point its DNS at Vercel; add or repoint the Clerk webhook to the apex
- T3: Verify production sign-in, draft, and scoring
- T4: Monitor for 48 hours
- T5: Retire Heroku

**Gate:** site live on Vercel; Heroku scaled to zero.

🔴 **Also gated, from Phase 3.5:** every new surface is built from the Phase 3.5 primitives — `SectionHead`, `Panel`, `Shelf`, `Button`, `StatusChip`, `Eyebrow`, `CinemaFrame`, `PosterFrame` — and carries a Storybook story. No new component may introduce a hairline card border, an all-caps heading outside `Eyebrow`, a squared or pill button, or a machine-formatted date. `LetterboxRule`, `font-display`, the Archivo `wdth` axis and the `/tokens` page no longer exist (D69–D77); do not reach for any of them.

---

### Phase 14 — Realtime


> **Also covers the draft board (D48).** The owner enters picks live on a call while the league watches, so the board needs the same transport as the live award show — one mechanism, both surfaces. The components already take plain props, so this is a change of supplier, not a rewrite.

Replaces the polling fallback (D13).

- T0: **Choose the realtime transport** (D23 deferred this) — evaluate Upstash direct, Pusher, Ably, and Postgres `LISTEN`/`NOTIFY`, then record the decision
- T1: Publisher wired into the winner-marking Server Action
- T2: `/api/live/[event]/stream` SSE route
- T3: Client subscription replacing the polling hook
- T4: Winner-seal stamp animation — the one orchestrated motion moment (§6.8)
- T5: Reconnection handling
- T6: E2E: two clients, admin marks winner, viewer receives it

**Gate:** live event works end to end with two concurrent clients.

🔴 **Also gated, from Phase 3.5:** every new surface is built from the Phase 3.5 primitives — `SectionHead`, `Panel`, `Shelf`, `Button`, `StatusChip`, `Eyebrow`, `CinemaFrame`, `PosterFrame` — and carries a Storybook story. No new component may introduce a hairline card border, an all-caps heading outside `Eyebrow`, a squared or pill button, or a machine-formatted date. `LetterboxRule`, `font-display`, the Archivo `wdth` axis and the `/tokens` page no longer exist (D69–D77); do not reach for any of them.

---

### Phase 15 — New features


> **Possible future enhancement, not planned work:** a self-service timed draft (clock, on-the-clock cell, per-turn deadline). The owner confirmed that entering picks during a video call is the intended workflow (D46), so this would be a change in how the product works, not a gap to close. Only build it if the owner asks.

Per §7, all post-cutover.

- Season timeline rail (already built in phase 5 — extend to a full-season view)
- Points ledger (already built in phase 9 — extend)
- Head-to-head roster comparison, with shared vs unique picks called out
- Public logged-out league board replacing the welcome card

**Gate:** per-feature E2E green.

🔴 **Also gated, from Phase 3.5:** every new surface is built from the Phase 3.5 primitives — `SectionHead`, `Panel`, `Shelf`, `Button`, `StatusChip`, `Eyebrow`, `CinemaFrame`, `PosterFrame` — and carries a Storybook story. No new component may introduce a hairline card border, an all-caps heading outside `Eyebrow`, a squared or pill button, or a machine-formatted date. `LetterboxRule`, `font-display`, the Archivo `wdth` axis and the `/tokens` page no longer exist (D69–D77); do not reach for any of them.

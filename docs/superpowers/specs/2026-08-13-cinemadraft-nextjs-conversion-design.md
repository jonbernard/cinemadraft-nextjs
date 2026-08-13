# Cinemadraft — Next.js / Vercel Conversion

**Date:** 2026-08-13
**Status:** Approved design, pending implementation plan
**Source app:** `/Users/jonbernard/Development/cinemadraft` (read-only reference — never modified)
**Target app:** `/Users/jonbernard/Development/cinemadraft-nextjs`

---

## 1. Goal

Replace the production Cinemadraft app — a Create React App SPA with an Express/Sequelize API on Heroku — with a Next.js application on Vercel using only free-tier services, backed by Prisma. The replacement ships a new visual identity rather than a port of the current MUI Minimal template look. `cinemadraft.com` cuts over to Vercel; Heroku is retired.

Cinemadraft is a fantasy movie award league. Members draft a team of up to 8 films before awards season. As nominations and wins are announced across the season's award shows, each film accrues points; a film's points sum to a team total, and teams are ranked within a league.

## 2. Current system

- ~25,000 lines of JavaScript
- CRA 4 + MUI v5 (unmodified Minimal template), react-router v6, SWR, Auth0 SPA SDK
- Express API: 18 route files → 17 controllers → 18 Sequelize model files, 18 migrations
- **16 live database tables.** Two model files are dead and must not be ported: `session` (no migration ever created it) and `moviesstats` (its migration is fully commented out). Verified against production 2026-08-13: Heroku reports 17 tables, which is 16 app tables plus `SequelizeMeta`
- Production database is small — 11.9 MB on Postgres 17.9
- socket.io for live award-show broadcast (`sendSelectedAward`, `sendNewWinner`)
- In-process `memory-cache` for TMDB image configuration
- External services: TMDB, OMDB, Cloudinary, Auth0
- Node 14.16, deployed to Heroku with Heroku Postgres

Two features are structurally incompatible with Vercel's serverless model and must be redesigned, not ported: the socket.io server (cannot hold WebSocket connections) and the in-process cache (no shared process memory between invocations).

## 3. Locked decisions

Each was decided explicitly during design. A future session must not re-litigate these without the owner's input.

| # | Decision | Rationale |
|---|---|---|
| D1 | **Next.js 16 App Router**, React 19 | Target platform |
| D2 | **Full TypeScript conversion** | Prisma's generated types are most of its value over Sequelize |
| D3 | **MUI v7** as component substrate; visual identity delivered through the theme layer | Avoids rebuilding 25k LOC while still replacing the look entirely |
| D4 | **Prisma 6** + `@prisma/adapter-neon` | Chosen ORM |
| D5 | **Neon Postgres** via Vercel Marketplace (free) | Vercel's default Postgres partner. Supabase explicitly rejected |
| D6 | ~~Upstash Redis for caching and pub/sub~~ — **superseded by D23** | Upstash no longer offers a free tier through the Vercel Marketplace; the smallest plan is pay-as-you-go and requires a card |
| D23 | **Vercel Runtime Cache** for caching. Realtime transport **deferred to phase 14** | Runtime Cache is included with the platform — no card, no extra vendor — and Next.js 16 targets it natively via `'use cache: remote'`. Pub/sub is only needed post-cutover, so the choice is made when it is built, not months early |
| D7 | **Clerk** for auth, replacing Auth0 | Owner's choice, accepting user-migration risk |
| D8 | **Server Components + Server Actions**; no general `/api` layer | `/api` retained only where HTTP is required: Clerk webhook, SSE stream, ical feed |
| D9 | **Vercel Blob** replaces Cloudinary | One less vendor |
| D24 | Blob uploads are **public** | The only stored content is user avatars, already served unsigned by Cloudinary and displayed to other league members by design. Private would require signing a URL per avatar on pages that render dozens, defeating CDN caching and `next/image` |
| D10 | **Schema replicated exactly**, then introspected with `prisma db pull` | Guarantees data fidelity; cleanups become later migrations |
| D11 | **Parallel run, then DNS swap** | Safe rollback |
| D12 | Contract tests at the **repository layer** + Playwright E2E on critical flows | See §13 — the HTTP seam disappears under D8, so contracts move to the data layer |
| D13 | Realtime ships **after** cutover; live page uses polling until then | Feature is seasonal |
| D14 | New features (§7) ship **after** cutover | Keeps migration risk separate from feature risk |
| D15 | **Both light and dark themes** are first-class | Dark is default; light is a designed palette, not an inversion |
| D16 | **All prior committed work in `cinemadraft-nextjs` is ignored.** Start fresh | Owner's instruction. Existing git history is not a source of truth |
| D17 | Priority order for feature porting: **dashboard, draft, auth**, then the rest | Owner's choice |
| D22 | **The active season year is data, not config.** `AvailableYear.isActive`, settable from the running app | Today it is `NEXT_PUBLIC_ACTIVE_YEAR`, a build-time constant requiring a rebuild and redeploy every season |

### Rejected alternatives worth recording

- **Supabase** (DB and realtime) — explicitly rejected by the owner.
- **Gold-on-black palette** — the reflex answer for awards products; would make the site indistinguishable from any Oscars microsite.
- **Reusing the prior scaffold's `schema.prisma`** — considered valuable, but D16 overrides.
- **Keeping Auth0 as a Clerk OAuth connection** — zero migration risk, but retains the vendor being removed.

## 4. Target stack

| Concern | From | To |
|---|---|---|
| Framework | CRA 4 + Express | Next.js 16 App Router |
| Language | JavaScript | TypeScript (strict) |
| UI | MUI v5 | MUI v7 + `@mui/material-nextjs` |
| ORM | Sequelize 6 | Prisma 6 + Neon adapter |
| Database | Heroku Postgres | Neon |
| Auth | Auth0 SPA SDK | Clerk (`@clerk/nextjs`) |
| Data fetching | SWR (client) | Server Components |
| Mutations | REST via axios | Server Actions |
| Realtime | socket.io | SSE + a transport chosen in phase 14 |
| Cache | `memory-cache` | Vercel Runtime Cache |
| Media | Cloudinary | Vercel Blob |
| Forms | Formik + Yup | react-hook-form + Zod |
| Drag & drop | `react-beautiful-dnd` | `@hello-pangea/dnd` |
| Dates | moment | date-fns |
| Node | 14.16 | 24 (current LTS) |
| Tests | none | Vitest + Playwright |

Two swaps are forced rather than preferred: `react-beautiful-dnd` is unmaintained and breaks under React 19, and `@hello-pangea/dnd` is its maintained drop-in fork. Zod replaces Yup because Server Actions require server-side validation schemas regardless.

## 5. Architecture

```
app/
  (marketing)/              public pages — static / ISR
  (app)/                    authenticated shell — Clerk middleware
    page.tsx                dashboard (RSC)
    films/                  browse · watchlist · draft list (consolidated)
    award-shows/[abbr]/
    leagues/[id]/
      draft/                snake draft board
    live/[abbr]/
  api/
    webhooks/clerk/         user sync
    live/[event]/stream/    SSE (phase 14)
    ical/[...]/             calendar feed
lib/
  db.ts                     Prisma singleton + Neon adapter
  repositories/*.ts         ONLY layer importing Prisma; returns DTOs
  services/*.ts             business logic (points, draft rules, nominations)
  external/tmdb.ts          TMDB client, Runtime Cache-backed
  external/color.ts         poster accent extraction (§6.6)
  auth.ts                   getCurrentUser / requireUser / requireAdmin
actions/*.ts                Server Actions
components/                 ported MUI components ('use client')
theme/                      design tokens, light + dark (§6)
```

### Layer boundaries

`lib/repositories/` is the only code that imports Prisma. It returns plain DTOs, never Prisma model instances, so Prisma types never reach a component. `lib/services/` composes repositories and holds the logic currently in `server/controllers/` — `server/controllers/points.js` becomes `lib/services/points.ts`, and so on. Server Components and Server Actions call services.

This preserves the existing `routes → controllers → models` seams while removing the HTTP hop.

### Data flow

- **Read:** RSC page → service → repository → Prisma → Neon. No client fetching.
- **Write:** client component → Server Action → Zod validation → service → repository → `revalidateTag`.

### Error handling

Repositories throw typed errors (`NotFoundError`, `ForbiddenError`, `ConflictError`). Route segments catch via `error.tsx`. Server Actions never throw across the boundary — they return a discriminated union:

```ts
type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; field?: string }
```

## 6. Design system

### 6.1 Direction

**Screening Room.** The application's real content is film posters — vertical, saturated, professionally designed artwork. A light-first UI competes with them; a dark ground frames them. The interface is the dark room; the films supply the color.

The identity deliberately avoids gold-on-black, the default treatment for anything awards-related.

**Signature device: the letterbox.** Hairline rules above and below section headers, and a 2.39:1 frame used as a real layout unit on movie detail heroes. Cinema's own visual grammar, largely unused in this product category.

### 6.2 Palette — dark (default)

| Token | Hex | Use |
|---|---|---|
| `bg.base` | `#0B0D10` | Page ground |
| `bg.surface` | `#14171C` | Cards, panels |
| `bg.raised` | `#1D2127` | Inputs, hover, wells |
| `border.rule` | `#2A2F38` | Letterbox rules, dividers |
| `text.primary` | `#E8E6E1` | Body — warm off-white, reads as projected light |
| `text.secondary` | `#8A9099` | Secondary copy |
| `text.dim` | `#828993` | Small mono labels, eyebrows |
| `accent.fill` | `#A8323E` | Carmine — fills, seals, bars, on-clock outline |
| `accent.text` | `#DA707C` | Carmine for text and icons |
| `beam` | `#7FA6B8` | Informational / secondary state |

`accent.fill` is a **fill-only** token in dark mode. `#A8323E` on `#0B0D10` is 2.96:1 and fails as text — this is why `accent.text` exists as a separate token. White on `accent.fill` is 6.58:1 and is correct.

### 6.3 Palette — light

| Token | Hex | Use |
|---|---|---|
| `bg.base` | `#F5F3EF` | Page ground — warm paper |
| `bg.surface` | `#FFFFFF` | Cards |
| `bg.raised` | `#EDEAE3` | Inputs, hover |
| `border.rule` | `#DED9CF` | Dividers |
| `text.primary` | `#14171C` | Body |
| `text.secondary` | `#5F636C` | Secondary copy |
| `accent.fill` | `#8C2F39` | Carmine, darkened for paper |
| `accent.text` | `#8C2F39` | Same value passes as text on light |

Light is a warm paper palette, not inverted greys — inverting a cinema-dark theme produces the flat blue-white that every admin template already has. Two adjustments make it work: posters gain a hairline border and soft shadow so they stay contained without a dark room around them, and poster-derived accents darken per theme (§6.6). Both are token swaps; no component branches on theme.

### 6.4 Contrast

Every foreground/background pair above was computed and meets WCAG AA (≥4.5:1 for text, ≥3:1 for large text and non-text UI). Three failures were found and corrected during design:

| Original | Ratio | Replaced with | Ratio |
|---|---|---|---|
| `#A8323E` as dark-mode text | 2.96 | `#DA707C` (`accent.text`) | 6.11 |
| `#7C8089` as light secondary | 3.57 | `#5F636C` | 5.43 |
| `#6E757F` as dark mono label | 4.18 | `#828993` | 5.51 |

A unit test asserts every token pair in both themes meets its threshold. This test must exist before any component consumes the tokens.

### 6.5 Typography

| Role | Face | Setting |
|---|---|---|
| Display | **Archivo** (variable, width axis) | `wdth` 118–120, `wght` 700, uppercase, tight tracking — borrowed from the film credit block |
| Body | **Archivo** | `wght` 400/500 |
| Data | **IBM Plex Mono** | `wght` 500, `font-variant-numeric: tabular-nums` |

One family across two width axes plus a mono. All points, standings, dates and countdowns use tabular figures so columns never jitter. Loaded via `next/font` with `display: swap`.

### 6.6 Poster-derived accent color

Each film accents its own UI — contribution bar, ledger rule, hover state. Carmine remains the **system** color (actions, deadlines, live states); films supply the **content** color.

- At TMDB ingest, extract the poster's dominant color and store one hex on `Movie.accentHex`.
- At render, the theme derives a light and dark variant from that single value.
- **Derived accents must be luminance-clamped** so contrast always passes: convert to OKLCH, clamp lightness into the theme's safe band, cap chroma, and verify ≥4.5:1 against the theme background. This is deterministic and unit-tested — a poster color is never trusted raw.

Cost: one column plus one ingest step. Effect: every roster and league board looks different, because every member drafted different films.

### 6.7 Component specifications

**Roster strip** — the core object. Up to 8 films.

- Frames are 2:3, numbered `01`–`08` by **draft round**. Snake order is real information: round 1 cost more than round 8.
- Title sits **below** the frame — full width, two-line clamp. This fixes the current truncation ("One Ba…", "Is This …", "Wake …") caused by overlaying titles on artwork.
- Points render in tabular mono beneath the title.
- A thin bar shows that film's share of the team total, colored by its poster accent — hierarchy without resizing frames.
- **Films are never greyed out by score.** The strip is ordered by draft position, not performance; a last pick may be the best pick.
- Winner: a single carmine corner seal. Nominated and still live: a top hairline. One signal per fact — the current app uses both a size change and a green check for "winner", and green wrongly reads as validation state.
- Responsive: 8 across → 4×2 → 2 columns.

**Snake draft board**

- Serpentine grid: rounds down the side, owners across the top, direction reversing each round with the reversal marked under the round it applies to.
- Each filled cell carries a **poster thumbnail** plus title and points. Scan by image, confirm by text — reading twelve titles to learn whether a film is gone is too slow.
- The viewer's own picks carry a carmine outline; the cell on the clock carries a carmine outline and label.

**Season rail**

- Horizontal rail of the season's award shows with dates. Completed shows filled, next show carmine with a countdown.
- Built from data the app already has but currently buries inside a single event's detail card.

**Points ledger**

- Default surface shows the **movie total only** — the board stays scannable.
- One click deeper reveals per-award line items: award, category, nominated/won, value.
- Scoring model: `team total = Σ movie totals`, `movie total = Σ (nomination + win points) per award`.

### 6.8 Motion

One orchestrated moment: during a live event, the winner seal stamps onto the frame. That is the emotional payoff of the product and earns the only substantial animation. Everything else stays at 150–200 ms with ease-out on enter. `prefers-reduced-motion` is respected throughout.

### 6.9 Navigation

Consolidate from seven top-level items to four. Browse, Watchlist and Draft List are three views of one idea:

`Home · Films · Award Shows · Leagues`

Rules & Scoring becomes contextual help surfaced inside the ledger, not a nav peer.

### 6.10 Deferred

The logo mark is **not decided**. Three directions were explored (frame + pick seal, letterbox bars, sprocket strip) but rendered poorly and the decision was postponed. Until it is made, use the Archivo Expanded wordmark alone. The current pinwheel mark ships with the MUI Minimal template, is not owned by this project, and must not carry over.

## 7. New features

Approved, all scheduled **after** cutover.

1. **Season timeline rail** (§6.7) — highest value, uses existing data.
2. **Points ledger** (§6.7) — totals by default, breakdown on click.
3. **Head-to-head roster comparison** — compare two teams with shared vs unique picks called out. Shared picks cancel out; unique picks decide leagues. Most new query work of the four.
4. **Public logged-out league board** — replace the welcome card with a live league board as proof of the product.

## 8. Data and schema

1. `pg_dump` from Heroku Postgres.
2. Restore into Neon.
3. `prisma db pull` to generate `schema.prisma` from the real schema.
4. Baseline it: `prisma migrate diff` → `prisma migrate resolve --applied` so Prisma owns migrations going forward.
5. Drop Sequelize's `SequelizeMeta` table after baselining.
6. Add `Movie.accentHex`, `User.clerkId`, and `AvailableYear.isActive` as the first Prisma-owned migrations.

### The active season year (D22)

Today the active year is `NEXT_PUBLIC_ACTIVE_YEAR`, a build-time environment variable read in roughly ten client files. Changing seasons means editing an env var and redeploying — an annual annoyance with no upside.

The `available_years` table already exists and already stores every year. It simply has no concept of which one is current.

**Migration.** Add `is_active boolean not null default false`, plus a partial unique index so the database itself guarantees at most one active year:

```sql
CREATE UNIQUE INDEX available_years_one_active
  ON available_years (is_active) WHERE is_active;
```

No application path can produce two active years. Correctness lives in the schema rather than in a convention someone has to remember.

**Read path.** `lib/services/season.ts` exposes `getActiveYear(): Promise<number>`, cached and tagged `active-year`. Server Components resolve it and pass it down as props — under D8 there is no client-side env var to replace.

**Write path.** An admin-only Server Action `setActiveYear(year)` clears the current flag, sets the new one in the same transaction, and calls `revalidateTag('active-year')`. Changing seasons becomes a click in the running app.

`NEXT_PUBLIC_ACTIVE_YEAR` is deleted from Vercel once the read path ships.

**Rejected:** Vercel Edge Config. It is the right tool for flags needed at middleware latency; the active year is domain data belonging beside the years table, and using Edge Config would split configuration across two systems.

The 18 Sequelize migrations stay in the source repo as history and are not ported.

## 9. Auth migration

The highest-risk item in the project.

1. Prisma migration adds `User.clerkId` (unique, nullable). `auth0Id` is retained permanently.
2. A one-off script reads Auth0 users via the Management API and creates them in Clerk via the Backend API, setting `external_id` to the Auth0 `sub` and preserving email.
3. Backfill `User.clerkId`, matched on email.
4. A Clerk `user.created` webhook upserts on email, so any user missed by the import self-heals on first sign-in rather than creating a duplicate.
5. `getCurrentUser()` resolves the Clerk session to a `User` row via `clerkId`, falling back to email.

**Watch item:** social and passwordless Auth0 users require the matching Clerk connection to be enabled *before* import. Without it, their sign-in silently creates a second identity.

## 10. Movie search

Search is load-bearing in three different places and today is a thin proxy that serves none of them well. `server/routes/search.js` forwards the query straight to TMDB `/search/movie` and returns the raw page. It does not consult the local `Movie` table, does not dedupe against films already ingested, has no ranking beyond TMDB's default, and applies no awards-season relevance.

The three jobs are genuinely different and the design must serve each:

| Context | What the user is doing | What must rank first |
|---|---|---|
| **Draft** | Finding a film eligible for this award year | Eligible-year films already known to the system, excluding films already drafted in this league |
| **Browse / watchlist** | Finding any film | General relevance; already-tracked films marked as such |
| **Award show admin** | Attaching a nominee to a category | Films already ingested; exact-title matches; year-scoped |

### Design

A single `lib/services/search.ts` with a source-merging strategy:

1. **Local first.** Query the `Movie` table (trigram or `ILIKE` prefix index on title, scoped by year where the context supplies one). These rows are the valuable ones — already ingested, already carrying `accentHex`, already scoreable.
2. **TMDB fill.** Call TMDB only when local results are thin, and merge.
3. **Dedupe on `tmdbId`**, local row winning — a film must never appear twice.
4. **Rank** with an eligibility-year boost, exact-title-match boost, and a penalty for films already drafted in the caller's league when the context is a draft.
5. **Cache** TMDB responses in the Vercel Runtime Cache, keyed by query plus year and tagged for invalidation. TMDB's rate limit is the constraint, and identical queries during a live draft are common.

Client-side: debounced input (250 ms), request cancellation on keystroke, and results that render the poster — this audience recognizes films by artwork faster than by title.

Search results are read-only, so this is a Server Component data path with a Server Action for the interactive typeahead, not a route handler.

## 11. Scoring pipeline

### How it works today

`server/routes/points.js` recomputes everything on every request. For a league board it loads all nominations for all the league's movies and reduces them in JavaScript through Ramda pipelines defined in the route file. Nothing is stored. The rule, from `sumPoints`:

```js
const points = path(['award', 'pointsData', 'points'], nom);
return points + (nom.movieId === nom.award.winner.movieId ? points : 0);
```

A nomination earns the award's point value. A win earns it a second time. So **nomination = P, win = 2P total.**

This is correct but fragile: the rule lives in a route file rather than a testable unit, cost scales with league size on every page view, and there is no way to answer "why is this number what it is" — which the points ledger (§6.7) now requires.

### Target design

**The rule becomes a pure function.** `lib/services/scoring.ts` exports a function from nomination and winner records to points, with no database access. It is unit-tested against the current behavior, including the nomination-plus-win doubling. This function is the single definition of scoring in the system.

**Results are materialized.** Three derived tables, each with a `computedAt`:

- `MovieScore` — `(movieId, year) → points`
- `TeamScore` — `(draftId) → points`, the sum of its movies
- `LeagueStanding` — `(leagueId, year) → ordered team rankings`

**Recomputation is bounded and event-driven.** When an admin records a nomination or marks a winner, the blast radius is known and small:

```
award changed
  → movies nominated in that award        (MovieScore)
    → teams holding any of those movies   (TeamScore)
      → leagues containing those teams    (LeagueStanding)
        → revalidateTag per affected league
```

A single winner announcement during a live ceremony touches a handful of movies, not the whole database. This is what makes the live event feel instant.

**Full recompute exists as a first-class command**, for backfill and for recovery. It is the same code path with an unbounded scope.

**Reconciliation guards against drift.** A scheduled job recomputes from source and diffs against the materialized tables, reporting any mismatch. Materialized values that silently drift from their source are the failure mode this design otherwise introduces, so detecting drift is part of the design rather than an afterthought. Runs on Vercel Cron, nightly during the season.

**The ledger comes free.** Because the pure function operates on nomination and winner records, the per-award line items in §6.7 are the function's inputs rather than a separate query.

## 12. Award show page

Elevated to its own phase — it is where nominations and winners are administered, which makes it the input to the entire scoring pipeline. Errors here propagate to every league.

Requirements:

- Category list for an event and year, with nominee grids per category.
- Admin: attach a nominee (uses the award-show search context, §10), mark a winner, correct a mistake.
- Marking a winner triggers the bounded recompute in §11 and, in phase 14, publishes to the live channel.
- One winner signal only — the carmine corner seal (§6.7). The current page uses both a size change and a green check for the same fact.
- Correcting a winner must fully reverse the prior recompute. Winner changes during a live ceremony are common and the design must treat them as normal, not exceptional.

### Media migration (D9, D24)

The Blob store holds one kind of content: **user profile avatars**. Uploads are `access: 'public'` — the URLs carry an unguessable random suffix, matching the practical guarantee Cloudinary provides today.

Two details make this more than a URL swap:

**Vercel Blob does not transform images.** `src/hooks/useUserImage.js` currently asks Cloudinary for an on-the-fly 128×128 fill. Blob stores and serves bytes only, so resizing moves to `next/image`, with the Blob hostname registered in `images.remotePatterns`.

**Stored values are inconsistent.** `useUserImage` branches on `value.startsWith('http')` — some rows hold a full URL, others a bare Cloudinary public ID. The phase 11 migration must handle both forms and normalize them to Blob URLs.

## 13. Testing

**Repository contract tests.** Before porting begins, capture golden JSON fixtures from the live Heroku API for every endpoint. Each repository and service function is then asserted to produce the same shape. Under D8 there is no HTTP layer to test, so this is the seam that catches port regressions — a differently-nested return from `getPointsByLeagueId` is exactly the class of bug this exists to find.

**Playwright E2E** on: sign-in, create league, make a draft pick, view an event, view the live page.

**Design system unit tests:** token contrast (§6.4) and poster-accent luminance clamping (§6.6).

No component unit tests.

## 14. Phases

| # | Phase | Gate |
|---|---|---|
| 0 | **Owner setup** — provision Vercel, Neon, Blob, Clerk (§15) | All required keys present in `vercel env ls` (Sensitive values cannot be pulled back) |
| 1 | Scaffold: Next 16, TS strict, MUI v7, lint, CI | `npm run build` green; deploys to a Vercel preview |
| 2 | Data layer: dump → Neon, introspect, baseline, repositories, contract fixtures | All contract tests green |
| 3 | Design system: tokens, both themes, typography, contrast + clamping tests | Design tests green |
| 4 | **Auth** — Clerk, user import script, webhook, guards | Sign in as a migrated production user |
| 5 | **Dashboard** — RSC + Server Actions | E2E green |
| 6 | **Draft** — snake board with poster thumbnails, picks, ordering | E2E green |
| 7 | **Parity audit** — enumerate every route, page and controller in the source app; mark ported / deficit / dropped; produce `docs/PARITY.md` | Matrix complete and reviewed; remaining work decomposed into tasks |
| 8 | **Award show page** + search rework (§10, §12) | Admin can attach nominees and mark winners; search serves all three contexts |
| 9 | **Scoring pipeline** (§11) — pure rule, materialized tables, bounded recompute, reconciliation | Scoring unit tests green; reconciliation reports zero drift against production data |
| 10 | Remaining features to parity, driven by `PARITY.md`: films, leagues, live (polling), reviews, users, admin | E2E green per feature; parity matrix fully closed |
| 11 | Cloudinary → Vercel Blob, existing uploads migrated | Images render from Blob |
| 12 | Parallel run on staging domain against a copy of production data | Full manual verification pass |
| 13 | DNS cutover; Heroku retired | Site live on Vercel |
| 14 | Realtime: SSE + a transport chosen at phase start replaces polling | Live event works end to end |
| 15 | New features (§7) | Per-feature E2E |

Phases 4–6 are the D17 priority trio. Auth leads because the dashboard and draft board both depend on a resolved user.

**Phase 7 is a mandatory checkpoint, not a formality.** After the priority trio the app will be visibly incomplete, and the gap needs to be measured rather than estimated. The audit enumerates the source app's 18 route files, 17 controllers and every page, and classifies each as ported, deficient, or intentionally dropped. Its output — `docs/PARITY.md` — becomes the task list for phase 10 and the definition of "done" for the migration. Cutover cannot happen with an open parity matrix.

## 15. Owner setup runbook

Phase 0 is owner-executed and blocks everything else. The implementation plan carries the full step-by-step; summarized here so the spec is self-contained.

**Vercel** — create the project, link the local repo, connect the Git repository, set the production branch, add `cinemadraft.com` as a domain but **do not** point DNS at it until phase 13.

**Neon** — provision through the Vercel Marketplace so the integration injects `DATABASE_URL` automatically. Enable a preview branch for pull requests. Confirm the free-tier plan.

**Caching** — nothing to provision. The Vercel Runtime Cache is included with the platform and requires no integration, no keys, and no card. This replaced Upstash, which no longer offers a free Marketplace tier (D23).

**Vercel Blob** — create the store, confirm `BLOB_READ_WRITE_TOKEN`, and record the public hostname. Uploads use `access: 'public'` (D24).

**Clerk** — the longest step, and the one with a decision embedded in it. Create the application; enable exactly the connections that the Auth0 tenant currently uses (§9 — this must be verified against Auth0 before any import runs, or social users get duplicate identities); configure the sign-in and sign-up URLs; create the webhook endpoint pointing at `/api/webhooks/clerk` subscribed to `user.created` and `user.updated`; capture the publishable key, secret key, and webhook signing secret.

**Auth0** — create a Management API application with read access to users, for the one-off import. This can be revoked immediately after phase 4.

**Heroku** — confirm `pg_dump` access to the production database and capture a dump before anything else. Also confirm the app can serve the contract fixtures (§13) while it is still live.

Every credential goes into Vercel environment variables, then is pulled locally with `vercel env pull`. No secret is committed.

## 16. Resumability

This effort spans more sessions than one context window. State lives in files, not conversation.

- `docs/superpowers/specs/2026-08-13-cinemadraft-nextjs-conversion-design.md` — this document
- `docs/PLAN.md` — phased tasks, each with explicit "done when" criteria
- `docs/PROGRESS.md` — checkbox ledger, updated as the final step of every task
- `docs/DECISIONS.md` — §3 of this spec, extracted so a fresh session does not re-ask

**Protocol for a new session:** read `PROGRESS.md`, find the first unchecked task, read its entry in `PLAN.md`, continue. One commit per task, message referencing the task ID. No conversational handoff required.

## 17. Risks

| Risk | Mitigation |
|---|---|
| **Realtime transport undecided** — phase 14 needs pub/sub and no free option is currently provisioned | Deferred deliberately (D23). Candidates: Upstash direct (outside the Marketplace), Pusher Channels free tier, Ably free tier, or Postgres `LISTEN`/`NOTIFY` on an unpooled Neon connection. Cutover does not depend on it — polling ships at phase 13 |
| Auth0 → Clerk migration orphans users | `auth0Id` retained; email-keyed webhook self-heals; verify social connections before import (phase 0) |
| Port regressions in data shape | Repository contract tests against golden fixtures captured from live production |
| **Contract fixtures become uncapturable** — the source of truth is a live Heroku app that gets retired | Capture in phase 0/2, before any migration work. This is unrecoverable if skipped |
| **Materialized scores drift from source** — the failure mode §11 introduces | Nightly reconciliation job diffs recomputed vs stored and reports mismatches; full recompute available as a first-class command |
| **Winner corrections during a live ceremony** leave stale points | Recompute must be fully reversible; treated as a normal path and E2E tested, not an exception |
| **Search regresses the draft experience** — TMDB rate limits or slow typeahead during a live draft | Local-first search, Runtime Cache-backed TMDB calls, debounce + cancellation; load-tested in phase 8 |
| Neon free tier limits under real traffic | Measure during the phase 12 parallel run, before cutover |
| Poster accents produce unreadable UI | Luminance clamping with a unit test; raw poster color never trusted |
| MUI v7 API drift from v5 during the component port | Port shared components first (phase 3) to surface breakage early |
| Vercel function duration limits break SSE | Deferred to phase 14; polling ships at cutover |
| **Cutover with hidden feature gaps** | Phase 7 parity audit produces `docs/PARITY.md`; cutover is blocked while the matrix has open rows |
| Scope creep from new features into the migration | D14 — features are phase 15, after cutover |

## 18. Out of scope

- Rewriting the UI to shadcn/Tailwind (D3 keeps MUI)
- Redesigning the database schema (D10 replicates exactly)
- Porting the 18 Sequelize migrations
- Native mobile apps
- Any work in `/Users/jonbernard/Development/cinemadraft` — reference only

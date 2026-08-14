# Decisions

Locked during design on 2026-08-13. **Do not re-litigate these without the owner.**
Full rationale lives in `docs/superpowers/specs/2026-08-13-cinemadraft-nextjs-conversion-design.md`.

| # | Decision |
|---|---|
| D1 | Next.js 16 App Router, React 19 |
| D2 | Full TypeScript conversion (strict) |
| D3 | **MUI (latest stable)** as component substrate; new identity delivered through the theme layer |
| D4 | **Prisma (latest stable)** + `@prisma/adapter-neon` at the matching major |
| D5 | Neon Postgres via Vercel Marketplace (free tier) |
| D6 | ~~Upstash Redis~~ — **superseded by D23** |
| D7 | Clerk for auth, replacing Auth0 |
| D8 | Server Components + Server Actions; no general `/api` layer |
| D9 | Vercel Blob replaces Cloudinary |
| D10 | Data replicated exactly, **then identifiers normalized** (D27), then `prisma db pull` |
| D11 | Parallel run, then DNS swap |
| D12 | Contract tests at the repository layer + Playwright E2E |
| D13 | Realtime ships after cutover; polling until then |
| D14 | New features ship after cutover |
| D15 | Light and dark themes both first-class; dark is default |
| D16 | All prior committed work in this repo is ignored — started fresh |
| D17 | Port priority: auth, dashboard, draft — then everything else |
| D18 | A **parity audit** (phase 7) follows the priority trio and gates cutover; output is `docs/PARITY.md` |
| D19 | Scoring becomes a **pure, unit-tested rule** with materialized results and bounded event-driven recompute |
| D20 | Search is **local-first**, merged with cached TMDB, and context-aware (draft / browse / award admin) |
| D21 | The **award show page gets its own phase** — it is the input to the entire scoring pipeline |
| D22 | **Active season year is data, not config** — `AvailableYear.isActive`, settable from the running app; `NEXT_PUBLIC_ACTIVE_YEAR` is deleted |
| D23 | **Vercel Runtime Cache** replaces Upstash for caching; **realtime transport deferred to phase 14** |
| D25 | **No bulk user migration** — accounts are claimed on first Clerk auth with a **verified** matching email. Linking on an unverified email is an account-takeover vector |
| D27 | **snake_case normalization** — plural snake_case tables/columns/enums, drop NULL `password`+`salt` and `SequelizeMeta`. **No PK type changes.** Script is committed and repeatable, because cutover re-dumps from Heroku's original schema |
| D26 | **Passwordless.** Clerk offers email verification code + Google only; password is disabled. Every sign-in is email-verified by construction, and no user ever migrates or resets a password |
| D24 | **Blob uploads are `access: 'public'`.** Content is avatars, already public via Cloudinary and shown to other league members by design |

| D28 | **Always latest stable.** Every dependency is pinned to the newest stable release at the time it is introduced — never a pre-release, never an older major for familiarity. Verify against the npm registry rather than assuming a version from memory |

## Explicitly rejected

- **Supabase** for database or realtime — rejected by the owner.
- **Gold-on-black palette** — the default for awards products; would be indistinguishable from any Oscars microsite.
- **Reusing the prior scaffold's `schema.prisma`** — valuable, but D16 overrides.
- **Keeping Auth0 as a Clerk OAuth connection** — no migration risk, but retains the vendor being removed.
- **Bulk-importing users from Auth0 into Clerk** — superseded by D25. Auth0 does not export password hashes without a support request, and all 51 users are email+password. Claiming needs only the webhook that already existed.
- **Rewriting UI to shadcn/Tailwind** — D3 keeps MUI.
- **Building on MUI 7 / Prisma 6** — the versions originally written into the spec. Both were taken from memory rather than the registry and were stale: MUI shipped 9.x and Prisma 7.x. Superseded by D28.
- **Unifying primary key types** — `Users.id` is an int, `Awards.id` a UUID. Unifying rewrites every PK and FK for no user-visible benefit.
- **Transforming the dump file before restore** — restore as-is then rename in SQL; catalog renames cannot mismap data, dump rewrites can.
- **Upstash Redis via the Vercel Marketplace** — no longer has a free tier; smallest plan is pay-as-you-go and requires a credit card, which violates the free-only constraint.
- **Vercel Edge Config for the active year** — right tool for middleware-latency flags, wrong tool for domain data that belongs beside the years table.
- **Greying out zero-point films in the roster** — the strip is ordered by draft position, not performance. A last pick may be the best pick.

## Confirmed scoring rule

Extracted from the source app (`server/routes/points.js`, `sumPoints`) and preserved exactly:

- A **nomination** earns the award's point value `P`.
- A **win** earns `P` a second time — so a win is worth **2P total**.
- `team total = Σ movie totals`; `movie total = Σ per-award points`.

## Still open

- **Realtime transport for phase 14.** Needed only post-cutover. Candidates: Upstash direct (signed up outside the Marketplace, where a free tier may still exist), Pusher Channels free tier, Ably free tier, or Postgres `LISTEN`/`NOTIFY` over an unpooled Neon connection. Do not decide until phase 14 — pricing and free tiers will have moved.

- **Logo mark.** Three directions explored (frame + pick seal, letterbox bars, sprocket strip); rendered poorly, decision postponed. Use the Archivo Expanded wordmark alone until decided. The current pinwheel mark ships with the MUI Minimal template, is not owned by this project, and must not carry over.

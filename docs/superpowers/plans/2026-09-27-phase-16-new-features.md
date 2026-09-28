# Phase 16 — New features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the seven Phase 16 features the owner decided on 2026-09-27: opening next season, film slugs (and the duplicate-film merge they need), the season view on `/award-shows`, the extended points ledger (standings by show, a live "what moved", a page per seat, a race chart), head-to-head compare, and the signed-out league page as a follower's view.

**Architecture:** Nothing new is scored. Every figure comes from `getLeagueBoard`'s single batched load (D59, D125, D126). Two new pure services turn that load into a season: `lib/services/moments.ts` (the season's 23 scoring moments, in order) and `lib/services/season-ledger.ts` (each seat's points per moment, and the standings after each one). The season view, the standings tab, the live panel, the seat page, the race chart, head-to-head and the stranger's "race at the top" all read those two services. Four migrations: `events.has_ceremony`, the duplicate-film merge with a unique `tmdb_id`, slugs, and a per-season `event_dates` table. Realtime reuses the D102/D110 pattern, as a third route with its own 204 gate, because D116 requires a new decision for anything that streams outside a draft.

**Tech Stack:** Next.js 16.3 App Router (read `node_modules/next/dist/docs/` before writing route code, as AGENTS.md requires), React 19, Prisma 7 on Postgres 17 / Neon, MUI + Tailwind 4 in cascade layers, Vitest (two projects), Playwright against a production build, Storybook, Biome.

**Spec:** the owner's decisions, reproduced verbatim in § Owner decisions below. The source file lives outside the repo (`.context/phase-16/owner-decisions.md` in the conductor workspace), so this plan carries it. The three proposals and their screenshots are the design reference: `.context/phase-16/{league-views,season-and-ledger,films-and-season}/proposal.md`. Prototype code is on `agent/p16-league`, `agent/p16-season` and `agent/p16-films`. Read it with `git show`, reuse it, and **never merge those branches**: they hard-code league 1/2026, list mock routes in `test/route-protection.ts`, and use raw SQL in place of `prisma generate`.

---

## Owner decisions (2026-09-27, authoritative)

Reproduced verbatim, including the two corrections the owner made the same day: §6 compare became public, and §7 became "followers".

> ## 1. Stage the next season
> - Entry: "Open 2027" (films-and-season option B), rollover panel (A) as fallback.
> - **Appears when the site's active year (admin season control) is set to the next year** — not tied to draft completion.
> - **Nobody carries forward.** Opening a season creates an empty one. Season setup gains "add people from previous seasons" (members, not-yet-registered people, characters all selectable, one tap each). Supersedes the "Start with nobody" option — empty is the only behaviour.
> - After opening: land on season setup.
> - Only one season beyond the league's newest can be opened.
>
> ## 2. Film addresses (slugs)
> - `/films/arrival-2016`; TMDB id appended only on a real clash.
> - **Store every browse result** so every film has a slug (ingest when a film is shown/opened, not only when drafted/nominated). Measure write volume and Neon cost; bound it.
> - Old numeric links 301 to the slug, forever.
> - Slug is permanent once assigned (title/year corrections don't change it).
>
> ## 3. Duplicate films (8 pairs in production)
> - Older row survives; merged automatically per pair.
> - If a merge would put one film twice in the same draft: stop the whole migration, ask a person.
> - Migration must be added to the Phase 13 cutover plan (T3b table) and `scripts/restore-from-heroku.sh` checks.
>
> ## 4. Season view
> - Replaces the logo grid on `/award-shows` (option A).
> - Signed in: per-league points and rank change on finished moments only. **Signed out must look good too** — a first-class signed-out version, not an empty shell.
> - AFI: a real per-show "no ceremony" setting (`events.has_ceremony`); fixes the dashboard rail "11 of 12 · Next · date TBA" bug.
> - Off-season: show the finished season + "dates come in the autumn".
> - "Up next": up to 8 films, then "and N more".
>
> ## 5. Points ledger
> - Standings-by-show (B): **its own tab/page** (not under the board).
> - "What moved": always shown, about the latest finished moment, dated.
> - **"What moved" updates live as winners are entered** during a ceremony (not only after refresh).
> - Seat season ledger (A): its own linkable page; any member can open any seat.
> - **Race chart (C) wanted, as another tab.** Requires storing each show's dates per season (new table). Past seasons have no per-year dates — plan must say how history is handled (chart only seasons with dates, or order-only axis for the past).
>
> ## 6. Head-to-head
> - **Option B (standings open up: "Compare" on each standings row, `?vs=`), with C's visuals** (split bar, headline, "films that make the gap"). Pick who to compare from the standings.
> - **Public, like the league page** (owner, 2026-09-27: "compare public") — followers can compare too; noindex like the league page.
> - Same-group comparisons allowed with the "no film on both teams" line.
> - Above/below = league-wide position; character seats can be rivals.
>
> ## 7. Followers: the league page, read-only, for people who aren't playing
> - **No league is featured on `/`.** The homepage stays as it is (film overall totals).
> - **The feature is the signed-out league page** (`/leagues/[id]`, e.g. `/leagues/70`): for friends and family following a league they're not in. They see **almost the same data as players** — real names, who drafted what, standings, points, the board — **read-only** (no owner/member actions, no "your roster"). Owner's words: "They should see almost the same data on the league page as the players do, except it's read only."
> - Audit what the signed-out league page hides today vs the member view and close the gap; the slot that shows the sign-in card becomes the explainer + "race at the top".
> - Keep league pages out of search engines as today (noindex) — reachable by link only.

---

## Open questions for the owner

Each question has a default. The plan is written to that default, so work can start without an answer, and each default is one condition in one place, so an answer changes one line.

1. **A league that skipped a season.** The rules "appears when the active year is the next year" and "only one season beyond the league's newest" agree for a league that plays every year. They conflict for a league whose newest season is 2025 when the site is on 2027: newest + 1 is 2026, which is already over. **Default: the offer appears only when `activeYear === newest + 1`.** A league that skipped a year gets no offer and needs the admin. The alternative is to allow opening the active year whenever it is newer than the league's newest. Either way it is one condition in `canOpenSeason` (P16.T4).
2. **"301" is sent as a 308.** Next's `permanentRedirect()` sends 308 Permanent Redirect. Browsers, crawlers and link unfurlers treat it exactly like 301 for a GET. Sending a literal 301 would move the redirect into `proxy.ts` and need a database lookup there. **Default: 308.** Say so if a literal 301 matters.
3. **Where "store every browse result" writes.** Measured and bounded in P16.T11. **Default:**
   - **Written:** every film rendered by `/browse`, plus the "In cinemas now" shelf on `/`, on render and for every reader. Only the films not already held are inserted. A signed-in reader opening an unheld film page by id also writes it.
   - **Not written:** a **signed-out** reader opening an unheld film by id. D63's crawler bound stays for that one case. Search results and a film page's "similar films" are not written either.
   - Opening an unheld film by id signed out still works: it renders from TMDB at its numeric address, as today.
4. **What does "above/below" drive for a seated member?** Option B has no default partner, and the owner's answer names C's above/below rule. **Default:** the reader's "Your roster" panel gains one line, "25 behind Micah Baird · Compare", pointing at the seat directly above (or directly below, for the leader). The rule also picks the stranger's "race at the top" (1st against 2nd). **Nobody gets C's two cards.**
5. **Does "what moved" also go live on nominations mornings?** The owner said "as winners are entered". The only on-air flag the port sets is `awards_active`; nothing sets `nom_active` (D118). **Default: live only while a show's `awards_active` is on.** A nominations morning appears after the award-entry skill's `refresh`, as today.

**Interpretations stated rather than asked:**
- **Opening a comparison.** The "Compare" link compares the reader's own seat with the row. A reader with no seat that season, which includes every follower, gets the leader against the row, and the leader's own row gets 1st against 2nd. This is the B prototype's rule.
- **"Any member can open any seat"** does not make the seat page members-only. §7 gives followers "almost the same data as players", so the seat page, the standings tab and the race tab are public and noindexed, like the board.

---

## Global Constraints

- 🔴 **AGENTS.md is binding.** Biome, not ESLint. MUI for components, Tailwind for custom styling, and never `!important`. `npm run lock` for any lockfile change. No new dependencies are needed or allowed in this plan: the race chart is hand-drawn SVG and slugs are made in SQL.
- 🔴 **Databases.** Export `DATABASE_URL` for every test run: 5433/5434, or the port `npm run agent:up` printed. Never use 5432, which is the owner's. Run unit tests with `E2E_TEST_AUTH` **unset**.
- 🔴 **Every migration is applied to all three databases, by hand**, then verified with `information_schema`, not with the command's own output:
  ```bash
  for P in 5432 5433 5434; do
    DATABASE_URL=postgresql://cinemadraft:local@localhost:$P/cinemadraft npx prisma migrate deploy
  done
  ```
  An `agent:up` database gets them from its own `migrate deploy`. Each migration task has this as a numbered step, together with its cutover-plan and `restore-from-heroku.sh` edits.
- 🔴 **`prisma generate` in a worktree.** AGENTS.md forbids generating in a worktree because `generated/` is hardlinked to the main checkout. A schema task therefore first gives its worktree a private copy:
  ```bash
  rm -rf generated && cp -R /Users/jonbernard/Development/cinemadraft-nextjs/generated generated && npx prisma generate
  ```
  `rm` removes only this worktree's links. The main checkout's inodes survive, and the generate then writes only the copy. The main checkout is regenerated by the orchestrator at merge, never by a task agent.
- 🔴 **Never merge the prototype branches.** Copy from them.
- **Phase 3.5 gate, every UI task:**
  - Build from `SectionHead`, `Panel`, `Shelf`, `Button`, `StatusChip`, `Eyebrow`, `CinemaFrame`, `PosterFrame`, `EmptyState`.
  - Every new component carries a Storybook story beside it.
  - No hairline card border, no all-caps heading outside `Eyebrow`, no squared or pill button, no machine-formatted date.
  - `LetterboxRule`, `font-display` and the Archivo `wdth` axis do not exist.
  - Brass means an award outcome only (D99). Pills are for status and filter chips only (D73), so nomination "chips" are plain text.
  - 44px targets.
- **Public and noindex.** Every new league route is public (D44/D45), exported with `robots: NOINDEX`, and already covered by `robots.ts`'s `/leagues` disallow. Each one is listed in `test/route-protection.ts`, pinned in `test/route-protection.test.ts`, and given a sample in `e2e/route-protection.spec.ts`'s `SAMPLES`.
- **One ranking and one arithmetic.**
  - Positions come from `rankSeats` (`lib/utils/rank.ts`), never from a local sort.
  - Totals are the ledger's own sums (D125), never recomputed from `earned`.
  - Per show: nomination points are `Σ line.points`, and win points are `Σ (line.won ? line.points : 0)`.
- **Measure in a production build.** Playwright's `webServer` already builds and starts one. Never measure on `next dev` or `127.0.0.1` dev.
- **Mutation check, every task.** Make the named edit, watch the named test go red at the named assertion, restore it, and watch it go green. Record the result in the commit message body. A check that cannot go red is replaced, and the commit says so.
- **CI placement.** A test that needs restored rows goes on `vitest.ci.config.mts`'s exclusion list with a comment naming the rows it reads. Such a test is *excluded*, never weakened.
- Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## The tranche gate (the same command every time)

The last batch let reds through by running only the specs it touched. Every tranche ends on the **whole** suite in CI's shape: an empty database, migrations and the seed. If 5435 is taken by another agent, use the next free port, with `E2E_PORT` set to that port + 1000.

```bash
unset E2E_TEST_AUTH
docker run --rm -d --name ci-verify-pg-$USER -e POSTGRES_USER=cinemadraft \
  -e POSTGRES_PASSWORD=local -e POSTGRES_DB=cinemadraft -p 5435:5432 postgres:17
export DATABASE_URL=postgresql://cinemadraft:local@localhost:5435/cinemadraft E2E_PORT=6435
npx prisma migrate deploy && node scripts/seed-e2e.mjs
npm run lint && npm run typecheck && npm run layering && npm run test:ci
npm run build-storybook
npm run test:e2e                      # every spec; passes only with 0 failed
docker rm -f ci-verify-pg-$USER
```

After that, on the task's own executor, which holds restored data: the full unit suite `npx vitest run` (restored-data tests included), then the full e2e suite once more. Record passed/skipped/failed for both shapes in `docs/PROGRESS.md` under the tranche. Skips must be only the existing `VISUAL=1` and Clerk-key opt-outs, and the gate names them.

## Review Focus

The five inputs most likely to hurt a real person, each pinned by a test in the task that owns it:

1. **A finished season relabelled when the next one opens.** `drafting_status` is one column for every season. Opening 2027 used to make 2026 read `pending` and let its groups be re-dealt. Pinned in P16.T3 by `randomiseGroups({ year: previous })` being refused after opening.
2. **Two films with one title and year inserted in one statement.** Browse can surface both *Sing* (2016) films on one page. Without the right volatility on the slug function, both rows compute `sing-2016` and the whole batch fails with a unique violation, so browse shows nothing. Pinned in P16.T9 by a single-statement two-row insert.
3. **A ceremony scoring under a viewer who left the tab.** A hidden or off-air standings page must open no stream (D111/D123). Pinned in P16.T20 by the hidden-at-mount case and the off-air budget test.
4. **A merge that silently rewrites a draft.** Both copies of a film picked in one league, season and group must abort the migration. Pinned in P16.T8 by a CI-runnable, rolled-back transaction that expects the `RAISE`.
5. **A follower told less than a player.** Pinned in P16.T26 by an e2e test that compares the seat names, picks and totals a stranger's context reads with what a player's context reads, on every league tab.

## Migrations (four)

| # | Migration | Task | Change | Cutover (T3b table, C5, C7) |
|---|---|---|---|---|
| M1 | `20260928090000_event_has_ceremony` | P16.T1 | `events.has_ceremony boolean not null default true`; `afi` → false | row + C5 "afi has no ceremony" |
| M2 | `20260928120000_movie_merge` | P16.T8 | `merge_duplicate_movies()`, run once; `movies_tmdb_id` → unique `movies_tmdb_id_key` | row + C5 unique index, 0 duplicate `tmdb_id`, 0 orphans + **C7 predicts the merge's deltas** |
| M3 | `20260928130000_movie_slugs` | P16.T9 | `unaccent`, `movie_slug_base()`, `movie_slug_for()`, `movies.slug` + backfill + `movies_slug_key`, insert trigger | row + C5 column, index, trigger, extension, 0 null slugs among Latin titles |
| M4 | `20260929090000_event_dates` | P16.T18 | `event_dates(year, event_id, nom_date, nom_time, awards_date, awards_time)`, unique `(year, event_id)`, 2026 backfilled from literals | row + C5 table and 12 rows for 2026; `norm` excludes the new table |

Opening a season (tranche 1) needs **no** migration: a season's status is derived (D130).

## Decisions this plan records

`docs/DECISIONS.md` currently ends at D128, so the next free number is D129. Numbers are provisional in the order below: if another branch lands a D-number first, renumber in order and fix the references in this plan's tasks. Each task writes its own entry, in the house style: a bold rule, the measurement, and a 🔴 for the trap.

| # | Decision | Task |
|---|---|---|
| D129 | **A show's ceremony is data.** `events.has_ceremony`; AFI has none. Replaces "no ceremony date and no winners" as knowledge in the award-entry skill and inference in the rail | P16.T1 |
| D130 | **A league's status belongs to its active season.** `seasonStatus(league, year)`: earlier seasons are complete, later ones unopened | P16.T3 |
| D131 | **Nobody carries forward.** Opening a season creates an empty one. It is offered only when the site's active year is the league's newest + 1. The owner re-seats people from earlier seasons one tap at a time. Supersedes the carry-forward in `stageNextSeason` and the proposal's "Start with nobody" | P16.T4–T6 |
| D132 | **Duplicate films merge into the oldest row, and `tmdb_id` is unique.** Generic by `tmdb_id`. It aborts if one film would appear twice in one league-season-group. `upsertByTmdbId` and award-import become real upserts | P16.T8 |
| D133 | **A held film is addressed by a frozen `title-year` slug**, with `-<tmdb>` only on a clash and a permanent redirect from its numeric address. Made in SQL by an insert trigger, so both writers agree | P16.T9 |
| D134 | **A film shown by browse is stored.** Amends D63 and D56: a row in `movies` no longer means "somebody used this film". Bounded by the discover filters (measured), and by leaving a stranger's open of an unshown id unwritten | P16.T11 |
| D135 | **Show dates are stored per season, from 2026.** `event_dates`. The race chart uses a date axis where every finished moment has a date and an order-only axis otherwise (2017–2025), and says so on the page | P16.T18, T22 |
| D136 | **"What moved" streams during a ceremony.** A new route with its own 204 gate (any show `awards_active`, and the active year), the "new decision with its own budget" D116 asked for | P16.T20 |
| D137 | **Head-to-head is public, like the board.** The owner reversed "members only" on 2026-09-27. `?vs=` on `/leagues/[id]`, noindex | P16.T24 |
| D138 | **No league is featured on `/`; the signed-out league page is a follower's read-only view**, with the measured audit of what it still withholds and why | P16.T26 |

## Traps, recorded before anyone hits them

- 🔴 **Flipping the active year to 2027 changes every page at once.**
  - Every league page defaults to 2027 and finds no seats.
  - The dashboard rail would show 2026's dates as a finished 2027 (`toSeasonPhases` has no season window).
  - P16.T2 and P16.T5 exist for exactly this. Tranche 1 must ship whole before the owner flips the year.
- 🔴 **The merge changes restored row counts.**
  - `lib/db.test.ts`, `scripts/agent-baseline.sh`, `scripts/agent-up.sh` and AGENTS.md all say 1,355 movies. After M2 the migrated executors hold **1,347** (8 pairs merged, measured by the prototype).
  - `restore-from-heroku.sh`'s C7 compares post-migration counts with the dump's, so without P16.T8's prediction step it goes red on every restore.
- 🔴 **Store-every-browse-result breaks exact counts again.**
  - Browsing ingests real films, and they do not match `db.test.ts`'s `e2e-` title exclusion.
  - P16.T11 moves the movie count to a `created_at` cutoff taken from the baseline dump.
- 🔴 **`scoring.differential.test.ts` is keyed by the source's ids.** Four merged pairs carry nominations: Allegiant 50/117, Ready Player One 270/331, Solo 258/332, My Life as a Zucchini 60/177. The losers' figures move onto the keepers. P16.T8 derives that deviation. It never hand-lists it.
- 🔴 **The board stream answers 204 during a ceremony.** It streams only while `drafting_status = 'active'` (D116). The live panel needs its own route (P16.T20). It must not widen that one.
- 🔴 **`StandingsRow` has no `draftId`.** Its `userId` is `-draftId` for a dummy seat. `?vs=` needs the real id, so P16.T24 adds it.
- 🔴 **Scratch data in e2e is global.** `events`, `available_years` and `awards_active` are shared by every spec running in parallel, and `fullyParallel` runs four workers. Specs seed their own `TAG`-prefixed rows in a scratch year (the next free are **2989, 2990, 2988, 2987**, assigned per spec below). They assert only on their own rows, and they never flip the global active year.

---
# Tranche 1 — Opening the next season, and the AFI flag (time-sensitive)

The owner flips the active year to 2027 in the autumn, and every task below changes what that flip does. The tranche ships whole before the flip, or not at all.

### Task P16.T1: `events.has_ceremony` (M1), and the rail stops waiting for the AFI

**Files:**
- Create: `prisma/migrations/20260928090000_event_has_ceremony/migration.sql`
- Modify: `prisma/schema.prisma` (model `Event`)
- Modify: `lib/repositories/events.ts` (add `hasCeremony` to the `Event` pick)
- Modify: `lib/services/season.ts` (`toSeasonPhases`)
- Modify: `app/(app)/page.tsx:81-85` (the "N of M shows complete" eyebrow)
- Modify: `lib/services/entry-status.ts` (`needsWinners` is false for a show with no ceremony)
- Modify: `components/admin/EventAdmin.tsx`, `actions/admin/update-event.ts` (a "This show has a ceremony" checkbox)
- Modify: `scripts/award-import.mjs` (`loadDates`/`applyDates` skip the awards half when `has_ceremony` is false), `.claude/skills/award-entry/SKILL.md` § What to know about the shows
- Modify: `docs/superpowers/plans/2026-09-27-phase-13-cutover.md` (T3b table), `scripts/restore-from-heroku.sh` (C5)
- Test: `lib/services/season-phases.test.ts` (new; pure, CI), `lib/services/entry-status.test.ts`, `actions/admin/update-event.test.ts`, `scripts/award-import.test.mjs`, `e2e/dashboard.spec.ts`

**Interfaces:**
- Produces: `Event.hasCeremony: boolean`. `toSeasonPhases(events: readonly PhaseEvent[], season: number, now?: number): SeasonPhase[]`, where `PhaseEvent` adds `hasCeremony: boolean` (the `season` argument is P16.T2's; T1 passes it through unused). The eyebrow's rule is "a show is complete when every one of its phases is".

- [ ] **Step 1: Write the failing pure test**

```ts
// lib/services/season-phases.test.ts
import { describe, expect, it } from 'vitest';
import { toSeasonPhases } from './season';

const NOW = Date.UTC(2026, 8, 27);
const show = (id: number, over: Partial<Parameters<typeof toSeasonPhases>[0][number]> = {}) => ({
  id, name: `Show ${id}`, abbreviation: `s${id}`, hasCeremony: true,
  nomDate: Date.UTC(2026, 0, 8), awardsDate: Date.UTC(2026, 2, 1), ...over,
});

describe('toSeasonPhases', () => {
  it('gives a show with no ceremony one moment, not a ceremony that never comes', () => {
    const phases = toSeasonPhases([show(1), show(2, { hasCeremony: false, awardsDate: null })], 2026, NOW);
    expect(phases.map((p) => p.key)).toEqual(['1-nominations', '2-nominations', '1-ceremony']);
  });

  it('leaves an undated ceremony that does exist in place, as Date TBA', () => {
    const phases = toSeasonPhases([show(1, { awardsDate: null })], 2026, NOW);
    expect(phases.find((p) => p.key === '1-ceremony')).toMatchObject({ date: null, complete: false });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run lib/services/season-phases.test.ts`
Expected: FAIL. `2-ceremony` is present, and the signature takes no season.

- [ ] **Step 3: Migration and schema**

```sql
-- prisma/migrations/20260928090000_event_has_ceremony/migration.sql
-- A show that names honourees and never holds a ceremony (the AFI: ten films
-- a year, 0 winner rows in any season). Until now this was knowledge in the
-- award-entry skill and an inference in the rail, which built a ceremony box
-- for it with no date and so read "11 of 12 shows complete · Next · date TBA"
-- for the rest of the year (D129). Default true: every other show has one.
ALTER TABLE "events" ADD COLUMN "has_ceremony" BOOLEAN NOT NULL DEFAULT true;
UPDATE "events" SET "has_ceremony" = false WHERE "abbreviation" = 'afi';
```

In `prisma/schema.prisma`, model `Event`: `hasCeremony Boolean @default(true) @map("has_ceremony")`. Then regenerate using § Global Constraints' private-copy recipe, and add `'hasCeremony'` to the `Pick` in `lib/repositories/events.ts`.

- [ ] **Step 4: Apply M1 to all three databases and verify**

```bash
for P in 5432 5433 5434; do
  DATABASE_URL=postgresql://cinemadraft:local@localhost:$P/cinemadraft npx prisma migrate deploy
  /opt/homebrew/opt/libpq/bin/psql postgresql://cinemadraft:local@localhost:$P/cinemadraft -Atc \
    "select abbreviation from events where not has_ceremony"
done
```
Expected: `afi` printed three times.

- [ ] **Step 5: Implement `toSeasonPhases`**

Emit the ceremony phase only when `event.hasCeremony`. Keep undated-sorts-last. In `app/(app)/page.tsx`, the eyebrow counts a show as complete when every phase whose `eventId` matches it is `complete`, which makes the AFI complete once its nominations have passed:

```ts
const byShow = Map.groupBy(view.events, (phase) => phase.eventId);
const complete = [...byShow.values()].filter((phases) => phases.every((p) => p.complete)).length;
```

- [ ] **Step 6: Entry status, admin and the script**
  - `entryStatus`: `needsWinners` is `false` when `!hasCeremony`. Add a test beside `entry-status.test.ts:103`, which is today's "a null date is never due" case.
  - `EventAdmin` gets a checkbox bound to `hasCeremony`, and `updateEvent` accepts `hasCeremony: z.boolean().optional()`. Add a test to `update-event.test.ts` that asserts the column round-trips.
  - In `award-import.mjs`, `loadDates` selects `has_ceremony`, and the `dates` report prints "no ceremony" instead of a blank awards half. `applyDates` refuses an `awards` entry for such a show with `"<abbr> has no ceremony"`. Add both cases to `award-import.test.mjs`.
  - In SKILL.md, replace "AFI has no ceremony … never invent one" with "a show with `has_ceremony = false` (today the AFI) has no awards half; the script refuses one".

- [ ] **Step 7: e2e (production build, CI data)**

In `e2e/dashboard.spec.ts`, beside the existing undated-scratch-event case (lines 430–470), add a case with its own tagged event where `has_ceremony = false`, `nom_date` is yesterday and `awards_date` is null. Assert that the rail has no box for that event's ceremony, and that no chip reading `Next · date TBA` belongs to it (scope the locator to the event's name). Clean the row up in `finally`.

- [ ] **Step 8: Cutover plan and restore check**
  - In `docs/superpowers/plans/2026-09-27-phase-13-cutover.md` § What a full restore wipes, add the row `| 20260928090000_event_has_ceremony | events.has_ceremony, AFI false (D129). Without it the rail waits for an AFI ceremony forever |`, and change "the six changes" / "the nine T3b schema facts" to the new counts.
  - In `scripts/restore-from-heroku.sh` C5, add:
    ```sql
    ('events.has_ceremony, afi false', coalesce((select not has_ceremony from events where abbreviation = 'afi'), false)),
    ```
  - Mutation-test the check: run the script against a scratch copy (`--yes` against an `agent:up` port) with the `UPDATE` line deleted from the migration, and confirm C5 goes red naming that row. Restore the line.

- [ ] **Step 9: Run the tests**

Run: `npx vitest run lib/services/season-phases.test.ts lib/services/entry-status.test.ts actions/admin/update-event.test.ts && node --test scripts/award-import.test.mjs && npx playwright test e2e/dashboard.spec.ts`
Expected: PASS.

- [ ] **Step 10: 🔴 Mutation**

Emit the ceremony phase unconditionally. Expect red at "gives a show with no ceremony one moment" and at the dashboard e2e's no-ceremony-box assertion. Restore.

- [ ] **Step 11: Record D129 and commit**

Append D129 to `docs/DECISIONS.md` and tick P16.T1 in `docs/PROGRESS.md`.
```bash
git add prisma lib app components actions scripts .claude/skills/award-entry/SKILL.md docs e2e
git commit -m "feat(awards): a show's ceremony is data, and the rail stops waiting for the AFI (P16.T1)"
```

---

### Task P16.T2: The rail shows the season it is labelled with

Once the active year is 2027, `events` still holds 2026's dates until the award-entry skill sets the new ones, and `toSeasonPhases` has no season window. The rail would then call 2027 finished.

**Files:**
- Create: `lib/utils/season-window.ts` (move `inSeason` out of `lib/services/entry-status.ts`)
- Modify: `lib/services/entry-status.ts` (import it), `lib/services/season.ts` (`toSeasonPhases`, `getSeasonPhases`), `lib/services/dashboard.ts` (pass the active year)
- Test: `lib/utils/season-window.test.ts` (pure, CI), `lib/services/season-phases.test.ts`

**Interfaces:**
- Produces: `inSeason(instant: number, season: number): boolean`, `seasonStart(season: number): number` (= `Date.UTC(season - 1, 7, 1)`), and `seasonOffset(instant: number): number`, which is the milliseconds since the start of the season the instant falls in. `seasonOffset` is P16.T13's order key.

- [ ] **Step 1: Failing tests**

```ts
// lib/utils/season-window.test.ts
import { describe, expect, it } from 'vitest';
import { inSeason, seasonOffset } from './season-window';

describe('season window', () => {
  it('puts December nominations in the next year’s season', () => {
    expect(inSeason(Date.UTC(2025, 11, 8), 2026)).toBe(true);
    expect(inSeason(Date.UTC(2025, 11, 8), 2025)).toBe(false);
  });
  it('orders a date by its place in its own season, whatever the year', () => {
    expect(seasonOffset(Date.UTC(2019, 0, 22))).toBe(seasonOffset(Date.UTC(2026, 0, 22)));
    expect(seasonOffset(Date.UTC(2025, 11, 8))).toBeLessThan(seasonOffset(Date.UTC(2026, 0, 8)));
  });
});
```
Add to `season-phases.test.ts`: `toSeasonPhases([show(1)], 2027, NOW)` gives both phases `date: null, complete: false`, because 2026's dates are not 2027's.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run lib/utils/season-window.test.ts lib/services/season-phases.test.ts`
Expected: FAIL (module missing; 2027 reads as complete).

- [ ] **Step 3: Implement**

```ts
// lib/utils/season-window.ts
/** A season runs 1 Aug of the year before to 31 Jul (the award-import `seasonWindow`). */
export function seasonStart(season: number): number {
  return Date.UTC(season - 1, 7, 1);
}
export function inSeason(instant: number, season: number): boolean {
  return instant >= seasonStart(season) && instant < seasonStart(season + 1);
}
/** Milliseconds into whichever season `instant` falls in: an order key that ignores the year. */
export function seasonOffset(instant: number): number {
  const year = new Date(instant).getUTCFullYear();
  const season = new Date(instant).getUTCMonth() >= 7 ? year + 1 : year;
  return instant - seasonStart(season);
}
```
In `toSeasonPhases(events, season, now = Date.now())`, a date outside `inSeason(date, season)` becomes `null`. `getDashboard` and `getSeasonPhases` pass `await getActiveYear()`.

- [ ] **Step 4: Run the tests plus the existing dashboard/entry-status tests on the executor**

Run: `npx vitest run lib/utils/season-window.test.ts lib/services/season-phases.test.ts lib/services/entry-status.test.ts lib/services/dashboard.test.ts`
Expected: PASS. `dashboard.test.ts` is restored-data, and 2026 is active there, so nothing moves.

- [ ] **Step 5: 🔴 Mutation**

Drop the `inSeason` guard in `toSeasonPhases`. Expect the 2027 case to go red. Restore.

- [ ] **Step 6: Commit**

`git commit -m "fix(dashboard): the rail reads only its own season's dates (P16.T2)"`

---

### Task P16.T3: A league's status belongs to its active season

**Files:**
- Create: `lib/leagues/season.ts`, `lib/leagues/season.test.ts` (copy both from `agent/p16-films`: `git show agent/p16-films:lib/leagues/season.ts`)
- Modify: every read of `draftingStatus` that is about a specific year. Inventory them first:
  ```bash
  git grep -n "draftingStatus" -- lib actions app components
  ```
  The expected set: `lib/services/draft.ts` (`getLeagueBoard` status), `lib/services/season-setup.ts`, `actions/leagues/manage-seats.ts` (`randomiseGroups`, `assignSeats`, `removeSeat`, `addDummySeat` where they gate on pending), `actions/leagues/manage-league.ts` (`startDraft`, `completeDraft`), `lib/services/draft-console.ts`. Record the final list in the commit body.
- Test: `lib/leagues/season.test.ts` (pure, CI), `actions/leagues/season-actions.test.ts` (DB, own fixture, CI)

**Interfaces:**
- Produces: `seasonStatus(league: Pick<League, 'activeYear' | 'draftingStatus'>, year: number): League['draftingStatus']`. It returns the league's status for `activeYear` (or when that is null), `'complete'` for an earlier year, and `null` for a later one.

- [ ] **Step 1: Copy the pure test from the prototype, and add the action test**

```ts
// actions/leagues/season-actions.test.ts, in the staging describe
it('closes the season it leaves: its groups can no longer be re-dealt', async () => {
  signInAs(fixture.owner);
  await db.league.update({ where: { id: fixture.league.id }, data: { activeYear: YEAR + 1, draftingStatus: 'pending' } });
  const redeal = await randomiseGroups({ leagueId: fixture.league.id, year: YEAR, groupCount: 2 });
  expect(redeal.ok).toBe(false);
});
```
(The row is written directly. The action that writes it is P16.T4, and this task must not depend on it.)

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run lib/leagues/season.test.ts actions/leagues/season-actions.test.ts -t "closes the season|seasonStatus"`
Expected: FAIL.

- [ ] **Step 3: Implement.** Route each inventoried read through `seasonStatus(league, year)`.

- [ ] **Step 4: Run the whole season-actions file, plus `lib/services/draft.test.ts` and `league-view.test.ts`**
Expected: PASS.

- [ ] **Step 5: 🔴 Mutation**

Make `seasonStatus` return `league.draftingStatus` always. Expect red at "closes the season it leaves" and at `seasonStatus`'s "keeps a finished season finished". Restore.

- [ ] **Step 6: Record D130 and commit**

`git commit -m "fix(leagues): a league's status belongs to its active season (P16.T3)"`

---

### Task P16.T4: Opening a season creates an empty one

**Files:**
- Modify: `actions/leagues/manage-league.ts:211` (rename `stageNextSeason` to `openSeason` and rewrite it; it has no UI caller today, only its test)
- Create: `lib/leagues/open-season.ts` (the pure rule)
- Test: `lib/leagues/open-season.test.ts` (pure, CI), `actions/leagues/season-actions.test.ts` (DB, CI)

**Interfaces:**
- Consumes: `seasonStatus` (T3), `getActiveYear()` (`lib/services/season.ts`), `draftRepository.findYearsByLeagueId(leagueId): Promise<number[]>` (newest first; add it if absent, as one `distinct year` query).
- Produces:
  - `canOpenSeason({ activeYear, seasons }: { activeYear: number; seasons: readonly number[] }): number | null` returns the year that may be opened, or null. **This is the one condition open question 1 would change.**
  - `openSeason(input: { leagueId: number; year: number }): Promise<ActionResult<{ opened: boolean }>>`

- [ ] **Step 1: Failing pure test**

```ts
// lib/leagues/open-season.test.ts
import { describe, expect, it } from 'vitest';
import { canOpenSeason } from './open-season';

describe('canOpenSeason', () => {
  it('offers the active year when it is the season after the newest', () => {
    expect(canOpenSeason({ activeYear: 2027, seasons: [2026, 2025] })).toBe(2027);
  });
  it('offers nothing while the site is still on the newest season', () => {
    expect(canOpenSeason({ activeYear: 2026, seasons: [2026] })).toBeNull();
  });
  it('offers nothing two seasons ahead: only one beyond the newest may open', () => {
    expect(canOpenSeason({ activeYear: 2027, seasons: [2025] })).toBeNull();
  });
  it('offers nothing to a league with no season at all: that is league creation', () => {
    expect(canOpenSeason({ activeYear: 2027, seasons: [] })).toBeNull();
  });
});
```

- [ ] **Step 2: Failing action tests** (replace the three carry-forward tests at `season-actions.test.ts:560-606`)

```ts
vi.mock('@/lib/services/season', async (real) => ({
  ...(await real<typeof import('@/lib/services/season')>()),
  getActiveYear: vi.fn(async () => YEAR + 1),
}));

it('refuses a year the site is not on, and changes nothing', async () => {
  signInAs(fixture.owner);
  const result = await openSeason({ leagueId: fixture.league.id, year: YEAR + 2 });
  expect(result.ok).toBe(false);
  expect(await db.draft.count({ where: { leagueId: fixture.league.id, year: YEAR + 2 } })).toBe(0);
});
it('refuses a member who is not an owner', async () => {
  signInAs(fixture.member);
  expect((await openSeason({ leagueId: fixture.league.id, year: YEAR + 1 })).ok).toBe(false);
  expect((await db.league.findUnique({ where: { id: fixture.league.id } }))?.activeYear).not.toBe(YEAR + 1);
});
it('opens an empty season: nobody carries forward', async () => {
  signInAs(fixture.owner);
  const result = await openSeason({ leagueId: fixture.league.id, year: YEAR + 1 });
  expect(result).toMatchObject({ ok: true, data: { opened: true } });
  expect(await db.draft.count({ where: { leagueId: fixture.league.id, year: YEAR + 1 } })).toBe(0);
  expect(await db.league.findUnique({ where: { id: fixture.league.id } })).toMatchObject({
    activeYear: YEAR + 1, draftingStatus: 'pending',
  });
});
it('opening twice changes nothing the second time', async () => {
  signInAs(fixture.owner);
  await openSeason({ leagueId: fixture.league.id, year: YEAR + 1 });
  expect(await openSeason({ leagueId: fixture.league.id, year: YEAR + 1 })).toMatchObject({ ok: true, data: { opened: false } });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `npx vitest run lib/leagues/open-season.test.ts actions/leagues/season-actions.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement**

```ts
// lib/leagues/open-season.ts
/** The season an owner may open, or null (D131). One beyond the newest, and only once the site is on it. */
export function canOpenSeason({ activeYear, seasons }: { activeYear: number; seasons: readonly number[] }): number | null {
  const newest = seasons[0];
  return newest != null && activeYear === newest + 1 ? activeYear : null;
}
```
`openSeason` works in this order:
1. `authorizeLeague`.
2. `seasons = findYearsByLeagueId`.
3. If `league.activeYear === year`, return `ok({ opened: false })`.
4. If `canOpenSeason({ activeYear: await getActiveYear(), seasons }) !== year`, throw `new ConflictError('that season cannot be opened')`.
5. `leagueRepository.update(id, { activeYear: year, draftingStatus: 'pending' })`.
6. `revalidatePath(\`/leagues/${id}\`, 'layout')`, then return `ok({ opened: true })`.

It creates no `drafts` rows. Delete the carry-forward loop entirely. Do not comment it out.

- [ ] **Step 5: Run and confirm PASS.**

- [ ] **Step 6: 🔴 Mutation**
  - (a) Re-add a loop copying last season's seats. Expect red at "opens an empty season".
  - (b) Replace the `canOpenSeason` check with `true`. Expect red at "refuses a year the site is not on".
  - Restore both.

- [ ] **Step 7: Record D131 (the rule; T6 adds the re-seating half) and commit**

`git commit -m "feat(leagues): opening a season creates an empty one (P16.T4)"`

---

### Task P16.T5: "Open 2027", and the rollover panel

**Files:**
- Create: `components/leagues/OpenSeason.tsx` (`OpenSeasonButton`, `OpenSeasonPanel`), `components/leagues/OpenSeason.stories.tsx`, `components/leagues/OpenSeason.test.tsx`
- Modify: `app/(app)/leagues/[id]/page.tsx` (the Seasons nav at lines 306–323, the owner action row, and the empty-season state)
- Test: `e2e/open-season.spec.ts` (new; `TAG = 'e2e-open-season'`)

Reuse the prototype's `useStage` hook and its confirm flow (`git show agent/p16-films:components/leagues/NextSeason.tsx`), with the carry-forward counts removed. There is nobody to count.

**Interfaces:**
- Consumes: `canOpenSeason` and `openSeason` (T4), `useConfirm` (`components/ui/ConfirmDialog`).
- Produces:
  - `OpenSeasonButton({ leagueId, year }: { leagueId: number; year: number })`
  - `OpenSeasonPanel({ leagueId, year, fromYear }: { leagueId: number; year: number; fromYear: number })`
  - On success, both call `router.push(\`/leagues/${leagueId}/setup?year=${year}\`)`.

**Behaviour, by reader, with the page's own season `view.year`:**

| Reader | `openable = canOpenSeason(...)` is a year | Viewing `openable` (the page defaults to the active year) |
|---|---|---|
| Owner | `+ Open 2027` at the end of the Seasons nav, with a confirm ("Open 2027? It starts empty. You'll add people on the next page. 2026 stays exactly as it is.") | `OpenSeasonPanel` in place of the board: the same act, larger, with a link back to `fromYear` |
| Member or stranger | nothing | `EmptyState`: "The 2027 season hasn't been set up yet", action "See 2026" |

The board room is not rendered for an unopened season.

- [ ] **Step 1: Component tests (jsdom)**
  - The button opens the confirm and calls `openSeason` only after "Open".
  - An `ok: false` shows the message in an `aria-live` region and does not navigate.
  - The panel's focus lands on Cancel when the confirm opens.

- [ ] **Step 2: Run them and confirm they fail. Then implement the components and wire the page.**

- [ ] **Step 3: Stories:** `Button`, `Panel`, `PanelError`, in both schemes (the toolbar global).

- [ ] **Step 4: e2e (production build, CI data)**

Seed a league whose only season is **2025**, with two seats. CI's active year is 2026, so 2026 is `newest + 1`. There is no global flip.
  - As the owner at `/leagues/<id>`, `Open 2026` is visible. Confirm it, and assert the URL becomes `/leagues/<id>/setup?year=2026`, with zero seats in 2026 (a SQL count).
  - `/leagues/<id>?year=2025` still shows both seats and a `complete` eyebrow.
  - A second context signed out at `/leagues/<id>` reads "The 2026 season hasn't been set up yet" and has no `Open` control.
  - No horizontal scroll at 390 in either context.
  - `afterAll` deletes by `TAG`.

- [ ] **Step 5: 🔴 Mutation**

Render `OpenSeasonButton` for non-owners. Expect the stranger assertion to go red. Restore.

- [ ] **Step 6: Commit**

`git commit -m "feat(leagues): open the next season from the league page (P16.T5)"`

---

### Task P16.T6: Season setup adds people from earlier seasons, one tap each

**Files:**
- Modify: `lib/services/season-setup.ts` (add `getReturningPeople`), `actions/leagues/manage-seats.ts` (add `seatReturning`), `components/leagues/SeasonSetup.tsx` (a "From earlier seasons" section), `components/leagues/SeasonSetup.stories.tsx`, `app/(app)/leagues/[id]/setup/page.tsx` (pass the list)
- Test: `actions/leagues/season-actions.test.ts` (DB, CI), `components/leagues/SeasonSetup.test.tsx`, `e2e/open-season.spec.ts`

**Interfaces:**
- Produces:
  - `type ReturningPerson = { fromDraftId: number; name: string; kind: 'member' | 'unregistered' | 'character'; lastYear: number }`
  - `getReturningPeople(leagueId: number, year: number): Promise<ReturningPerson[]>`. It returns one entry per person across every season before `year`: members keyed by `userId`, everyone else by `dummyName`, taken from their newest seat. It excludes anyone already seated in `year`. Order: members, then unregistered, then characters, each by name. `kind` comes from `isCharacter(name)` (D121).
  - `seatReturning(input: { leagueId: number; year: number; fromDraftId: number }): Promise<ActionResult<{ draftId: number }>>`

- [ ] **Step 1: Failing tests (action and service, one fixture)**
  - Seed seats in YEAR: owner, member, a placeholder "Aunt Jo", and a character "Neo". Open YEAR + 1.
  - `getReturningPeople` returns four entries with the right kinds.
  - `seatReturning` for the member creates a YEAR + 1 draft with `userId` set and `dummy` false. For "Neo" it creates a dummy seat named "Neo".
  - A second `seatReturning` for the member is refused, and the count is unchanged.
  - `fromDraftId` from another league is refused.
  - `fromDraftId` from YEAR + 1 itself is refused.
  - Any `seatReturning` once `seasonStatus` is not `pending` is refused.
  - After seating the member, `getReturningPeople` returns three.

- [ ] **Step 2: Run them and confirm they fail. Implement.**

`seatReturning` works in this order:
1. `authorizeLeague`.
2. The source seat must satisfy `leagueId === input.leagueId && year < input.year`.
3. `seasonStatus(league, input.year) === 'pending'`.
4. The person must not already be seated, using the same key as `getReturningPeople`.
5. `draftRepository.create({ leagueId, year, userId: source.userId, dummyName: source.userId == null ? source.dummyName : null })`.
6. `revalidatePath(\`/leagues/${id}\`, 'layout')`.

- [ ] **Step 3: UI**

A `SectionHead as="h2"` "From earlier seasons" with one row per person: the name, `· character` or `· not registered yet` in dim text (the same words `SeasonSetup.tsx:448` uses), "last in 2026", and an "Add" `Button` (44px). The row leaves the list once the action resolves. Nothing is batched, and there is no "add everyone", because D121 says one press seats one person.

- [ ] **Step 4: Component test, story (`WithReturningPeople`), and extend the e2e**

After opening 2026, add the member and one character with a tap each. Both appear in the seat list, and the member's row carries no "not registered" suffix.

- [ ] **Step 5: 🔴 Mutation**

Drop the already-seated check. Expect red at "a second seatReturning … is refused". Restore.

- [ ] **Step 6: Complete D131's entry (the re-seating half) and commit**

`git commit -m "feat(leagues): season setup re-seats people from earlier seasons (P16.T6)"`

---

### Task P16.T7: Tranche 1 gate

- [ ] **Step 1:** Run § The tranche gate. Every spec. 0 failed.
- [ ] **Step 2:** On the executor, run the full `npx vitest run` and the full e2e suite.
- [ ] **Step 3: Browser pass in a production build** at 1440 and 390, light and dark: owner, member and stranger on a league whose newest is 2025. Screenshot the four states from T5's table into `.local/p16/t1/` (gitignored).
- [ ] **Step 4:** In `docs/PROGRESS.md`, tick T1–T7 and record both gates' pass/skip/fail counts.
- [ ] **Step 5:** Tell the owner the tranche is on `dev` and that flipping the active year is now safe. `git commit -m "docs: P16 tranche 1 gate"`

---
# Tranche 2 — The duplicate-film merge, slugs, and storing every browse result

Merge first: slugs need one row per film, and a unique `tmdb_id` is what makes the browse ingest's `ON CONFLICT` possible.

### Task P16.T8: The duplicate-film merge (M2)

**Files:**
- Create: `prisma/migrations/20260928120000_movie_merge/migration.sql`
- Modify: `prisma/schema.prisma` (`Movie.tmdbId` → `@unique(map: "movies_tmdb_id_key")`, drop `@@index([tmdbId])`), `lib/repositories/movies.ts` (`upsertByTmdbId` becomes `db.movie.upsert`), `scripts/award-import.mjs:329` (`INSERT … ON CONFLICT (tmdb_id) DO UPDATE SET tmdb_id = EXCLUDED.tmdb_id RETURNING id, title, release_date`)
- Modify: `lib/db.test.ts:58` (1355 → 1347), `scripts/agent-baseline.sh:23-24`, `scripts/agent-up.sh:120` (`60/13/1347/156`), `AGENTS.md:96,122` (the same numbers, and one clause: "after the P16 merge, M2")
- Modify: `docs/superpowers/plans/2026-09-27-phase-13-cutover.md` (T3b table), `scripts/restore-from-heroku.sh` (C5 and **C7**)
- Test: `lib/repositories/movie-merge.test.ts` (new; DB, **CI-runnable**), `lib/repositories/movie-merge.production.test.ts` (new; restored data, **excluded on CI**), `lib/services/film-ingest.test.ts`, `scripts/award-import.test.mjs`

**Interfaces:**
- Produces: the SQL function `merge_duplicate_movies() RETURNS integer`, which returns the movie rows removed. It stays in the schema: it is a no-op once the unique index exists, and tests call it inside rolled-back transactions. It also produces a unique `movies.tmdb_id`, and `movieRepository.upsertByTmdbId` is atomic.

- [ ] **Step 1: Write the CI-runnable merge test.** It runs in a transaction that is always rolled back, so it needs no data and leaves none behind.

```ts
// lib/repositories/movie-merge.test.ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';

class Rollback extends Error {}
async function inRolledBack(work: (tx: typeof db) => Promise<void>) {
  await expect(
    db.$transaction(async (tx) => { await work(tx as typeof db); throw new Rollback(); }),
  ).rejects.toBeInstanceOf(Rollback);
}
const q = (tx: typeof db, sql: string, ...values: unknown[]) => tx.$queryRawUnsafe<{ [k: string]: unknown }[]>(sql, ...values);

describe('merge_duplicate_movies', () => {
  it('keeps the older row, moves every reference, and coalesces the doubled watchlist row', async () => {
    await inRolledBack(async (tx) => {
      await tx.$executeRawUnsafe('DROP INDEX movies_tmdb_id_key');
      const [keeper, loser] = await q(tx, `insert into movies (title, tmdb_id, created_at, updated_at)
        values ('e2e-merge a', '999000111', now(), now()), ('e2e-merge a', '999000111', now(), now()) returning id`);
      const [user] = await q(tx, `insert into users (uuid, email, created_at, updated_at)
        values (gen_random_uuid(), 'merge-${Date.now()}@example.test', now(), now()) returning id`);
      await q(tx, `insert into watchlists (movie_id, user_id, created_at, updated_at) values ($1, $3, now(), now()), ($2, $3, now(), now())`, keeper?.id, loser?.id, user?.id);
      await q(tx, `insert into nominations (movie_id, award_id, year, created_at, updated_at) values ($1, 1, 2990, now(), now())`, loser?.id);

      const [{ removed }] = (await q(tx, 'select merge_duplicate_movies() as removed')) as [{ removed: number }];

      expect(removed).toBe(1);
      expect(await q(tx, `select id from movies where tmdb_id = '999000111'`)).toEqual([{ id: keeper?.id }]);
      expect(await q(tx, `select count(*)::int as n from watchlists where user_id = $1`, user?.id)).toEqual([{ n: 1 }]);
      expect(await q(tx, `select movie_id from nominations where year = 2990 and movie_id in ($1, $2)`, keeper?.id, loser?.id)).toEqual([{ movie_id: keeper?.id }]);
    });
  });

  it('refuses when both copies are drafted in one league, season and group', async () => {
    await inRolledBack(async (tx) => {
      await tx.$executeRawUnsafe('DROP INDEX movies_tmdb_id_key');
      // two movies, one tmdb id; one league; two drafts in the same year and group; one pick each
      // ... (seed as above, then:)
      await expect(q(tx, 'select merge_duplicate_movies()')).rejects.toThrow(/movie merge/);
    });
  });
});
```
(Complete the second test's seed with the same `insert … returning id` pattern: one `leagues` row, two `drafts` rows with `year = 2990, "group" = 1`, and one `draft_picks` row per draft pointing at keeper and loser. Mixed int/bigint keys: pass ids through SQL, and don't compare them in JS until they are selected back.)

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run lib/repositories/movie-merge.test.ts`
Expected: FAIL (`function merge_duplicate_movies() does not exist`).

- [ ] **Step 3: Write M2.** Take the prototype's merge (`git show agent/p16-films:prisma/migrations/20260927120000_movie_slugs/migration.sql`, section 1) and wrap it as a function:

```sql
-- prisma/migrations/20260928120000_movie_merge/migration.sql
-- Merge every movies row that shares a tmdb_id into its oldest (lowest id),
-- then make tmdb_id unique so the look-up-then-insert race cannot recur (D132).
-- Generic by tmdb_id, never by literal ids: Heroku keeps writing until cutover.
-- A function, not inline SQL, so a CI test can run it inside a rolled-back
-- transaction; once the index exists it can never find anything to do.
CREATE FUNCTION merge_duplicate_movies() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE removed integer;
BEGIN
  CREATE TEMP TABLE movie_merge ON COMMIT DROP AS
  SELECT id AS loser, keeper FROM (
    SELECT id, min(id) OVER (PARTITION BY tmdb_id) AS keeper FROM movies WHERE tmdb_id IS NOT NULL
  ) ranked WHERE id <> keeper;

  -- "One film twice in the same draft": the group's draft room, which also
  -- covers one seat holding both copies. A person decides, not the migration.
  IF EXISTS (
    SELECT 1 FROM draft_picks p JOIN drafts d ON d.id = p.draft_id
      LEFT JOIN movie_merge m ON m.loser = p.movie_id
     GROUP BY d.league_id, d.year, d."group", coalesce(m.keeper, p.movie_id)
    HAVING count(*) > 1 AND bool_or(m.loser IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'movie merge: one film is drafted twice in a league-season-group; resolve by hand';
  END IF;

  UPDATE nominations t SET movie_id = m.keeper FROM movie_merge m WHERE t.movie_id = m.loser;
  UPDATE winners     t SET movie_id = m.keeper FROM movie_merge m WHERE t.movie_id = m.loser;
  UPDATE draft_picks t SET movie_id = m.keeper FROM movie_merge m WHERE t.movie_id = m.loser;
  UPDATE lists       t SET movie_id = m.keeper FROM movie_merge m WHERE t.movie_id = m.loser;
  UPDATE reviews     t SET movie_id = m.keeper FROM movie_merge m WHERE t.movie_id = m.loser;
  UPDATE watchlists  t SET movie_id = m.keeper FROM movie_merge m WHERE t.movie_id = m.loser;

  DELETE FROM watchlists w USING watchlists e WHERE w.user_id = e.user_id AND w.movie_id = e.movie_id
     AND w.id > e.id AND w.movie_id IN (SELECT keeper FROM movie_merge);
  DELETE FROM reviews w USING reviews e WHERE w.user_id = e.user_id AND w.movie_id = e.movie_id
     AND w.id > e.id AND w.movie_id IN (SELECT keeper FROM movie_merge);
  DELETE FROM lists w USING lists e WHERE w.user_id = e.user_id AND w.movie_id = e.movie_id
     AND w.year = e.year AND w.id > e.id AND w.movie_id IN (SELECT keeper FROM movie_merge);

  DELETE FROM movies WHERE id IN (SELECT loser FROM movie_merge);
  GET DIAGNOSTICS removed = ROW_COUNT;
  DROP TABLE movie_merge;
  RETURN removed;
END $$;

SELECT merge_duplicate_movies();
DROP INDEX IF EXISTS movies_tmdb_id;
CREATE UNIQUE INDEX movies_tmdb_id_key ON movies (tmdb_id);
```
Update the schema, regenerate using the private-copy recipe, and make `upsertByTmdbId` `db.movie.upsert({ where: { tmdbId }, update: {}, create: { ... } })`. `update: {}` keeps D63's "never refresh a cached title", and a slug never changes.

- [ ] **Step 4: Run it and confirm PASS.** Also run `film-ingest.test.ts`: its `Promise.all([ensureFilm, ensureFilm])` case is now guaranteed by the index, not by luck. Add to `award-import.test.mjs` a case where an INSERT for an existing `tmdb_id` returns the existing id.

- [ ] **Step 5: Apply M2 to all three databases and verify**

```bash
for P in 5432 5433 5434; do
  U=postgresql://cinemadraft:local@localhost:$P/cinemadraft
  DATABASE_URL=$U npx prisma migrate deploy
  /opt/homebrew/opt/libpq/bin/psql $U -Atc "select count(*), count(distinct tmdb_id) from movies where tmdb_id is not null"
done
```
Expected on 5433/5434: `1347|1347`. 5432 may differ if the owner has ingested films, but the two numbers must be equal.

- [ ] **Step 6: The restored-data test** (add it to `vitest.ci.config.mts`'s exclusion list, with the comment "reads the eight merged pairs in the restored movies table")

`movie-merge.production.test.ts` asserts:
  - no repeated non-null `tmdb_id`;
  - 1,347 non-`e2e-` movies;
  - zero orphaned `movie_id` in each of the six tables (a `left join movies … where movies.id is null` count per table);
  - nominations **4,559**, winners, draft_picks, lists and reviews equal to their pre-merge counts. Take those numbers from a fresh `npm run agent:up` port **before** it migrates, and write them into the test as literals with that provenance in a comment.
  - For each of the 8 `tmdb_id`s in the proposal's table, exactly one row, with the lower of the two original ids.

- [ ] **Step 7: The counts that moved.** Update `lib/db.test.ts`, `agent-baseline.sh`, `agent-up.sh` and AGENTS.md from 1355 to 1347, as above.

Then run `scoring.differential.test.ts` and `scoring.production.test.ts` on the executor. If they go red on the four pairs that carry nominations:
  - add a **derived** deviation. The fixture's film figures for an id absent from `movies` fold into the one surviving row with the same `tmdb_id`;
  - the test then asserts the keeper's figure equals the **sum** of both fixture figures;
  - never hand-list the pairs.

Mutation-check the derivation: point it at the wrong keeper and watch it go red.

- [ ] **Step 8: Cutover plan and restore script**
  - T3b table row: `| 20260928120000_movie_merge | merge_duplicate_movies(), run once; movies.tmdb_id unique (D132). Changes row counts: see C7 |`.
  - C5 facts:
    ```sql
    ('movies_tmdb_id_key unique', exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'movies_tmdb_id_key' and indexdef like 'CREATE UNIQUE INDEX%')),
    ('no duplicate tmdb_id', not exists (select 1 from movies where tmdb_id is not null group by tmdb_id having count(*) > 1)),
    ('no orphaned movie_id', not exists (select 1 from nominations n left join movies m on m.id = n.movie_id where m.id is null
       union all select 1 from draft_picks p left join movies m on m.id = p.movie_id where m.id is null)),
    ```
  - **C7 must predict the merge.** Today it expects post-migration counts to equal the dump's, and the merge deletes rows by design. Between step 3/6 (normalize, C4) and step 4/6 (migrate), capture the prediction with the function's own rules:
    ```bash
    CURRENT="predicting the movie merge (C7)"
    read -r MERGE_MOVIES MERGE_WATCH MERGE_REVIEWS MERGE_LISTS < <(q -F ' ' <<'SQL'
    with l as (select id loser, keeper from (select id, min(id) over (partition by tmdb_id) keeper
                 from movies where tmdb_id is not null) r where id <> keeper),
         k as (select distinct keeper from l)
    select (select count(*) from l),
      (select count(*) - count(distinct (w.user_id, coalesce(l.keeper, w.movie_id))) from watchlists w
         left join l on l.loser = w.movie_id where coalesce(l.keeper, w.movie_id) in (select keeper from k)),
      (select count(*) - count(distinct (r.user_id, coalesce(l.keeper, r.movie_id))) from reviews r
         left join l on l.loser = r.movie_id where coalesce(l.keeper, r.movie_id) in (select keeper from k)),
      (select count(*) - count(distinct (x.user_id, x.year, coalesce(l.keeper, x.movie_id))) from lists x
         left join l on l.loser = x.movie_id where coalesce(l.keeper, x.movie_id) in (select keeper from k))
    SQL
    )
    say "   merge will remove movies $MERGE_MOVIES, watchlists $MERGE_WATCH, reviews $MERGE_REVIEWS, lists $MERGE_LISTS"
    ```
    C7's `folded_counts` then compares against an expected file with those four tables reduced by the predicted amounts (an `awk` over `$EXPECTED`). Tables the P16 migrations *create* (`event_dates`, from P16.T18) are added to `norm`'s `grep -v` list and checked by C5 instead.
  - Mutation-test C7 twice against a scratch `agent:up` port:
    - comment out `SELECT merge_duplicate_movies();` in the migration. The prediction no longer holds, and C7 goes red on `movies`.
    - with the migration intact, the restore is GREEN with 8 / 13 / 0 / 0 printed.
  - In the cutover plan's § What a full restore wipes, add a line under **Data**: "`movies` and `watchlists` shrink by the merge; C7 predicts it."

- [ ] **Step 9: 🔴 Mutation**
  - Delete the `IF EXISTS … RAISE` block. Expect red at "refuses when both copies are drafted".
  - Change `min(id)` to `max(id)`. Expect red at "keeps the older row".
  - Restore both.

- [ ] **Step 10: Record D132, tick the P16 duplicate-rows note in PROGRESS as fixed, and commit**

`git commit -m "fix(films): merge duplicate film rows into the oldest, and make tmdb_id unique (P16.T8)"`

---

### Task P16.T9: Film slugs (M3), the route, and the permanent redirect

**Files:**
- Create: `prisma/migrations/20260928130000_movie_slugs/migration.sql` (the prototype's section 3, with the change below), `lib/utils/film-href.ts` (the prototype's `lib/utils/slug.ts`, renamed so it reads as what it is)
- Rename: `app/(app)/films/[tmdbId]/` → `app/(app)/films/[film]/` (`page.tsx`, `opengraph-image.tsx`)
- Modify: `prisma/schema.prisma` (`slug String? @unique(map: "movies_slug_key") @db.VarChar(160)`), `lib/repositories/movies.ts` (`slug` in `Movie`; `findByTmdbId` returns it; add `findBySlug(slug)`), `lib/services/film.ts` (`resolveFilmSegment`), `lib/seo.ts`, `app/sitemap.ts`, `test/route-protection.ts`, `test/route-protection.test.ts`, `e2e/route-protection.spec.ts` (`'[film]': '999999999'`, `NOT_REQUESTABLE`), `scripts/sweep-deployed.mjs`
- Modify: cutover T3b table and `restore-from-heroku.sh` C5
- Test: `lib/utils/film-href.test.ts` (pure, CI), `lib/repositories/movie-slugs.test.ts` (DB, CI), `lib/repositories/movie-slugs.production.test.ts` (restored, excluded), `lib/services/film.test.ts`, `lib/seo.test.ts`, `app/sitemap.test.ts`, `e2e/films.spec.ts`

**Interfaces:**
- Produces:
  - `isTmdbId(segment: string): boolean`
  - `filmHref(film: { tmdbId: string | null; slug?: string | null }): string`
  - `SLUG_SHAPE = /^[a-z0-9-]{1,160}$/`
  - `resolveFilmSegment(segment: string): Promise<{ tmdbId: string; slug: string | null } | null>`
  - `Movie.slug: string | null`
- 🔴 One change from the prototype: `movie_slug_for` is declared **`VOLATILE`**, not `STABLE`. A STABLE function reads the snapshot taken at the start of the calling statement. So two rows with one title and year inserted by **one** statement (P16.T11's batched browse insert, e.g. both *Sing* 2016s) would both compute `sing-2016`, and the second would fail the unique index and take the batch with it. The test in step 1 decides whether VOLATILE is enough. If it goes red, P16.T11 inserts one row per statement instead, and T11 notes why.

- [ ] **Step 1: Failing tests**

```ts
// lib/repositories/movie-slugs.test.ts (DB, CI). Every case inserts inside a rolled-back transaction, as in movie-merge.test.ts.
it('gives a new film title-year, whichever writer inserts it', ...);          // app upsert AND award-import's raw INSERT columns
it('adds the TMDB id only on a real clash', ...);                               // 'e2e-slug sing' 2016 twice → base, then base-<tmdb>
it('gives two clashing films distinct slugs when one statement inserts both', ...); // insert … values (a), (b) in ONE statement
it('keeps a digits-only title from reading as an id', ...);                     // title '1917', no release date → '1917-<tmdb>'
it('leaves a title with nothing Latin in it on its numeric address', ...);      // '弟弟' → slug null
it('never changes a slug after a title correction', ...);                       // update title → slug unchanged
```
```ts
// lib/utils/film-href.test.ts: copy the prototype's slug.test.ts, and add:
expect(filmHref({ tmdbId: null, slug: null })).toBe('/films'); // a row with neither never links to /films/null
```

- [ ] **Step 2: Run them and confirm they fail. Write M3 and apply it to all three databases** (loop as in P16.T8 step 5, verifying `select count(*) filter (where slug is null), count(*) from movies`).
Expected on the restored copies: the only nulls are titles with no Latin letter. List them in the commit body.

- [ ] **Step 3: Route.**
  - Take the prototype's `page.tsx` and `opengraph-image.tsx` diffs.
  - `if (resolved.slug && segment !== resolved.slug) permanentRedirect(filmHref(resolved))` comes before any TMDB request.
  - The canonical, the JSON-LD `url` and the sitemap use `filmHref`.
  - The OG route uses `resolveFilmSegment`. Its looser `/^\d+$/` regex goes.
  - Raise `FILM_LIMIT` in `app/sitemap.ts` from 5,000 to 50,000, the protocol maximum. P16.T11 makes the table outgrow 5,000, and `listForSitemap` orders by id, so the cap would silently drop the newest films.

- [ ] **Step 4: Route protection.** Rename the two `PUBLIC_ROUTES` entries and the pin. Keep D63's comment, amended to say a stranger still causes no write on this route (P16.T11 keeps that).

- [ ] **Step 5: e2e (CI data; `test.skip(!hasTmdb)` like the rest of `films.spec.ts`)**
  - Insert `('e2e-slug Arrival', tmdb 329865, release 2016-11-11)`. `GET /films/329865` with `maxRedirects: 0` is **308** to `/films/e2e-slug-arrival-2016`.
  - The slug page is 200. `link[rel=canonical]` ends with the slug, and the JSON-LD `url` does too.
  - `/films/not-a-film-2099` is 404.
  - An unheld numeric id (`496243` on CI) is 200 with no redirect.
  - Delete the row in `afterAll`.

- [ ] **Step 6: The restored-data test** (excluded on CI, with the comment "reads every restored title")
  - Every held film with a Latin title has a unique slug.
  - Both *Sing* 2016s: the lower id has `sing-2016`, the other `sing-2016-<its tmdb id>`.
  - The twenty sample paths in `films-and-season/proposal.md` § Twenty real URL samples resolve exactly. Copy the table into the test as data.

- [ ] **Step 7: Cutover**
  - T3b row: `| 20260928130000_movie_slugs | unaccent; movies.slug, backfilled, unique; insert trigger (D133). Without it every film page 404s by slug and old links stop redirecting |`.
  - C5:
    ```sql
    ('unaccent installed', exists (select 1 from pg_extension where extname = 'unaccent')),
    ('movies_slug_key unique', exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'movies_slug_key' and indexdef like 'CREATE UNIQUE INDEX%')),
    ('movies_assign_slug trigger', exists (select 1 from pg_trigger where tgname = 'movies_assign_slug')),
    ('every Latin title has a slug', not exists (select 1 from movies where slug is null and title ~ '[A-Za-z]')),
    ```
  - Mutation-test C5 by skipping the backfill `DO` block against a scratch port. Expect it red on "every Latin title has a slug".

- [ ] **Step 8: 🔴 Mutation**
  - Make the trigger `BEFORE INSERT OR UPDATE`, recomputing the slug. Expect red at "never changes a slug".
  - Delete the redirect line. Expect the e2e 308 assertion to go red.
  - Restore both.

- [ ] **Step 9: Record D133 and commit**

`git commit -m "feat(films): films are addressed by a frozen title-year slug (P16.T9)"`

---

### Task P16.T10: Every internal link spells the slug

A permanent redirect on every internal click is the failure the proposal warned about, so this task finishes before the tranche gate.

**Files (every hit, from `git grep -n '/films/'`, 2026-09-27):**
- Film links: `app/(app)/films/[film]/page.tsx` (similar films), `app/(app)/page.tsx:338` (In cinemas now), `app/(app)/watchlist/page.tsx:455`, `components/films/BrowseMonth.tsx:61,102`, `components/profile/FeedPost.tsx:93,114`, `components/shell/SearchOverlay.tsx:111`
- Cache refresh: `actions/reviews/save-review.ts:60`, `actions/reviews/delete-review.ts:35`, `actions/watchlist/set-watched.ts:74`. `revalidatePath` must name the slug path *and* the numeric one.
- Types that gain `slug`: `FilmResult` (search), the browse card, the watchlist row, the feed post film, and the similar-films entry. Similar films are TMDB results; they take slugs from one `findManyByTmdbIds` for the seven ids.
- Tests asserting numeric URLs: `app/sitemap.production.test.ts:29,35`, `components/films/BrowseMonth.test.tsx:40,60`, `components/shell/SearchOverlay.test.tsx:45`, `components/profile/FeedPost.test.tsx:73,84`, `lib/seo.test.ts:7,49`, `actions/reviews/review-actions.test.ts:266`, `e2e/browse.spec.ts:331`, `e2e/members.spec.ts:213`, and journeys 03 and 04
- Modify: `scripts/layering.sh`, adding a guard:
  ```bash
  check "film URLs are spelled by filmHref" \
    "git grep -nE '/films/\\\$\\{' -- app components lib actions ':!lib/utils/film-href.ts'"
  ```

**Interfaces:** Consumes `filmHref` (T9).

- [ ] **Step 1: Add the layering guard and watch it go red.** It should list every hit above.
- [ ] **Step 2: Replace each hit, updating its unit test** to expect `filmHref`'s output for a held film (slug) and an unheld one (numeric).
- [ ] **Step 3: e2e.** In `e2e/browse.spec.ts`, a card for a held film links to its slug, and clicking it produces **no** 308 (assert `response.request().redirectedFrom()` is null).
- [ ] **Step 4: 🔴 Mutation.** Reintroduce one raw `` `/films/${film.tmdbId}` `` in `BrowseMonth.tsx`. Expect `npm run layering` red naming that line. Restore.
- [ ] **Step 5: Commit.** `git commit -m "refactor(films): every film link goes through filmHref (P16.T10)"`

---

### Task P16.T11: Store every browse result, measured and bounded

**What it writes (open question 3's default, stated in D134):**

| Surface | When | Who | Write |
|---|---|---|---|
| `/browse` (the page, and `loadBrowsePage` for infinite scroll) | on render | every reader | the films on the page not already held, in one `INSERT … ON CONFLICT (tmdb_id) DO NOTHING` |
| "In cinemas now" on `/` | on render | every reader | the same, for ~20 films |
| `/films/<numeric id>` of an unheld film | on open | **signed-in** reader | `ensureFilm(tmdbId)`, then the 308 to its new slug |
| the same | on open | signed-out reader | **nothing** (D63 kept). It renders from TMDB at its numeric address |
| search results, similar films | never | — | — |

**Why list-render and not view.** The owner's reason is "so every film has a slug". A browse card's `href` is decided when the list renders, so a film first stored when it is opened would be linked by number and redirect on every first click (P16.T10's failure). Writing on render is the honest reading.

**The bound** is the discover filters, not the reader count:
- The past side needs `vote_count ≥ 200` and popularity above 10, across ≤ 500 months. The future side needs popularity above 5.
- A crawler walking every browse page can therefore store at most that universe. Step 1 measures it.
- A crawler walking arbitrary `/films/<id>` stores nothing, because that path stays write-free for strangers.

**Files:**
- Modify: `lib/repositories/movies.ts` (add `ingestListed`), `lib/services/browse.ts` (`loadBrowse`), `lib/services/dashboard.ts:40,144` (the now-playing shelf), `app/(app)/films/[film]/page.tsx` (signed-in ingest), `lib/db.test.ts` (movie count by `created_at` cutoff), `scripts/agent-baseline.sh` and `scripts/agent-up.sh` (the same cutoff), `e2e/award-shows.spec.ts:27` (`UNCACHED` must be a film browse can never surface)
- Test: `lib/services/browse.test.ts` (DB, CI), `lib/services/film.test.ts` (DB, CI), `lib/repositories/movies.test.ts`

**Interfaces:**
- Produces: `movieRepository.ingestListed(films: readonly { tmdbId: string; title: string; poster: string | null; backdrop: string | null; releaseDate: Date | null }[]): Promise<Map<string, string | null>>`. It returns tmdbId → slug for **every** film passed in: one `SELECT` for the held ones, and one `INSERT … RETURNING tmdb_id, slug` for the missing ones only (skipped when none are missing).

- [ ] **Step 1: Measure the universe and write the numbers into D134 before writing code**
  - With `TMDB_API_KEY` set, write a throwaway Vitest file that calls `discoverFilms({ when: 'past', page })` for every 20th page from 1 to 500, and for `'future'` pages 1–12. Record the films per month and extrapolate the total.
  - Delete the file afterwards; it is never committed.
  - Record in D134: films per sampled month, the extrapolated total (the explorer's estimate was ~8k–15k), and the measured bytes per row. That is **~950 B** today (`pg_total_relation_size('movies') / count(*)` = 1,256 kB / 1,355 on 5433). Re-measure after M3 adds `slug` and its index.
  - Also record storage at the ceiling: rows × bytes against Neon Free's 512 MB. 15k rows ≈ 15 MB ≈ 3%, against D123's 36 MB baseline.

- [ ] **Step 2: Record the compute arithmetic in D134**
  - Neon bills awake time, not statements (D102, D123), so the insert costs nothing while the database is already awake.
  - 🔴 **The new cost is waking it.** Signed-out `/browse` makes **zero** queries today (`browse.test.ts:136`), so a stranger browsing an idle site never woke Neon. After this change it does: one ~5-minute autosuspend window at the 0.25 CU floor, **0.021 CU-hr per isolated visit**.
  - Against D123's ~5 CU-hr/month baseline and the 100 CU-hr allowance, that leaves ~4,500 isolated browse wakes a month before the tier is at risk. A visit that follows `/` (which already wakes it) costs nothing extra.
  - It also brings the ~3 s cold start (D123) to a stranger's first `/browse` after an idle period. That is accepted in D134 and named, not hidden.
  - **Reopen if** Neon's usage page shows browse wakes above 20 CU-hr in a month.

- [ ] **Step 3: Failing tests**

```ts
// lib/services/browse.test.ts: replace "zero queries for an anonymous reader"
it('stores the films it shows, in two statements, and none on a repeat render', async () => {
  const first = await countQueries(() => loadBrowse({ when: 'past', page: 1, userId: null }));
  expect(first.queries).toBe(2);                    // select held + insert missing
  expect(first.result.months.flatMap((m) => m.films).every((f) => f.slug != null)).toBe(true);
  const again = await countQueries(() => loadBrowse({ when: 'past', page: 1, userId: null }));
  expect(again.queries).toBe(1);                    // everything is held now
});
```
(Stub `discoverFilms` with two `e2e-browse …` films at tmdb `999100001`/`999100002`, as the file already stubs TMDB. Delete the rows in `afterEach`.)
```ts
// lib/services/film.test.ts: keep 'renders, and writes nothing' for a signed-out reader. Add:
it('stores an unheld film a signed-in reader opens, once', ...);   // movie.count +1, and a second open +0
```

- [ ] **Step 4: Run them and confirm they fail. Implement `ingestListed`, and call it from `loadBrowse` and the dashboard shelf.** Thread each returned slug onto the card; `filmHref` does the rest. In the film page, after `resolveFilmSegment` returns `slug: null` for a signed-in reader, call `ensureFilm` and then `permanentRedirect`.

- [ ] **Step 5: Exact counts survive browsing.** Browse now ingests real titles on the executors.
  - `lib/db.test.ts` counts `movies where created_at <= CUTOFF`. `CUTOFF` is `select max(created_at) from movies` on a fresh `npm run agent:up` database, pinned as a literal with that provenance.
  - `agent-baseline.sh` and `agent-up.sh` use the same predicate.
  - `e2e/award-shows.spec.ts` picks an `UNCACHED` film below the past side's `vote_count.gte=200`, so browse can never have stored it, and says so in its comment.

- [ ] **Step 6: Search is unchanged, and this says why.** `WEIGHT.local` (`lib/services/search-ranking.ts:63`) boosts a held film. Once browse holds most notable films, the boost means "is a film TMDB lists as notable", which is still the right thing to rank first when drafting. Run `search.test.ts` and `search-ranking.test.ts` on an executor *after* running `e2e/browse.spec.ts` against it. If the ordering assertions move, restrict those tests' fixture to `created_at <= CUTOFF`, not the ranking. Record which happened in the commit body.

- [ ] **Step 7: 🔴 Mutation**
  - Remove the `ingestListed` call from `loadBrowse`. Expect red at "stores the films it shows".
  - Ingest for a signed-out reader on the film page. Expect red at "renders, and writes nothing".
  - Restore both.

- [ ] **Step 8: Record D134 (amends D63 and D56; quote both) and commit**

`git commit -m "feat(films): browse stores what it shows, so every film it lists has a slug (P16.T11)"`

---

### Task P16.T12: Tranche 2 gate

- [ ] **Step 1:** Run § The tranche gate (CI shape, every spec), then the full suites on the executor.
- [ ] **Step 2:** Run `scripts/restore-from-heroku.sh .local/baseline.dump <scratch agent:up URL> --yes` end to end. It must be GREEN, printing the merge prediction 8/13/0/0 (step 8 of T8), the C5 lines for M2 and M3, and C7.
- [ ] **Step 3: Production-build browser pass**
  - `/films/313369` redirects to `/films/la-la-land-2016`. Check that every link on `/browse` page 1, `/watchlist` and a member page is a slug, with no 308s in the network log.
  - At 1440 and 390, light and dark.
- [ ] **Step 4:** PROGRESS: tick T8–T12 and record the counts. `git commit -m "docs: P16 tranche 2 gate"`

---
# Tranche 3 — The season view on `/award-shows`

Two services come first, because tranches 3–6 all read them. Both are pure at their core and tested on synthetic rows, so they run on CI.

### Task P16.T13: `moments` — a season's scoring moments, in order

**Files:**
- Create: `lib/services/moments.ts`, `lib/services/moments.test.ts` (pure, CI)
- Modify: `lib/repositories/nominations.ts`, `lib/repositories/winners.ts` (add `countByEventForYear(year): Promise<Map<number, number>>`, one grouped query each, joined through `awards.event_id`)

**Interfaces:**
- Consumes: `Event.hasCeremony` (T1), `inSeason` and `seasonOffset` (T2).
- Produces:
```ts
export type Moment = {
  key: string;                         // `${eventId}-nominations` | `${eventId}-ceremony`, the rail's keys
  eventId: number; abbreviation: string; name: string;
  phase: 'nominations' | 'ceremony';
  /** This season's date (epoch ms), or null: unscheduled, or a past season with no stored dates. */
  date: number | null;
  /** Sort key: `seasonOffset` of `date`, or of the calendar's current date for this show when undated. */
  order: number;
  /** Data, not the clock: finished once its rows exist; live while `awards_active`. */
  state: 'upcoming' | 'live' | 'finished';
  nominations: number; winners: number;
};
export function toMoments(input: {
  events: readonly Pick<Event, 'id' | 'abbreviation' | 'name' | 'hasCeremony' | 'nomDate' | 'awardsDate' | 'awardsActive'>[];
  year: number;
  nominations: ReadonlyMap<number, number>;   // eventId → count, this year
  winners: ReadonlyMap<number, number>;
  datesForYear?: ReadonlyMap<number, { nomDate: number | null; awardsDate: number | null }>; // P16.T18
}): Moment[];
export async function getSeasonMoments(year: number): Promise<Moment[]>; // 3 queries: events, two counts
```

**Rules, each a test:**
- A show with `hasCeremony: false` has one moment.
- `date` comes from `datesForYear` when that has the show. Otherwise it is `events.nomDate`/`awardsDate` **only if** `inSeason(date, year)`. Otherwise it is null.
- `order` uses `seasonOffset(date)` when dated, and otherwise `seasonOffset` of the event's current column (whatever year it holds). That puts a past season, which has no dates, in this year's calendar order. An event with no date anywhere sorts last.
- `state`:
  - nominations moments are `finished` when `nominations > 0`;
  - ceremony moments are `live` when `awardsActive` and the year is the one being viewed, and `finished` when `winners > 0 && !awardsActive`;
  - anything else is `upcoming`.
- Sorting is by `order`, then nominations before ceremony, then name.

- [ ] **Step 1: Write the tests above**, plus: "a 2019 season with no dates is in this year's order" (events dated 2026, `year: 2019`, `datesForYear` empty → every `date` null, order equals 2026's order), and "an entered ceremony is finished though its date is in the future" (late entry is data-driven, as the proposal's risk note asked).
- [ ] **Step 2: Run them and confirm they fail. Implement. Run and confirm PASS.**
- [ ] **Step 3: 🔴 Mutation.** Make `state` date-based (`date < now`). Expect red at "a 2019 season with no dates" (no moment would ever finish). Restore.
- [ ] **Step 4: Commit.** `git commit -m "feat(season): a season's scoring moments, ordered and finished by data (P16.T13)"`

---

### Task P16.T14: `season-ledger` — every seat's points per moment, and the standings after each

**Files:**
- Create: `lib/services/season-ledger.ts`, `lib/services/season-ledger.test.ts` (pure, CI), `lib/services/season-ledger.production.test.ts` (restored, excluded: "reads league 1's 2025 and 2026 boards")
- Reference: `git show 'agent/p16-season:app/(app)/p16-mock/_lib.ts'` (`getSeatRows`, `standingsByPhase`, `filmsAt`). Copy the arithmetic. Replace its local sort and `denseRank` with `rankSeats`.

**Interfaces:**
- Consumes: `Seat` from `getLeagueBoard` (`lib/services/draft.ts`), `Moment` (T13), `rankSeats` (`lib/utils/rank.ts`).
- Produces:
```ts
export type SeatSeason = {
  draftId: number; userId: number | null; uuid: string | null; name: string; isDummy: boolean;
  /** moment.key → points earned at that moment. */
  byMoment: ReadonlyMap<string, number>;
  /** abbreviation → { nom, win }. nom = Σ line.points; win = Σ (line.won ? line.points : 0). */
  byShow: ReadonlyMap<string, { nom: number; win: number }>;
  total: number;                       // === the board's seat.total, asserted
};
export type MomentStep = {
  moment: Moment;
  delta: ReadonlyMap<number, number>;          // draftId → points at this moment
  standings: StandingsRow[];                    // rankSeats over cumulative totals, after it
  moves: ReadonlyMap<number, number>;           // draftId → previous position − new position
  films: { title: string; posterUrl: string | null; points: number; won: number; holders: number }[];
};
export type SeasonLedger = { seats: SeatSeason[]; steps: MomentStep[]; latest: MomentStep | null };
export function buildSeasonLedger(seats: readonly Seat[], moments: readonly Moment[], viewerId: number | null): SeasonLedger;
export async function getSeasonLedger(leagueId: number, year: number, viewerId: number | null): Promise<SeasonLedger>;
```
- `steps` holds one entry per `finished` or `live` moment, in moment order.
- `latest` is the last of them: the live one if there is one, otherwise the latest finished one.
- 🔴 Win points of a show with no ceremony attach to its nominations moment, so a win can never vanish from the sum.

- [ ] **Step 1: Failing tests (synthetic seats and moments)**
  - **The invariant:** for every seat, `Σ over steps of delta === seat.total` and `Σ byShow (nom + win) === seat.total`, on a fixture with a D125 pair (two nominations in one category, one wins → 3P).
  - A tie reuses `rankSeats`'s order: two equal cumulative totals are listed in draft order and share a position.
  - `moves`: a seat passing another reads +1, and the passed seat −1.
  - `films` for a ceremony step lists only the lines that won, and `holders` counts the seats holding the film.
  - An upcoming moment produces no step.
  - A no-ceremony show's stray win is counted on its nominations step.
- [ ] **Step 2: The restored-data test**
  - League 1 2026: `steps.at(-1)!.standings[0]` is Sasha Downey on **1190**. Jacob is on **1130**. This is D125's measured pair.
  - The lead changed 3 times in 2026 and 6 times in 2025, as the proposal measured. Count the changes of `standings[0].draftId` across steps.
- [ ] **Step 3: Run them and confirm they fail. Implement. Run and confirm PASS.**
- [ ] **Step 4: 🔴 Mutation.** Count a won line's `earned` (2P) in `win`. Expect red at the invariant. Restore.
- [ ] **Step 5: Commit.** `git commit -m "feat(ledger): each seat's season by moment, from the board's own ledger (P16.T14)"`

---

### Task P16.T15: The season view replaces the logo grid (signed out first)

**Files:**
- Create: `lib/services/season-view.ts` (+ `season-view.test.ts`, DB, own fixture, CI), `components/awards/SeasonAgenda.tsx`, `components/awards/SeasonUpNext.tsx`, their `.stories.tsx` and `.test.tsx`
- Modify: `app/(app)/award-shows/page.tsx` (replace the `<ul className="grid …">` at lines 85–104; keep the admin "Still to enter" panel and the calendar subscription panel), `components/leagues/SeasonStepper.tsx` or `app/(app)/page.tsx` (the rail's heading becomes a link to `/award-shows`)
- Test: `e2e/award-shows.spec.ts` (new `describe('the season view')`, `TAG = 'e2e-season-view'`, scratch year **2989**)
- Reference: `git show 'agent/p16-season:app/(app)/p16-mock/timeline-a/page.tsx'`

**Interfaces:**
- Consumes: `getSeasonMoments` (T13).
- Produces:
```ts
export type SeasonView = {
  year: number;
  /** True when the active year has nothing yet: the view shows `year` (the finished season) and says dates come in the autumn. */
  offSeason: boolean; activeYear: number;
  months: { label: string; moments: (Moment & { highlight: { title: string; count: number } | null })[] }[];
  next: (Moment & { films: { title: string; slug: string | null; tmdbId: string | null; count: number }[]; more: number }) | null;
};
export async function getSeasonView(requestedYear: number | null): Promise<SeasonView>;
export const UP_NEXT_FILMS = 8;
```

**Rules:**
- **Which year.** `?year=` if it is given and is a season. Otherwise the active year, *unless* it has no dated moment in its window and no nominations. In that case show the previous year with `offSeason: true`, and the line "Dates for the {activeYear} season come in the autumn."
- **A signed-out reader gets a first-class page, not an empty shell:**
  - every moment, grouped by month (a month label, not a machine date);
  - the weekday and day;
  - the show linked to `/award-shows/<abbr>?year=`;
  - the phase, and the count ("188 nominations", "24 of 24 decided");
  - a `highlight` on finished moments: the most-nominated film at a nominations moment ("*One Battle After Another*, 9"), and the film with the most wins at a ceremony;
  - an **Up next** panel: the countdown in words ("in 3 days"), and the films most nominated at that show, capped at `UP_NEXT_FILMS` with "and N more".
  - Before nominations are out, Up next names no films and says when they are due.
- Undated moments sit under "Not yet scheduled" at the end.

- [ ] **Step 1: Service tests (DB, own tagged event and nominations in year 2989, CI)**
  - `months` groups by the month of `date`.
  - `next.films.length <= 8` and `more === total − 8`, using a show with 10 nominated films.
  - The off-season rule: a year with no dated moments and no nominations picks the previous year.
- [ ] **Step 2: Component tests.** `SeasonAgenda` renders a `<time dateTime>` per dated moment. "Not yet scheduled" is last. `SeasonUpNext` renders "and 2 more" for 10 films.
- [ ] **Step 3: Implement. Stories:** `SignedOut`, `OffSeason`, `UpNextCapped`, in both schemes.
- [ ] **Step 4: e2e, production build, signed out**
  - `/award-shows?year=2989` lists the tagged show's two moments, and Up next caps at 8 with "and N more".
  - No horizontal scroll at 390 or 1440.
  - The page has no seat name and no league name (grep the HTML for the fixture's seat names: 0 hits). This is D44 rule (b).
  - The rail's heading on `/` links to `/award-shows`.
- [ ] **Step 5: 🔴 Mutation.** Set `UP_NEXT_FILMS` to 20. Expect red at "and N more" in the service test and in the e2e. Restore.
- [ ] **Step 6: Commit.** `git commit -m "feat(awards): the season, in date order, replaces the logo grid (P16.T15)"`

---

### Task P16.T16: Signed in, each finished moment says what it did to you

**Files:**
- Modify: `lib/services/season-view.ts` (add `getSeasonViewer`), `components/awards/SeasonAgenda.tsx`, `components/awards/SeasonUpNext.tsx`, `app/(app)/award-shows/page.tsx`
- Test: `lib/services/season-view.test.ts` (DB, CI), `e2e/award-shows.spec.ts`

**Interfaces:**
- Consumes: `getSeasonLedger` (T14), `draftRepository.findLeagueIdsByUserId`.
- Produces:
```ts
export type SeasonViewer = {
  leagues: { leagueId: number; name: string;
    /** moment.key → { points, position, move } for the reader's seat; finished moments only. */
    byMoment: ReadonlyMap<string, { points: number; position: number; move: number }> }[];
  /** For the next ceremony: the reader's nominations at stake. */
  atStake: { films: { title: string; slug: string | null; tmdbId: string | null; category: string }[]; points: number; more: number } | null;
};
export const MAX_LEAGUES = 5; // ponytail: one board load per league; raise when someone plays in more than five
export async function getSeasonViewer(userId: number, year: number): Promise<SeasonViewer>;
```
- It covers leagues where the reader holds a seat in `year` and the league has ≥ 2 seats, up to `MAX_LEAGUES`, newest league first.
- A row reads: "Racso award +170 · 16th ▼3". The direction is in words for screen readers ("down 3 places").
- **Finished moments only.** A live ceremony shows no per-league line (the owner's rule), and `/live` is linked instead.

- [ ] **Step 1: Failing tests.** Seed a league with the reader and a rival, and a tagged show in 2989 with one nomination on each seat's film.
  - The reader's line at that nominations moment has `points` equal to the nomination's points.
  - Its `position` comes from `rankSeats`.
  - A signed-out call is never made: the page calls `getSeasonViewer` only with a user. Assert this in the page's own test by counting queries for `userId: null`: **0** from this service.
- [ ] **Step 2: Implement.** e2e, signed in as the seeded reader: the line appears, and a second, signed-out context on the same URL has no such line.
- [ ] **Step 3: 🔴 Mutation.** Show lines on live moments too. Expect red at a live-moment case in the service test. Restore.
- [ ] **Step 4: Commit.** `git commit -m "feat(awards): the season view says what each moment did to your leagues (P16.T16)"`

---

### Task P16.T17: Tranche 3 gate

- [ ] **Step 1:** Run § The tranche gate, then the full suites on the executor.
- [ ] **Step 2: Production-build pass** on the executor, which holds real 2026 data. `/award-shows` signed out and signed in (as a league 1 member via test auth), at 1440 and 390, light and dark.
  - The AFI appears once, with no ceremony row.
  - The rail on `/` reads "12 of 12 shows complete" in September 2026.
- [ ] **Step 3:** PROGRESS: tick T13–T17 with the counts. `git commit -m "docs: P16 tranche 3 gate"`

---
# Tranche 4 — The ledger: standings by show, a live "what moved", a page per seat, the race

The league gains tabs: **Board** (`/leagues/[id]`, unchanged), **Standings** (`/leagues/[id]/standings`) and **Race** (`/leagues/[id]/race`). A seat's page, `/leagues/[id]/seats/[draftId]`, opens from any seat name on the Standings and Race tabs. Every one is public and noindexed (§7, D44).

### Task P16.T18: Show dates per season (M4)

**How history is handled (D135).** Seasons 2017–2025 have no stored dates, and no dates are invented for them. `event_dates` starts with 2026, which is backfilled from literal values (the dates held on the restored copy on 2026-09-27, listed below). From 2027 the award-entry skill's `set-dates` writes it.
- For a season with no row for a show, `moments` falls back to `events`' columns only when they fall inside that season's window (T13's rule). Otherwise the moment is undated and ordered by this year's calendar.
- The race chart (T22) uses a **date axis only when every finished moment in the season has a date**, and an **order-only axis otherwise**, with the caption "Dates weren't recorded before 2026, so the moments are in this year's order, evenly spaced."

**Files:**
- Create: `prisma/migrations/20260929090000_event_dates/migration.sql`, `lib/repositories/event-dates.ts` (+ test, DB, CI)
- Modify: `prisma/schema.prisma` (`model EventDate`, `@@map("event_dates")`, `@@unique([year, eventId])`), `lib/services/moments.ts` (`getSeasonMoments` passes `datesForYear`), `scripts/award-import.mjs` (`applyDates` also upserts `event_dates` for the plan's year, in the same transaction), `scripts/award-import.test.mjs`, `.claude/skills/award-entry/SKILL.md` § Dates (one line: dates are now also kept per season)
- Modify: cutover T3b table, `restore-from-heroku.sh` (C5, and `norm`'s exclusion)

**Interfaces:**
- Produces: `eventDateRepository.findByYear(year): Promise<Map<number, { nomDate: number | null; nomTime: number | null; awardsDate: number | null; awardsTime: number | null }>>`, with the epoch-ms bigints normalised to numbers, like `events.ts`.

- [ ] **Step 1: Failing tests**
  - Repository: `findByYear(2026)` on a tagged event returns its row.
  - `findByYear(2025)` is empty.
  - `award-import.test.mjs`: a committed `set-dates` for year Y writes one `event_dates` row per show and updates it on re-run, with no duplicate.

- [ ] **Step 2: M4**

```sql
-- prisma/migrations/20260929090000_event_dates/migration.sql
-- Each show's dates for each season (D135). events.nom_date/awards_date are
-- overwritten every year, so before this nothing said when a past season's
-- moments happened. No FK, like every table here (the schema has none).
CREATE TABLE "event_dates" (
  "id" SERIAL PRIMARY KEY,
  "year" INTEGER NOT NULL,
  "event_id" INTEGER NOT NULL,
  "nom_date" BIGINT, "nom_time" BIGINT,
  "awards_date" BIGINT, "awards_time" BIGINT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "event_dates_year_event_id_key" ON "event_dates" ("year", "event_id");

-- 2026, from literals, NOT copied from events: by the time this runs the
-- skill may already have written 2027's dates into those columns. UTC
-- midnight of each announcement day, epoch ms, as read on 2026-09-27.
INSERT INTO "event_dates" ("year", "event_id", "nom_date", "awards_date")
SELECT 2026, e.id, v.nom, v.awards FROM "events" e JOIN (VALUES
  ('afi',    1764806400000, NULL::bigint),
  ('gg',     1765152000000, 1768089600000),
  ('adg',    1767744000000, 1772236800000),
  ('sag',    1767744000000, 1772323200000),
  ('asc',    1767830400000, 1772928000000),
  ('dga',    1767830400000, 1770422400000),
  ('pga',    1767916800000, 1772236800000),
  ('raz',    1768953600000, 1773446400000),
  ('oscars', 1769040000000, 1773532800000),
  ('bafta',  1769472000000, 1771718400000),
  ('wga',    1769472000000, 1772928000000),
  ('ace',    1769472000000, 1772150400000)
) AS v(abbr, nom, awards) ON e.abbreviation = v.abbr;
```
(The values are 2025-12-04 to 2026-03-15, from `events` on 5433. Before writing the migration, re-read them with `select abbreviation, nom_date, awards_date from events order by nom_date`, and confirm each is inside `inSeason(…, 2026)`.)

- [ ] **Step 3: Apply M4 to all three databases**, verifying `select count(*) from event_dates where year = 2026` (**12** on each). Regenerate with the private-copy recipe.
- [ ] **Step 4: Implement the repository, the `moments` wiring and the script. Run and confirm PASS.**
- [ ] **Step 5: Cutover**
  - T3b row: `| 20260929090000_event_dates | event_dates, with 2026 backfilled (D135). Without it every past season's race is undated, and 2026 is too |`.
  - C5:
    ```sql
    ('event_dates 2026', coalesce((select count(*) = 12 from event_dates where year = 2026), false)),
    ```
  - Add `-e '^event_dates'` to `norm`'s `grep -v`: the dump has no such table, so C3/C7 would read it as a stray.
  - Mutation-test by dropping the INSERT against a scratch port. Expect C5 red on "event_dates 2026".
- [ ] **Step 6: 🔴 Mutation.** Make `getSeasonMoments` ignore `datesForYear`. Expect red at a `moments.test.ts` case added here: "a stored 2025 date wins over the events columns".
- [ ] **Step 7: Record D135 and commit.** `git commit -m "feat(season): keep each show's dates per season (P16.T18)"`

---

### Task P16.T19: The Standings tab, led by "what moved"

**Files:**
- Create: `app/(app)/leagues/[id]/standings/page.tsx`, `components/leagues/LeagueTabs.tsx`, `components/leagues/WhatMoved.tsx`, `components/leagues/StandingsByShow.tsx`, each with a `.stories.tsx` and `.test.tsx`
- Modify: `app/(app)/leagues/[id]/page.tsx` (render `LeagueTabs`; hidden in TV mode), `test/route-protection.ts`, `test/route-protection.test.ts`
- Test: `e2e/league-ledger.spec.ts` (new, `TAG = 'e2e-ledger'`, scratch year **2990**)
- Reference: `git show 'agent/p16-season:app/(app)/p16-mock/ledger-b/page.tsx'`

**Interfaces:**
- Consumes: `getSeasonLedger` (T14).
- Produces:
  - `LeagueTabs({ leagueId, year, current }: { leagueId: number; year: number; current: 'board' | 'standings' | 'race' })`. It follows `/watchlist`'s view-nav pattern: `Link` with `aria-current="page"` inside `<nav aria-label="League views">`, with `?year=` carried.
  - `WhatMoved({ step, live }: { step: MomentStep; live: boolean })`
  - `StandingsByShow({ seats, steps, shows, leagueId, year })`
  - `getStandingsView(leagueId: number, year: number, viewerId: number | null): Promise<StandingsView>` in `lib/services/season-ledger.ts`. It is shared by the page and T20's stream, so the two cannot disagree (the reason `league-view.ts` exists).

**What it shows:**
- **What moved** is always shown. It covers `ledger.latest` and is dated: "Oscars · ceremony · Sun 15 Mar". An undated past moment reads "Oscars · ceremony · 2025". While live it reads "Oscars · ceremony · live · 14 of 24 decided".
  - a leader sentence: "Sasha Downey keeps the lead" or "X takes the lead from Y";
  - the three biggest gains;
  - who changed places, with ▲▼ plus words;
  - the films that did it ("*One Battle After Another*, won 6, +85, 4 seats"). "Won" in brass (D99); nominations as plain text, not pills (D73).
- **Standings by show:** a `<table>` of seats × shows, each cell `nom + win`, then last gain, move and total. The total is `seat.total`, never re-summed (asserted). Below `lg` it becomes a list of rank, name, last gain, move and total, with the per-show split behind a `<details>`.
- Seat names link to `/leagues/[id]/seats/[draftId]` (T21). Until T21 lands, they link to `/members/[uuid]` as the board does, and T21 changes the href.
- An empty season (no finished moment) shows `EmptyState` ("Nothing has scored yet. Nominations start {first moment date}.").

- [ ] **Step 1: Component tests**
  - **It renders the total it is given, never a re-sum.** Build a fixture seat whose cells sum to 100 but whose `total` is 105. Real data can never produce this, and that is the point: it tells a re-sum from a pass-through. Expect 105. That the cells add up to the total is `buildSeasonLedger`'s invariant (T14), tested there.
  - `WhatMoved` renders "takes the lead from" when `standings[0]` changed.
  - Moves are announced in words.
- [ ] **Step 2: Page.** Public; `generateMetadata` returns `robots: NOINDEX`; `notFound()` on an unknown league. Add `/leagues/[id]/standings` to `PUBLIC_ROUTES` and the pin.
- [ ] **Step 3: Stories:** `WhatMoved/{KeepsLead, TakesLead, Live, UndatedPastSeason}`, `StandingsByShow/{SixteenSeats, Narrow}`.
- [ ] **Step 4: e2e (CI data)**
  - Seed a league with 3 seats in 2990, a tagged show with nominations and one winner, and `event_dates` for 2990.
  - Signed out, `/leagues/<id>/standings?year=2990` shows the What moved heading with the date.
  - The table's totals equal the board's totals (read both pages).
  - No horizontal scroll at 1440 or 390.
  - The tab nav marks Standings `aria-current`.
- [ ] **Step 5: 🔴 Mutation.**
  - (a) Render the total as `Σ cells` in the component. Expect red at "renders the total it is given". The e2e's standings-equals-board check **cannot** catch this on real data, where the two agree by construction, so it is a regression line and not this mutation's target. Say so in the commit.
  - (b) Make `WhatMoved` read `steps[0]` in place of `latest`. Expect the heading-date e2e red.
  - Restore both.
- [ ] **Step 6: Commit.** `git commit -m "feat(leagues): a Standings tab, by show, led by what moved (P16.T19)"`

---

### Task P16.T20: "What moved" moves while a ceremony is being entered

**Files:**
- Create: `app/api/leagues/[id]/standings/stream/route.ts` (+ `route.test.ts`), `components/leagues/StandingsRoom.tsx` (+ `.test.tsx`)
- Modify: `app/(app)/leagues/[id]/standings/page.tsx` (render `StandingsRoom` around `WhatMoved` and `StandingsByShow`), `test/route-protection.ts` + pin
- Test: `e2e/league-ledger.spec.ts` (a live case)

This is a **third copy of the D110 route and the D111 client, on purpose.** The two existing ones are small and each is proven by its own mutations. A shared helper is a refactor with its own risk, and it is not needed to ship this. Copy `app/api/leagues/[id]/board/stream/route.ts` and `components/leagues/LeagueBoardRoom.tsx`'s effect verbatim, then change only what is listed:

| | Board stream (D116) | Standings stream (D136) |
|---|---|---|
| frame | `getLeagueBoardView` | `getStandingsView(leagueId, year, user?.id ?? null)` |
| 204 unless | `view.isDrafting` | `view.onAir`, meaning some event has `awards_active` **and** `year === await getActiveYear()` |
| client never opens when | `!initial.isDrafting` | `!initial.onAir` |
| client closes when a frame says | `!next.isDrafting` | `!next.onAir` |

Everything else is unchanged: `runtime = 'nodejs'`, `maxDuration = 60` (layering guard), 2s poll, write on change, a heartbeat after 10 quiet polls, self-close at 50s, the whole state in every frame, no `id:`, and the three stop conditions (off air, hidden at mount, `visibilitychange`). `StandingsView` carries `onAir: boolean`.

**Cost (in D136).**
- It streams only while a show is on air, which is the ceremony nights. Neon is already awake then for `/live` and the admin's entry, so each extra viewer costs a connection, not awake time. The measured ceremony budget is 0.75–6 CU-hr (D123).
- It never streams in the months between ceremonies, the case D116 refused to widen for. A forgotten tab closes on hidden (D111), and a finished show answers 204, which the browser does not retry.
- **Reopen if** Neon's usage on a ceremony night exceeds the D123 ceiling.

- [ ] **Step 1: Route tests (copy the board route's)**
  - 204 when no event is `awards_active`.
  - 204 for a past `year` even while a show is on air.
  - The first frame equals `getStandingsView`'s output for the same parameters (the "stream is exactly as generous as the page" rule, D110).
  - It self-closes at `LIFETIME_MS`.
  - Timers are cleared on abort.
- [ ] **Step 2: Client tests (copy `LeagueBoardRoom.test.tsx`'s stop-condition cases)**
  - No `EventSource` when `initial.onAir` is false.
  - None when `document.hidden` at mount.
  - It closes on hidden and reopens on visible.
  - It closes on a frame with `onAir: false`.
  - A `CLOSED` `readyState` is final.
- [ ] **Step 3: Implement. Add `/api/leagues/[id]/standings/stream` to `PUBLIC_ROUTES` and the pin.** The matcher includes `/(api|trpc)(.*)`, so without the entry a stranger's `EventSource` is bounced.
- [ ] **Step 4: e2e (two contexts; copy `league-board-live.spec.ts`'s scaffolding with its own `TAG`/`YEAR`)**
  - Seed in the **active year** (CI's 2026) a tagged show with `awards_active = true` and a tagged league whose seats hold the nominated films.
  - A signed-out viewer opens `/leagues/<id>/standings`. Plant `window.__token`.
  - Insert a winner row via SQL. Within 20s, What moved reads the new leader or gain.
  - `window.__token` is still there, and the `load` event count is unchanged, so there was no navigation.
  - Budget case: with `awards_active = false`, the page opens **0** requests to the stream path.
  - `finally` sets `awards_active = false` and deletes by `TAG`.
- [ ] **Step 5: 🔴 Mutations (each must go red at its own assertion)**
  - (a) Drop `document.hidden` from `open()`. Expect red at "none when hidden at mount".
  - (b) Make the route's 204 condition `false`. The client guard still keeps the budget e2e green, so assert the route's 204 in `route.test.ts`, which must go red. This is D116's lesson: two guards, each with its own test.
  - (c) Drop the `year === activeYear` half. Expect red at "204 for a past year".
  - Restore all.
- [ ] **Step 6: Record D136 and commit.** `git commit -m "feat(leagues): what moved updates live while a ceremony is entered (P16.T20)"`

---

### Task P16.T21: A seat's season, on its own page

**Files:**
- Create: `app/(app)/leagues/[id]/seats/[draftId]/page.tsx`, `components/leagues/SeatSeason.tsx` (+ story + test)
- Modify: `components/leagues/StandingsByShow.tsx` (seat links), `test/route-protection.ts` + pin, `e2e/route-protection.spec.ts` (`SAMPLES['[draftId]'] = '999999'`)
- Test: `e2e/league-ledger.spec.ts`
- Reference: `git show 'agent/p16-season:app/(app)/p16-mock/ledger-a/page.tsx'`

**Interfaces:**
- Consumes: `getSeasonLedger` (T14), `PointsLedger` (`components/awards/PointsLedger.tsx`).
- Produces: `SeatSeason({ seat, picks, shows, seats, leagueId }: { … })`.
  - It shows picks in draft order down the side and shows in date order across the top, with "won" in brass and a footer of per-show totals.
  - Each film's total opens the shipped `PointsLedger`.
  - A native `<select>` in a GET form switches seats (no JS).
  - Below `lg`, one card per film lists only the shows it scored at.

**Rules:**
- The page 404s when `draftId` is not a seat of league `id`. A `draftId` fixes the season, so there is no `?year=`.
- Public and noindexed.
- The footer's grand total is `seat.total`.

- [ ] **Step 1: Failing tests**
  - Component: the footer's per-show totals sum to the seat total (on `buildSeasonLedger`'s output, per T19's lesson).
  - Page: a seat of another league is a 404.
  - e2e: a seat name on Standings opens the seat page; the switcher's GET lands on another seat; the page is readable signed out; no horizontal scroll at 390.
- [ ] **Step 2: Implement. Stories:** `Wide`, `Narrow`, `NoPoints`.
- [ ] **Step 3: 🔴 Mutation.** Drop the league check in the page. Expect red at the 404 case. Restore.
- [ ] **Step 4: Commit.** `git commit -m "feat(leagues): a linkable page for each seat's season (P16.T21)"`

---

### Task P16.T22: The Race tab

**Files:**
- Create: `app/(app)/leagues/[id]/race/page.tsx`, `lib/services/race.ts` (+ `race.test.ts`, pure, CI), `components/leagues/RaceChart.tsx` (+ story + test)
- Modify: `components/leagues/LeagueTabs.tsx` (enable Race), `test/route-protection.ts` + pin
- Test: `e2e/league-ledger.spec.ts`
- Reference: `git show 'agent/p16-season:app/(app)/p16-mock/ledger-c/page.tsx'`

**Interfaces:**
- Consumes: `SeasonLedger` (T14).
- Produces:
```ts
export type RaceAxis = 'date' | 'order';
export type Race = {
  axis: RaceAxis;                                  // 'date' iff every step's moment has a date (D135)
  x: number[];                                     // per step: the date, or the step index
  lines: { draftId: number; name: string; points: number[]; isLeader: boolean; isViewer: boolean }[];
  leadChanges: { stepIndex: number; from: string; to: string; moment: Moment }[];
  biggest: { draftId: number; name: string; points: number; moment: Moment }[]; // top 3 single-moment gains
};
export function toRace(ledger: SeasonLedger): Race;
```
- `RaceChart` is hand-drawn SVG. No chart library: none is installed, and none may be added.
  - One thin line per seat in the rule colour; the leader in primary ink; the reader in beam.
  - Ticks labelled by month (date axis) or by show (order axis).
  - Tokens only, so layering's hex guard holds.
- **The same data as a `<table>`** follows the chart: seats × steps, cumulative. The chart is `aria-hidden` and the table carries it.
- Below the chart: lead changes as sentences ("Robert Bernard takes the lead from Jon Bernard · Oscar nominations"), then the biggest moments.
- On the order axis, the caption is D135's sentence.

- [ ] **Step 1: Failing pure tests**
  - `axis` is `'order'` when one step is undated, and `'date'` when all are dated.
  - `leadChanges` counts a change only when `standings[0].draftId` differs from the previous step's. A tie at the top that `rankSeats` orders by draft order is not a change.
  - The last point of each line equals the seat's total.
- [ ] **Step 2: Component test.** The table has one row per seat, and its last column equals the totals. The SVG has one `path` per seat.
- [ ] **Step 3: Implement. Stories:** `DatedSeason` (2026-shaped), `OrderOnlyPastSeason` (2025-shaped, 6 lead changes), `FlatSeason`.
- [ ] **Step 4: e2e.**
  - The 2990 fixture with `event_dates` shows the date axis and no caption.
  - A second fixture year **2988** with no `event_dates` shows the caption.
  - Both are signed out, at 1440 and 390, with no horizontal scroll.
- [ ] **Step 5: 🔴 Mutation.** Make `axis` `'date'` when *any* step is dated. Expect red at the one-undated case. Restore.
- [ ] **Step 6: Commit.** `git commit -m "feat(leagues): a Race tab, dated where the dates exist (P16.T22)"`

---

### Task P16.T23: Tranche 4 gate

- [ ] **Step 1:** Run § The tranche gate, then the full suites on the executor.
- [ ] **Step 2: Production-build pass on the executor**
  - League 1: Standings, Race and a seat page for 2026 (dated) and 2025 (order axis, 6 lead changes), at 1440 and 390, light and dark.
  - Check the 16-column table at 1440 fits the panel (`scrollWidth === clientWidth`), as the proposal's width risk requires.
- [ ] **Step 3: Live, by hand, once.**
  - On the executor, set a scratch show `awards_active` and enter a winner through the admin UI while `/leagues/1/standings` is open in a second window. It moves with no reload.
  - Hide the tab, and the network panel shows the stream end.
  - Put it back.
- [ ] **Step 4:** PROGRESS: tick T18–T23 with the counts. `git commit -m "docs: P16 tranche 4 gate"`

---
# Tranche 5 — Head-to-head (B's standings, C's visuals), public

### Task P16.T24: "Compare" on every standings row

**Files:**
- Create: `lib/services/head-to-head.ts` (+ `head-to-head.test.ts`, pure, CI), `components/leagues/HeadToHead.tsx` (+ story + test)
- Modify: `lib/utils/rank.ts` (`StandingsRow` gains `draftId: number`; `rankSeats` already receives it), `components/leagues/StandingsPanel.tsx` (optional `compareHref?: (row: StandingsRow) => string | null`; only the league page passes it; `/live` and the dashboard stay as they are), `components/leagues/LeagueBoardRoom.tsx` (the roster slot renders `HeadToHead` when given one), `app/(app)/leagues/[id]/page.tsx` (read `?vs=`; add `vs` to `pageUrl`'s known parameters, **dropped in TV mode**)
- Test: `e2e/head-to-head.spec.ts` (new, `TAG = 'e2e-h2h'`, scratch year **2987**)
- Reference: `git show agent/p16-league:lib/services/head-to-head.ts` and `git show agent/p16-league:components/leagues/HeadToHead.tsx` (option C's `Race` is the visual)

**Interfaces:**
- Consumes: `Seat[]` from the page's existing `getLeagueBoard` load. No new query.
- Produces:
```ts
export type H2HFilm = { title: string; slug: string | null; tmdbId: string | null; posterUrl: string | null;
  points: number; status: 'none' | 'nominated' | 'won'; roundA: number | null; roundB: number | null };
export type HeadToHead = {
  a: H2HSide; b: H2HSide;             // H2HSide = { draftId, name, uuid, isDummy, group, total, position, isViewer }
  sameGroup: boolean;
  shared: H2HFilm[]; onlyA: H2HFilm[]; onlyB: H2HFilm[];
  sharedPoints: number; uniqueA: number; uniqueB: number;
  margin: number;                      // a.total − b.total === uniqueA − uniqueB, asserted
  /** C's "films that make the gap": the four unique films, both sides, by points. */
  gap: H2HFilm[];
};
export function compareSeats(seats: readonly (Seat & { group: number })[], viewerId: number | null, vs: number | null): HeadToHead | null;
export function seatAbove(standings: readonly StandingsRow[], draftId: number): number | null; // the seat directly above, or below for the leader
```
- **Who is `a`:** the reader's seat if they hold one this season. Otherwise, which includes every follower, the leader. If `vs` *is* `a`, then `b` is the next seat by position.
- **`vs`** must be a `draftId` in this league and season. Anything else is ignored, and the page renders as if absent (no 404, following the watchlist's R11 rule for an unknown view).
- **Same group:** `shared` is empty by construction (measured: 0 duplicates in 1,020 picks), and the component says "Same group, so no film is on both teams" rather than showing an empty band.
- Dummy and character seats compare like anyone else (§6).
- **Positions** come from `rankSeats`, so they are league-wide (§6). The member's "Your roster" line (open question 4's default) uses `seatAbove`.

**Visual (C's):**
- The headline: "25 behind Micah Baird", or "Leads Micah Baird by 25".
- One split bar: A-only | shared | B-only, widths in proportion, with each segment's points in text beside it (the colour is not the only carrier).
- One sentence: "415 of James's 810 points are films Micah also holds. The gap is the other five picks each."
- The four `gap` posters (`PosterFrame`).
- Everything else is a list, not posters, for the 390 layout.

- [ ] **Step 1: Failing pure tests**
  - `margin === uniqueA − uniqueB` on a cross-group fixture with two shared films.
  - **The "cancels out" pin:** for every film held by more than one seat in a board, `points` is identical for every holder. Assert it over the fixture *and* over every pick of the restored league 1 boards in a `.production.test.ts` (excluded on CI). A per-seat multiplier would break the feature silently; this is what catches it (league-views proposal, Risks).
  - Same-group pair: `shared` is empty and `sameGroup` is true.
  - No reader: `a` is the leader.
  - `vs` equals the leader for a follower: `b` is second.
  - An unknown `vs` returns the default pair.
  - `seatAbove` for the leader returns the second seat.
- [ ] **Step 2: Implement.** `StandingsRow.draftId` is added, and `rankSeats`' existing tests stay green (it is a new field). A row's Compare link is `pageUrl({ vs: row.draftId })`, omitted on the reader's own row and in TV mode.
- [ ] **Step 3: Stories:** `CrossGroup`, `SameGroup`, `Leader`, `Narrow`, in both schemes.
- [ ] **Step 4: e2e (CI data)**
  - Seed four seats in two groups with one film shared across groups.
  - A signed-out context clicks Compare on row 3 and the URL gains `?vs=`. The headline names both seats; the split bar's text sums to both totals; the served HTML contains `noindex`.
  - A signed-in seated member's Compare shows *their* seat as `a`.
  - `?tv=1&vs=…` renders no comparison.
  - No horizontal scroll at 390.
- [ ] **Step 5: 🔴 Mutation.**
  - Give one holder of a shared film different points in the fixture. Expect the "cancels out" pin red.
  - Put the reader's seat in `b`. Expect the member e2e red.
  - Restore both.
- [ ] **Step 6: Record D137 (public compare: the owner reversed "members only", 2026-09-27) and commit.** `git commit -m "feat(leagues): compare any seat from the standings (P16.T24)"`

---

### Task P16.T25: Tranche 5 gate

- [ ] **Step 1:** Run § The tranche gate, then the full suites on the executor.
- [ ] **Step 2: Production-build pass:** league 1 2026, James Kinney (9th) against Micah Baird (8th). The sentence reads 415 of 810, as the proposal measured. At 1440 and 390, light and dark.
- [ ] **Step 3:** PROGRESS: tick T24–T25. `git commit -m "docs: P16 tranche 5 gate"`

---

# Tranche 6 — Followers: the signed-out league page, read-only

### Task P16.T26: Audit what a follower is not shown, measured, and close the gap

**Files:**
- Create: `e2e/followers.spec.ts` (`TAG = 'e2e-followers'`, reuses the 2987 fixture shape), `.local/p16/followers-audit.md` (the raw measurement; gitignored)
- Modify: whatever the audit finds (expected: `components/leagues/LeagueBoardRoom.tsx`, `components/draft/DraftBoard.tsx`), `docs/PROGRESS.md` (the audit's table)

**Method (measured, not recalled).** On the executor's production build, fetch the served HTML of `/leagues/1`, `/leagues/1/standings`, `/leagues/1/race` and one seat page, in three states:
- (a) signed out;
- (b) signed in as a league 1 member *not* seated in 2026, or seated;
- (c) signed in as an owner.

For each page, extract and diff: seat names, pick titles, point totals, `/members/` links, `PointsLedger` lines, avatar `src` values, and every control (`button`, `a[href*="setup"]`, `a[href*="draft"]`, invite).

**Allowed to differ, and nothing else (D138):**
- owner and member actions (setup, draft console, invite, open season);
- "Your roster" and the "You" marker;
- avatars: initials for a stranger, faces for a member (D100's Gravatar/`MD5(email)` leak; kept);
- the reader's own seat as `a` in compare.

**Everything else must match.** Any other difference found is a gap. Fix it in this task, and list it in the commit.

- [ ] **Step 1: Run the measurement** and write the diff table to `.local/p16/followers-audit.md`. Copy the summary (one row per page, each difference with "allowed: why" or "gap: fixed in <file>") into `docs/PROGRESS.md` under Phase 16.
- [ ] **Step 2: Failing e2e (CI data).** For each league tab, collect seat names, pick titles and totals from a signed-out context and from a seated-member context. Assert the three sets are **equal**. Assert the signed-out page has no `setup`/`draft` links and no invite control.
- [ ] **Step 3: Close each gap.** Run and confirm PASS.
- [ ] **Step 4: 🔴 Mutation.** Hide `PointsLedger` lines when signed out (`signedIn ? lines : []` in `PickCell`). Expect the equality e2e red. Restore.
- [ ] **Step 5: Record D138 and commit.** `git commit -m "feat(leagues): a follower sees what a player sees, read-only (P16.T26)"`

---

### Task P16.T27: The explainer and "race at the top" take the sign-in card's slot

**Files:**
- Create: `components/leagues/FollowerIntro.tsx` (+ story + test)
- Modify: `components/leagues/LeagueBoardRoom.tsx:235-243` (the `!signedIn` branch; also the "You do not hold a seat this season" branch, so a signed-in non-player gets the same, minus "Sign in"), `lib/copy.ts` (reuse `PITCH`; add nothing unless the two sentences need a league-specific form)
- Test: `e2e/followers.spec.ts`
- Reference: `git show 'agent/p16-league:app/(app)/p16-mock/board-link/page.tsx'`

**Interfaces:**
- Consumes: `compareSeats(seats, null, null)` (T24): with no reader and no `vs`, it is exactly 1st against 2nd.
- Produces: `FollowerIntro({ seatCount, rounds, year, race, signedIn }: { seatCount: number; rounds: number; year: number; race: HeadToHead | null; signedIn: boolean })`
  - `SectionHead` "What you are looking at", with the eyebrow "You were sent a league".
  - Two sentences: "{n} friends drafted {rounds} films each before awards season. Every nomination a film earns scores for whoever holds it, and a win scores again."
  - "Start your own league" → `/auth/register`, and "Sign in, if one of these seats is yours" → `/auth/login`, only when signed out.
  - `HeadToHead` for `race`, headed "The race at the top", with a "Compare others" hint pointing at the standings.
  - `race` is null for a league with fewer than two seats; the intro then shows the sentences only.

- [ ] **Step 1: Component tests.** Signed out shows both links. A signed-in non-player shows neither. A null `race` renders no bar.
- [ ] **Step 2: e2e.**
  - A stranger at `/leagues/<id>` reads "What you are looking at" and "The race at the top", naming the fixture's 1st and 2nd.
  - The old "Sign in to see your own roster here" is gone.
  - The page is still `noindex`, and `/leagues` is still disallowed in `robots.txt` (fetch it).
- [ ] **Step 3: Stories:** `SignedOut`, `SignedInNotPlaying`, `OneSeat`.
- [ ] **Step 4: 🔴 Mutation.** Pass `viewerId` of the first seat into `compareSeats` for a stranger. Expect the "names the fixture's 1st and 2nd" assertion red. Restore.
- [ ] **Step 5: Commit.** `git commit -m "feat(leagues): a stranger on a league link gets the explainer and the race at the top (P16.T27)"`

---

### Task P16.T28: Tranche 6 gate, and Phase 16 closes

- [ ] **Step 1:** Run § The tranche gate, then the full suites on the executor.
- [ ] **Step 2: Production-build pass** of every Phase 16 surface, signed out and signed in, at 1440 and 390, light and dark. `npm run build-storybook` passes with every new story present.
- [ ] **Step 3: Docs**
  - Tick T26–T28 in PROGRESS.
  - Confirm D129–D138 are all present, and renumber if any clashed.
  - Update `docs/PLAN.md` § Phase 16's gate line to "met".
  - Confirm the cutover plan's T3b table lists M1–M4 and that its C5 count matches the script.
- [ ] **Step 4:** `git commit -m "docs: Phase 16 complete"`

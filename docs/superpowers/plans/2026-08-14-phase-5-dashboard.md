# Phase 5 — Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the welcome-card home page with the member's actual position — where they stand, what their films have scored, and which show is next.

**Architecture:** Server Components read through a `lib/services/` layer that composes repositories; no component touches Prisma or the db client. The active season becomes data (D22). Scoring's **pure rule** ships here because standings cannot exist without it; Phase 9 adds materialization and bounded recompute on top of the same function.

**Tech Stack:** Next 16 RSC, Prisma 7 repositories (Phase 2), design tokens and `PosterFrame` (Phase 3), Clerk session via `lib/auth.ts` (Phase 4).

## Global Constraints

- **D8** — Server Components and Server Actions. No `/api` layer for reads.
- **D19** — scoring is a **pure, unit-tested rule**. This phase ships the rule and reads it on demand; Phase 9 materializes it.
- **D22** — the active season is data. `NEXT_PUBLIC_ACTIVE_YEAR` is deleted in this phase, not deferred again.
- **D33 / D37** — `app/`, `actions/` and `components/` may not import Prisma or the db client, and may not contain a hex literal. Five CI checks enforce it.
- **D34** — 🔴 **there is no roster size.** The roster strip renders what it is given: 6, 8 or 30. Nothing may hardcode 8. `docs/PLAN.md`'s "8 frames" predates D34 and is superseded.
- **§6.7** — one signal per fact; titles below frames; nothing greyed out by score.
- 🔴 **Scoring: `P` is `points.points`, reached via `awards.points` as a foreign key.** Summing `award.points` scores Best Picture 9 instead of 20 and corrupts every total in the app.

## The confirmed scoring rule

From `server/routes/points.js` (`sumPoints`), preserved exactly:

```
movie total = Σ over that movie's nominations of:
                P             (the nomination)
              + P if that movie won that award   (so a win is worth 2P)
team total  = Σ movie totals
```

`P` is the **resolved value** from `points`, not `awards.points` — that column is a foreign key into `points.id`.

🔴 **Do not port the source app's winner association.** `Awards.hasOne(Movies, { foreignKey: 'id' })` joins `movies.id = winners.id` and nests the wrong movie entirely (recorded in `docs/PROGRESS.md`). A win is: a `winners` row whose `award_id` **and** `movie_id` match, for that year.

---

## File structure

| File | Responsibility |
|---|---|
| `lib/services/season.ts` | `getActiveYear()`, cached and tagged `active-year`. The one place the current season is decided. |
| `actions/admin/set-active-year.ts` | Admin Server Action; moves the season and revalidates the tag. |
| `lib/services/scoring.ts` | The pure rule: nominations + winners + points → per-movie totals. No I/O. |
| `lib/services/scoring.test.ts` | The rule, including the 2P win and the foreign-key trap. |
| `lib/services/dashboard.ts` | Composes repositories into everything the page renders, in one place. |
| `app/(app)/page.tsx` | The dashboard, an RSC. |
| `components/SeasonRail.tsx` | The season's shows, completed / next, with a countdown. |
| `components/RosterStrip.tsx` | Lays out `PosterFrame`s. Assumes no count (D34). |
| `components/StandingsPanel.tsx` | League table, tabular figures. |
| `components/EmptyState.tsx` | No league, no draft yet — an invitation to act, not an apology. |

---

## Task 0: The active season becomes data (D22)

**Files:**
- Create: `lib/services/season.ts`, `lib/services/season.test.ts`, `actions/admin/set-active-year.ts`
- Modify: `.env` (delete `NEXT_PUBLIC_ACTIVE_YEAR`)

**Interfaces:**
- Produces: `getActiveYear(): Promise<number>`, `setActiveYear(year)`. Every later task takes the year as a prop rather than reading it again.

- [ ] **Step 1: Write `lib/services/season.ts`**

```ts
import { unstable_cacheTag as cacheTag } from 'next/cache';

import { availableYearRepository } from '@/lib/repositories/available-years';

/**
 * The season the app is currently showing (D22).
 *
 * This replaces `NEXT_PUBLIC_ACTIVE_YEAR`, a build-time constant that made
 * changing seasons a redeploy every January.
 *
 * Falls back to the newest year rather than throwing when nothing is flagged.
 * A blank site in January is a worse failure than showing last season, and the
 * partial unique index means "no active row" is a real state the table can be
 * in — it is what it looked like before the seeding migration.
 */
export async function getActiveYear(): Promise<number> {
  'use cache';
  cacheTag('active-year');

  const active = await availableYearRepository.findActive();
  if (active?.year != null) return active.year;

  const years = await availableYearRepository.listYears();
  const newest = years[0];
  if (newest == null) throw new Error('no seasons exist');
  return newest;
}
```

- [ ] **Step 2: The write path**

```ts
'use server';

import { revalidateTag } from 'next/cache';

import { requireAdmin } from '@/lib/auth';
import { availableYearRepository } from '@/lib/repositories/available-years';

/**
 * Move the season from inside the running app (D22).
 *
 * The repository does the clear-and-set in one transaction, because the
 * database allows only one active row. This adds the cache invalidation:
 * without it `getActiveYear` keeps serving the old season until the tag
 * expires, and the admin concludes the button is broken.
 */
export async function setActiveYear(year: number) {
  await requireAdmin();
  const updated = await availableYearRepository.setActive(year);
  revalidateTag('active-year');
  return updated;
}
```

- [ ] **Step 3: Test both paths** — the fallback when nothing is active, that a non-admin cannot move the season, and that the year actually changes.

- [ ] **Step 4: Delete `NEXT_PUBLIC_ACTIVE_YEAR` from `.env`** and confirm nothing references it:

```bash
grep -rn "NEXT_PUBLIC_ACTIVE_YEAR" --include='*.ts' --include='*.tsx' . | grep -v node_modules
```
Expected: no matches. Also remove it from Vercel (owner action — note it in PROGRESS).

- [ ] **Step 5: Commit**

---

## Task 1: The scoring rule 🔴

**Files:**
- Create: `lib/services/scoring.ts`, `lib/services/scoring.test.ts`

**Interfaces:**
- Produces: `scoreMovies(input): Map<number, number>` — pure, no I/O — and `pointsForMovieIds(movieIds, year)` which loads and calls it.

- [ ] **Step 1: Write the pure rule**

```ts
/**
 * The scoring rule, ported exactly from `server/routes/points.js` (D19).
 *
 * A nomination earns the award's point value P. A win earns P a second time,
 * so a win is worth 2P total. A movie's total is the sum across its
 * nominations; a team's total is the sum of its movies.
 *
 * Pure and synchronous on purpose. Phase 9 materializes results and
 * recomputes them on award-show events; it will call this same function, so
 * the rule has exactly one definition and the materialized copy cannot drift
 * from what the tests pin.
 *
 * 🔴 `P` is `points.points`, resolved through `award.pointsId`. That column is
 * a FOREIGN KEY into `points.id`, not a value — "Performance by an Ensemble"
 * stores 1, which is the Alphabet tier-3 row, worth 5. Summing the column
 * directly scores it 1 and quietly corrupts every total in the app.
 */
export type ScoringInput = {
  nominations: readonly { movieId: number; awardId: number }[];
  /** award id -> resolved point value */
  pointsByAward: ReadonlyMap<number, number>;
  /** award id -> the movie ids that won it */
  winnersByAward: ReadonlyMap<number, ReadonlySet<number>>;
};

export function scoreMovies(input: ScoringInput): Map<number, number> {
  const totals = new Map<number, number>();

  for (const nomination of input.nominations) {
    const value = input.pointsByAward.get(nomination.awardId);
    // An award with no resolvable point value scores nothing rather than
    // NaN — one bad row must not poison a whole team's total.
    if (value == null) continue;

    const won = input.winnersByAward.get(nomination.awardId)?.has(nomination.movieId) === true;
    totals.set(nomination.movieId, (totals.get(nomination.movieId) ?? 0) + value + (won ? value : 0));
  }

  return totals;
}
```

- [ ] **Step 2: Test the rule against the real fixture**

`fixtures/points-by-draft.json` is the source API's own answer for draft 124: `{"1054":370,"1055":290,…}`. Reproducing those numbers from the database proves the port, not just the arithmetic.

```ts
it('reproduces the source API totals for draft 124', async () => {
  const expected = loadFixture<Record<string, number>>('points-by-draft');
  const picks = await draftPickRepository.findByDraftId(124);
  const totals = await pointsForMovieIds(picks.map((p) => p.movieId), 2025);
  for (const [movieId, points] of Object.entries(expected)) {
    expect(totals.get(Number(movieId))).toBe(points);
  }
});
```

- [ ] **Step 3: Test the traps explicitly**

```ts
it('🔴 scores a win as 2P, not P', () => { … });
it('🔴 uses the resolved point value, never awards.points', () => {
  // Best Picture stores pointsId 9; points row 9 is Oscars tier 1, worth 20.
  // A regression here scores it 9 and every total in the app is wrong.
});
it('a win in an award the movie was not nominated for scores nothing', () => { … });
it('ignores an award whose points row is missing rather than returning NaN', () => { … });
```

- [ ] **Step 4: Run, then commit**

---

## Task 2: The dashboard service

**Files:**
- Create: `lib/services/dashboard.ts`, `lib/services/dashboard.test.ts`

**Interfaces:**
- Consumes: `getActiveYear`, scoring, and the league/draft/event repositories.
- Produces: `getDashboard(userId): Promise<DashboardView>`.

- [ ] **Step 1: Define the view the page needs**

One type, assembled once. The page does no data assembly of its own — that is what keeps the RSC readable and the queries countable.

```ts
export type DashboardView = {
  year: number;
  leagues: {
    id: number;
    name: string | null;
    /** The viewer's own roster, ordered by draft round. */
    roster: { movie: Movie; round: number; points: number; share: number }[];
    total: number;
    standings: { userId: number; name: string; total: number; position: number }[];
    position: number | null;
  }[];
  /**
   * The season's shows, for the rail.
   *
   * `date` is epoch MILLISECONDS, not a Date, and both strings are nullable.
   * The events repository normalizes six bigint schedule columns that way —
   * a bigint DTO throws on JSON.stringify the first time it crosses the RSC
   * boundary. Any date formatting must pin a time zone (UTC), or the rail
   * hydration-mismatches for every viewer west of the server.
   */
  events: {
    id: number;
    name: string | null;
    abbreviation: string | null;
    date: number | null;
    complete: boolean;
  }[];
};
```

- [ ] **Step 2: Implement, batching by id**

Every repository already has a `findManyByIds`. Use them: a per-movie or per-user query inside a loop is what made the source dashboard slow, and it is invisible until a league has twelve members.

- [ ] **Step 3: Test against a real league** — league 1, the only real one. Assert the viewer's roster length matches their picks (no assumed count, D34), that standings are ordered by total descending, and that positions are dense.

- [ ] **Step 4: Commit**

---

## Task 3: Season rail

**Files:** `components/SeasonRail.tsx`, `components/SeasonRail.test.tsx`

- [ ] **Step 1: Build it** — a horizontal rail of the season's shows with dates; completed filled, next in carmine with a countdown. Built from data the app already has and currently buries inside one event's detail card (§6.7).

- [ ] **Step 2: Test the states** — completed, next, and future; a season with no upcoming show renders without a countdown rather than a negative one; **an empty `events` array**; and **a past-dated show nobody marked complete**, which is still "next" and must not render "in -12 days".

- [ ] **Step 3: Commit**

---

## Task 4: Roster strip

**Files:** `components/RosterStrip.tsx`, `components/RosterStrip.test.tsx`

- [ ] **Step 1: Build it on `PosterFrame`** (Phase 3). The strip owns layout and ordering; the frame owns one film.

🔴 **No count is assumed anywhere (D34).** The grid wraps rather than compressing frames: `grid-cols-2 sm:grid-cols-4 lg:grid-cols-8`, so 30 films wrap to four rows and stay legible instead of shrinking to unreadable slivers.

- [ ] **Step 2: Test the sizes that matter**

```tsx
it.each([6, 8, 30])('renders a %i-film roster', (count) => { … });
it('orders by draft round, not by points', () => { … });
```

- [ ] **Step 3: Commit**

---

## Task 5: Standings panel

**Files:** `components/StandingsPanel.tsx`, `components/StandingsPanel.test.tsx`

- [ ] **Step 1: Build it** — position, member, total. Totals use the `tabular` utility so the column does not jitter as scores change during a live show (§6.5).

- [ ] **Step 2: Test ties** — two members on the same total share a position, and the next position skips accordingly. Ties are common early in a season when nothing has been awarded.

- [ ] **Step 3: Commit**

---

## Task 6: The page and its empty states

**Files:** `app/(app)/page.tsx`, `components/EmptyState.tsx`

- [ ] **Step 1: Compose the page** — `requireUser()`, then `getDashboard`, then render. No data assembly in the component.

- [ ] **Step 2: Empty states that invite action**

Three real cases, and the copy differs because the remedy differs:
- **No league** — "Join a league to start drafting." with the action.
- **In a league, no draft yet** — name the date if there is one; this member has nothing to do yet and should not think something is broken.
- **Drafted, nothing scored** — the season has not started. Show the roster and the rail, not an empty state; there is plenty to look at.

- [ ] **Step 3: Commit**

---

## Task 7: E2E and close-out

- [ ] **Step 1: E2E** — a signed-in member with a league sees their roster and standing; the gate from `PLAN.md` is **no truncated titles at any breakpoint**, so assert the full text of the longest title at 375, 768 and 1440.
- [ ] **Step 2:** `npm run typecheck && npm run lint && npm run test && npm run test:ci && npm run build`, and all five layering checks.
- [ ] **Step 3:** Tick P5.T0–T7 in `PROGRESS.md`, add a notes section, record decisions as D41+.
- [ ] **Step 4:** Commit.

---

## Notes for the executor

- **Do not hardcode 8 anywhere.** D34. The one number in this phase that looks like a constant is not one.
- **`P` is not `awards.points`.** If a total looks suspiciously small, this is why.
- **`NEXT_PUBLIC_ACTIVE_YEAR` must be gone by the end of this phase**, from `.env` and from Vercel. D22 has been deferred twice already.
- The dashboard is the first page most members will ever see of the new app. It is worth the extra pass on empty states.

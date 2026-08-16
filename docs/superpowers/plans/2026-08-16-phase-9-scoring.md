# Phase 9 — Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the port scores exactly what the league actually saw, and build the ledger that explains any number on screen.

**Architecture:** Scoring stays the pure function it already is (D41), computed on read. No derived tables. The ledger is the same function's inputs, surfaced.

**Tech Stack:** No new dependencies, no migration.

---

## 🔴 The plan changed: no materialized scores (D59)

`PLAN.md` specified three derived tables — `MovieScore`, `TeamScore`,
`LeagueStanding` — with bounded recompute, a full-recompute command, a
reconciliation job and a nightly cron. **The owner cancelled that after
measurement**, and the measurement is the reason:

| Operation | Measured |
|---|---|
| Full 16-seat league board, scoring included | **8 ms** |
| Every film nominated in a season (123 films) | 7 ms |
| All 1,355 films at once | 16 ms |

The spec's case was "cost scales with league size on every page view". At 13
leagues and 60 people it does not scale to anything: the queries are batched,
the corpus is 4,559 nominations, and the whole board costs less than one
network round trip to Neon.

Against that, materializing buys ~8 ms and introduces **drift** — a second copy
of the truth that can silently disagree with it. Standings that are quietly
wrong are a far worse failure for this app than a page that takes 8 ms longer,
and every mitigation the spec proposed (reconciliation, cron, bounded
recompute) exists only to manage a risk that not materializing does not have.

**What this phase does instead** is the part that was always load-bearing and
is not about speed at all:

1. **Prove we score what production scored.** Four captured fixtures hold the
   real API's own numbers. That is the honest reading of the gate "reconciliation
   reports zero drift against restored production data" — the drift that matters
   is between the port and the app people have been using for ten years, not
   between two copies of our own data.
2. **Build the ledger** (§6.7), which is the actual missing capability: today
   nothing can answer "why is this number what it is".

## 🔴 What the fixtures give us

Captured from the live Heroku API before any of this was written:

| Fixture | Path | Holds |
|---|---|---|
| `points-by-draft` | `/points/draft/124` | One seat's films and per-film points |
| `points-by-year` | `/points/year/2025` | **Every** 2025-nominated film, per-event breakdown and total |
| `points-league-total` | `/points/league/total/1/2025` | Every team's total in league 1, ranked |
| `points-by-movie` | `/points/movie/313369` | One film's per-event breakdown, and `avgDraftPos` |

Only `points-by-draft` is currently verified (`scoring.production.test.ts`).
The other three cover the shapes the port has never been checked against — a
whole season, a whole league, and the per-event grouping the ledger needs.

## Global Constraints

- **D41** — `lib/services/scoring.ts` is the single definition of scoring. This phase extends it; it does not fork it.
- **D41 (the trap)** — `awards.points` is a foreign key into `points.id`. Resolve through `pointsId`, never print the column.
- **D59** — no materialized scores. If a task starts to need a stored total, stop and re-read this section.
- **The P8 constraint holds**: `award-actions.test.ts` asserts a corrected winner moves the points. It passes by construction while scoring is computed on read — keep it that way.
- **D8/D33/D37** — Server Components and Actions; `app/`, `actions/`, `components/` import no Prisma, no db client, no hex literals.
- **D49** — mobile-friendly by default. The ledger is read by members on phones during a ceremony.
- Data-backed suites go in `vitest.ci.config.mts` **before** pushing.

## File structure

| File | Responsibility |
|---|---|
| `lib/services/scoring.ts` | Extended with `ledgerForMovies` — per-award line items, same inputs as the totals. |
| `lib/services/scoring.production.test.ts` | Extended to verify all four fixtures. 🔴 The gate. |
| `lib/services/scoring.test.ts` | The pure ledger rule, no database. |
| `components/PointsLedger.tsx` | Movie total by default; per-award lines on demand (§6.7). |
| `app/(app)/leagues/[id]/page.tsx` | The ledger, reachable from the board. |
| `e2e/scoring.spec.ts` | A real total on screen, and its explanation one interaction away. |

---

## Task 1: Verify against every captured fixture 🔴 the gate

**Files:** `lib/services/scoring.production.test.ts`

This is the task that matters. If the port scores differently from the source
app, sixty people's ten-year history changes the day we cut over — and nobody
would know which number was right.

- [ ] **Step 1: `points-by-year` — a whole season.** For every film in the
  fixture, assert `pointsForMovieIds` returns the fixture's `total`. 123 films,
  each with an independently captured number. This is the broadest correctness
  check available and it costs one test.

- [ ] **Step 2: 🔴 Assert the count too.** A loop over the fixture that silently
  iterates zero films passes. Assert the fixture holds the films you expect
  before asserting anything about them.

- [ ] **Step 3: `points-league-total` — a whole league.** Every team's total in
  league 1's 2025 season, against `getLeagueBoard`. This checks the *sum*
  path — a per-film total can be right while the roll-up to a team is wrong.

- [ ] **Step 4: `points-by-movie` — the per-event breakdown.** This is the
  ledger's shape, verified before the ledger is built rather than after.

- [ ] **Step 5: If anything disagrees, stop and investigate before changing
  either side.** A mismatch here is either a port bug or a source bug, and
  `PARITY.md` already lists ten of the latter. Do not "fix" the port to match a
  source bug without recording it; do not fix the fixture at all.

- [ ] **Step 6: Commit.**

---

## Task 2: The ledger rule

**Files:** `lib/services/scoring.ts`, `lib/services/scoring.test.ts`

**Produces:**

```ts
export type LedgerLine = {
  awardId: number;
  awardName: string;
  eventAbbreviation: string;
  eventName: string;
  /** The award's value. A nomination earns this; a win earns it twice. */
  points: number;
  won: boolean;
  /** What this line contributes: `points`, or `points * 2` when won. */
  earned: number;
};

export type MovieLedger = {
  movieId: number;
  total: number;
  lines: LedgerLine[];
};

export function ledgerForMovies(
  movieIds: readonly number[],
  year: number,
): Promise<Map<number, MovieLedger>>;
```

- [ ] **Step 1: 🔴 The ledger and the total must be the same computation.**
  `total` is `lines.reduce(...)`, not a second query — if they can be computed
  separately they can disagree, and a ledger that does not add up to the number
  above it is worse than no ledger. Test that they agree for every film in the
  season fixture.

- [ ] **Step 2: Reuse the existing loading path.** `pointsForMovieIds` already
  resolves nominations, winners and `pointsId`; extract the shared load rather
  than writing a second one (D41).

- [ ] **Step 3: Pure-rule tests with no database** — a nomination is `P`, a win
  is `2P`, a film in two categories of one show gets two lines, a film
  nominated in a year it did not win gets `won: false`.

- [ ] **Step 4: Commit.**

---

## Task 3: The ledger UI

**Files:** `components/PointsLedger.tsx`, plus tests

§6.7: "Default surface shows the **movie total only** — the board stays
scannable. One click deeper reveals per-award line items: award, category,
nominated/won, value."

- [ ] **Step 1: Total first, lines on demand.** A `<details>`/`<summary>` or an
  expanding button — no modal, no navigation. The point is that the explanation
  is *adjacent* to the number, not on another page.

- [ ] **Step 2: Group lines by award show.** The captured
  `points-by-movie` fixture groups by event, and that is how people talk about
  it ("it got 195 from the Oscars"). Show the show's subtotal, then its
  categories.

- [ ] **Step 3: 🔴 A win is stated, not coloured.** `won: true` renders the word
  and the doubled value, not a green tint — the same rule as the winner seal
  (§12), and for the same reason.

- [ ] **Step 4: Keyboard-reachable and mobile-legible** (D49). A member checks
  this on a phone during a ceremony.

- [ ] **Step 5: Test** — the total matches the sum of the lines shown; a win
  renders as twice the award's value; a film with no points says so rather than
  rendering an empty box.

- [ ] **Step 6: Commit.**

---

## Task 4: Put it where the numbers are

**Files:** `app/(app)/leagues/[id]/page.tsx`, `lib/services/draft.ts`

- [ ] **Step 1: The league board is where people ask the question.** A pick's
  points are already rendered there; make that number expandable.

- [ ] **Step 2: 🔴 Do not load a ledger per pick up front.** A 16-seat board
  with 9 picks each is 144 ledgers nobody has asked for. Load the season's
  ledger once for the films on the board — the same batched call the totals
  already make — and hand each cell its own.

- [ ] **Step 3: Measure before and after.** The board is 8 ms today; if adding
  the ledger makes it materially slower, that is a real finding and belongs in
  the close-out notes rather than being shipped quietly.

- [ ] **Step 4: Commit.**

---

## Task 5: E2E and close-out

- [ ] **Step 1: E2E** — open a league board, expand a pick's points, see the
  award lines and confirm they sum to the total shown. Signed out, since the
  board is public (D44).
- [ ] **Step 2:** `npm run typecheck && npm run lint && npm run test && npm run test:ci && npm run build`, the five layering checks, CI excludes updated.
- [ ] **Step 3:** Tick P9 tasks; close `PARITY.md` **P10.T6** (a film's points by award show) if the ledger covers it.
- [ ] **Step 4:** Record D59 in `DECISIONS.md` and reconcile `PLAN.md`, whose Phase 9 tasks T2–T6 no longer exist.
- [ ] **Step 5:** Commit and confirm CI green.

---

## Notes for the executor

- **Task 1 is the phase.** If time runs short, a verified scoring engine with no ledger is a good outcome; a ledger over unverified scoring is not.
- **Do not create a scores table.** If something seems to need one, the answer is a batched read (D59).
- **`awards.points` is a foreign key.** Resolve it or do not print it.
- **A fixture is evidence, not a test to be edited.** If the port disagrees with one, the port is wrong until proven otherwise.

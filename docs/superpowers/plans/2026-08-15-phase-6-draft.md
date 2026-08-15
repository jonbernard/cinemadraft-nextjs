# Phase 6 — Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the draft — how a league's seats get their films — with the board redesigned so a taken film is unmistakable from artwork alone.

**Architecture:** A `lib/services/draft.ts` shapes a league-year into groups of seats with their picks; Server Actions add, remove and reorder picks behind an ownership check. No new realtime, no clock.

---

## 🔴 Read this before planning any work: the draft is not what the spec describes

The spec (§6.7) designs a **snake draft board** where "the cell on the clock carries a carmine outline and label". I checked the source app before building it, and **there is no live draft in Cinemadraft.** There is no clock, no current-pick pointer, no turn timer, and no column in `drafts` or `draft_picks` that could express one.

What actually exists, verified in `server/routes/draftpicks.js` and `src/pages/league/`:

| Reality | Evidence |
|---|---|
| **Only the league owner enters picks.** Members do not pick for themselves. | `addPick` rejects unless `league.owner.includes(req.user.id)` |
| A league drafts in **groups**. League 1's 2026 season is 4 groups × 4 seats. | `drafts.group`, and `/league/:id/:view/:activeGroup` |
| A **seat** is a `drafts` row: `user_id`, `group`, `order`, or `dummy` + `dummy_name`. | 17 dummy seats exist in production; 3 in league 1's 2026 season |
| `draft_picks.order` is the seat's **own ordering**, 1..N, changed by dragging. | `POST /draftpicks/reorder` writes `{id, order}` pairs |
| `leagues.draftingStatus` is `pending` → `active` → `complete`. `pending` shows the order-and-groups setup screen instead of the board. | `src/pages/league/index.js` |

**Consequence.** The snake board with a live clock is a **new feature**, and D14 puts new features after cutover. This phase ports what exists and redesigns its presentation; the on-the-clock affordance is recorded for Phase 15. Building it now would mean inventing a data model mid-migration and having nothing to compare against in the Phase 7 parity audit.

**What the redesign still delivers here:** the group board becomes a real grid — seats down, rounds across, poster thumbnails in filled cells — which is the §6.7 improvement that does not depend on a clock. The gate ("a taken film is unmistakable at a glance from artwork alone") is about the board, and it is met without live drafting.

## 🔴 The security bug this phase must fix

`addPick`, `reorder` and `delete` all authorize with:

```js
league.owner.includes(req.user.id)
```

`leagues.owner` is **TEXT holding a JSON array** — league 1's value is the literal string `[3]`. So this is a substring match on a string, not a membership test:

- `"[13]".includes(3)` → `false` — the real owner is locked out.
- `"[31]".includes(3)` → `true` — **a stranger passes the ownership check.**

The repository already exposes the parsed `League.ownerIds: number[]` (Phase 2) and fails closed on unparseable text. Every authorization in this phase uses that. This is the single most important line of code in the phase.

## Global Constraints

- **D8** — Server Components and Server Actions; no `/api` for these operations.
- **D14** — new features ship after cutover. The live clock is a new feature.
- **D33 / D37** — `app/`, `actions/` and `components/` may not import Prisma or the db client, nor contain a hex literal. Five CI checks enforce it.
- **D34** — 🔴 no roster size. The board pads to the **longest seat in the group**, never to a constant.
- **D44** — league pages are **public** (they were never guarded in the source app). The board renders signed-out; only the controls are gated.
- **D45** — the proxy enumerates public routes; add the league routes deliberately.
- Latest stable for any new dependency (D28) — `@hello-pangea/dnd` replaces `react-beautiful-dnd`, which is unmaintained and breaks under React 19.

---

## File structure

| File | Responsibility |
|---|---|
| `lib/services/draft.ts` | League-year → groups → seats → picks, with points. The board's whole shape. |
| `lib/services/draft.test.ts` | Against league 1: group counts, dummy seats, padding to the longest seat. |
| `lib/services/league-access.ts` | `canManageLeague(league, userId)` — the parsed ownership check, in one place. |
| `actions/draft/add-pick.ts` | Owner-only. Adds a film to a seat. |
| `actions/draft/remove-pick.ts` | Owner-only. |
| `actions/draft/reorder-picks.ts` | Owner-only. Bulk `{id, order}`. |
| `components/DraftBoard.tsx` | Seats down, rounds across, poster thumbnails. Public. |
| `components/PickCell.tsx` | One cell: thumbnail, title, points. Empty cells are visibly empty. |
| `app/(app)/leagues/[id]/page.tsx` | The league board (public, D44). |
| `e2e/draft.spec.ts` | Add a pick, see it land; reorder, see it persist. |

---

## Task 1: Ownership, parsed — 🔴 the security fix

**Files:** `lib/services/league-access.ts`, `lib/services/league-access.test.ts`

- [ ] **Step 1: Write the failing tests first.** These are the ones that matter.

```ts
it('🔴 rejects a user whose id is a substring of the owner id', () => {
  // The source bug: "[31]".includes(3) is true, so user 3 could manage a
  // league owned by user 31 — every pick, every reorder, every deletion.
  expect(canManageLeague({ ownerIds: [31] }, 3)).toBe(false);
});

it('🔴 admits the real owner whose id is not a substring', () => {
  // The mirror image: "[13]".includes(3) is false, so the actual owner was
  // locked out of their own league.
  expect(canManageLeague({ ownerIds: [13] }, 13)).toBe(true);
});

it('fails closed on an empty owner list', () => {
  expect(canManageLeague({ ownerIds: [] }, 3)).toBe(false);
});

it('fails closed for a signed-out visitor', () => {
  expect(canManageLeague({ ownerIds: [3] }, null)).toBe(false);
});
```

- [ ] **Step 2: Implement.** It is three lines; the value is that it exists exactly once and every action calls it.

- [ ] **Step 3: Commit.**

---

## Task 2: The draft service

**Files:** `lib/services/draft.ts`, `lib/services/draft.test.ts`

**Produces:** `getLeagueBoard(leagueId, year): Promise<BoardView>`

```ts
export type Seat = {
  draftId: number;
  /** Null for a dummy seat — a placeholder the owner drafts on behalf of. */
  userId: number | null;
  name: string;
  isDummy: boolean;
  order: number;
  picks: { pickId: number; movie: Movie; round: number; points: number }[];
  total: number;
};

export type BoardView = {
  year: number;
  leagueName: string | null;
  status: 'pending' | 'active' | 'complete' | null;
  groups: { group: number; seats: Seat[]; rounds: number }[];
};
```

- [ ] **Step 1: Implement, batching by id.** Reuse `pointsForMovieIds` from Phase 5 — do not write a second scoring path (D41).

- [ ] **Step 2: `rounds` is the longest seat in that group, never a constant** (D34). The source computed exactly this as `maxLength`. A group where one seat has 7 picks and another has 5 shows 7 columns, with two empty cells.

- [ ] **Step 3: Dummy seats render with `dummyName`.** 17 exist in production. Dropping them would silently remove seats from a league.

- [ ] **Step 4: Test against league 1, 2026** — 4 groups, 4 seats each, 3 of them dummies; seats ordered by `order`; picks ordered by `order`.

- [ ] **Step 5: Commit.**

---

## Task 3: The board 🔴 the phase gate

**Files:** `components/PickCell.tsx`, `components/DraftBoard.tsx`, plus tests

**Gate:** *a taken film is unmistakable at a glance from artwork alone.*

- [ ] **Step 1: `PickCell`** — poster thumbnail with title and points beneath. §6.7: "Scan by image, confirm by text — reading twelve titles to learn whether a film is gone is too slow."

- [ ] **Step 2: `DraftBoard`** — seats down the side, rounds across the top, a cell per pick. The viewer's own seat carries a carmine outline **and** a label, never colour alone.

- [ ] **Step 3: Empty cells must read as empty**, not as a loading state or a missing image — a seat with fewer picks than the group's longest is normal, not broken.

- [ ] **Step 4: Test** — 🔴 a board where one seat has 7 picks and another 5 renders 7 columns and 2 visibly empty cells; dummy seats appear; no count is hardcoded.

- [ ] **Step 5: Commit.**

---

## Task 4: The Server Actions

**Files:** `actions/draft/add-pick.ts`, `remove-pick.ts`, `reorder-picks.ts`, plus tests

- [ ] **Step 1: Every action starts with the same three lines** — resolve the user, load the league, `canManageLeague`. Then validate with Zod, then write.

- [ ] **Step 2: 🔴 Test the refusals before the successes.** A non-owner must not add, remove or reorder; a signed-out caller must not either. Assert the database is unchanged, not merely that it threw.

- [ ] **Step 3: `reorder` writes in one transaction.** A partial reorder leaves duplicate `order` values, and the board then renders two films in the same round.

- [ ] **Step 4: `revalidatePath` the league** so the board reflects the change.

- [ ] **Step 5: Commit.**

---

## Task 5: Reordering by drag

**Files:** `components/PickList.tsx`, dependency `@hello-pangea/dnd`

- [ ] **Step 1: Install at the current stable** (D28). `react-beautiful-dnd` is unmaintained and breaks under React 19; `@hello-pangea/dnd` is its maintained fork.

- [ ] **Step 2: Optimistic reorder, reconciled on the server response.** The source app did this and it is the right behaviour — a drag that waits for a round trip feels broken.

- [ ] **Step 3: Keyboard reordering must work.** `@hello-pangea/dnd` supports it; do not disable it. Drag-only would make the feature unusable for anyone not using a mouse (a11y `gesture-alternative`).

- [ ] **Step 4: Commit.**

---

## Task 6: The league page

**Files:** `app/(app)/leagues/[id]/page.tsx`, proxy update

- [ ] **Step 1: Public (D44).** Signed out shows the board; the add/remove/reorder controls appear only for an owner.
- [ ] **Step 2: `pending` shows the order-and-groups state**, matching the source app's redirect rather than an empty board.
- [ ] **Step 3: Add `/leagues/(.*)` to the proxy's public list** — deliberately, as D45 requires.
- [ ] **Step 4: Commit.**

---

## Task 7: E2E and close-out

- [ ] **Step 1: E2E** — as owner, add a pick and see it land in the right seat and round; reorder and see it persist across a reload; as a non-owner, confirm the controls are absent.
- [ ] **Step 2:** `npm run typecheck && npm run lint && npm run test && npm run test:ci && npm run build`, five layering checks, and add any data-backed suites to `vitest.ci.config.mts`. **This was missed in Phase 5 and turned CI red — check it before pushing.**
- [ ] **Step 3:** Tick P6.T1–T6, add notes, record decisions.
- [ ] **Step 4:** Commit and confirm CI green.

---

## Notes for the executor

- **Do not build a clock.** There is no data model for it and no parity baseline. Phase 15.
- **`canManageLeague` is the only ownership check.** If you find yourself writing `.includes(` against an owner value, stop.
- **Pad to the longest seat, never to 8** (D34).
- The board is public; the controls are not.

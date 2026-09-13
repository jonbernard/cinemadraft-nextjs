# Phase 14 tranche 2 — the last parity rows

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three parity rows still open after Phase 14 tranche 1 — the dashboard's route into a live ceremony (P10.T3), the league board moving while the draft runs (P10.T21), and the admin's selection driving every watcher's screen (P10.T32) — so `docs/PARITY.md` has zero open rows and the cutover is unblocked.

**Architecture:** Nothing new is invented. Tranche 1 built one transport — an SSE route on the Node runtime that polls Postgres every 2s and writes complete state per frame (D102, D110), plus a client that opens exactly one `EventSource` and stops in three conditions (D111). This tranche applies that same mechanism to the draft board, which is D48's second surface and the half `PLAN.md` promised but never scheduled, and adds one persisted field so the admin's choice of category has somewhere to travel — because a design with no broker has no other channel.

**Tech Stack:** Next.js 16 App Router · React 19 · Prisma 7 + Postgres · SSE on the Node runtime · Vitest 4 (two projects) · Playwright · Biome · Tailwind 4 + MUI 9.

**Spec:** `docs/superpowers/specs/2026-09-12-realtime-transport.md` (🔴 read its correction banner: it is sized against the 300s **Pro** ceiling throughout; this project is on Hobby and the real ceiling is 60s — D115).

**Parity rows this closes:** `docs/PARITY.md` lines 91 (P10.T3), 136 (P10.T21), 157 (P10.T32). Line 156 (P10.T31) is **already closed** by tranche 1 and the matrix simply has not been updated; P14.T14 does that.

## Global Constraints

Every task's requirements implicitly include all of this.

- **`export const maxDuration = 60`** on any streaming route, never higher. Hobby's ceiling is 60s and Vercel validates it at deploy time only (D115). `scripts/layering.sh` greps for anything above 60 and fails the build.
- **`export const runtime = 'nodejs'`** on any streaming route. The spec forbids `edge`.
- **A stream self-closes at `LIFETIME_MS = 50_000`**, ten seconds short of the ceiling, so the client sees a clean end and `EventSource` reconnects on its own rather than being killed mid-write.
- **Every frame is complete state, never a delta**, no `id:` field, no cursor on the client (D110). This is what makes the ~53s reconnect cadence invisible.
- **A route that has nothing to stream answers `204`, not an empty 200.** `EventSource` retries a dropped 200 forever and gives up on any other status; 204 is the only way a server can say *stop asking*, and it is what stops a forgotten tab spending the Neon allowance (D110).
- **A stream is exactly as generous as the page it belongs to, and no more.** Same `getCurrentUser()`, same arguments, same service call. Where the page and the stream both need a rule, the rule is exported from the service and imported by both — never re-typed (the `pinnedLeague` precedent, D110).
- **The client has no backoff of its own.** `EventSource.readyState === CLOSED` is a refusal and is final; `CONNECTING` is the browser already retrying our own clean close and must be left alone (D111).
- **Three stop conditions, not one:** never open when there is nothing to stream, never open into a tab that is *already* hidden at mount, and close on `visibilitychange` (D111).
- **`components/` may not import `lib/services/*`** (D33). A component declares the shape it reads structurally; the page holds both types and passes one as the other, which is the compile-time drift guard.
- **Colour means something.** Brass is an award outcome (D85/D99). Carmine (`accent`) is live/now/act. A "on screen now" marker is carmine; it is never brass.
- **Build from the Phase 3.5 primitives** — `SectionHead`, `Panel`, `Shelf`, `Button`, `StatusChip`, `Eyebrow`, `CinemaFrame`, `PosterFrame`, `EmptyState` — and every new component carries a Storybook story. No hairline card borders, no all-caps headings outside `Eyebrow`, no squared or pill buttons, no machine-formatted dates.
- 🔴 **A verification step that cannot fail is not verification.** Every task ends by mutating its own implementation, watching the test go red, and restoring. A task that cannot make its test fail must say so in its commit message rather than claim a passing run as proof.
- **Run the unit suite with `E2E_TEST_AUTH` unset.** Exported, it turns 186 unit tests red on `headers` outside a request scope.
- **Never regenerate `package-lock.json` on macOS.** No task here adds a dependency; if one somehow must, `npm run lock`.
- **One commit per task**, message starting with the task ID (`P14.T8: ...`). Tick the PROGRESS box as the final step.

---

## Tasks

| Task | Closes | Deliverable |
|---|---|---|
| P14.T8 | P10.T3 | The dashboard's route into a live ceremony |
| P14.T9 | — | `lib/services/league-view.ts`: one definition of the league page |
| P14.T10 | — | `/api/leagues/[id]/board/stream` — D48's second surface |
| P14.T11 | P10.T21 | The board moves while the draft runs |
| P14.T12 | — | `events.focused_award_id` + the admin's control |
| P14.T13 | P10.T32 | The focused category on every watcher's screen |
| P14.T14 | P10.T31 (bookkeeping) | The gate, and a parity matrix with zero open rows |
| P14.T15 | — | The invite goes in a dialog (owner-reported layout defect) |
| P14.T16 | — | A top bar on a phone, carrying the wordmark (owner's call) |
| P14.T17 | — | The auth form's focus ring is clipped (owner-reported) |

T15 and T16 are the owner's two requests of 2026-09-13 and are independent of the parity work; T15 is ordered after T11 because both edit `app/(app)/leagues/[id]/page.tsx`.

---

## File structure

**New files**

| File | Responsibility |
|---|---|
| `components/awards/LiveBanner.tsx` (+ `.test.tsx`, `.stories.tsx`) | The dashboard's route into a ceremony that is on air. Pure presentation. |
| `lib/services/league-view.ts` (+ `.test.ts`) | **One** definition of what `/leagues/[id]` renders — board, standings, the reader's own roster — so the page and the stream cannot disagree. |
| `app/api/leagues/[id]/board/stream/route.ts` (+ `.test.ts`) | The board as SSE. Structurally `app/api/live/[abbr]/stream/route.ts`. |
| `components/leagues/LeagueBoardRoom.tsx` (+ `.test.tsx`) | The client that holds the board, the standings and the roster and keeps them live. Structurally `components/awards/LiveRoom.tsx`. |
| `prisma/migrations/20260913120000_event_focused_award/migration.sql` | `events.focused_award_id`. |
| `actions/awards/focus-award.ts` (+ `.test.ts`) | Admin-only write of that column. |
| `e2e/league-board-live.spec.ts` | The gate for P10.T21. |

**Modified files**

| File | Change |
|---|---|
| `lib/services/dashboard.ts` | `DashboardView` gains `liveNow`. |
| `app/(app)/page.tsx` | Renders `LiveBanner` when `liveNow` is non-null. |
| `app/(app)/leagues/[id]/page.tsx` | Derivation moves out to `league-view.ts`; the board region becomes `LeagueBoardRoom`. |
| `test/route-protection.ts` | One entry: `/api/leagues/[id]/board/stream`. |
| `prisma/schema.prisma` | `Event.focusedAwardId`. |
| `lib/repositories/events.ts` | `Event` type + `SELECT` + `EventUpdate` carry the new column; a `setFocusedAward` write. |
| `lib/services/live.ts` | `LiveShowView` gains `focusedAwardId`. |
| `components/awards/LiveRoom.tsx` | Marks and scrolls to the focused category. |
| `components/awards/LiveAward.tsx` | An `onScreen` prop. |
| `components/admin/CategoryAdmin.tsx` | The "Put on screen" control. |
| `app/(app)/live/[abbr]/page.tsx` | Passes `focusedAwardId` through. |
| `e2e/live.spec.ts` | One case for the focused category. |
| `docs/PARITY.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, `docs/PLAN.md` | Recorded. |

---

## Task order and why

T8 is independent and small — do it first so there is a green commit before the refactor. T9 is a pure refactor with no behaviour change, which is what makes T10 and T11 safe. T12 must precede T13 because T13 renders a field T12 creates. T14 is the gate and the bookkeeping.

---

### Task P14.T8: the dashboard's route into a live ceremony

**Closes:** `docs/PARITY.md:91` — P10.T3, "Watch live" banner during a ceremony. Source: `../cinemadraft/src/pages/dashboard/components/LiveCTA.js:34-66`.

**Why it is a parity row and not a nicety:** today the **only** link into `/live/[abbr]` in the whole application is on the award-show page (`app/(app)/award-shows/[abbr]/page.tsx:134`). A member who opens the product during a ceremony lands on `/` and is told nothing. The source app put the invitation on the dashboard, which is the page everybody has open.

**Files:**
- Create: `components/awards/LiveBanner.tsx`, `components/awards/LiveBanner.test.tsx`, `components/awards/LiveBanner.stories.tsx`
- Modify: `lib/services/dashboard.ts` (add `liveNow` to `DashboardView` and to `getDashboard`), `app/(app)/page.tsx`
- Test: `components/awards/LiveBanner.test.tsx`, and a case in `lib/services/dashboard.test.ts`

**Interfaces:**
- Produces: `export type LiveNow = { abbreviation: string; name: string; year: number }` from `lib/services/dashboard.ts`, and `DashboardView.liveNow: LiveNow | null`.
- Produces: `export function LiveBanner({ abbreviation, name, year }: { abbreviation: string; name: string; year: number })` from `components/awards/LiveBanner.tsx`.
- Consumes: `eventRepository.findActive()` (`lib/repositories/events.ts:188`) — already exists, returns every row with `nomActive` **or** `awardsActive`.

🔴 **A deliberate deviation from the source, and it must be written down.** `LiveCTA` took `activeEvents[0]`, which the source populated from both flags — so a show merely *announcing nominations* produced a banner reading "the results are coming in now" and a link to a live page with nothing live on it. We filter to `awardsActive` only, because that is the flag `/api/live/[abbr]/stream` answers 204 without (`route.ts:112`) — a banner that led to a page which immediately refuses its own stream would be a link to a dead end. Record it in the commit message and in the PARITY row.

🔴 **The banner is for signed-out readers too.** `/` is public (D44) and so is `/live/[abbr]` (P17.T16). It reads nothing about the reader, so there is nothing to withhold.

- [ ] **Step 1: Write the failing service test**

Add to `lib/services/dashboard.test.ts`, following the mocking style already in that file:

```ts
it('names the show that is handing out awards right now', async () => {
  const view = await getDashboard(null);
  expect(view.liveNow).toEqual({ abbreviation: 'oscars', name: 'Academy Awards', year: view.year });
});

it('ignores a show that is only announcing nominations', async () => {
  // 🔴 Deliberate deviation from the source, which showed this one too and
  // linked to a live page whose stream answers 204 (D110). A banner into a
  // dead end is worse than no banner.
  const view = await getDashboard(null);
  expect(view.liveNow).toBeNull();
});
```

Set the fixture up so the first case has an event with `awardsActive: true` and the second has one with `nomActive: true, awardsActive: false`. Read the top of `dashboard.test.ts` first and match how it stands the repositories up — do not invent a second mocking idiom in a file that already has one.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run lib/services/dashboard.test.ts
```

Expected: FAIL — `liveNow` is `undefined`, not an object / not null.

- [ ] **Step 3: Add `liveNow` to the service**

In `lib/services/dashboard.ts`, beside `NowPlayingFilm`:

```ts
/**
 * The show handing out awards at this moment, or null — the dashboard's one
 * route into a ceremony (P10.T3).
 *
 * 🔴 `awardsActive` only, **not** the source's `nomActive || awardsActive`.
 * `LiveCTA` showed a banner reading "the results are coming in now" for a show
 * that was merely announcing nominations, linking to a live page whose stream
 * answers 204 off air (D110) — an invitation into a dead end. A nominations
 * announcement is a different event and, if it is ever worth a banner, it is
 * worth different words.
 *
 * The first, if two shows are somehow live at once. `findActive` orders by
 * name, so the choice is stable rather than arbitrary; two simultaneous
 * ceremonies has never happened and a banner listing both would be a design
 * for a case that does not occur.
 */
export type LiveNow = { abbreviation: string; name: string; year: number };
```

Add `liveNow: LiveNow | null;` to `DashboardView`, and inside `getDashboard`, alongside the other awaited reads (batch it into the existing `Promise.all` rather than adding a serial round trip):

```ts
const onAir = (await eventRepository.findActive()).filter((event) => event.awardsActive);
const liveNow =
  onAir[0] == null
    ? null
    : { abbreviation: onAir[0].abbreviation, name: onAir[0].name, year };
```

Import `eventRepository` from `@/lib/repositories/events`.

- [ ] **Step 4: Run the service test and watch it pass**

```bash
npx vitest run lib/services/dashboard.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write the failing component test**

`components/awards/LiveBanner.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LiveBanner } from './LiveBanner';

describe('LiveBanner', () => {
  it('names the show and links to its live page for this season', () => {
    render(<LiveBanner abbreviation="oscars" name="Academy Awards" year={2026} />);
    const link = screen.getByRole('link', { name: /watch/i });
    expect(link).toHaveAttribute('href', '/live/oscars?year=2026');
    expect(screen.getByText(/academy awards/i)).toBeInTheDocument();
  });

  it('announces itself to a screen reader without shouting on every render', () => {
    // 🔴 `role="status"`, not `role="alert"`. The banner is present from the
    // first paint of a page a member opens deliberately; an alert interrupts,
    // and there is nothing here to interrupt for.
    render(<LiveBanner abbreviation="oscars" name="Academy Awards" year={2026} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run it and watch it fail**

```bash
npx vitest run components/awards/LiveBanner.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 7: Write the component**

`components/awards/LiveBanner.tsx`:

```tsx
import Link from 'next/link';

import { StatusChip } from '@/components/ui/StatusChip';

/**
 * The dashboard's route into a ceremony that is happening now (P10.T3).
 *
 * 🔴 **Carmine, never brass.** Brass means an award outcome (D85/D99) and this
 * is not one — it is an invitation to watch, which is the same register as the
 * `Live` chip the live page's own header carries. The two are deliberately the
 * same colour: a member who learns what carmine means on one page reads it on
 * the other.
 *
 * A `Link`, not `components/ui/Button` — `Button` renders a `<button>`, and a
 * control that navigates has to be an anchor so middle-click, open-in-new-tab
 * and the status bar work.
 *
 * `role="status"` rather than `alert`: this is on the page from its first
 * paint, and a member who opened the dashboard during a ceremony is not being
 * interrupted.
 */
export function LiveBanner({
  abbreviation,
  name,
  year,
}: {
  abbreviation: string;
  name: string;
  year: number;
}) {
  return (
    <div
      role="status"
      className="bg-bg-panel flex flex-wrap items-center gap-4 rounded-sm p-6"
    >
      <StatusChip tone="carmine">Live</StatusChip>
      <p className="text-text-primary min-w-0 flex-1 text-sm">
        The {name} results are coming in now.
      </p>
      <Link
        href={`/live/${abbreviation}?year=${year}`}
        className="bg-accent-fill focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Watch it land
      </Link>
    </div>
  );
}
```

- [ ] **Step 8: Run the component test and watch it pass**

```bash
npx vitest run components/awards/LiveBanner.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Write the story**

`components/awards/LiveBanner.stories.tsx`, matching the format of `components/awards/LiveCountdown.stories.tsx` exactly (read it first). One story, `OnAir`, with the Oscars at 2026.

- [ ] **Step 10: Render it on the dashboard**

In `app/(app)/page.tsx`, import `LiveBanner` and place it as the **first** thing inside the page's top-level container, above the existing header:

```tsx
{view.liveNow ? (
  <LiveBanner
    abbreviation={view.liveNow.abbreviation}
    name={view.liveNow.name}
    year={view.liveNow.year}
  />
) : null}
```

Read the page's existing container and heading structure before inserting, and match its gap rhythm rather than adding a margin.

- [ ] **Step 11: Mutate, and watch a test go red**

Change the filter in `dashboard.ts` from `event.awardsActive` to `event.nomActive || event.awardsActive` — the source's rule. Run `npx vitest run lib/services/dashboard.test.ts`. Expected: the "ignores a show that is only announcing nominations" case FAILS. Restore.

Then change the link's `href` to drop `?year=`. Run `npx vitest run components/awards/LiveBanner.test.tsx`. Expected: FAIL. Restore.

If either mutation does **not** go red, the test is not testing what it claims — fix the test, not the mutation, and say so in the commit message.

- [ ] **Step 12: Full local verification**

```bash
npm run lint && npm run typecheck && npx vitest run lib components app
```

Expected: clean, and no new failures.

- [ ] **Step 13: Commit**

```bash
git add components/awards/LiveBanner.tsx components/awards/LiveBanner.test.tsx \
        components/awards/LiveBanner.stories.tsx lib/services/dashboard.ts \
        lib/services/dashboard.test.ts "app/(app)/page.tsx"
git commit
```

Message starts `P14.T8: the dashboard's route into a ceremony`. Record in the body: that this closes P10.T3, the `awardsActive`-only deviation and why, and the result of both mutations.

---

### Task P14.T9: one definition of what the league page shows

**Closes nothing on its own.** It is the precondition for T10 and T11, and it is a **pure refactor**: no rendered output changes, no query count changes.

**Why:** `app/(app)/leagues/[id]/page.tsx` derives four things inline that a stream would also have to derive — the viewer's seat (`:178-183`), the viewer's roster with each film's share of the seat total (`:185-194`), the standings rows with `denseRank` (`:196-211`), and `isPending`/`isComplete` from `board.status`. A stream that re-derived them would be a second definition of the league page, and the first thing to drift would be the standings — which is arithmetic a member reads as truth. This is exactly what D110 recorded about `pinnedLeague`: two doors, one rule, exported once.

**Files:**
- Create: `lib/services/league-view.ts`, `lib/services/league-view.test.ts`
- Modify: `app/(app)/leagues/[id]/page.tsx`

**Interfaces:**
- Consumes: `getLeagueBoard(leagueId, year): Promise<BoardView>` from `lib/services/draft.ts:97`; `denseRank` from `lib/utils/rank`; `posterUrl` from `lib/utils/poster`.
- Produces, from `lib/services/league-view.ts`:

🔴 **`LeagueBoardView`, not `LeagueView`.** `lib/services/dashboard.ts:76` already exports a `LeagueView` — a different shape, for the dashboard's league cards — and two types of that name in one import graph is a trap for whoever reads the second one. Same reason the function is `getLeagueBoardView`.


```ts
export type LeagueRosterFilm = {
  id: number;
  title: string;
  posterUrl: string | null;
  round: number;
  points: number;
  /** This film's slice of the seat's total. Zero when the seat has scored nothing. */
  share: number;
};

export type LeagueBoardSeat = {
  draftId: number;
  name: string;
  isDummy: boolean;
  uuid: string | null;
  total: number;
  order: number;
  picks: readonly {
    pickId: number;
    round: number;
    title: string;
    posterUrl: string | null;
    points: number;
    ledger: LedgerLine[];
  }[];
};

export type LeagueBoardGroup = {
  group: number;
  rounds: number;
  seats: readonly LeagueBoardSeat[];
};

export type LeagueBoardView = {
  leagueId: number;
  leagueName: string | null;
  year: number;
  status: string | null;
  /** `status === 'pending'` — the running order exists, the board does not. */
  isPending: boolean;
  /** `status === 'active'` — 🔴 the ONLY state that streams (see T10). */
  isDrafting: boolean;
  isComplete: boolean;
  ownerIds: number[];
  uuid: string | null;
  /** The signed-in reader's own seat in this league-year, or null. */
  viewerSeatId: number | null;
  viewerRoster: readonly LeagueRosterFilm[];
  /** True when the reader holds a seat, even one with no picks yet. */
  viewerSeated: boolean;
  standings: readonly StandingsRow[];
  groups: readonly LeagueBoardGroup[];
};

export async function getLeagueBoardView(
  leagueId: number,
  year: number,
  userId: number | null,
): Promise<LeagueBoardView>;
```

`StandingsRow` is imported from `lib/services/dashboard.ts` — the page already uses that shape and `StandingsPanel` already takes it. Do not declare a fifth one.

🔴 **`viewerSeated` is a separate field from `viewerRoster.length`, deliberately.** The page has a branch for a member who holds a seat with no picks (`page.tsx:340-348`), added because P19.T2 caught the page telling a seated owner "you do not hold a seat this season" while their name was in the standings table beside it. Collapsing the two fields reintroduces exactly that bug.

- [ ] **Step 1: Write the failing service test**

`lib/services/league-view.test.ts`. Mock `getLeagueBoard` and assert the derivation, not the database:

```ts
it('gives the reader their own seat, their roster, and each film as a share of the seat', async () => {
  // seat 1 belongs to user 42 and holds two picks worth 30 and 10
  const view = await getLeagueBoardView(1, 2026, 42);
  expect(view.viewerSeatId).toBe(1);
  expect(view.viewerSeated).toBe(true);
  expect(view.viewerRoster.map((film) => film.share)).toEqual([0.75, 0.25]);
});

it('says a seat with no picks is still a seat', async () => {
  // 🔴 The bug P19.T2 caught: a seated owner told they hold no seat, with
  // their own name in the standings beside the message.
  const view = await getLeagueBoardView(1, 2026, 43);
  expect(view.viewerSeated).toBe(true);
  expect(view.viewerRoster).toEqual([]);
});

it('divides by a zero total as zero rather than NaN', async () => {
  const view = await getLeagueBoardView(1, 2026, 44);
  expect(view.viewerRoster.every((film) => film.share === 0)).toBe(true);
});

it('ranks the standings densely and gives a dummy seat a negative key', async () => {
  const view = await getLeagueBoardView(1, 2026, null);
  expect(view.standings.map((row) => row.position)).toEqual([1, 1, 3]);
  expect(view.standings.some((row) => row.userId < 0)).toBe(true);
  // 🔴 No reader, so no seat is theirs — including the dummy seat, whose
  // `userId` is null and would match a null reader on a bare `===`.
  expect(view.standings.every((row) => row.isViewer === false)).toBe(true);
});

it('is drafting only while the league says active', async () => {
  await expect(getLeagueBoardView(1, 2026, null)).resolves.toMatchObject({
    isDrafting: true, isPending: false, isComplete: false,
  });
});
```

Give the mock a board with: seat 1 (user 42, picks 30 and 10, total 40), seat 2 (user 43, no picks, total 0), seat 3 (dummy, `userId: null`, `draftId: 9`, total 40), and `status: 'active'`.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run lib/services/league-view.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the service by moving the code**

Create `lib/services/league-view.ts` with the types above and:

```ts
/**
 * Everything `/leagues/[id]` renders, assembled once.
 *
 * 🔴 **Two doors, one definition.** The page and
 * `/api/leagues/[id]/board/stream` (P14.T10) both render this, and the first
 * thing to drift if they each derived it would be the standings — arithmetic a
 * member reads as truth. Same rule, same reason, as `pinnedLeague` in
 * `lib/services/live.ts` (D110): the moment there are two doors, the rule moves
 * out of the page.
 *
 * 🔴 This is a **move**, not a rewrite. Every line below came out of
 * `app/(app)/leagues/[id]/page.tsx` unchanged, including its comments, because
 * a refactor that also improves things cannot be verified by the tests that
 * existed before it.
 */
export async function getLeagueBoardView(
  leagueId: number,
  year: number,
  userId: number | null,
): Promise<LeagueBoardView> {
  const board = await getLeagueBoard(leagueId, year);

  const seats = board.groups.flatMap((group) => group.seats);

  // 🔴 `userId != null &&` first. A dummy seat's `userId` is null, so a bare
  // `seat.userId === userId` marks every placeholder in the league as the
  // reader's own seat for a reader who has none.
  const viewerSeat =
    userId == null ? null : (seats.find((seat) => seat.userId === userId) ?? null);

  const viewerRoster: LeagueRosterFilm[] =
    viewerSeat == null
      ? []
      : viewerSeat.picks.map((pick) => ({
          id: pick.pickId,
          title: pick.movie.title ?? 'Untitled',
          posterUrl: posterUrl(pick.movie.poster, 'w185'),
          round: pick.round,
          points: pick.points,
          // Zero rather than a division by zero: a bar showing a share of
          // nothing is noise.
          share: viewerSeat.total > 0 ? pick.points / viewerSeat.total : 0,
        }));

  const ranked = [...seats].sort((a, b) => b.total - a.total);
  const positions = denseRank(ranked);
  const standings = ranked.map((seat, index) => ({
    // A dummy seat has no user, so it takes `-draftId` — real ids are
    // positive, so the two can never collide.
    userId: seat.userId ?? -seat.draftId,
    name: seat.name,
    total: seat.total,
    position: positions[index] as number,
    isViewer: userId != null && seat.userId === userId,
  }));

  return {
    leagueId: board.leagueId,
    leagueName: board.leagueName,
    year: board.year,
    status: board.status,
    isPending: board.status === 'pending',
    isDrafting: board.status === 'active',
    isComplete: board.status === 'complete',
    ownerIds: board.ownerIds,
    uuid: board.uuid,
    viewerSeatId: viewerSeat?.draftId ?? null,
    viewerRoster,
    viewerSeated: viewerSeat != null,
    standings,
    groups: board.groups.map((group) => ({
      group: group.group,
      rounds: group.rounds,
      seats: group.seats.map((seat) => ({
        draftId: seat.draftId,
        name: seat.name,
        isDummy: seat.isDummy,
        uuid: seat.uuid,
        total: seat.total,
        order: seat.order,
        picks: seat.picks.map((pick) => ({
          pickId: pick.pickId,
          round: pick.round,
          title: pick.movie.title ?? 'Untitled',
          posterUrl: posterUrl(pick.movie.poster, 'w185'),
          points: pick.points,
          ledger: pick.ledger,
        })),
      })),
    })),
  };
}
```

🔴 Read `app/(app)/leagues/[id]/page.tsx:100-215` and `:400-440` before writing this and carry the **existing** `viewerSeatId` resolution across verbatim — the page may resolve it differently from the naive version above (it handles the group-scoped case). If the page's version differs, the page's version is correct and this step is to move it, not to replace it.

- [ ] **Step 4: Run the service test and watch it pass**

```bash
npx vitest run lib/services/league-view.test.ts
```

Expected: PASS.

- [ ] **Step 5: Repoint the page**

In `app/(app)/leagues/[id]/page.tsx`, replace the `getLeagueBoard` call and the four inline derivations with one `getLeagueBoardView(leagueId, season, user?.id ?? null)`, and rename the local references (`board.groups` → `view.groups`, `standings` → `view.standings`, and so on). `getLeagueSeasons`, `canManageLeague`, `inviteBase` and the metadata function stay exactly as they are.

`canManageLeague(view, user?.id)` takes something with `ownerIds` — `LeagueBoardView` has it, so the call is unchanged. Verify by typecheck rather than by reading.

- [ ] **Step 6: Prove nothing changed**

```bash
npm run typecheck && npx vitest run lib app components
npm run test:e2e -- e2e/journeys/02-*.spec.ts
```

Expected: all green. The journey suite renders this page against real rows; if the refactor changed anything a reader sees, it fails here. If you cannot map a journey file to this page, run the whole e2e suite instead — `npm run test:e2e` — and compare the summary line to the last known-good run.

- [ ] **Step 7: Mutate, and watch a test go red**

Change `share` to `pick.points / viewerSeat.total` with no zero guard. Run `npx vitest run lib/services/league-view.test.ts`. Expected: the NaN case FAILS. Restore.

Change `isViewer` to `seat.userId === userId` without the null guard. Expected: the dummy-seat case FAILS. Restore.

- [ ] **Step 8: Commit**

```bash
git add lib/services/league-view.ts lib/services/league-view.test.ts \
        "app/(app)/leagues/[id]/page.tsx"
git commit
```

Message starts `P14.T9: one definition of what the league page shows`. Say in the body that it is a pure refactor, name the e2e run that proves it, and record both mutations.

---

### Task P14.T10: the board as a stream

**Closes nothing on its own.** It is D48's second surface — the same transport, the other screen.

**Files:**
- Create: `app/api/leagues/[id]/board/stream/route.ts`, `app/api/leagues/[id]/board/stream/route.test.ts`
- Modify: `test/route-protection.ts`

**Interfaces:**
- Consumes: `getLeagueBoardView(leagueId, year, userId)` from T9; `getCurrentUser()` from `@/lib/auth`; `getActiveYear()` from `@/lib/services/season`; `NotFoundError` from `@/lib/errors`.
- Produces: `GET(request, { params }: { params: Promise<{ id: string }> })`, and a `text/event-stream` whose every `data:` is `JSON.stringify(LeagueBoardView)`.

🔴 **Write this by reading `app/api/live/[abbr]/stream/route.ts` and changing the four things that differ.** It is not a template to improve on: the timer teardown, the abort listener, the `request.signal.aborted` re-check after the first await, the skipped-beat `catch`, and the `dispose`/`cancel()` pairing are all load-bearing and were each written for a named failure. Copy them exactly. The four differences:

1. The service call is `getLeagueBoardView(leagueId, year, user?.id ?? null)`.
2. The 404 case is a league that does not exist (`getLeagueBoard` throws `NotFoundError`).
3. **The 204 case is `!view.isDrafting`** — see below.
4. There is no `?league=` pin, so no `pinnedLeague`. There **is** a `?year=`, parsed with the same idiom.

🔴 **`isDrafting`, not "has the season ended".** The parity row is *"live board updates **while the draft runs**"* (`PARITY.md:136`), and a league is `active` only during the owner's draft call — an hour or two, once a season. Every other state answers 204 and costs nothing. Streaming a `complete` league so its standings track the award season would hold a connection open for months of a forgotten tab against a 100 CU-hr Neon allowance, to move numbers that already move on reload — and the live page is where a member watches scores land. If this is ever wanted, it is a separate decision with a separate budget, not a widened condition.

🔴 **Public, and exactly as generous as the page.** `/leagues/[id]` is public (D44/D45) and shows a stranger the whole board already. The stream calls `getCurrentUser()` and passes `user?.id ?? null`, so a signed-out reader gets `viewerSeatId: null`, `viewerRoster: []`, `viewerSeated: false` and no `isViewer` row — which is precisely what the page gives them. Nothing here decides access; it mirrors.

`ponytail:` the frame is the whole board including every pick's ledger — around 100KB for a sixteen-seat league. Fine for a league-sized audience at one write per pick; if a ceremony-sized audience ever reads a board, diff on a cheap digest before serialising.

- [ ] **Step 1: Write the failing route test**

`app/api/leagues/[id]/board/stream/route.test.ts`. Read `app/api/live/[abbr]/stream/route.test.ts` first and reuse its `collect()`, `settle()` and fake-timer scaffolding verbatim — including `// @vitest-environment node` on line 1. Mock `@/lib/auth` and `@/lib/services/league-view`. The cases:

```ts
it('opens with the complete view, as one event, before any poll', async () => { /* status 200, the three headers, one frame, JSON.parse deep-equals BASE */ });
it('writes nothing while unchanged, then a heartbeat at 20s', async () => { /* 3 calls, 1 frame; then ':\n\n' */ });
it('writes a frame when a pick lands, and it is complete state again', async () => { /* 2 frames, second deep-equals the new view, then no repeat */ });
it('clears its timers and closes when the reader disconnects', async () => { /* abort, closed, no further calls over 60s */ });
it('closes itself at 50s and stops polling', async () => { /* not closed at 49s, closed at 50s */ });
it('answers 204 and holds no connection when the league is not drafting', async () => {
  // 🔴 Not an empty stream: EventSource retries a closed 200 forever. 204 is
  // how the server says stop asking, and a league is `active` for an hour a
  // season — every other day of the year must cost nothing (D110).
});
it('answers 404 for a league that does not exist', async () => { /* NotFoundError -> 404 */ });
it('keeps the last good state when a poll throws', async () => { /* still open, still one frame */ });
it('gives a signed-out reader no seat of their own', async () => {
  expect(mocks.getLeagueBoardView).toHaveBeenCalledWith(1, 2026, null);
  expect(view.viewerSeatId).toBeNull();
  expect(view.viewerRoster).toEqual([]);
  expect(view.standings.every((row) => row.isViewer === false)).toBe(true);
});
it('passes a signed-in reader their own id', async () => {
  expect(mocks.getLeagueBoardView).toHaveBeenCalledWith(1, 2026, 42);
});
it('answers 404 for a league id that is not a positive integer', async () => {
  // `/api/leagues/7x/board/stream` — validated, not passed to the database.
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run "app/api/leagues/[id]/board/stream/route.test.ts"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the route**

Copy `app/api/live/[abbr]/stream/route.ts` to the new path and make the four changes. Keep `runtime`, `maxDuration`, `POLL_MS`, `HEARTBEAT_BEATS` and `LIFETIME_MS` at exactly the same values, and keep their docstrings — those comments are D110's and D115's reasoning and it applies here identically.

The id parse, before anything else:

```ts
const { id } = await params;
const leagueId = Number(id);
// Validated, not trusted, and not handed to the database as NaN.
if (!Number.isSafeInteger(leagueId) || leagueId <= 0) {
  return new Response('not found', { status: 404 });
}
```

The 204:

```ts
/**
 * 🔴 Only while the draft is running. A league is `active` for an hour or two
 * a season; every other state answers 204 and holds nothing. The parity row is
 * "live board updates while the draft runs" (PARITY.md:136), and widening it
 * to a finished season would hold a connection open for months of a forgotten
 * tab against a 100 CU-hr allowance, to move numbers that already move on
 * reload. 204 rather than an empty stream because `EventSource` retries a
 * closed 200 forever and stops only on a non-200 (D110).
 */
if (!view.isDrafting) return new Response(null, { status: 204 });
```

- [ ] **Step 4: Run the route test and watch it pass**

```bash
npx vitest run "app/api/leagues/[id]/board/stream/route.test.ts"
```

Expected: PASS.

- [ ] **Step 5: Open the door in the proxy**

`test/route-protection.ts` enumerates **public** routes; everything else is protected, and its own enumeration test goes red demanding a decision for a route that is on neither list. Add, beside the `/api/live/[abbr]/stream` entry:

```ts
  // 🔴 The board's stream, the same ruling one door further in (P14.T10/D48).
  // `/leagues/[id]` is public (D44/D45) and `config.matcher` covers
  // `/(api|trpc)(.*)`, so without this line the stream a stranger's browser
  // opens on a league link is bounced and the public page they were handed
  // simply never updates during the draft — which is the whole feature.
  //
  // It grants exactly what the page grants: the handler resolves the reader
  // with `getCurrentUser()` and passes `user?.id ?? null` to the same
  // `getLeagueBoardView` the page calls, so a signed-out reader gets no seat of
  // their own and no `isViewer` row. Its own `route.test.ts` pins that.
  '/api/leagues/[id]/board/stream',
```

- [ ] **Step 6: Run the protection test**

```bash
npx vitest run test/route-protection.test.ts
```

Expected: PASS. If it was already red before this step, that is the mechanism working — it demanded a decision for the new route.

- [ ] **Step 7: Mutate, and watch tests go red**

Change the 204 condition to `if (false)`. Run the route test. Expected: the "not drafting" case FAILS. Restore.

Delete the `'/api/leagues/[id]/board/stream'` entry. Run `npx vitest run test/route-protection.test.ts`. Expected: FAIL. Restore.

Delete `clearInterval(poll)` from `stop()`. Run the route test. Expected: the disconnect case FAILS on the polling-count assertion. Restore. 🔴 If it does **not** fail, the leak test is not testing the leak — fix it before committing, because that assertion is the one standing between this feature and the free tier.

- [ ] **Step 8: Guard and full verification**

```bash
bash scripts/layering.sh && npm run lint && npm run typecheck && npx vitest run
```

Expected: clean. `layering.sh` includes the `maxDuration > 60` guard (D115) and must pass.

- [ ] **Step 9: Commit**

```bash
git add "app/api/leagues/[id]/board/stream/route.ts" \
        "app/api/leagues/[id]/board/stream/route.test.ts" test/route-protection.ts
git commit
```

Message starts `P14.T10: the board as a stream`. Record the `isDrafting`-only budget decision and all three mutations.

---

### Task P14.T11: the board moves while the draft runs

**Closes:** `docs/PARITY.md:136` — P10.T21.

**Files:**
- Create: `components/leagues/LeagueBoardRoom.tsx`, `components/leagues/LeagueBoardRoom.test.tsx`
- Modify: `app/(app)/leagues/[id]/page.tsx`

**Interfaces:**
- Produces: `export function LeagueBoardRoom({ initial, streamUrl, signedIn, viewerSeatId }: { initial: LeagueBoardRoomView; streamUrl: string; signedIn: boolean; viewerSeatId: number | null })`.
- Consumes: `DraftBoard` (`components/draft/DraftBoard.tsx:78`), `StandingsPanel`, `RosterStrip`, `EmptyState`, `SectionHead`, `StatusChip`.

🔴 **Declare `LeagueBoardRoomView` structurally in the component**, composed from the types `DraftBoard`, `StandingsPanel` and `RosterStrip` already export — `components/` may not import `lib/services/*` (D33). The drift guard is the page, which holds both types and passes one as the other; a field renamed in the service fails that assignment at compile time. This is the pattern `LiveRoom.tsx:14-36` records; follow it exactly.

🔴 **The server render is the page.** `initial` is the view `getLeagueBoardView()` produced for this request, rendered to HTML on the server — a stranger, a crawler and a reader whose JavaScript never arrives all get the whole board. The effect only stops it being a snapshot.

🔴 **The header, the season nav and the invite link stay server-rendered.** Nothing in them moves during a draft, and pulling them into a client component would mean `inviteBase()`'s `headers()` read has to cross the boundary. Only the board, the standings and the roster go inside.

- [ ] **Step 1: Write the failing component test**

`components/leagues/LeagueBoardRoom.test.tsx`. Read `components/awards/LiveRoom.test.tsx` first and reuse its fake-`EventSource` harness verbatim. Cases — each is one of D111's stop conditions plus the happy path:

```tsx
it('renders the server frame before any connection', () => { /* the picks in `initial` are on screen */ });
it('replaces the board outright when a frame arrives', () => { /* a new pick appears, no merge */ });
it('opens no connection at all when the league is not drafting', () => {
  // 🔴 The budget. A league is `active` for an hour a season; every other
  // reload of this public page must cost nothing.
});
it('opens no connection when the tab is already hidden at mount', () => {
  // 🔴 Not redundant with `visibilitychange`: a restored browser or a
  // background-opened tab fires no event, so nothing would ever close it.
  // This exact gap survived tranche 1's first mutation run (D111).
});
it('closes on visibilitychange and opens exactly one on return', () => {});
it('closes on unmount', () => {});
it('does not reopen after a refusal', () => {
  // readyState CLOSED is final — the 204 off-draft, or a 404 (D111).
});
it('leaves a clean close alone', () => {
  // readyState CONNECTING is the ~50s self-close; the browser reconnects and
  // nothing here interferes.
});
it('closes when a frame says the draft has finished', () => {
  // The route checks `isDrafting` only when a connection opens, so a draft
  // ending mid-stream arrives as one last full frame saying so.
});
it('opens exactly one connection under StrictMode double-invocation', () => {});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run components/leagues/LeagueBoardRoom.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Copy the `useEffect` body of `components/awards/LiveRoom.tsx:161-221` **verbatim** — the `done` latch, the `source !== null` StrictMode guard, the `document.hidden` check inside `open()`, the `readyState` split in `onerror`, the `visibilitychange` listener and its cleanup. Change exactly two things: the gate is `initial.isDrafting` instead of `initial.onAir`, and the mid-stream stop reads `next.isDrafting`. The dependency array is `[streamUrl, initial.isDrafting]`.

🔴 **The effect must not depend on the view it sets.** `view.isDrafting` in the dependency array would tear the connection down and rebuild it on every frame — the whole connection budget spent in seconds, and the bug would look like the page working perfectly.

There is no `justDecided` equivalent and no reveal: a pick landing on a board is not an announcement, and `DraftBoard` already renders a keyed grid so React updates cells in place. Do not add an animation this task was not asked for.

Render: the roster/standings row and the groups, exactly as `page.tsx:320-440` renders them today, moved across. Keep every comment; they carry P17.T31's and P19.T2's findings.

- [ ] **Step 4: Run the component test and watch it pass**

```bash
npx vitest run components/leagues/LeagueBoardRoom.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Wire the page**

In `app/(app)/leagues/[id]/page.tsx`, replace the roster/standings/groups JSX with:

```tsx
<LeagueBoardRoom
  // 🔴 Keyed on the stream URL, so switching season reconciles into a new
  // connection rather than leaving one open to the old one.
  key={streamUrl}
  initial={view}
  streamUrl={streamUrl}
  signedIn={user != null}
  viewerSeatId={view.viewerSeatId}
/>
```

with, above the return:

```ts
// 🔴 Built from the page's own `?year=`, so the stream renders the view the
// first paint already showed. A stream asked for different parameters is a
// second, disagreeing page (the note on `LiveRoom`'s `streamUrl`).
const streamUrl = `/api/leagues/${view.leagueId}/board/stream?year=${view.year}`;
```

- [ ] **Step 6: Mutate, and watch tests go red**

Remove the `document.hidden` check from `open()`. Run the component test. Expected: the already-hidden case FAILS. Restore. 🔴 This is the mutation that survived in tranche 1 — if it does not fail here, the test is wrong.

Change the dependency array to `[streamUrl, view.isDrafting]`. Expected: a test FAILS (a frame causes a reconnect). If **nothing** fails, add the assertion that catches it — count connections across two frames — before restoring, and say so in the commit message.

Change the `onerror` handler to reopen on `CLOSED`. Expected: "does not reopen after a refusal" FAILS. Restore.

- [ ] **Step 7: Full local verification**

```bash
npm run lint && npm run typecheck && npx vitest run && bash scripts/layering.sh
```

- [ ] **Step 8: Commit**

```bash
git add components/leagues/LeagueBoardRoom.tsx components/leagues/LeagueBoardRoom.test.tsx \
        "app/(app)/leagues/[id]/page.tsx"
git commit
```

Message starts `P14.T11: the board moves while the draft runs`. Say it closes P10.T21, and record all three mutations including whether the dependency-array one needed a new assertion.

---

### Task P14.T12: the admin's choice has somewhere to live

**Closes nothing on its own.** It is the state T13 renders.

**Files:**
- Create: `prisma/migrations/20260913120000_event_focused_award/migration.sql`, `actions/awards/focus-award.ts`, `actions/awards/focus-award.test.ts`
- Modify: `prisma/schema.prisma`, `lib/repositories/events.ts`, `lib/services/live.ts`, `components/admin/CategoryAdmin.tsx`, `app/(app)/award-shows/[abbr]/page.tsx`

**Interfaces:**
- Produces: `events.focused_award_id INTEGER` (nullable), `Event.focusedAwardId: number | null`, `eventRepository.setFocusedAward(eventId: number, awardId: number | null): Promise<void>`, `focusAward(input: { awardId: number; on: boolean }): Promise<ActionResult>`, and `LiveShowView.focusedAwardId: number | null`.

🔴 **Why a column, when the source used a socket message.** The source emitted `sendSelectedAward` over socket.io and the selection lived nowhere — a watcher who joined thirty seconds late saw no highlight, and a reconnect lost it. D102 removed the broker: the database **is** the bus, and this design has no other channel. Persisting it is not a heavier implementation of the same thing, it is a better one — a full frame carries the current selection to a reader who arrives mid-ceremony, which the source could not do (D110's argument, applied to a second field).

🔴 **Cutover hazard, and it must be written into Phase 13.** `PLAN.md`'s Phase 13 T2 is a final `pg_dump` from Heroku into Neon. That dump has no `focused_award_id`, exactly as it has no Blob URLs in `events.image` — which is why T3 exists. Add a sibling note to Phase 13 in this task (see step 9): after the final restore, the migrations must be re-applied before the app is pointed at it, or this column is gone and every read of it fails. This is the same class of defect T3 records, found the same way, and it is cheaper to write down now than to find during a cutover.

- [ ] **Step 1: Write the migration**

`prisma/migrations/20260913120000_event_focused_award/migration.sql`:

```sql
-- The category the admin currently has on screen, or NULL for none (P10.T32).
--
-- The source app carried this only as a socket.io message (`sendSelectedAward`
-- in src/pages/events/list.js:67), so it existed nowhere: a watcher who joined
-- late, or whose connection dropped, saw no selection at all. D102 removed the
-- broker and made the database the bus, so this is where it lives now — and
-- persisting it is what lets a full frame carry the current selection to a
-- reader arriving mid-ceremony, which the source could not do.
--
-- Deliberately NOT a foreign key to `awards`. A category the admin has on
-- screen and then deletes would refuse the delete or cascade a write into
-- `events` during a ceremony; a stale id simply matches no category and
-- renders as no selection, which is the correct behaviour and needs no
-- cleanup. `lib/services/live.ts` reads it by comparison, never by join.
ALTER TABLE "events" ADD COLUMN "focused_award_id" INTEGER;
```

Add to `prisma/schema.prisma`, in `model Event` after `awardsDuration`:

```prisma
  focusedAwardId Int?      @map("focused_award_id")
```

- [ ] **Step 2: Apply it and regenerate**

```bash
npx prisma migrate deploy && npx prisma generate
```

Expected: one migration applied, client regenerated. 🔴 Against your **local** database only — `DATABASE_URL` must point at 5433 or 5434. Never Neon from a local run.

- [ ] **Step 3: Write the failing repository and action tests**

In `lib/repositories/events.test.ts`, add a case asserting `findByAbbreviation` returns `focusedAwardId` and that `setFocusedAward` round-trips a value and a null.

`actions/awards/focus-award.test.ts`, following `actions/awards/set-winner.test.ts`'s shape exactly:

```ts
it('refuses a caller who is not an admin', async () => { /* authorizeAward throws; result is a failure and nothing is written */ });
it('puts a category on screen', async () => { /* on: true -> setFocusedAward(eventId, awardId) */ });
it('takes it off again', async () => { /* on: false -> setFocusedAward(eventId, null) */ });
it('rejects an award id that is not a positive integer', async () => { /* INVALID, no write */ });
it('revalidates the show page so the admin sees their own control move', async () => {});
```

- [ ] **Step 4: Run them and watch them fail**

```bash
npx vitest run lib/repositories/events.test.ts actions/awards/focus-award.test.ts
```

Expected: FAIL.

- [ ] **Step 5: Carry the column through the repository**

In `lib/repositories/events.ts`: add `focusedAwardId` to the `Event` type, to `SELECT`, and to `toEvent`. Add:

```ts
/**
 * Put one category on every watcher's screen, or clear it (P10.T32).
 *
 * Written to the **event**, not to the award: there is one selection per show,
 * and storing it on the category would make "which one is on screen" a scan of
 * every category rather than one field. Null clears it.
 */
async setFocusedAward(eventId: number, awardId: number | null): Promise<void> {
  await db.event.update({ where: { id: eventId }, data: { focusedAwardId: awardId } });
},
```

🔴 Do **not** add `focusedAwardId` to `EventUpdate`. `actions/admin/update-event.ts` is an explicit field whitelist that closed the source's mass assignment; the live selection is a different act with a different control and it gets its own action.

- [ ] **Step 6: Write the action**

`actions/awards/focus-award.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { eventRepository } from '@/lib/repositories/events';
import { type ActionResult, fail, ok, toActionResult } from '../result';
import { authorizeAward } from './guard';

const Input = z.object({
  awardId: z.int().positive(),
  /** False takes it off screen. */
  on: z.boolean(),
});

export type FocusAwardInput = z.infer<typeof Input>;

/**
 * Put one category on every watcher's screen, or take it off (P10.T32).
 *
 * 🔴 Admin-only, through the same `authorizeAward` gate as the winner writes —
 * and the show is derived from the award rather than accepted from the caller,
 * so two facts from one untrusted payload cannot disagree.
 *
 * This changes no scoring input. It is the ceremony's pointer: the admin says
 * "this is the one being announced" and every open `/live` frame carries it
 * within one poll (D102). `revalidatePath` is for the admin's own page, so the
 * control they just pressed reflects what they pressed; the watchers do not
 * need it, because the stream re-reads.
 */
export async function focusAward(input: FocusAwardInput): Promise<ActionResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that category is not valid');

  try {
    const { award, abbreviation } = await authorizeAward(parsed.data.awardId);
    await eventRepository.setFocusedAward(award.eventId, parsed.data.on ? award.id : null);
    revalidatePath(`/award-shows/${abbreviation}`, 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
```

- [ ] **Step 7: Carry it into the view**

In `lib/services/live.ts`: add to `LiveShowView`

```ts
  /**
   * The category the admin has on screen, or null (P10.T32).
   *
   * 🔴 Compared, never joined. A stale id — the admin put a category on screen
   * and then deleted it — matches nothing and renders as no selection, which
   * is why the column carries no foreign key.
   */
  focusedAwardId: number | null;
```

and in the returned object: `focusedAwardId: event.focusedAwardId,`. The stream already sends the whole view, so this costs nothing there and needs no change to the route.

Add a case to `lib/services/live.test.ts` asserting the field survives, and to `app/api/live/[abbr]/stream/route.test.ts` asserting a frame carries it.

- [ ] **Step 8: The admin's control**

In `components/admin/CategoryAdmin.tsx`, add an `onScreen: boolean` prop and one control beside the winner buttons:

```tsx
<button
  type="button"
  onClick={() => start(async () => { await focusAward({ awardId, on: !onScreen }); })}
  aria-pressed={onScreen}
  className={cn(
    'min-h-11 rounded-sm px-3 text-sm',
    onScreen ? 'bg-accent-fill text-white' : 'border-border-rule border',
  )}
>
  {onScreen ? 'On screen' : 'Put on screen'}
</button>
```

Match the file's existing `useTransition` idiom rather than introducing a second one — read the winner buttons above it and copy their shape. Pass `onScreen={show.focusedAwardId === category.awardId}` from `app/(app)/award-shows/[abbr]/page.tsx`; if that page's view does not carry `focusedAwardId`, read it from `eventRepository.findByAbbreviation` there, the way it already reads the event for its other admin controls.

Add a test to `components/admin/CategoryAdmin.test.tsx` for both label states and `aria-pressed`.

- [ ] **Step 9: Write the cutover note into Phase 13**

In `docs/PLAN.md`, in the Phase 13 list, immediately after T3 (the award-logo restore), add:

```markdown
- T3b: **Re-apply the migrations after T2's restore.** `npx prisma migrate deploy`
  against Neon before anything reads from it. The Heroku dump carries the
  source app's schema, so every column this port added — `available_years.is_active`
  and its partial unique index, `movies.accent_hex`, `users.clerk_id` and its
  unique index, `events.focused_award_id` (P14.T12) — is absent from it, and a
  restore with `--clean` drops them. This is the same class of defect as T3:
  a full restore is a schema event as well as a data one, and it silently
  reverts everything the port added. Verify with
  `\d events` and `\d available_years` in `psql` before T4's verification pass;
  the app fails on the first read of a missing column, which during a cutover
  looks like a deployment failure rather than a restore one.
```

🔴 Check the existing `is_active` and `clerk_id` columns against the dump before writing that list — if any of them is already handled somewhere in Phase 13, say so rather than duplicating it, and if the list is longer than the four named, name them all.

- [ ] **Step 10: Run everything and mutate**

```bash
npx vitest run lib actions components app
```

Expected: PASS.

Mutate: change `parsed.data.on ? award.id : null` to `award.id` unconditionally. Run `npx vitest run actions/awards/focus-award.test.ts`. Expected: the "takes it off again" case FAILS. Restore.

Mutate: remove the `requireAdmin` path by changing `authorizeAward(parsed.data.awardId)` to a direct `eventRepository` read. Expected: the non-admin case FAILS. Restore.

- [ ] **Step 11: Verify against a CI-shaped database**

The new column is in a migration, so a fresh CI database gets it — but prove that rather than assume it:

```bash
docker run --rm -d --name ci-verify-pg -e POSTGRES_USER=cinemadraft \
  -e POSTGRES_PASSWORD=local -e POSTGRES_DB=cinemadraft -p 5437:5432 postgres:17
export DATABASE_URL=postgresql://cinemadraft:local@localhost:5437/cinemadraft
npx prisma migrate deploy && node scripts/seed-e2e.mjs && npm run test:ci
docker rm -f ci-verify-pg
unset DATABASE_URL
```

Expected: green. 🔴 `npm run test:ci` passing against your own 5433 does not mean CI passes — it holds the restored production copy. This step is the one that reproduces CI.

- [ ] **Step 12: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260913120000_event_focused_award \
        lib/repositories/events.ts lib/repositories/events.test.ts \
        lib/services/live.ts lib/services/live.test.ts \
        actions/awards/focus-award.ts actions/awards/focus-award.test.ts \
        components/admin/CategoryAdmin.tsx components/admin/CategoryAdmin.test.tsx \
        "app/(app)/award-shows/[abbr]/page.tsx" \
        "app/api/live/[abbr]/stream/route.test.ts" docs/PLAN.md
git commit
```

Message starts `P14.T12: the admin's choice has somewhere to live`. Record why it is a column and not a message, the no-foreign-key decision, the Phase 13 T3b note, and both mutations.

---

### Task P14.T13: the focused category on every watcher's screen

**Closes:** `docs/PARITY.md:157` — P10.T32.

**Files:**
- Modify: `components/awards/LiveAward.tsx`, `components/awards/LiveAward.test.tsx`, `components/awards/LiveAward.stories.tsx`, `components/awards/LiveRoom.tsx`, `components/awards/LiveRoom.test.tsx`, `app/(app)/live/[abbr]/page.tsx`

**Interfaces:**
- Consumes: `LiveShowView.focusedAwardId` from T12.
- Produces: `LiveAward` gains `onScreen?: boolean` (default `false`); `LiveRoomView` gains `focusedAwardId: number | null`.

🔴 **Carmine, not brass.** Brass means an award outcome (D85/D99) and "being announced right now" is not one — it is the same register as the `Live` chip, and it must read as different from a win or the page teaches two meanings for one colour.

🔴 **The marker is not only colour.** The live page is read from three metres (the 10-foot arithmetic in `LiveAward`'s docstring). A border tint alone subtends nothing at that distance. The category states it in words — an "On screen now" chip in the heading — as well as in colour, which is also what makes it survive a monochrome panel and a screen reader.

- [ ] **Step 1: Write the failing tests**

In `components/awards/LiveAward.test.tsx`:

```tsx
it('says in words when it is the one being announced', () => {
  render(<LiveAward name="Best Picture" points={10} nominees={NOMINEES} onScreen />);
  expect(screen.getByText(/on screen now/i)).toBeInTheDocument();
});

it('says nothing when it is not', () => {
  render(<LiveAward name="Best Picture" points={10} nominees={NOMINEES} />);
  expect(screen.queryByText(/on screen now/i)).not.toBeInTheDocument();
});
```

In `components/awards/LiveRoom.test.tsx`:

```tsx
it('marks the category the admin has on screen', () => {
  render(<LiveRoom initial={{ ...BASE, focusedAwardId: 10 }} {...props} />);
  expect(screen.getByText(/on screen now/i)).toBeInTheDocument();
});

it('moves the mark when a frame changes the selection', () => {
  // 🔴 The whole feature: the admin points at a category and every open page
  // follows within one poll. Deliver a frame with a different focusedAwardId
  // and assert the mark moved — not merely that one exists.
});

it('marks nothing when the admin has selected nothing', () => {
  render(<LiveRoom initial={{ ...BASE, focusedAwardId: null }} {...props} />);
  expect(screen.queryByText(/on screen now/i)).not.toBeInTheDocument();
});

it('scrolls the focused category into view when the selection changes, and not on first render', () => {
  // 🔴 Not on first render. A reader who opens the page mid-ceremony has the
  // selection in their first frame; yanking their scroll position before they
  // have looked at anything is the same defect as replaying every reveal on
  // reload (`LiveAward`'s `reveal` default).
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run components/awards/LiveAward.test.tsx components/awards/LiveRoom.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: The chip in `LiveAward`**

Add the prop with a docstring saying what it means and why it is carmine, and render, in the category heading beside the point value:

```tsx
{onScreen ? <StatusChip tone="carmine">On screen now</StatusChip> : null}
```

Import `StatusChip` from `@/components/ui/StatusChip`.

- [ ] **Step 4: The selection in `LiveRoom`**

Add `focusedAwardId: number | null` to `LiveRoomView`. Pass `onScreen={category.awardId === view.focusedAwardId}` where the categories are mapped. Add, beside the existing effect:

```tsx
/** The selection this page has already moved to, so a re-render does not re-scroll. */
const scrolled = useRef<number | null>(initial.focusedAwardId);

useEffect(() => {
  const focused = view.focusedAwardId;
  // 🔴 First render is excluded by seeding the ref with the server's own
  // value: a reader opening the page mid-ceremony already has the selection in
  // their first frame, and yanking their scroll before they have looked at
  // anything is the same defect as replaying every reveal on reload.
  if (focused == null || focused === scrolled.current) return;
  scrolled.current = focused;
  document.getElementById(`award-${focused}`)?.scrollIntoView({
    block: 'start',
    // Honour the reader's own setting rather than deciding for them.
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth',
  });
}, [view.focusedAwardId]);
```

Give each category's wrapper `id={`award-${category.awardId}`}`.

- [ ] **Step 5: Pass it through the page**

In `app/(app)/live/[abbr]/page.tsx`, include `focusedAwardId: show.focusedAwardId` in the object handed to `LiveRoom`. The page holds both types, so a mismatch is a compile error — which is the drift guard.

- [ ] **Step 6: Story**

Add an `OnScreen` story to `components/awards/LiveAward.stories.tsx`, matching the file's existing format.

- [ ] **Step 7: Run and mutate**

```bash
npx vitest run components app
```

Expected: PASS.

Mutate: change `onScreen={category.awardId === view.focusedAwardId}` to `onScreen={false}`. Expected: the LiveRoom marking cases FAIL. Restore.

Mutate: seed `scrolled` with `null` instead of `initial.focusedAwardId`. Expected: the "not on first render" case FAILS. Restore. 🔴 If it does not, that assertion is decorative — make it real before committing.

- [ ] **Step 8: Commit**

```bash
git add components/awards/LiveAward.tsx components/awards/LiveAward.test.tsx \
        components/awards/LiveAward.stories.tsx components/awards/LiveRoom.tsx \
        components/awards/LiveRoom.test.tsx "app/(app)/live/[abbr]/page.tsx"
git commit
```

Message starts `P14.T13: the focused category on every watcher's screen`. Say it closes P10.T32, record the carmine-not-brass choice and both mutations.

---

### Task P14.T14: the gate, and the matrix

**Gate:** the board moves for a second viewer while the owner drafts, the admin's selection moves a second viewer's screen, and `docs/PARITY.md` has zero open rows.

**Files:**
- Create: `e2e/league-board-live.spec.ts`
- Modify: `e2e/live.spec.ts`, `docs/PARITY.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`

**Interfaces:**
- Consumes: everything above. 🔴 **Reuse `e2e/live.spec.ts`'s own scaffolding rather than writing new**: `withDb` (`:38`), `cleanup` (`:51`), `seedShow` (`:112`), `seedShowWithLeague` (`:218`), `signInAsMember` (`:202`), and the `TAG`/`YEAR` scratch constants (`:29-31`). `signInAs` comes from `e2e/support/session.ts` and `skipWithoutRestoredCorpus` from `e2e/support/corpus.ts`. 🔴 A scratch league left behind breaks `lib/db.test.ts`, which counts rows — `seedShowWithLeague`'s comment says so and `cleanup` is what keeps it true. Read `e2e/live.spec.ts` first — tranche 1's gate is the template, including how it opens two browser contexts against one database and how it proves *no navigation* happened.

🔴 **Two contexts, one database, and the assertion is that the second one never reloaded.** Tranche 1 learned this the expensive way twice: `framenavigated` also fires for the same-document History entries the App Router writes during hydration, so it races hydration and is not a navigation counter — count `page.on('load')`, which fires once per real document. And a test that only proves "the number changed" cannot tell a live update from a reload, which is why the count is asserted.

- [ ] **Step 1: Write the board gate**

`e2e/league-board-live.spec.ts`:

```ts
test('a pick the owner enters lands on a watcher’s board with no navigation', async ({ browser }) => {
  // 1. Seed a scratch league in `active` status with two seats. 🔴 Scratch
  //    rows only — league 1 is sixty real people's history.
  // 2. Context A: the owner, on /leagues/<id>/draft.
  // 3. Context B: a watcher, on /leagues/<id>. Count documents:
  //      let documents = 0;
  //      viewer.on('load', () => { documents += 1; });
  //    and plant a token on `window` so a reload is detectable two ways.
  // 4. Wait for the board to settle; `const settled = documents;`
  // 5. Owner assigns a pick.
  // 6. Expect the film's title on the watcher's board, and the seat total to
  //    move, within 10s.
  // 7. expect(documents).toBe(settled) and the window token still present.
});

test('a watcher of a finished league opens no stream', async ({ browser }) => {
  // 🔴 The budget, proved rather than asserted: a `complete` league's page
  // must make no request to /api/leagues/*/board/stream. Watch for the
  // request rather than for a rendering difference.
});

test('a signed-out watcher gets the board and no seat of their own', async ({ browser }) => {
  // Read the stream off the wire, not out of the DOM — the tranche 1 pattern.
  // No `isViewer: true` row, `viewerSeatId` null, `viewerRoster` empty.
});
```

- [ ] **Step 2: Add the focus case to `e2e/live.spec.ts`**

```ts
test('the admin’s selection moves every watcher’s screen', async ({ browser }) => {
  // Context A: an admin on /award-shows/<abbr>, presses "Put on screen" on a
  // scratch category. Context B: a viewer on /live/<abbr>, on air.
  // Expect "On screen now" to appear in B's focused category within 10s, with
  // the document count unchanged — then press it again in A and expect the
  // mark to disappear in B.
});
```

- [ ] **Step 3: Run the gate**

```bash
npm run test:e2e -- e2e/league-board-live.spec.ts e2e/live.spec.ts
```

Expected: all pass. 🔴 Run each file three times **sequentially** — not `--repeat-each`, which collides scratch fixtures across repeats and produces strict-mode violations that look like real failures. A test that passes on Playwright's retry is a race, not a flake, and must be fixed at the cause before this task is done.

- [ ] **Step 4: Mutate, and watch the gate go red**

Splice `await viewer.reload();` in before the board assertion. Expected: the document-count assertion FAILS. Remove.

Revert `LeagueBoardRoom`'s effect to never open a connection. Expected: the pick never arrives and the first test FAILS on its 10s expectation. Restore.

Change the route's 204 condition to always stream. Expected: "a watcher of a finished league opens no stream" FAILS. Restore.

Record each in the commit message, including any mutation that was caught by an earlier assertion than the one it was aimed at — that makes the later assertion a redundancy rather than the primary guard, and saying so is the point.

- [ ] **Step 5: Full suite**

```bash
npm run lint && npm run typecheck && npx vitest run && bash scripts/layering.sh
npm run test:e2e
```

Expected: green, with `E2E_TEST_AUTH` unset for the unit run. Report the actual summary lines, not a summary of them.

- [ ] **Step 6: Update `docs/PARITY.md`**

Four rows change verdict to **ported**, each citing the file that closes it:

- line 91 (P10.T3) → `components/awards/LiveBanner.tsx` + `lib/services/dashboard.ts`. Note the `awardsActive`-only deviation.
- line 136 (P10.T21) → `components/leagues/LeagueBoardRoom.tsx` + `/api/leagues/[id]/board/stream`, **while the league is `active`**.
- line 156 (P10.T31) → `app/(app)/live/[abbr]/page.tsx` + `components/awards/LiveRoom.tsx` (closed by tranche 1; the matrix was simply not updated).
- line 157 (P10.T32) → `actions/awards/focus-award.ts` + `events.focused_award_id`.

🔴 **Recount the header table from the table itself; never increment it.** The counts drifted by one during Phase 10 and went unnoticed for four batches, because each task adjusted the header by its own delta. Count the literal occurrences of each verdict:

```bash
grep -c '| \*\*ported\*\* |' docs/PARITY.md
grep -c '| \*\*deficient\*\* |' docs/PARITY.md
grep -c '| \*\*dropped\*\* |' docs/PARITY.md
```

and make the header say what those say. Expected after this task: deficient **0**.

Update the "Audited" line and the "Where it stands" prose to say the cutover is no longer blocked on parity.

- [ ] **Step 7: Record the decisions**

Append to `docs/DECISIONS.md` — 🔴 grep for `'\n| D116 |'` (the row form, with the leading pipe and newline) before appending, not the bare string `D116`, which matches inside other rows' prose and has silently skipped an append before:

- **D116** — the board streams only while the league is `active`, and why a finished season is a separate budget decision.
- **D117** — the admin's selection is a persisted column, not a message; no foreign key; and the cutover consequence (Phase 13 T3b).
- **D118** — the dashboard banner is `awardsActive` only, deviating from the source, because the stream answers 204 without it.

- [ ] **Step 8: Update `docs/PROGRESS.md`**

Tick P14.T8–T14, tick the four P10 rows in the Phase 10 section with their closing commits, and add a tranche 2 banner under Phase 14 stating the gate result in the numbers actually observed. Note in the Phase 12 section that the parity matrix is now clean, so T2's manual pass starts from zero known gaps.

- [ ] **Step 9: Commit**

```bash
git add e2e/league-board-live.spec.ts e2e/live.spec.ts \
        docs/PARITY.md docs/DECISIONS.md docs/PROGRESS.md
git commit
```

Message starts `P14.T14: the gate, and the matrix`. Include the real suite summary lines and every mutation result.

---

### Task P14.T15: the invite goes in a dialog

**Not a parity row — a layout defect the owner reported**, with a screenshot: the invite disclosure sits in the same flex row as "Run the draft" and "Set up the season", and when it opens it grows in flow, so the two buttons are vertically centred against a three-row block and the whole action row loses its baseline.

🔴 **This reverses a decision, and the reversal is the point.** `InviteAction`'s docstring argues for a native `<details>` over a dialog on three grounds: the link belongs beside the league, the open state is the element's own, and it keeps the file a server component. The first two still hold and the third was the real reason — and it is the one that costs the layout. A disclosure that expands *in flow* inside a row of fixed-height controls cannot not push its siblings around. `InviteLink` is already a client island on this page, so the server-component argument buys nothing once the button moves in with it.

**Ordering:** after T11, because both edit `app/(app)/leagues/[id]/page.tsx`.

**Files:**
- Create: `components/leagues/InviteDialog.tsx`, `components/leagues/InviteDialog.test.tsx`, `components/leagues/InviteDialog.stories.tsx`
- Delete: `components/leagues/InviteAction.tsx` and its test and story, if it has them
- Modify: `app/(app)/leagues/[id]/page.tsx`
- Unchanged: `components/leagues/InviteLink.tsx` — it already does the clipboard half and it moves inside the dialog untouched

**Interfaces:**
- Produces: `export function InviteDialog({ url, className }: { url: string; className?: string })` — a `'use client'` component rendering one trigger button and a native `<dialog>`.
- Consumes: `InviteLink` from `@/components/leagues/InviteLink`.

🔴 **A native `<dialog>` with `showModal()`, not a `useState` overlay and not a library.** `showModal()` gives the focus trap, the Escape key, inertness of the rest of the page, the top-layer stacking and a styleable `::backdrop` — all of it, with no code. Writing any of those by hand is how a dialog ends up half-accessible. `ref.current?.showModal()` in the click handler and `close()` on dismissal is the whole mechanism.

🔴 **The trigger must be exactly the same shape as `SecondaryAction`.** That is the defect being fixed: it has to sit in the row at 44px like its neighbours. Copy `SecondaryAction`'s classes from `page.tsx:65-71` verbatim rather than approximating them — but as a `<button type="button">`, because this one opens a dialog rather than navigating, which is the inverse of the reason `SecondaryAction` is an anchor.

🔴 **The credential warning goes inside the dialog**, not next to the trigger. "Anyone with this link can take a seat" is the sentence a person needs when they are about to copy the link, not while they are looking at a button — and leaving it outside is what made the closed control three rows tall.

- [ ] **Step 1: Write the failing test**

`components/leagues/InviteDialog.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { InviteDialog } from './InviteDialog';

const URL = 'https://cinemadraft.com/join/d501d8c9-63e5-4652-a9c6-5de9dc49eaf7';

// 🔴 jsdom implements `<dialog>` but not `showModal`/`close` in every version
// this project has run on. Stub them so the test asserts OUR behaviour — that
// the element is opened and closed — rather than the environment's.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

describe('InviteDialog', () => {
  it('keeps the link off the page until it is asked for', () => {
    render(<InviteDialog url={URL} />);
    // 🔴 The uuid IS the join credential. It must not be on screen, and it
    // must not be in the accessibility tree, before somebody asks for it.
    expect(screen.queryByText(URL)).not.toBeInTheDocument();
  });

  it('opens the dialog on the trigger, showing the link and the warning', async () => {
    render(<InviteDialog url={URL} />);
    await userEvent.click(screen.getByRole('button', { name: /invite/i }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByText(URL)).toBeInTheDocument();
    expect(screen.getByText(/anyone with this link/i)).toBeInTheDocument();
  });

  it('closes on the close control', async () => {
    render(<InviteDialog url={URL} />);
    await userEvent.click(screen.getByRole('button', { name: /invite/i }));
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.getByRole('dialog', { hidden: true })).not.toBeVisible();
  });

  it('names itself to a screen reader', () => {
    render(<InviteDialog url={URL} />);
    // The dialog carries `aria-labelledby` pointing at its own heading, so it
    // is announced as something rather than as "dialog".
    expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute(
      'aria-labelledby',
    );
  });

  it('is one control the height of a button, not a block', () => {
    // 🔴 The reported defect. The trigger carries `min-h-11` like its
    // siblings, and nothing else renders beside it in the closed state.
    render(<InviteDialog url={URL} />);
    expect(screen.getByRole('button', { name: /invite/i }).className).toContain('min-h-11');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run components/leagues/InviteDialog.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

`components/leagues/InviteDialog.tsx`:

```tsx
'use client';

import { useCallback, useRef } from 'react';

import { InviteLink } from '@/components/leagues/InviteLink';
import { cn } from '@/lib/utils/cn';

/**
 * The invite, behind a modal dialog (P14.T15, replacing P17.T30's disclosure).
 *
 * 🔴 The uuid **is** the join credential — whoever holds it can seat themselves
 * — so it is owners-only and it stays off the page until somebody asks for it.
 * That part is unchanged and is the whole reason this is behind anything at
 * all.
 *
 * 🔴 **What changed, and why it reverses the earlier note.** This was a native
 * `<details>`, chosen so the file could stay a server component. But a
 * disclosure expands *in flow*, and this one lives in the same row as "Run the
 * draft" and "Set up the season" — so opening it made a three-row block of a
 * 44px control and vertically re-centred both buttons beside it. The owner
 * reported exactly that. A modal is the shape that does not move the page: it
 * is in the top layer, so the row it came from is untouched. The server
 * component was the only thing the `<details>` bought, and `InviteLink` was
 * already a client island on this page, so it bought nothing.
 *
 * 🔴 **`showModal()`, not a `useState` overlay.** The native dialog gives the
 * focus trap, Escape-to-close, inertness of the page behind it, top-layer
 * stacking and a styleable `::backdrop` with no code. Every one of those
 * hand-written is a way for a dialog to end up half-accessible.
 */
export function InviteDialog({ url, className }: { url: string; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);

  const open = useCallback(() => dialog.current?.showModal(), []);
  const close = useCallback(() => dialog.current?.close(), []);

  return (
    <>
      {/* 🔴 The same classes as the page's `SecondaryAction`, so it sits in the
          row at the same height as its neighbours — which is the defect this
          task exists to fix. A `<button>` rather than an anchor because it
          opens a dialog rather than navigating, which is the inverse of the
          reason `SecondaryAction` is an anchor. */}
      <button
        type="button"
        onClick={open}
        className={cn(
          'border-border-rule text-text-primary hover:bg-bg-surface focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm border px-4 text-sm focus-visible:outline-2',
          className,
        )}
      >
        Invite
      </button>

      {/* `backdrop:` is Tailwind's variant for `::backdrop`. The dialog is
          `m-auto` because the top layer centres nothing by default. */}
      <dialog
        ref={dialog}
        aria-labelledby="invite-dialog-title"
        className="bg-bg-panel text-text-primary m-auto w-full max-w-lg rounded-sm p-6 backdrop:bg-black/60"
      >
        <div className="flex flex-col gap-4">
          <h2 id="invite-dialog-title" className="text-text-primary text-base">
            Invite someone to this league
          </h2>

          {/* 🔴 Inside the dialog, not beside the trigger: this is the sentence
              a person needs at the moment they copy the link, and having it
              outside is what made the closed control three rows tall. */}
          <p className="text-text-secondary text-sm">
            Anyone with this link can take a seat in this league. Send it to whoever is
            playing, and nobody else.
          </p>

          <InviteLink url={url} />

          <button
            type="button"
            onClick={close}
            className="border-border-rule text-text-primary hover:bg-bg-surface focus-visible:outline-accent-fill flex min-h-11 w-fit items-center rounded-sm border px-4 text-sm focus-visible:outline-2"
          >
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npx vitest run components/leagues/InviteDialog.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Swap it in and delete the old one**

In `app/(app)/leagues/[id]/page.tsx`, change the import and the one usage from `InviteAction` to `InviteDialog`. Keep the surrounding comment — its reasoning about owners-only and a finished season is unchanged — and add one line to it saying the control is now a dialog and why.

```bash
git rm components/leagues/InviteAction.tsx
ls components/leagues/InviteAction.* 2>/dev/null   # remove any test/story too
```

🔴 `git rm`, and check for siblings — a deleted component whose story survives breaks the Storybook build, and its test would go on passing against a file nothing renders.

- [ ] **Step 6: Write the story**

`components/leagues/InviteDialog.stories.tsx`, matching `components/leagues/InviteLink.stories.tsx`'s format if it exists, otherwise `components/awards/LiveCountdown.stories.tsx`. One story, `Closed`, with a fake uuid — 🔴 a made-up one, never a real league's.

- [ ] **Step 7: Measure the fix in a production build**

🔴 **Not `next dev`.** A dev server answers 403 for every `_next/static` chunk on `127.0.0.1`, so a measurement there is of an unstyled page, and the dev-tools indicator has been mistaken for a page element before.

```bash
npm run build && npm run start
```

Then, at 1440 on a league page with an invite (an owner session, a `pending` league), read back:

```js
const row = document.querySelector('[data-action-row]') ?? /* the flex row holding the buttons */;
[...row.children].map((el) => el.getBoundingClientRect().height)
```

Expected: every child the same height, 44. Open the dialog and read the row's heights again — **identical**, because the dialog is in the top layer. That equality before-and-after is the assertion the report was about; record the actual numbers in the commit message, not the word "fixed".

- [ ] **Step 8: Mutate, and watch a test go red**

Change `showModal()` to `show()` — the non-modal form. Run the test. Expected: nothing fails, because both open the dialog. 🔴 That means the test does **not** cover the modal-ness, which is the accessibility half. Either add an assertion that does (assert `showModal` was the method called, using the spy the `beforeAll` already installs) or state plainly in the commit message that modal behaviour rests on the manual check in step 7. Do not leave it implied.

Then remove `min-h-11` from the trigger. Expected: the height test FAILS. Restore.

- [ ] **Step 9: Full verification**

```bash
npm run lint && npm run typecheck && npx vitest run && npm run build
npm run test:e2e -- e2e/journeys/02-*.spec.ts
```

🔴 Run the e2e journey that seats somebody through an invite, if there is one — `grep -rln "join/" e2e/` finds it. A changed invite control that breaks the join flow is the only way this task can do real damage.

- [ ] **Step 10: Commit**

```bash
git add components/leagues/InviteDialog.tsx components/leagues/InviteDialog.test.tsx         components/leagues/InviteDialog.stories.tsx "app/(app)/leagues/[id]/page.tsx"
git commit
```

Message starts `P14.T15: the invite goes in a dialog`. Record the reversal of P17.T30's `<details>` choice and why, the measured row heights from step 7, and the honest result of the `showModal`/`show` mutation.

---

### Task P14.T16: a top bar on a phone, carrying the wordmark

**Not a parity row — the owner's call**: "on mobile we need a top bar with the wordmark. it's not good enough to have it in the bottom bar."

**What is true today, measured from the source rather than assumed:** `TabBar.tsx:84-88` renders `<Wordmark size="sm" markOnly />` in a 44px square that is `hidden … sm:flex`. So between `sm` and `xl` the identity is a bare mark in the bottom bar, and **on a phone below `sm` — the actual mobile case — there is no wordmark anywhere in the application.** `TabBar`'s own docstring (`:26-34`) explains why: at 390px the five tab slots have 78px each with no slack, and taking 44px squares out of the row wraps "Award shows" onto two lines and grows the bar from 48.5px to 65px.

🔴 **A top bar dissolves that constraint rather than fighting it.** The measurement was never about the wordmark — it was about the bottom bar being the only horizontal chrome below `xl`. Give the phone a second strip and the mark costs the tab row nothing.

**Scope, deliberately narrow:** the wordmark moves. Search and the account control **stay where they are** (the bottom bar from `sm`, `MoreSheet` below it, where D75 put them). Moving those is a separate decision about D75's grouping and the owner has not asked for it. Note in the commit message that the top bar now has room for them if that is ever wanted.

**Ordering:** independent of every other task here. Do it whenever.

**Files:**
- Create: `components/shell/TopBar.tsx`, `components/shell/TopBar.test.tsx`, `components/shell/TopBar.stories.tsx`
- Modify: `components/shell/AppShell.tsx`, `components/shell/AppShell.test.tsx`, `components/shell/TabBar.tsx`, `components/shell/TabBar.test.tsx`, `components/awards/TvModeLink.test.tsx`
- Check: `e2e/smoke.spec.ts` (the three cascade-layer tests) and `e2e/nav.spec.ts` — do not relax either

**Interfaces:**
- Produces: `export function TopBar()` from `components/shell/TopBar.tsx` — a server-safe presentational component taking no props, rendered by `AppShell`.

🔴 **`sticky top-0`, not `fixed`.** A sticky element stays in normal flow, so it reserves its own height and nothing below it needs compensating padding. `fixed` would put the first heading of every page underneath it and require a matching `padding-top` — a second number to keep in step with the bar's height, and the bottom bar's `pb-[calc(4rem+env(safe-area-inset-bottom))]` is already one of those. One is enough.

🔴 **It must carry `data-app-chrome`.** That is TV mode's only seam (D112) — one unlayered rule in `app/globals.css` hides everything carrying it. A new piece of chrome without the hook means TV mode stops being "nothing but the room". `components/awards/TvModeLink.test.tsx:77` asserts the attribute appears **exactly twice** in `AppShell.tsx`; adding a third occurrence turns it red, which is the guard working — update the count to 3 and update the comment above it to name four elements, not three.

🔴 **The full lockup, not `markOnly`.** The complaint is that the mark alone in the bottom bar is not good enough. A top bar is a full-width row, so it holds `<Wordmark size="sm" />` — mark and name — which is what makes it identity rather than a favicon.

- [ ] **Step 1: Write the failing test**

`components/shell/TopBar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TopBar } from './TopBar';

describe('TopBar', () => {
  it('is the wordmark, linked home', () => {
    render(<TopBar />);
    const link = screen.getByRole('link', { name: /cinemadraft, home/i });
    expect(link).toHaveAttribute('href', '/');
    // 🔴 The full lockup, not the mark alone — the mark alone in the bottom
    // bar is the thing being replaced.
    expect(screen.getByRole('img', { name: 'Cinemadraft' })).toBeInTheDocument();
  });

  it('is the phone and tablet bar only', () => {
    // The rail carries identity from `xl` up; two wordmarks at once is a
    // duplicate landmark and a duplicate link to `/`.
    const { container } = render(<TopBar />);
    expect(container.firstElementChild?.className).toContain('xl:hidden');
  });

  it('carries the TV-mode hook', () => {
    // 🔴 Without it, TV mode leaves a bar on screen at any width a browser can
    // be made full-screen at (D112).
    const { container } = render(<TopBar />);
    expect(container.firstElementChild).toHaveAttribute('data-app-chrome');
  });

  it('reserves its own height rather than overlapping the page', () => {
    // `sticky`, not `fixed`: a fixed bar would put the first heading of every
    // page underneath it and need a compensating padding-top on `<main>` —
    // a second number to keep in step. The bottom bar already owns one.
    const { container } = render(<TopBar />);
    const className = container.firstElementChild?.className ?? '';
    expect(className).toContain('sticky');
    expect(className).not.toContain('fixed');
  });

  it('gives the link a 44px target', () => {
    render(<TopBar />);
    expect(screen.getByRole('link', { name: /cinemadraft, home/i }).className).toMatch(
      /min-h-11/,
    );
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run components/shell/TopBar.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

`components/shell/TopBar.tsx`:

```tsx
import Link from 'next/link';

import { Wordmark } from '../ui/Wordmark';

/**
 * The phone and tablet top bar: the wordmark, and nothing else (P14.T16).
 *
 * 🔴 **Why it exists.** Below `xl` the rail is hidden, and identity was a
 * 44px `markOnly` square in the bottom bar that was itself `hidden sm:flex` —
 * so on an actual phone the application carried no wordmark at all. The owner
 * called that out directly. `TabBar`'s docstring explains why the mark could
 * not simply be un-hidden there: at 390px the five tab slots have 78px each
 * and no slack, and a 44px square in the row wraps "Award shows" to two lines
 * and grows the bar from 48.5px to 65px.
 *
 * 🔴 A top bar dissolves that rather than arguing with it. The measurement was
 * never about the wordmark; it was about the bottom bar being the only
 * horizontal chrome below `xl`. There are two now, and the mark costs the tab
 * row nothing.
 *
 * 🔴 **`sticky`, not `fixed`.** Sticky stays in normal flow, so this reserves
 * its own height and nothing below needs a compensating `padding-top` — the
 * bottom bar already owns one of those numbers (`pb-[calc(4rem+env(safe-area-inset-bottom))]`
 * on `<main>`) and one is enough to keep in step.
 *
 * 🔴 **`data-app-chrome` is not decoration.** It is TV mode's only seam
 * (D112): one unlayered rule in `app/globals.css` hides everything carrying
 * it. A bar without the hook means full-screen is not "nothing but the room".
 *
 * The full lockup rather than `markOnly`: a full-width row holds the name, and
 * the name is the half the bottom bar could not carry.
 *
 * No landmark. This is chrome, not navigation — `NavRail`'s `Main` and
 * `TabBar`'s `Primary, mobile` are the two navigations, and a third landmark
 * holding one link would make a screen reader's landmark list worse.
 */
export function TopBar() {
  return (
    <div
      className="bg-bg-panel xl:hidden sticky top-0 z-40 flex items-center px-4 sm:px-6"
      data-app-chrome
    >
      <Link
        href="/"
        aria-label="Cinemadraft, home"
        className="text-text-primary focus-visible:outline-accent-fill flex min-h-11 items-center focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <Wordmark size="sm" />
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npx vitest run components/shell/TopBar.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Render it in the shell**

In `components/shell/AppShell.tsx`, import `TopBar` and render it as the **first child of the content column** — the `<div className="min-w-0 flex-1 …">`, immediately above `<Strip …/>`:

```tsx
<TopBar />
```

🔴 Above the `<Strip>`, not above the skip link. The skip link must stay the first focusable element on the page by DOM order — a skip link that is not first is not a skip link, and `AppShell`'s own comment says so.

🔴 For `sticky top-0` to stick, no ancestor may have `overflow: hidden` or a transform. Verify in the browser at step 8, not by reading — this is the single most common reason a sticky element silently behaves as static.

- [ ] **Step 6: Take the mark out of the bottom bar**

In `components/shell/TabBar.tsx`, delete the `<Link href="/" aria-label="Cinemadraft, home">` block at `:80-89` and the `Wordmark` import. Rewrite the docstring paragraph at `:26-34`: the measurement stays (it is still why *search and the account control* start at `sm`) but it must now say the identity moved to `TopBar` rather than that it is hidden below `sm`, and that the chrome group is two squares now rather than three.

Update `components/shell/TabBar.test.tsx` — any case asserting the wordmark is in the bar now asserts it is **not**, with a comment pointing at `TopBar`. 🔴 Do not simply delete the case: an assertion that the mark is no longer here is what stops it being added back in two places.

- [ ] **Step 7: Update the TV-mode seam guard**

`components/awards/TvModeLink.test.tsx:68-79` asserts `data-app-chrome` appears exactly twice in `AppShell.tsx`. It will now appear three times. Change `toHaveLength(2)` to `toHaveLength(3)` and rewrite the comment above it to name **four** elements: the rail wrapper, the utility strip, the top bar, and the phone tab bar.

🔴 Run it **before** the edit and confirm it is red. A guard you update without watching it fail first is a guard you have not confirmed is wired to anything.

```bash
npx vitest run components/awards/TvModeLink.test.tsx
```

- [ ] **Step 8: Story, and measure in a production build**

Write `components/shell/TopBar.stories.tsx` matching `components/shell/TabBar.stories.tsx`'s format. Check `components/shell/AppShell.stories.tsx` still renders.

🔴 **Measure in `npm run start`, never `next dev`** — a dev server answers 403 for every `_next/static` chunk on `127.0.0.1`, so a measurement there is of an unstyled page.

```bash
npm run build && npm run start
```

At **390px**, on any page under `(app)`:

```js
const top = document.querySelector('[data-app-chrome]');
top.getBoundingClientRect();                       // height ~44, top 0
getComputedStyle(top).position;                    // 'sticky' — NOT 'static'
window.scrollTo(0, 400);
top.getBoundingClientRect().top;                   // still 0 — it actually sticks
document.querySelectorAll('nav[aria-label]').length;  // unchanged: 2
[...document.querySelectorAll('a[href="/"]')].length; // exactly 1 below xl
```

Then at **1440px**: the top bar has `xl:hidden`, so `getComputedStyle(top).display` is `none` and the rail carries identity as before.

Record the real numbers in the commit message. "Looks right" is not a measurement.

- [ ] **Step 9: Mutate, and watch tests go red**

Remove `data-app-chrome` from `TopBar`. Run `npx vitest run components/shell/TopBar.test.tsx components/awards/TvModeLink.test.tsx`. Expected: both FAIL. Restore.

Change `sticky` to `fixed`. Expected: the "reserves its own height" case FAILS. Restore. 🔴 That test reads a class name, which is weaker than reading geometry — jsdom lays nothing out. Say so plainly in the commit message and point at step 8's `getComputedStyle` reading as the real check, rather than letting the unit test stand in for it.

Remove `xl:hidden`. Expected: the "phone and tablet bar only" case FAILS. Restore.

- [ ] **Step 10: Full verification**

```bash
npm run lint && npm run typecheck && npx vitest run && bash scripts/layering.sh
npm run test:e2e
```

🔴 `scripts/layering.sh` names specific shell files as guard exemptions, `TabBar` among them — read its output rather than only its exit code, and if a guard is now disarmed by this change, say so and fix the script rather than letting it pass quietly.

🔴 The e2e suite includes `e2e/smoke.spec.ts`'s three cascade-layer tests and TV mode's browser assertions at 1920. Do not relax any of them to make this pass. A red one means the chrome hook or the layer order actually moved.

- [ ] **Step 11: Commit**

```bash
git add components/shell/TopBar.tsx components/shell/TopBar.test.tsx         components/shell/TopBar.stories.tsx components/shell/AppShell.tsx         components/shell/AppShell.test.tsx components/shell/TabBar.tsx         components/shell/TabBar.test.tsx components/awards/TvModeLink.test.tsx
git commit
```

Message starts `P14.T16: a top bar on a phone, carrying the wordmark`. Record the measured heights and `position` from step 8, that the TV-mode count guard went red before it was updated, the honest limit of the sticky class-name assertion, and that search and the account control were deliberately left where D75 put them.

---

### Task P14.T17: the focus ring on the auth form is clipped

**Not a parity row — the owner reported it with two screenshots**: the carmine focus ring on the email field of `/auth/login` is cut off on the top, bottom and both sides. In the second screenshot it is flush against an invisible edge on every side at once, which is the signature of an `overflow` clip rather than a colour or offset problem.

**The cause, from reading `theme/clerk.ts`:** `FOCUS_RING` (`:27-32`) is `outline: 2px` at `outlineOffset: 2px`, so it paints **4px outside the input's border box**. `card` is set to `padding: 0` (`:147`) so the form fields span the card edge to edge, and `cardBox` carries a `borderRadius` (`:145`). Clerk's own stylesheet puts `overflow: hidden` on that rounded box — which is what a rounded card normally does — so a ring painted outside the field is painted outside the card and clipped away.

🔴 **The ring is not the thing to change.** 2px carmine at a 2px offset is what every other control in the app draws, and `FOCUS_RING`'s docstring records it being set deliberately after measuring Clerk's own `colorRing` treatment and Chrome's default blue fallback. Shrinking the offset to make it fit would make this one form's focus indicator different from the rest of the product, which is worse than the clipping.

**Files:**
- Modify: `theme/clerk.ts`
- Test: `e2e/auth.spec.ts` (a case; read the file first to see what it already covers)

- [ ] **Step 1: Confirm the cause in a browser before changing anything**

🔴 The diagnosis above is from reading, not from measuring — do not trust it. 🔴 And measure in a **production build**, never `next dev`: a dev server answers 403 for every `_next/static` chunk on `127.0.0.1`, so a dev measurement is of an unstyled page.

```bash
npm run build && npm run start
```

On `/auth/login`, focus the email field and read:

```js
const input = document.querySelector('input[name="identifier"]');
const box = input.closest('[class*="cardBox"]') ?? input.closest('div');
getComputedStyle(box).overflow;           // 'hidden' confirms the diagnosis
input.getBoundingClientRect();            // and the card's, to see the 4px overhang
```

If `overflow` is **not** hidden anywhere up the chain, the diagnosis is wrong: find the real cause and rewrite this task before implementing it. Say so in your report either way.

- [ ] **Step 2: Write the failing browser assertion**

In `e2e/auth.spec.ts`, a case that focuses the email field and asserts the ring is not clipped — by geometry, not by a screenshot:

```ts
test('the focus ring on the email field is not clipped', async ({ page }) => {
  await page.goto('/auth/login');
  const input = page.locator('input[name="identifier"]');
  await input.focus();

  // 🔴 The assertion is that the ring's 4px overhang is INSIDE whatever box
  // could clip it. A screenshot comparison would go red for any restyle of
  // this card and tells you nothing about why; this names the defect.
  const clipped = await input.evaluate((el) => {
    const ring = 4; // 2px outline at a 2px offset
    const field = el.getBoundingClientRect();
    for (let node = el.parentElement; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.overflow === 'visible') continue;
      const box = node.getBoundingClientRect();
      if (
        field.top - ring < box.top || field.bottom + ring > box.bottom ||
        field.left - ring < box.left || field.right + ring > box.right
      ) return true;
    }
    return false;
  });

  expect(clipped).toBe(false);
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
npm run test:e2e -- e2e/auth.spec.ts
```

Expected: the new case FAILS with `clipped` true. 🔴 If it passes before the fix, it is not testing the defect the owner photographed — fix the test before touching `theme/clerk.ts`.

- [ ] **Step 4: The fix**

In `theme/clerk.ts`, on the `elements` block:

```ts
    // 🔴 `overflow: visible` because the focus ring paints OUTSIDE the field.
    // `FOCUS_RING` is a 2px outline at a 2px offset — 4px beyond the border box
    // — and `card` has `padding: 0`, so a field spans the card edge to edge and
    // its ring lands outside the rounded box Clerk clips. The ring is not the
    // thing to change: 2px carmine at 2px is what every other control in the
    // app draws, and making this one form's focus indicator smaller to fit
    // would be worse than the clipping it fixes. Reported by the owner with
    // screenshots showing it cut on all four sides at once, which is what an
    // overflow clip looks like and a wrong offset does not.
    cardBox: { width: '100%', boxShadow: 'none', borderRadius: 'var(--radius-sm)', overflow: 'visible' },
    card: { /* …existing… */ overflow: 'visible' },
```

Keep every existing property; add `overflow` to the two. If step 1 found the clipping box to be something else, put it there instead and say which.

- [ ] **Step 5: Run it and watch it pass**

```bash
npm run build && npm run test:e2e -- e2e/auth.spec.ts
```

Expected: PASS, and no other case in that file regresses.

- [ ] **Step 6: Mutate, and watch it go red**

Remove `overflow: 'visible'` from `cardBox`. Expected: the new case FAILS. Restore.

Then check the other direction: nothing that used to be clipped *should* be visible now. Look at the card at 390px and at 1440px in the running build and confirm no content escapes the rounded corner — `overflow: visible` is exactly the kind of fix that trades one visual defect for another. Record what you saw.

- [ ] **Step 7: Full verification and commit**

```bash
npm run lint && npm run typecheck && npx vitest run && npm run test:e2e
```

```bash
git add theme/clerk.ts e2e/auth.spec.ts
git commit
```

Message starts `P14.T17: the focus ring on the auth form is clipped`. Record the `getComputedStyle` reading from step 1, the mutation result, and what step 6's second check showed.

---

## Notes carried into this tranche

- 🔴 **The disconnect log noise is still unfixed** and this tranche doubles it: `⨯ Error: The destination stream closed early.` is logged at error level on every reader cancel, and there are now two streams producing it. Nothing is broken — it is logging hygiene in the `cancel`/abort path. Worth fixing before the first real ceremony so a genuine error is still findable, but it is not this tranche's job and no task here should be widened to take it on.
- **`main` has not been redeployed** since `980781f` fixed `maxDuration`. `dev` is ahead by the CI-trigger, `vercel.json` and flake-fix commits. Merging `dev` → `main` is what deploys; that is the owner's call and no task here does it.
- **Four owner decisions are still open** from the auth work and are untouched by this tranche: `/api/ical/[...slug]` has never been public despite its docstring; `/[...notFound]` shows a stranger a login page; `?redirect_url=` no longer returns a member to the page they asked for; the auth pages carry two `<h1>`s and duplicate "Register" wording.

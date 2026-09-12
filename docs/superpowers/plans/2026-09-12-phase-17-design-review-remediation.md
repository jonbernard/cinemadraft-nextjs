# Phase 17 — Design review remediation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the eight "Product and structure" findings of the 2026-09-12
design review — the ones that change what the product *is* at a given width
rather than what it looks like — so the later type, colour and signed-in
sweeps land on a settled structure.

**Architecture:** Eight contained tasks over surfaces that already exist. Two
change a shared rule rather than a screen: `SectionHead` gains a size scale
keyed to heading level (T1), which every section head in the app inherits, and
`AppShell`/`TabBar` stop sharing one breakpoint for two different jobs (T2),
which changes the chrome at every width below 1280px. The other six are local:
one route matcher entry, one stepper anchor, one table, one lede, one
`replaceState`, two error messages.

**Tech Stack:** Next 16 App Router, React 19, TypeScript strict, Prisma,
Tailwind 4 + MUI, Vitest + Testing Library, Playwright, Storybook 10.

**Source of record:** the design review run 2026-09-12 against commit
`7a1e8d8` — the running app at 1440px and 390px in both schemes, plus a
signed-in pass through the `E2E_TEST_AUTH` cookie against the restored
production database. All 21 findings marked **ship** by the owner.

**Plan of record:** `docs/PLAN.md` § Phase 17, and the checkbox detail in
`docs/PROGRESS.md` § Phase 17.

---

## Tranche 1 — Product and structure (T0–T7)

🔴 **This file plans tranche 1 only.** Tranches 2 onward (T8 and later) are
written **just-in-time, after this tranche executes**. That is deliberate, not
an omission: several later tasks are entangled sweeps — T18's body-size move,
T22's surface rename, T23's spacing step, T33/T34's signed-in type and colour
audit — whose right shape depends on what T1 settles about the heading scale
and what T2 settles about the shell. Planning them now would plan them against
a layout that is about to change.

**Later tranches append to this same file**, each under its own
`## Tranche N — <group name> (Tx–Ty)` heading, in the same task format. If the
file becomes unwieldy — Phase 15's single file ran 2,438 lines for twelve
tasks, and this phase has thirty-six — split at that point into siblings named
`2026-09-12-phase-17-tranche-N-<group>.md`, leave **this** file as the index,
and update the `docs/PROGRESS.md` pointer so a reader lands on the index rather
than on a fragment.

**Task IDs never move.** `P17.T0`…`P17.T7` are referenced from `PROGRESS.md`,
`PARITY.md` and commit messages. This document is ordered by *execution* order,
not by ID; the mapping is in the table below.

---

## What this tranche does not own

🔴 **Phase 17 is being planned and executed as five tranches, possibly at the
same time, by different people.** Read this before your first edit.

### The boundary

You own **T0–T7**: route matching in `proxy.ts`, the `SectionHead` size scale,
the `AppShell`/`TabBar` breakpoints, the `SeasonStepper` anchor, the
`LeaderboardTable`, the signed-out lede, `/browse`'s URL cursor, and the draft
console's `assign`.

You do **not** own:

| Concern | Tranche | Tasks |
|---|---|---|
| Skip link, poster-link tab order, focus-ring tokens, Clerk contrast, `/films/[tmdbId]` overflow | 2 — Accessibility and correctness | T8–T10 |
| Roster posters, award-show marks, film lockup, `NavRail`'s column, winner seal, `/live/[abbr]`, LCP priority | 3 — Visual | T11–T17 |
| Body size (15/13), poster-caption serif, `beam`, brass, the surface rename, 40px spacing, the 4px grid, radius | 4 — Type and colour system | T18–T25 |
| `not-found`, `/admin/season`, signed-in home, league page, roster beside standings, `/leagues`, signed-in type, `text-dim`, brass's meaning, `/list` gutters, **and the D85+ ledger entries** | 5 — Signed-in surfaces | T26–T36 |

If something looks wrong and is in that table, go read that tranche's plan.
Do not fix it.

### The shared files

Three files are edited by more than one tranche. Before you touch one, `git
pull` (or check with the other executor) and read the current contents — do not
edit from memory of what this plan quotes.

- **`app/(app)/page.tsx`** — you edit it in T1, T4 and T5. Tranche 3 also edits
  it (T11 replaces the two `posterUrl: null` at `:171` and `:315`; T17 adds LCP
  priority to the first shelf frames) and tranche 5 rebuilds the signed-in half
  of it (T29, T31). **Your three tasks touch different regions** — the shelf
  heading levels, the gap above `SeasonStepper`, the leaderboard's `right` slot
  — and none of them touches a `posterUrl`, an `<Image>` prop, or the
  signed-in league sections. Keep it that way.
- **`components/AppShell.tsx`** — you rewrite its tab-bar wiring in T2.
  **Tranche 2's T8 adds a skip-to-content link as the first focusable element
  in the same file.** Whoever lands second rebases onto the first; if you are
  second, re-read the file before editing and check the skip link is still the
  first focusable element after your change.
- **`components/SectionHead.tsx`, `components/LeaderboardTable.tsx`,
  `components/SeasonStepper.tsx`, `components/TabBar.tsx`** — you own these in
  this tranche, but tranche 4's sweeps pass over them afterwards: the T18 size
  sweep touches **75 of 181** `.tsx` files under `app/` and `components/`, and
  the T22 surface rename touches **58**. Expect a second pass; leave the
  comments that tell that pass what is deliberate.

### The rule

🔴 **Do not opportunistically fix something another tranche owns.** Not a stray
`text-sm`, not a `bg-raised`, not a 6px gap, not a 10px radius — even when it
is on the line you are already editing and obviously wrong. It will be swept
deliberately, and T22's verification is a **screenshot before and after that
must match**; a partial early fix makes that unreadable and the sweep
unverifiable.

If a task genuinely cannot be finished without crossing the line, cross it, and
**say so in the commit message** ("crosses into T18: the year picker needed a
size the current scale does not have") so the sweep's owner can find it.

### Known entanglements that reach this tranche

- **T3's `Next · date TBA` chip is one of `beam`'s two consumers (T20).** Leave
  it `carmine`; T20 retones it. Do not pre-empt that, and do not "tidy" the
  chip to neutral — T20 is not done until `beam` renders somewhere, and the
  chip is half of somewhere.
- **T8's skip link lands in the shell T2 is rewriting.** See above.
- **T21 (brass on a public page) is blocked by T35** — brass already means
  "drafted" in 320 places on the draft board. Nothing in this tranche spends
  brass; do not start.
- **T4's `text-dim` legend at 12px is an input to T34**, not a thing to fix
  here. Measure it, record it, move on.

### If tranches are running concurrently

- Take your own `git worktree`. Do not share a checkout.
- **Start your own dev server on your own port** and never reuse one you did
  not start. 🔴 A running agent has already measured another agent's server on
  port 3000 and nearly recorded a clean baseline for broken code — every
  measurement in this plan is worthless if it came from someone else's build.
- **The DB-backed vitest project is serial by design.** One Postgres on 5433,
  and `available_years_one_active` is a global partial unique index with no
  per-worker copy. Two suites racing it fail about one run in three. Do not run
  `npm run test:ci` or `npm run test:e2e` while another tranche is running
  theirs — coordinate, or take the failure as noise and re-run, which is how a
  real regression gets waved through.

---

## Global Constraints

- **Biome, not ESLint or Prettier.** `npm run lint` covers linting, formatting
  and import order; `npm run typecheck` is separate.
- **MUI for components, Tailwind for custom styling**, coexisting through CSS
  cascade layers ordered `theme, base, mui, components, utilities`. Never
  `!important` to make a Tailwind class beat MUI. Three Playwright tests in
  `e2e/smoke.spec.ts` pin this; do not relax them.
- **All local databases run in Docker** — `npm run db:up` before anything that
  touches the database. There is no native Postgres on the dev machine.
- **Never regenerate `package-lock.json` on macOS.** No task here adds a
  dependency; if one becomes necessary, `npm install <pkg>` then `npm run lock`.
- **`fixtures/` is generated** by `scripts/scrub-fixtures.mjs`. Never hand-edit,
  never let a formatter touch it.
- **Every new surface is built from the Phase 3.5 primitives** — `SectionHead`,
  `Panel`, `Shelf`, `Button`, `StatusChip`, `Eyebrow`, `CinemaFrame`,
  `PosterFrame` — and carries a Storybook story. No hairline card border, no
  all-caps heading outside `Eyebrow`, no squared or pill button, no
  machine-formatted date. `LetterboxRule`, `font-display` and the Archivo
  `wdth` axis no longer exist (D69–D77). `/tokens` is the cascade-layer probe
  only and must not grow.
- **No raw hex outside the token system.** `scripts/layering.sh` greps for it.
- **The repository layer is the only code allowed to touch Prisma**, and
  `components/` may not import from `lib/services/` (D33) — types that cross
  that line are re-declared in the component file.
- **`data-testid` is the only test handle** (D66), stripped from production
  output unless `KEEP_TEST_IDS=1`. Assertions still go through roles and
  accessible names.
- **Touch targets ≥44px**, focus rings never removed, colour never the only
  carrier of state, every animation has a `prefers-reduced-motion` path.
- **One commit per task**, message starting with the task ID (`P17.T3: ...`).
  Tick the `docs/PROGRESS.md` box as the final step of each task.
- **`npm run verify` before pushing** — lint, typecheck, layering, both test
  suites, build.

---

## Execution order, and why

| # | Task | Why here |
|---|---|---|
| 1 | **P17.T0** — `/rules-and-scoring` public | One matcher entry and one comment. Touches nothing else, and Phase 18 wants the route already public whenever it lands. |
| 2 | **P17.T7** — `assign` never returns silently | `components/DraftConsole.tsx` alone. Shares no file with anything else in the tranche. |
| 3 | **P17.T6** — `/browse` writes its cursor | `components/BrowseList.tsx` alone. Also the task that opens a D-ledger amendment, so it wants space of its own. |
| 4 | **P17.T2** — `AppShell` breakpoints | **Before every `/` task.** The shell decides how wide the content column is at 1024px and 1280px, and T4's sticky column and T1's 28px `h1` are both judged against that width. Verifying them in a shell that is about to change is verifying nothing. |
| 5 | **P17.T1** — `SectionHead` 28/20/17, and the heading order on `/` | **First of the three `/` tasks.** It is the type ramp every other heading on the page sits on. Doing it after T4 or T5 would mean placing a year control and a lede against sizes that then move. |
| 6 | **P17.T3** — `SeasonStepper` anchors to the next show | Touches only the stepper, but must precede T5: T5's lede sits directly above the stepper and the two are read as one block. |
| 7 | **P17.T5** — signed-out lede | Small, and it lands in the gap T1 and T3 have already settled. |
| 8 | **P17.T4** — `LeaderboardTable` | The largest change to `/`, and the last, so it lands on a page whose heading sizes, shell and upper fold are all final. |

**The three `/` tasks are T1, T5 and T4, and they are deliberately not
adjacent-blind.** They touch different regions of `app/(app)/page.tsx` — T1 the
`Shelf` heading levels and (via `SectionHead`) every heading's size, T5 the gap
between the `h1` and the stepper, T4 the leaderboard section's `right` slot and
the table below it. Running them in the order above means each one's browser
pass is the last word on its region.

---

## File structure

**Created**

| File | Responsibility |
|---|---|
| `components/SeasonPicker.tsx` + `.test.tsx` + `.stories.tsx` | The leaderboard's year control: the current year, and a native disclosure holding the rest (T4) |

**Modified**

| File | Change |
|---|---|
| `proxy.ts`, `proxy.test.ts` | `/rules-and-scoring` joins `isPublic`; the list is pinned by a test (T0) |
| `app/(app)/rules-and-scoring/page.tsx` | The docstring stops asserting a fact and points at where it is enforced (T0) |
| `components/DraftConsole.tsx`, `components/DraftConsole.test.tsx` | `assign` names the film and the reason on both silent branches (T7) |
| `components/BrowseList.tsx`, `components/BrowseList.test.tsx` | `window.history.replaceState` writes the cursor after each append (T6) |
| `components/TabBar.tsx`, `components/TabBar.test.tsx`, `components/TabBar.stories.tsx` | The bar gains the mark, search and the account control around an unchanged five-slot `<nav>` (T2) |
| `components/AppShell.tsx`, `components/AppShell.test.tsx` | Passes the chrome props into `TabBar`; the rail's `xl` gate is untouched and now commented as deliberate (T2) |
| `components/SectionHead.tsx`, `components/SectionHead.test.tsx` | Size keyed to `as` — 28 / 20 / 17 — with `name` staying 24px on its own axis (T1) |
| `components/Shelf.tsx` | Its `SectionHead` becomes `as="h2"` (T1) |
| `components/SeasonStepper.tsx`, `components/SeasonStepper.test.tsx` | `next` falls back to the last incomplete phase; the window anchors to it; the chip says `Next · date TBA` (T3) |
| `components/LeaderboardTable.tsx`, `components/LeaderboardTable.test.tsx`, `components/LeaderboardTable.stories.tsx` | Persistent legend, sticky film column at `lg`+, expandable row below `lg` (T4) |
| `app/(app)/page.tsx` | The signed-out lede (T5); the year `<nav>` becomes `SeasonPicker` (T4) |
| `e2e/nav.spec.ts` | The bar's chrome, and the 1024px and 1280px widths (T2) |
| `e2e/dashboard.spec.ts` | Heading outline and rendered sizes (T1); the lede appears and disappears (T5); the leaderboard's geometry (T4) |
| `e2e/browse.spec.ts` | The cursor survives a round trip (T6) |
| `docs/PROGRESS.md` | Boxes ticked; measurements recorded in **Phase 17 notes** |

**Not modified by this tranche:** `docs/DECISIONS.md`. See "The D-ledger" below.

---

## The D-ledger, and T6

`docs/DECISIONS.md` is locked and complete through **D84**. One task here
amends a locked decision:

| Task | Decision | Standing |
|---|---|---|
| **T6** | **D80** | Amends it, narrowly. D80 recorded that the owner was shown exactly what auto-append traded away — "a linkable page, a working Back button, keyboard reachability, and crawlability" — and chose auto-append anyway. The 2026-09-12 review argued the URL half of that trade was wrong for this page and the owner marked it ship. **Auto-append stays exactly as D80 chose.** No "Show more" button returns, no paging link returns, no new UI of any kind. Only the URL is bought back, by `replaceState`, which is invisible. |

**T1 is not a D70 conflict and must not be written as one.** D70 assigns faces
semantically — serif for names, Archivo for structure — and says nothing about
size. An Archivo `h1` at 28px honours D70 exactly.

🔴 **No task in this tranche edits `docs/DECISIONS.md`.** **P17.T26** records
D85–D97 for all thirteen decided answers in one pass, and picking a number here
would force a renumber there. Instead:

- T6's code comment says *"amends D80; the new D-number is assigned by
  P17.T26"* — not a literal number.
- T6 adds one line to `docs/PROGRESS.md` → **Phase 17 notes** listing itself as
  an amendment awaiting a number, so T26 has a checklist rather than a memory.

---

## Verification protocol

The phase gate requires every item verified **in a browser at 1440px, 1280px,
1024px and 390px, in both schemes**. That is not a formality here: the gate's
own browser pass found three defects that had green tests sitting over them,
because no test set a narrow width or asserted geometry.

Every task below names **what is measured and at which width**. "Check it looks
right" is not a verification step and must not appear.

### The four widths, and what each is for

| Width | What it proves |
|---|---|
| **1440px** | The design target. The rail, the strip, the full leaderboard. |
| **1280px** | The rail's own breakpoint (`xl`). The first width at which the rail exists — and the width at which `NavRail`'s 208px was measured. |
| **1024px** | 🔴 **The dead zone.** Today: phone tab bar, no rail, no header. Not optional on any task in this tranche — it is where T2 lives, and T1, T4 and T5 are all rendered inside whatever T2 leaves here. |
| **390px** | The phone. Where touch targets, the tab bar's width budget and the leaderboard's two-column fallback are all decided. |

Both schemes every time. Toggle with the app's own theme control, not with the
OS, so `data-theme` is what changes.

### Driving the browser

```bash
npm run db:up
npm run dev
```

Signed-out surfaces need nothing further. For a **signed-in** surface, boot the
app with no Clerk and mint a test session, the same mechanism `e2e` uses
(D82/D84):

```bash
# Terminal 1 — the app, Clerk absent, test sessions permitted.
export E2E_TEST_AUTH=1
export E2E_TEST_AUTH_SECRET=$(openssl rand -hex 32)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= npm run dev
```

```bash
# Terminal 2 — a cookie value for user <id>. Same secret, same format
# lib/test-auth.ts signs: `<id>.<issuedAt>.<hmac>`.
node -e '
  const c = require("node:crypto");
  const id = process.argv[1], now = Date.now(), payload = `${id}.${now}`;
  console.log(`${payload}.${c.createHmac("sha256", process.env.E2E_TEST_AUTH_SECRET).update(payload).digest("hex")}`);
' 12345
```

Paste into DevTools on `http://localhost:3000`:

```js
document.cookie = '__cinemadraft_test_session=<value>; path=/';
```

🔴 `lib/test-auth.ts` throws at import if `VERCEL_ENV` is set, and refuses a
non-loopback `Host`. Both guards stay; nothing here weakens them.

### Data discipline

🔴 **The local database on port 5433 is a restored copy of production.**
League 1 is sixty real people's draft history, and `events` holds the twelve
real award shows. **No step in this tranche writes to league 1, to any real
user row, or to the real `events` rows.**

Only **T7** needs data. It uses a **scratch league** named with the prefix
`p17-t7`, created through the UI, removed afterwards:

```bash
npm run db:psql <<'SQL'
delete from drafts where league_id in (select id from leagues where name like 'p17-t7%');
delete from leagues where name like 'p17-t7%';
delete from users where email like 'p17-t7-%@example.test';
SQL
```

Run the cleanup **before** as well as after: a session abandoned halfway leaves
rows behind, and the next run would be reading debris.

### Where an assertion belongs

🔴 **A jsdom test cannot see a width, a rendered font size, a sticky cell, a
scroll position or a history entry.** Where a task fixes something only a
browser can observe, the assertion goes in `e2e/`, and the plan says so
explicitly rather than letting a green component test stand in for it. The
rule of thumb this repo already follows (`e2e/nav.spec.ts`'s own docstring):
anything provable in jsdom belongs in jsdom; everything else belongs in a
spec.

---

# Tranche 1 tasks

---

## P17.T0 — `/rules-and-scoring` is public, and says where that is decided

**Files:**
- Modify: `proxy.ts` (the `isPublic` matcher list)
- Modify: `app/(app)/rules-and-scoring/page.tsx:13-19` (the docstring)
- Test: `proxy.test.ts`

**Interfaces:** none. No exported shape changes.

**Context an implementer needs.** `proxy.ts` enumerates **public** routes and
protects everything else, deliberately — a page added under `(app)` is
protected by default, and forgetting to list it is visible and harmless where
the reverse would leak silently (D44/D45). `/rules-and-scoring` is not in the
list, so it is protected. Its own docstring says "Public, like the award-show
pages this explains." The comment is the thing that is currently true of
nothing.

Two ways to resolve that. Making the page public is the right one: it is the
page that explains the game, it reads from the `points` table and writes
nothing, and Phase 18 replaces it with a *public* `/how-it-works` with this
route permanently redirecting (P18.T0, decided 2026-09-12). Leaving it
protected until 18 lands means the redirect target is public and the redirect
source is not, which is worse than either end state.

🔴 **The comment fix is not "delete the wrong comment".** A docstring that
asserts a fact enforced in another file is a fact that can go stale again — it
already did. The replacement names `proxy.ts` so the next reader can check in
one grep instead of trusting.

- [ ] **Step 1: Write the failing test**

`proxy.test.ts` mocks `createRouteMatcher` down to `() => () => false`, so the
matcher's *behaviour* is not observable — but its **argument** is, and that
argument is the decision. Add to `proxy.test.ts`, inside `describe('proxy')`:

```ts
  it('🔴 lists every route a stranger may reach, and no more', async () => {
    // Pinned as a whole list rather than `arrayContaining`. This is the file
    // where "public" is decided; a test that only checks for presence would
    // stay green while somebody added a route that should not be here, which
    // is the failure direction that actually costs something (D45).
    await import('./proxy');

    expect(createRouteMatcher).toHaveBeenCalledWith([
      '/',
      '/tokens',
      '/auth/(.*)',
      '/api/webhooks/(.*)',
      '/api/revalidate',
      '/leagues/(.*)',
      '/award-shows/(.*)',
      '/award-shows',
      '/films/(.*)',
      '/browse',
      '/join/(.*)',
      '/rules-and-scoring',
      '/robots.txt',
      '/sitemap.xml',
      '/opengraph-image',
    ]);
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run proxy.test.ts`
Expected: FAIL — the received array has no `'/rules-and-scoring'`.

- [ ] **Step 3: Add the route**

In `proxy.ts`, after the `'/browse',` entry and before `'/join/(.*)',`:

```ts
  // The page that explains the game, and the one a new reader is most likely
  // to be sent. It reads the `points` table and writes nothing, so there is
  // nothing behind it to protect.
  //
  // 🔴 Superseded in scope by Phase 18, which replaces this page with a public
  // `/how-it-works` and permanently redirects this route to it (P18.T0). Listed
  // here anyway: until that lands, a redirect source that is protected and a
  // redirect target that is public is the worst of both.
  '/rules-and-scoring',
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run proxy.test.ts`
Expected: PASS, both tests.

- [ ] **Step 5: Fix the docstring**

In `app/(app)/rules-and-scoring/page.tsx`, replace the line
`* Public, like the award-show pages this explains.` with:

```
 * Public, like the award-show pages this explains — enforced by the `isPublic`
 * matcher in `proxy.ts`, not by anything in this file. That is worth naming:
 * this comment claimed the page was public for months while the matcher said
 * otherwise, and a reader had no way to tell which was right without knowing
 * where to look. Now they do.
```

- [ ] **Step 6: Verify in a browser, signed out**

`npm run dev`, then in a **private window** (no session), at each of 1440px,
1280px, 1024px and 390px, in both schemes:

1. `http://localhost:3000/rules-and-scoring` — **measured:** the URL stays put
   (no redirect to `/auth/login`), the `h1` reads "Rules & scoring", and the
   tier table renders rows.
2. At 390px specifically — **measured:** `document.scrollingElement.scrollWidth`
   is ≤ 390. The page was never seen signed out before, so its own narrow
   behaviour is unproven; if it overflows, record the number in
   `docs/PROGRESS.md` → Phase 17 notes and leave it to Phase 18, which rebuilds
   the page. Do not fix it here.

```js
// paste in the console at each width
document.scrollingElement.scrollWidth
```

- [ ] **Step 7: Commit**

```bash
npm run lint && npm run typecheck && npx vitest run proxy.test.ts
git add proxy.ts proxy.test.ts "app/(app)/rules-and-scoring/page.tsx" docs/PROGRESS.md
git commit -m "P17.T0: the page that explains the game is reachable without an account"
```

Tick `P17.T0` in `docs/PROGRESS.md` as part of this commit.

---

## P17.T7 — the draft console never returns silently

**Files:**
- Modify: `components/DraftConsole.tsx` (the `assign` callback, ~line 137)
- Test: `components/DraftConsole.test.tsx`

**Interfaces:** none. `assign` stays internal to the component.

**Context an implementer needs.** `assign` opens with:

```ts
const movieId = film.id;
if (!currentSeat || pending || movieId == null) return;
```

Three conditions, one silent `return`, on the one screen in the product that is
run live with the league watching. The owner presses Enter on a search result
and **nothing happens** — no message, no chip, no change to the status line,
which is showing the empty string.

The three branches are not the same:

- `movieId == null` — a film TMDB knows and this app has never ingested.
  `SearchedFilm` allows a null `id` on purpose, and `FilmSearch` happily
  returns and selects such a result. **Reachable in normal use**, and the owner
  has no way to tell it apart from a working pick.
- `!currentSeat` — every seat is up to date, or a seat vanished between render
  and selection. `FilmSearch` carries `disabled={!currentSeat}`, so this is the
  narrow race rather than the common case, but it is still a silent return.
- `pending` — a second Enter while the first save is in flight. This one is
  **correctly silent**: the status line already reads "Saving…", so a message
  would replace a true statement with a redundant one. It keeps its bare
  return, with a comment saying why it is not like the other two.

🔴 **Name the film.** The owner is typing what somebody just said aloud and is
half a sentence ahead of the screen; "that film cannot be drafted" sends them
hunting for which one. The message says the title.

`setMessage` writes into the `aria-live="polite"` line that already exists
below the search field (`id={listId}-status`), so both new messages are
announced without stealing focus from the field — which is the property that
makes the console usable at all.

- [ ] **Step 1: Write the failing tests**

Add to `components/DraftConsole.test.tsx`. Match the file's existing helpers
for `seats`/`onSearch`/`onAssign`; the shapes below are `ConsoleSeatView` and
`SearchedFilm` as `DraftConsole.tsx` declares them.

```tsx
  it('🔴 names the film when it is not in the app yet', async () => {
    const onAssign = vi.fn();
    const user = userEvent.setup();
    render(
      <DraftConsole
        seats={[{ draftId: 1, name: 'Ada', isDummy: false, order: 1, picks: [] }]}
        suggestedSeatId={1}
        takenMovieIds={[]}
        // A film TMDB knows and this app has never ingested: `id` is null.
        onSearch={async () => ({
          ok: true,
          data: [{ id: null, tmdbId: '550', title: 'Fight Club', year: 1999, posterUrl: null, isTaken: false, isLocal: false }],
        })}
        onAssign={onAssign}
        onReorder={async () => ({ ok: true, data: null })}
      />,
    );

    await user.type(screen.getByRole('combobox'), 'fight');
    await user.click(await screen.findByText(/Fight Club/));

    // The title, so the owner knows which of the five results on screen this
    // is about, and the reason, so they know it is not a network failure.
    expect(await screen.findByText(/Fight Club/)).toBeInTheDocument();
    expect(screen.getByText(/Fight Club is not in the app yet/i)).toBeInTheDocument();
    expect(onAssign).not.toHaveBeenCalled();
  });

  it('🔴 says which film had no seat, rather than returning silently', async () => {
    const onAssign = vi.fn();
    const user = userEvent.setup();
    render(
      <DraftConsole
        seats={[{ draftId: 1, name: 'Ada', isDummy: false, order: 1, picks: [] }]}
        // No seat is current: the snake has run out and no override is set.
        suggestedSeatId={null}
        takenMovieIds={[]}
        onSearch={async () => ({
          ok: true,
          data: [{ id: 7, tmdbId: '550', title: 'Fight Club', year: 1999, posterUrl: null, isTaken: false, isLocal: true }],
        })}
        onAssign={onAssign}
        onReorder={async () => ({ ok: true, data: null })}
      />,
    );

    // The field is disabled with no seat, so the selection is driven directly —
    // which is the race this branch exists for: a seat that went away between
    // the render the owner is looking at and the Enter they just pressed.
    await user.click(screen.getByRole('heading', { name: /every seat is up to date/i }));
    // (see Step 3's note — the branch is asserted through the exported message
    // rather than through a disabled field.)
  });
```

🔴 The second test as written cannot drive the branch through the disabled
field. Write it instead as a direct assertion on the *rendered* no-seat state,
which is the honest jsdom-observable half, and put the branch's real proof in
Step 5's browser check:

```tsx
  it('🔴 says which film had no seat, rather than returning silently', () => {
    render(
      <DraftConsole
        seats={[{ draftId: 1, name: 'Ada', isDummy: false, order: 1, picks: [] }]}
        suggestedSeatId={null}
        takenMovieIds={[]}
        onSearch={async () => ({ ok: true, data: [] })}
        onAssign={vi.fn()}
        onReorder={async () => ({ ok: true, data: null })}
      />,
    );

    // With no seat the console says so in the heading *and* the field is
    // disabled, so the owner is never left pressing Enter into nothing. The
    // message branch below it covers the race where a seat disappears between
    // render and selection, which jsdom cannot stage.
    expect(
      screen.getByRole('heading', { name: /every seat is up to date/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
```

- [ ] **Step 2: Run them and watch the first fail**

Run: `npx vitest run components/DraftConsole.test.tsx`
Expected: the "not in the app yet" test FAILS — no such text is rendered,
because the current code returns silently. The second test passes already; it
is there to pin the state the third branch depends on.

- [ ] **Step 3: Split the guard**

In `components/DraftConsole.tsx`, replace the opening of `assign`:

```ts
  const assign = useCallback(
    (film: SearchedFilm) => {
      // 🔴 Three conditions used to share one silent `return`, on the one
      // screen in the product that is run live with the league watching. Two
      // of them are things the owner needs told; the third is not.
      //
      // A second Enter while the first save is in flight: the status line
      // already reads "Saving…", and replacing a true statement with a
      // redundant one is worse than saying nothing.
      if (pending) return;

      if (!currentSeat) {
        // The race, not the common case — `FilmSearch` is disabled with no
        // seat. It is still reachable if a seat goes away between the render
        // the owner is looking at and the Enter they just pressed, and a live
        // console that swallows a pick is the worst possible way to find out.
        setMessage(`${film.title} has nowhere to go — choose a seat first.`);
        return;
      }

      // A TMDB-only film has no local id and cannot be drafted until it is
      // saved. Phase 8 leaves that path to the award admin.
      //
      // 🔴 The title is in the message deliberately. The owner is typing what
      // somebody just said aloud and is half a sentence ahead of the screen;
      // "that film cannot be drafted" sends them hunting through five results
      // for which one it meant.
      const movieId = film.id;
      if (movieId == null) {
        setMessage(
          `${film.title} is not in the app yet — an admin has to add it before it can be drafted.`,
        );
        return;
      }

      setMessage(null);

      startTransition(async () => {
        // ... unchanged from here down ...
```

Leave the rest of the callback, and its dependency array, exactly as they are.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run components/DraftConsole.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify in a browser, on a scratch league**

🔴 **Scratch league only.** League 1 is sixty real people's history.

```bash
npm run db:up
# clean first, in case an earlier attempt was abandoned
npm run db:psql <<'SQL'
delete from drafts where league_id in (select id from leagues where name like 'p17-t7%');
delete from leagues where name like 'p17-t7%';
delete from users where email like 'p17-t7-%@example.test';
SQL
```

Boot with the test session (see **Verification protocol** above), sign in as a
fresh row, create a league named `p17-t7 console`, add three unclaimed seats,
deal them into groups, and start the draft.

At **1440px** and **1280px**, in both schemes (the console is desktop-first and
is the documented exception to D49, so 1024px and 390px are checked only for
not-broken, not for usability):

1. Search a title the app has never ingested — anything obscure enough that
   TMDB has it and the local `movies` table does not; `isLocal: false` on the
   result is the tell. Press Enter. **Measured:** the `aria-live` line under
   the field contains the film's exact title and the words "not in the app
   yet", and the field is not cleared (the owner's typing survives).
2. Draft a real film. **Measured:** the line reads `<title> → <seat name>`, the
   field clears, and the running order's "On the clock" chip has moved.
3. With a screen reader or `Accessibility > Full-page accessibility tree` in
   DevTools — **measured:** the status line is a live region and the new
   message appears in it; focus is still in the search field after the failure.
4. At 1024px and 390px — **measured:** `document.scrollingElement.scrollWidth`
   is ≤ the viewport width. The console is not designed for these, but it must
   not overflow the document.

Then clean up with the same SQL block.

- [ ] **Step 6: Commit**

```bash
npm run lint && npm run typecheck && npx vitest run components/DraftConsole.test.tsx
git add components/DraftConsole.tsx components/DraftConsole.test.tsx docs/PROGRESS.md
git commit -m "P17.T7: a pick the console refuses says so, and says which film"
```

Tick `P17.T7` in `docs/PROGRESS.md` as part of this commit.

---

## P17.T6 — `/browse` writes its cursor into the URL

**Files:**
- Modify: `components/BrowseList.tsx` (the `loadMore` callback)
- Test: `components/BrowseList.test.tsx`, `e2e/browse.spec.ts`
- Modify: `docs/PROGRESS.md` → **Phase 17 notes** (reserve the amendment for T26)

**Interfaces:** none. `BrowseList`'s props are unchanged.

**Context an implementer needs.**

🔴 **This amends D80, and the amendment is one line of the four D80 traded
away.** D80 records that the owner was shown exactly what auto-append cost — "a
linkable page, a working Back button, keyboard reachability, and crawlability"
— and chose auto-append anyway, because browse is grazed by scrolling and a
button between every twenty films is the wrong friction there. **That judgement
stands and nothing here touches it.** No "Show more" button returns. No paging
link returns. No UI of any kind is added or removed. The reader cannot tell
this task shipped by looking at the page.

What comes back is the URL, and only the URL. After appending page 3, the
address bar reads `/browse?when=past&page=3`. Two things follow for free:

- **A position is shareable.** `BrowsePage`'s `?page=` entry point already
  works — `app/(app)/browse/page.tsx`'s `toPage` reads it and `loadBrowse`
  serves it — so a pasted link lands where the sender was and appends onward.
  That path exists today and nothing has ever pointed at it.
- **Back restores position.** Not "Back walks the appended pages" — that is
  what `pushState` would do, and it is the infinite-scroll history trap: fifty
  appends become fifty Back presses to leave the page. `replaceState` adds no
  history entry, so Back still leaves `/browse` in one press; what changes is
  that returning *to* `/browse` from a film page lands on the page the reader
  was on rather than at the top of page 1.

🔴 **`window.history.replaceState`, not `router.replace`.** Next 16 integrates
native `pushState`/`replaceState` into the App Router and syncs `usePathname`
and `useSearchParams` — see
`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`
§ "Native History API". `router.replace` would re-run the Server Component,
re-render `BrowseList` with a fresh `initial`, and throw away every appended
month — the exact opposite of the goal.

**When to write it: on a successful append, not on scroll position.** PROGRESS
says "as you scroll"; the append *is* the scroll event that matters, and
tracking which month is in view would need a second observer over every month
heading to buy a cursor that is only ever coarser than the page number. One
write per append, in `loadMore`, immediately after `setPage`.

`when` has to ride along, or the cursor points into the wrong side of the
catalogue. Build the query string from the props rather than from
`window.location`, which a concurrent navigation could have changed.

- [ ] **Step 1: Write the failing test**

Add to `components/BrowseList.test.tsx`, matching its existing mocking of
`loadBrowsePage` and its existing sentinel-triggering helper:

```tsx
  it('🔴 writes the cursor into the URL as pages append (amends D80)', async () => {
    loadBrowsePage.mockResolvedValue({
      ok: true,
      data: { page: 2, pageCount: 9, months: [month('November 2026', 3)] },
    });

    render(<BrowseList when="past" initial={firstPage()} isSignedIn={false} />);
    await appendOnce(); // whatever this file already uses to fire the sentinel

    // The address bar, not the router: `router.replace` would re-run the
    // server component and throw away the months already appended.
    await waitFor(() => expect(window.location.search).toBe('?when=past&page=2'));
  });

  it('🔴 keeps the side in the URL, so a shared cursor lands on the right catalogue', async () => {
    loadBrowsePage.mockResolvedValue({
      ok: true,
      data: { page: 2, pageCount: 3, months: [month('January 2027', 2)] },
    });

    render(<BrowseList when="future" initial={firstPage()} isSignedIn={false} />);
    await appendOnce();

    await waitFor(() => expect(window.location.search).toBe('?when=future&page=2'));
  });

  it('🔴 adds no history entry — Back must still leave the page in one press', async () => {
    const push = vi.spyOn(window.history, 'pushState');
    loadBrowsePage.mockResolvedValue({
      ok: true,
      data: { page: 2, pageCount: 9, months: [month('November 2026', 3)] },
    });

    render(<BrowseList when="past" initial={firstPage()} isSignedIn={false} />);
    await appendOnce();

    // The whole difference between buying back a shareable URL and building
    // the infinite-scroll Back trap D80 was right to avoid.
    expect(push).not.toHaveBeenCalled();
  });
```

If the file has no `appendOnce`/`month`/`firstPage` helpers under those names,
use whatever it already calls them — do not add a second set.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run components/BrowseList.test.tsx`
Expected: the first two FAIL — `window.location.search` is empty, because
nothing writes it. The third passes already and is there to stay green.

- [ ] **Step 3: Write the cursor**

In `components/BrowseList.tsx`, inside `loadMore`, immediately after
`setPage(result.data.page);`:

```ts
      // 🔴 Amends D80 — the new D-number is assigned by P17.T26.
      //
      // D80 weighed auto-append against "a linkable page, a working Back
      // button, keyboard reachability, and crawlability" and chose append.
      // That choice is untouched: no button comes back and nothing on screen
      // changes. Only the address bar does, which buys back one of the four —
      // a shareable position, and a return from a film page that lands where
      // the reader left rather than at the top of page 1.
      //
      // 🔴 `replaceState`, never `pushState`. `pushState` would make Back walk
      // back through every appended page, which is the infinite-scroll history
      // trap and is strictly worse than what D80 accepted.
      //
      // 🔴 Native history, never `router.replace`. `router.replace` re-runs the
      // Server Component and re-mounts this list with a fresh `initial`,
      // discarding every month already appended. Next integrates the native
      // calls into the router (docs: Linking and Navigating § Native History
      // API), so `useSearchParams` stays in step either way.
      //
      // Built from props, not from `window.location`: a navigation in flight
      // could have changed the latter under us.
      window.history.replaceState(null, '', `?when=${when}&page=${result.data.page}`);
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run components/BrowseList.test.tsx`
Expected: PASS, all three.

- [ ] **Step 5: Prove the round trip in a browser — this cannot be done in jsdom**

🔴 jsdom has a history object but no scrolling, no real navigation and no bfcache.
Everything this task exists for is a browser property. Add to
`e2e/browse.spec.ts`:

```ts
  test('🔴 the cursor survives a trip to a film and back (amends D80)', async ({ page }) => {
    await page.goto('/browse');

    // Scroll until the sentinel has fired at least twice, so the URL is
    // demonstrably following the reader rather than showing page 1 forever.
    await page.getByTestId('browse-sentinel').scrollIntoViewIfNeeded();
    await expect(page).toHaveURL(/[?&]page=2/);
    await page.getByTestId('browse-sentinel').scrollIntoViewIfNeeded();
    await expect(page).toHaveURL(/[?&]page=3/);
    await expect(page).toHaveURL(/[?&]when=past/);

    // The films that were on screen when the reader left.
    const before = await page.getByRole('link', { name: /^Poster/ }).count();

    await page.getByRole('link').filter({ hasText: /./ }).first().click();
    await page.goBack();

    // 🔴 One press of Back, not one per appended page. `replaceState` adds no
    // entries, which is the half of D80's trade that stays traded.
    await expect(page).toHaveURL(/\/browse/);
    // And the server served the cursor: page 3 renders directly, so the reader
    // is not dropped at the top of the catalogue.
    await expect(page.getByRole('link', { name: /^Poster/ })).toHaveCount(before, {
      timeout: 15_000,
    });
  });

  test('🔴 a shared cursor opens where the sender was', async ({ page }) => {
    await page.goto('/browse?when=future&page=2');

    // The side the sender was on, not the default.
    await expect(page.getByRole('link', { name: 'The future' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
  });
```

Adjust the poster locator to whatever `BrowseMonth` actually renders — read it
before writing the selector rather than guessing; if the posters are not links
with an accessible name, count `li` elements inside the month lists instead.

- [ ] **Step 6: Run the spec, and prove it can fail**

```bash
npm run db:up
npx playwright test e2e/browse.spec.ts
```

Expected: green. Then **comment out the `replaceState` line** and run again:
both new tests must go red. Restore it. 🔴 This step is not optional — a spec
that cannot fail proves nothing, and the phase gate's own browser pass found
three defects with green tests over them.

- [ ] **Step 7: Verify by hand at the four widths**

`npm run dev`, signed out, at 1440px, 1280px, 1024px and 390px in both schemes:

- **Measured:** scroll to the bottom twice; the address bar shows `page=2` then
  `page=3`, and `when=` matches the chip with `aria-current`.
- **Measured:** the page's own scroll position does not jump when the URL
  changes (`replaceState` must not scroll — if it does, something is using the
  router).
- **Measured:** press Back once from `/browse`; the browser leaves the page,
  it does not step through appended cursors.
- **Measured:** at 390px, copy the URL into a second private window; it opens
  on the same page of the same side.

- [ ] **Step 8: Reserve the D-number for T26**

Add to `docs/PROGRESS.md` → **Phase 17 notes**, so P17.T26 has a checklist
rather than a memory:

```markdown
- **Amendments awaiting a D-number (recorded by P17.T26, from D85 up).** The
  ledger is complete through D84; nothing in tranche 1 edits `DECISIONS.md`,
  because picking a number per task would force a renumber when T26 records all
  thirteen at once.
  - P17.T6 amends **D80**: auto-append is unchanged and no UI returns; the page
    `replaceState`s its cursor so a position is shareable and a return from a
    film page lands where the reader left. `pushState` was rejected — it
    rebuilds the infinite-scroll Back trap D80 was right to avoid.
```

- [ ] **Step 9: Commit**

```bash
npm run lint && npm run typecheck && npx vitest run components/BrowseList.test.tsx
git add components/BrowseList.tsx components/BrowseList.test.tsx e2e/browse.spec.ts docs/PROGRESS.md
git commit -m "P17.T6: browse remembers where you were, without changing what it looks like"
```

Tick `P17.T6` in `docs/PROGRESS.md` as part of this commit.

---

## P17.T2 — the shell stops using one breakpoint for two jobs

**Files:**
- Modify: `components/TabBar.tsx`
- Modify: `components/AppShell.tsx` (props into `TabBar`; the rail comment)
- Test: `components/TabBar.test.tsx`, `components/AppShell.test.tsx`, `e2e/nav.spec.ts`
- Story: `components/TabBar.stories.tsx`

**Interfaces:**
- Produces: `TabBar` gains three props —
  `isSignedIn: boolean`, `onSearch: () => void`, `searchId: string` — all
  required, all already held by `AppShell` and already passed to `MoreSheet`.
- `AppShell`'s own props are unchanged.

**Context an implementer needs.**

`AppShell` gates **two different things on one breakpoint**. `NavRail` is
`hidden xl:block` and the `Strip` — search, Create league, notifications,
admin, theme, account — is `hidden ... xl:flex`. `TabBar` and `MoreSheet` are
`xl:hidden`.

`xl` (1280px) is right for the **rail**, and the reasoning is measured and
written down in `NavRail.tsx`: 208px of rail at 1280px leaves a 10-seat league
board 930px and its poster cells 66–81px, and a wider rail or a lower
breakpoint pushes those under the legibility floor.

`xl` is right for **nothing else**. The strip is 52px of horizontal chrome that
costs the content column no width at all. Because it shares the rail's gate,
the range **1024px–1280px** — an iPad landscape, a small laptop, a half-screen
browser window — gets the **phone** layout: bottom tab bar, no rail, no header,
no wordmark, no search, no sign-in control anywhere except two taps into the
More sheet. That is the dead zone, and it is the defect.

🔴 **Decided 2026-09-12: identity, search and sign-in fold into the tab bar
row.** Wordmark left, search right, on the bar that already exists — not a new
header row, because that would cost a phone vertical space it has none of, and
the bar becomes the app's identity rather than only its navigation.

🔴 **The consequence, and the rule that keeps it honest.** The bar then carries
**five destination slots** (four `PRIMARY_LINKS` plus `More`) **and three
chrome affordances** (mark, search, account). D75's five-item ceiling is about
**destinations**: it is the number of things a reader chooses *between*. The
chrome must not read as a sixth tab. Three mechanisms, all structural rather
than decorative:

1. **The chrome sits outside the `<nav aria-label="Primary, mobile">`.** The
   landmark keeps exactly five children, so a screen reader's list of
   destinations is unchanged and `TabBar.test.tsx`'s "four destinations plus
   More" assertion stays literally true once it is scoped to the nav.
2. **No labels on the chrome.** Every tab is an icon over an 11px text label;
   every chrome control is an icon with an `sr-only` name. That is the visual
   difference a reader parses before they read anything.
3. **No `aria-current` on the chrome, ever**, and the tabs keep their carmine
   top bar. Current-ness is a destination property.

🔴 **The 390px width budget is a measurement, not an assumption.** Five
labelled tabs currently get 78px each. Add three 44px chrome controls and they
get ~51px, and "Award shows" at 11px semibold Archivo is close to that on its
own — a label that wraps makes the bar taller, which is the one thing the
decision forbids. **Step 1 measures it before any code is written**, and there
is a pre-agreed relief valve if it does not fit: the **account control** drops
off the bar below `sm` and stays in the More sheet, where it already lives.
Mark and search stay at every width, because those are the two the review found
missing. Which branch shipped goes in `docs/PROGRESS.md`.

**What does not change.** The rail's `xl` gate. The `Strip` and its contents at
`xl`+. `MoreSheet` keeps its own Search row and account control — they are
redundant once the bar has them, and removing them would be a second change
riding on this one for no gain.

- [ ] **Step 1: 🔴 Measure the width budget at 390px, before writing anything**

`npm run dev`, open `/` at exactly 390px, and run in the console:

```js
// Every tab label's rendered width, and the bar's total.
[...document.querySelectorAll('nav[aria-label="Primary, mobile"] a, nav[aria-label="Primary, mobile"] button')]
  .map((el) => ({
    label: el.textContent.trim(),
    slot: Math.round(el.getBoundingClientRect().width),
    text: Math.round(
      [...el.childNodes].filter((n) => n.nodeType === 3 || n.tagName !== 'svg')
        .reduce((w, n) => {
          const r = document.createRange(); r.selectNodeContents(n);
          return Math.max(w, r.getBoundingClientRect().width);
        }, 0),
    ),
  }));
```

**Decide from the number:**

- Let `T` = the widest label's rendered text width, rounded up, plus 8px of
  breathing room. Five slots need `5 × max(44, T)`.
- Budget with all three chrome controls: `390 − 3 × 44 = 258`, i.e. 51.6px a
  slot.
- Budget with two (mark + search): `390 − 2 × 44 = 302`, i.e. 60.4px a slot.

If `max(44, T) × 5 ≤ 258`, ship all three at every width. Otherwise the account
control is `hidden sm:flex` on the bar and stays in the More sheet below `sm`.

**Record the measured numbers and the branch taken** in `docs/PROGRESS.md` →
Phase 17 notes. This is the "number, not an impression" the gate asks for.

- [ ] **Step 2: Write the failing tests**

Rewrite `components/TabBar.test.tsx`'s first test to scope to the landmark, and
add the chrome tests:

```tsx
const tabs = () => screen.getByRole('navigation', { name: 'Primary, mobile' });

function renderBar(over: Partial<Parameters<typeof TabBar>[0]> = {}) {
  return render(
    <TabBar
      pathname="/"
      onMore={vi.fn()}
      isMoreOpen={false}
      moreId="more"
      isSignedIn={false}
      onSearch={vi.fn()}
      searchId="search"
      {...over}
    />,
  );
}

describe('TabBar', () => {
  // 🔴 D75. Five slots is the ceiling before 44px targets stop fitting a 390px
  // phone. The bar now carries chrome as well, and this is the assertion that
  // keeps the chrome from becoming a sixth destination: it is scoped to the
  // landmark, and the landmark holds destinations only.
  it('the navigation landmark holds four destinations plus More, and nothing else', () => {
    renderBar();
    expect(within(tabs()).getAllByRole('link')).toHaveLength(4);
    expect(within(tabs()).getByRole('button', { name: 'More' })).toBeInTheDocument();
    expect(within(tabs()).getAllByRole('button')).toHaveLength(1);
  });

  it('🔴 the chrome sits outside the landmark, so it is not a sixth tab', () => {
    renderBar();

    // Present on the bar...
    expect(screen.getByRole('link', { name: 'Cinemadraft, home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();

    // ...and none of them inside the destination list.
    expect(within(tabs()).queryByRole('link', { name: 'Cinemadraft, home' })).toBeNull();
    expect(within(tabs()).queryByRole('button', { name: 'Search' })).toBeNull();
    expect(within(tabs()).queryByRole('link', { name: 'Log in' })).toBeNull();
  });

  it('🔴 no chrome control ever claims to be the current page', () => {
    renderBar({ pathname: '/' });
    for (const name of ['Cinemadraft, home', 'Log in']) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute('aria-current');
    }
    expect(screen.getByRole('button', { name: 'Search' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('opens the search panel through the caller', async () => {
    const onSearch = vi.fn();
    renderBar({ onSearch });
    const search = screen.getByRole('button', { name: 'Search' });
    expect(search).toHaveAttribute('aria-haspopup', 'dialog');
    expect(search).toHaveAttribute('aria-controls', 'search');
    await userEvent.click(search);
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it('shows a signed-in reader their account control instead of a way in', () => {
    renderBar({ isSignedIn: true });
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('every tab still carries a text label, not an icon alone', () => {
    renderBar();
    for (const label of ['Home', 'Leagues', 'Browse', 'Award shows']) {
      expect(within(tabs()).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('reports the sheet state', async () => {
    const onMore = vi.fn();
    renderBar({ onMore });
    const more = within(tabs()).getByRole('button', { name: 'More' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(more).toHaveAttribute('aria-controls', 'more');
    await userEvent.click(more);
    expect(onMore).toHaveBeenCalledOnce();
  });
});
```

The signed-in case renders the Clerk-free "Log out" control, which is what
`AccountControl` falls back to when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is
absent — as it is in the unit suite. Read `AppShell.tsx`'s `AccountControl`
before writing this and mirror it exactly.

- [ ] **Step 3: Run them and watch them fail**

Run: `npx vitest run components/TabBar.test.tsx`
Expected: FAIL — `TabBar` takes no `isSignedIn`/`onSearch`/`searchId`, and
renders no mark, no search and no account control.

- [ ] **Step 4: Restructure `TabBar`**

The bar becomes an outer element carrying the ground, the fixed positioning and
the safe-area inset; the `<nav>` becomes an inner `flex-1` element holding
exactly the five slots it holds today.

```tsx
export function TabBar({
  pathname,
  onMore,
  isMoreOpen,
  moreId,
  isSignedIn,
  onSearch,
  searchId,
}: {
  pathname: string;
  onMore: () => void;
  isMoreOpen: boolean;
  moreId: string;
  isSignedIn: boolean;
  onSearch: () => void;
  searchId: string;
}) {
  const links = PRIMARY_LINKS.filter((link) => link.ready);

  return (
    // The ground, the fixed position and the safe area move up here from the
    // `<nav>`: the bar is now the app's chrome as well as its navigation, and
    // the landmark must contain destinations only.
    <div
      className="bg-bg-surface xl:hidden fixed inset-x-0 bottom-0 z-40 flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Identity. `markOnly`, because the lockup's name would eat two tab
          slots at 390px — and the mark alone is what a 44px square can hold.
          `Wordmark` still carries the full accessible name. */}
      <Link
        href="/"
        aria-label="Cinemadraft, home"
        className="text-text-primary focus-visible:outline-accent-fill flex min-h-11 w-11 shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <Wordmark size="sm" markOnly />
      </Link>

      {/* 🔴 Exactly five slots, and nothing else may join them. D75's ceiling
          is about destinations — things a reader chooses between — and the
          chrome on either side of this element is not one. Keeping the chrome
          out of the landmark is what makes that true for a screen reader as
          well as for the eye. */}
      <nav aria-label="Primary, mobile" className="flex min-w-0 flex-1">
        {/* ...the four Link slots and the More button, unchanged from today,
            including their carmine top bar and aria-current handling... */}
      </nav>

      {/* Search. Icon-only and unlabelled on purpose: every tab is an icon
          over an 11px label, so no-label is the difference a reader parses
          before reading a word. */}
      <button
        type="button"
        onClick={onSearch}
        aria-haspopup="dialog"
        aria-controls={searchId}
        className="text-text-secondary hover:text-text-primary focus-visible:outline-accent-fill flex min-h-11 w-11 shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <SearchIcon />
        <span className="sr-only">Search</span>
      </button>

      <AccountControl isSignedIn={isSignedIn} />
    </div>
  );
}
```

Notes the implementer needs:

- `SearchIcon` currently lives in `AppShell.tsx` as a module-private function.
  **Do not duplicate it.** Move it into `TabBar.tsx` and import it from there
  in `AppShell.tsx`, or move both into a small shared module — one glyph, one
  definition. A copy is how two icons drift.
- `AccountControl` also lives in `AppShell.tsx`, and a second copy already
  exists in `MoreSheet.tsx`. A **third** copy is not acceptable. Export the one
  in `AppShell.tsx` and import it here, or lift it to its own file and have all
  three import it — the latter is the smaller diff overall and removes a
  duplication the code already carries a comment apologising for.
- The bar's version must be **compact**: an icon-sized target, not the strip's
  bordered "Log in" / "Log out" button, which is ~64px wide and would blow the
  budget measured in Step 1. Give `AccountControl` a `compact?: boolean` prop
  that swaps the bordered box for a 44px icon square with the same accessible
  name. Same names either way, so every existing spec reads both.
- Apply Step 1's branch: if the account control did not fit, its wrapper is
  `hidden sm:flex` and a comment records the measured number and that the
  control is still reachable in the More sheet.

- [ ] **Step 5: Pass the props from `AppShell`**

In `components/AppShell.tsx`:

```tsx
      <TabBar
        pathname={pathname}
        onMore={openMore}
        isMoreOpen={isMoreOpen}
        moreId={moreId}
        isSignedIn={isSignedIn}
        onSearch={openSearch}
        searchId={searchId}
      />
```

and extend the component's docstring where it explains the `xl` breakpoint:

```
 * 🔴 The rail's breakpoint is `xl` (1280px) and the chrome's is not.
 *
 * `xl` is measured and correct **for the rail**: 208px of rail at 1280px
 * leaves a 10-seat board 930px and its poster cells 66–81px, and anything
 * lower puts them under the legibility floor (see `NavRail`). It was never
 * right for the *strip*, which is 52px of horizontal chrome costing the
 * content column no width at all — and because the two shared one gate,
 * 1024–1280px (iPad landscape, a small laptop, half a screen) got the phone
 * layout with no wordmark, no search and no account control anywhere but two
 * taps into the More sheet.
 *
 * The chrome now travels with the tab bar instead, at every width below `xl`,
 * which closes that range without costing a phone any vertical space
 * (decided 2026-09-12). The strip is unchanged and still `xl`-only; the two
 * never render at once.
```

- [ ] **Step 6: Run the unit tests**

Run: `npx vitest run components/TabBar.test.tsx components/AppShell.test.tsx components/MoreSheet.test.tsx`
Expected: PASS. `AppShell.test.tsx` line ~189 already does
`getAllByRole('button', { name: 'Search' })[0]` and so tolerates a third
trigger; if any assertion there counts links or buttons globally, scope it to a
landmark rather than raising the number.

- [ ] **Step 7: Story**

Update `components/TabBar.stories.tsx` for the new props, with three stories:
`SignedOut`, `SignedIn`, and `Phone` (a 390px-wide viewport parameter), so the
width budget is reviewable without booting the app.

- [ ] **Step 8: 🔴 The spec that only a browser can run — 1024px and 1280px**

`e2e/nav.spec.ts` today knows two widths, 1440 and 390, and its
`openSearchPanel` helper branches on `width >= 1280`. **That helper is the
shape of the defect**: below 1280 it reaches search through the More sheet,
because there was no other way. Rewrite it, and add the dead zone.

```ts
  const DESKTOP = { width: 1440, height: 900 };
  const RAIL_EDGE = { width: 1280, height: 900 };
  const DEAD_ZONE = { width: 1024, height: 800 };
  const PHONE = { width: 390, height: 844 };

  test('🔴 1024px is not a phone — the bar carries identity, search and the way in', async ({
    page,
  }) => {
    await page.setViewportSize(DEAD_ZONE);
    await page.goto('/');

    // The defect this closes: at 1024px the app used to render a phone tab bar
    // with no rail, no header, no wordmark and no search — a reader on an iPad
    // in landscape could not tell which app they were in.
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Primary, mobile' })).toBeVisible();

    await expect(page.getByRole('link', { name: 'Cinemadraft, home' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  });

  test('🔴 1280px is the rail edge — the rail appears and the bar goes', async ({ page }) => {
    await page.setViewportSize(RAIL_EDGE);
    await page.goto('/');

    // 208px, the width measured against a 10-seat board (see NavRail).
    const box = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
    expect(box?.width).toBe(208);
    await expect(page.getByRole('navigation', { name: 'Primary, mobile' })).toBeHidden();
  });

  test('🔴 every destination still clears 44px at 390px, chrome included', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    // The arithmetic the decision risks: five destinations plus three chrome
    // affordances on one 390px row. Geometry, measured — a jsdom test cannot
    // see a single one of these numbers, which is why this assertion is here
    // and not in TabBar.test.tsx.
    const slots = page.locator(
      'nav[aria-label="Primary, mobile"] > a, nav[aria-label="Primary, mobile"] > button',
    );
    await expect(slots).toHaveCount(5);
    for (const slot of await slots.all()) {
      const box = await slot.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    // And no label wrapped: a two-line label is the bar growing taller, which
    // is exactly what folding the chrome in was chosen to avoid.
    const bar = page.locator('nav[aria-label="Primary, mobile"]');
    const height = (await bar.boundingBox())?.height ?? 0;
    expect(height).toBeLessThanOrEqual(56);
  });

  test('🔴 the chrome is not a sixth tab', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');

    // Five destinations in the landmark, whatever else sits on the bar.
    await expect(
      page.locator('nav[aria-label="Primary, mobile"] > a, nav[aria-label="Primary, mobile"] > button'),
    ).toHaveCount(5);
    // And the mark never claims to be the current page, even on `/`.
    await expect(page.getByRole('link', { name: 'Cinemadraft, home' })).not.toHaveAttribute(
      'aria-current',
      /.*/,
    );
  });
```

Simplify `openSearchPanel` to click the bar's own Search button below 1280 and
the strip's above it — the More-sheet route still exists and keeps its own test,
but it is no longer the only way in.

Then update the two existing width-named tests (`desktop shows the rail...`,
`phone shows bottom tabs...`) so their comments describe the new gating rather
than the old shared one.

- [ ] **Step 9: Run the spec, and prove it can fail**

```bash
npm run db:up
npx playwright test e2e/nav.spec.ts
```

Expected: green. Then **revert the outer wrapper's `xl:hidden` to the `<nav>`
and delete the chrome** and confirm the 1024px test goes red. Restore. A shell
test that passes against the old shell is a shell test that proves nothing.

- [ ] **Step 10: The browser pass, all four widths, both schemes**

`npm run dev`, signed out and then signed in (see **Verification protocol**):

| Width | Measured |
|---|---|
| 1440 | Rail visible at 208px, strip visible, bar hidden. No duplicate search control on screen. |
| 1280 | Same as 1440. `getBoundingClientRect().width` of the rail is exactly 208. |
| 1024 | 🔴 Rail hidden, bar visible **with mark, search and account control**. `document.scrollingElement.scrollWidth` ≤ 1024. The content panel's width is unchanged from before this task (record it). |
| 390 | Five slots each ≥44×44. Bar height ≤56px. No label wrapped. `scrollWidth` ≤ 390. The mark reads as a mark, not as a tab. |

In **both schemes** at every width: the bar's ground is `bg-bg-surface` and the
chrome icons are `text-text-secondary` — confirm nothing on the bar is
invisible in light mode, which is where a token chosen against the dark ground
usually fails.

Record the 1024px content-panel width and the 390px slot widths in
`docs/PROGRESS.md` → Phase 17 notes.

- [ ] **Step 11: Commit**

```bash
npm run lint && npm run typecheck && npx vitest run components/
git add components/TabBar.tsx components/TabBar.test.tsx components/TabBar.stories.tsx components/AppShell.tsx components/AppShell.test.tsx components/MoreSheet.tsx e2e/nav.spec.ts docs/PROGRESS.md
git commit -m "P17.T2: the bar carries the app's identity, and 1024px stops being a phone"
```

Add whatever file the shared `SearchIcon`/`AccountControl` ended up in. Tick
`P17.T2` in `docs/PROGRESS.md` as part of this commit.

---

## P17.T1 — headings get a size, and `/` gets an outline

**Files:**
- Modify: `components/SectionHead.tsx`
- Modify: `components/Shelf.tsx:36` (its `SectionHead as="h3"`)
- Test: `components/SectionHead.test.tsx`, `e2e/dashboard.spec.ts`

**Interfaces:** none changed. `SectionHead`'s props are the same; what the `as`
prop *does* grows from "sets the tag" to "sets the tag and the size".

**Context an implementer needs.**

Every `SectionHead` renders at **17px** today, whatever `as` says, unless
`name` is set — in which case it is 24px serif. So the page `h1` on `/`
("Season") is 17px and a league name two screens down is 24px: the document's
top-level heading is visibly outranked by a subsection's. There is no hierarchy
to read because there is no size difference to read it from.

🔴 **Decided 2026-09-12: 28 / 20 / 17, keyed to `as`.** 28 is chosen so an `h1`
outranks a league name; today it does not.

🔴 **This is not a D70 conflict and must not be written as one.** D70 assigns
faces *semantically* — serif for proper nouns, Archivo for structure — and says
nothing about size. An Archivo `h1` at 28px honours D70 exactly. The serif
`name` variant stays **24px on its own axis**: it is the face rule, not the
hierarchy, and a league name is 24px serif whether it is an `h2` or an `h3`.

🔴 **A call the plan makes, flagged rather than hidden:** the `as` union is
`'h1' | 'h2' | 'h3' | 'h4'` — four levels, three sizes. **`h4` shares `h3`'s
17px.** Inventing a fourth step below 17 would collide with body text once
P17.T18 moves that to 15px, and no surface in the app currently nests four
heading levels deep. If one appears later, it gets a size then, with a reason.

**The heading order on `/`.** `app/(app)/page.tsx` renders, in document order:

| Order | Element | Level today |
|---|---|---|
| 1 | "Season" `SectionHead as="h1"` | h1 |
| 2 | "In cinemas now" — `Shelf` | **h3** |
| 3 | "Season leaderboard" `SectionHead as="h2"` | h2 |
| 4 | each league name `SectionHead as="h2" name` | h2 |
| 5 | "Recent picks" / "Top scorers" — `Shelf` | **h3** |

h1 → h3 is a skipped level, and h3 → h2 is an outline that goes back up. It is
invisible today because every one of them renders at 17px, and it becomes
visible the moment the sizes differ — which is why the two halves of this task
travel together.

**The fix is one line, because `Shelf` has exactly one consumer.** Grep first —
`Shelf` is used only in `app/(app)/page.tsx`, at three call sites, all of them
top-level sections of the page. So `Shelf`'s own `SectionHead` becomes
`as="h2"` and no prop is needed. 🔴 **Run the grep, do not trust this
paragraph**: if a second consumer has appeared and nests a shelf under an
`h2`, add an `as?: 'h2' | 'h3'` prop defaulting to `'h2'` and pass `'h3'` there.

**Forward collision, so the second pass is not a surprise.** P17.T18 (a later
tranche) moves body text to **15px with 13px as the small step**, and P17.T23
introduces a **40px section step**. Both will touch `SectionHead` and both will
touch the same call sites on `/`. T1 is decided at 28/20/17 and ships as
decided; the note belongs in the component so the T18 implementer sees it:

> The gap between the 17px `h3` and body text is 3px today and will be 2px
> after P17.T18. That is deliberate at this size — an `h3` is a label, not a
> headline — but if T18's sweep makes them indistinguishable, the `h3` is the
> one that moves, not the body.

- [ ] **Step 1: Write the failing tests**

Add to `components/SectionHead.test.tsx`:

```tsx
  // 🔴 Decided 2026-09-12: 28 / 20 / 17 keyed to `as`. Asserted rather than
  // left to review, for the same reason D70's face rule is: every heading in
  // the app inherits this, and a regression here is invisible on any one page.
  it.each([
    ['h1', 'text-[28px]'],
    ['h2', 'text-[20px]'],
    ['h3', 'text-[17px]'],
    ['h4', 'text-[17px]'],
  ] as const)('renders %s at its own size', (level, size) => {
    render(<SectionHead as={level}>Roster</SectionHead>);
    expect(screen.getByRole('heading')).toHaveClass(size);
  });

  // 🔴 The serif is an orthogonal axis, not the hierarchy (D70). A league name
  // is 24px serif whether it is an h2 or an h3 — and a 28px h1 therefore
  // outranks it, which is the whole reason 28 was chosen.
  it('keeps a name at 24px serif whatever its level', () => {
    const { rerender } = render(
      <SectionHead as="h2" name>
        Sarah Powers
      </SectionHead>,
    );
    expect(screen.getByRole('heading')).toHaveClass('font-serif', 'text-2xl');
    expect(screen.getByRole('heading')).not.toHaveClass('text-[20px]');

    rerender(
      <SectionHead as="h3" name>
        Sarah Powers
      </SectionHead>,
    );
    expect(screen.getByRole('heading')).toHaveClass('font-serif', 'text-2xl');
  });
```

And add to `components/Shelf.test.tsx`:

```tsx
  it('🔴 heads its section at h2, so a page of shelves has an outline', () => {
    // The defect: `/` ran h1 → h3 → h2, a skipped level and then a step back
    // up. Invisible while every heading rendered at 17px; a visible mess the
    // moment P17.T1 gave them sizes.
    render(<Shelf heading="In cinemas now"><li>x</li></Shelf>);
    expect(screen.getByRole('heading', { level: 2, name: 'In cinemas now' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run components/SectionHead.test.tsx components/Shelf.test.tsx`
Expected: FAIL — every heading carries `text-[17px]`, and `Shelf` renders an h3.

- [ ] **Step 3: Give `SectionHead` a scale**

Replace the heading's class expression:

```tsx
/**
 * 🔴 28 / 20 / 17, keyed to the heading level (decided 2026-09-12).
 *
 * Every `SectionHead` used to render at 17px whatever `as` said, so the page's
 * own `h1` was visibly outranked by any league name — which is 24px serif. 28
 * is chosen for exactly that: an `h1` has to outrank a name.
 *
 * 🔴 **This is not a D70 change.** D70 assigns *faces* semantically — serif for
 * proper nouns, Archivo for structure — and says nothing about size. An
 * Archivo `h1` at 28px honours it exactly, and the serif `name` variant below
 * stays 24px on its own axis: the face rule is not the hierarchy.
 *
 * `h4` shares `h3`'s 17px. Three sizes for four levels is deliberate — a
 * fourth step below 17 would collide with body text once P17.T18 moves that to
 * 15px, and nothing in the app nests four heading levels deep today.
 *
 * 🔴 Note for P17.T18 and P17.T23, which both sweep these components: the gap
 * between the 17px `h3` and body text is 3px today and 2px after T18. That is
 * intended at this size — an `h3` is a label, not a headline — but if the
 * sweep makes them indistinguishable, the `h3` moves, not the body.
 */
const SIZE = {
  h1: 'text-[28px] tracking-[-0.02em]',
  h2: 'text-[20px] tracking-[-0.015em]',
  h3: 'text-[17px] tracking-[-0.01em]',
  h4: 'text-[17px] tracking-[-0.01em]',
} as const;
```

```tsx
        <Tag
          className={cn(
            'text-text-primary',
            name
              ? 'font-serif text-2xl tracking-[-0.02em]'
              : cn('font-sans font-semibold', SIZE[Tag]),
          )}
        >
```

`Tag` is the `as` prop after its default is applied, so `SIZE[Tag]` is total
over the union and needs no fallback. If TypeScript disagrees because `Tag` has
widened, key off the `as` value directly rather than adding a `?? SIZE.h3` that
would silently swallow a future level.

- [ ] **Step 4: Fix the outline on `/`**

```bash
grep -rn "<Shelf" app components --include='*.tsx'
```

Expected: three hits, all in `app/(app)/page.tsx`, all top-level. Then in
`components/Shelf.tsx`, change its `SectionHead as="h3"` to `as="h2"` and add:

```tsx
      {/* h2, not h3. A shelf is a top-level section of the page it sits on —
          `/` ran h1 → h3 → h2, which skips a level and then steps back up. It
          was invisible while every heading rendered at 17px and became a
          visible mess the moment P17.T1 gave them sizes. If a shelf is ever
          nested inside another section, give this an `as` prop then. */}
```

If the grep finds a nested call site, add the prop instead, as described above.

- [ ] **Step 5: Run the unit tests**

Run: `npx vitest run components/`
Expected: PASS. Several component tests assert on heading *levels* — if any of
them asserted `level: 3` for a shelf, update the assertion and its comment;
do not add an `as="h3"` at the call site to keep an old test green.

- [ ] **Step 6: 🔴 The outline and the rendered sizes — browser only**

jsdom resolves no Tailwind, so `text-[28px]` is a string there and a number
only in a browser. Add to `e2e/dashboard.spec.ts`:

```ts
  test('🔴 the page has a valid heading outline', async ({ page }) => {
    await page.goto('/');

    const levels = await page.evaluate(() =>
      [...document.querySelectorAll('main h1, main h2, main h3, main h4')].map((h) =>
        Number(h.tagName[1]),
      ),
    );

    // One h1, first. Then no jump of more than one level — which is what
    // h1 → h3 was, and what made the page's own structure unreadable to a
    // screen reader long before it was visible to anybody else.
    expect(levels[0]).toBe(1);
    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] + 1);
    }
  });

  test('🔴 headings render at 28 / 20 / 17, and an h1 outranks a league name', async ({
    page,
  }) => {
    await page.goto('/');

    const px = (selector: string) =>
      page.locator(selector).first().evaluate((el) =>
        Number.parseFloat(getComputedStyle(el).fontSize),
      );

    // Rendered px, not class names: the whole defect was that four different
    // `as` values compiled to one size, which no class assertion would show.
    expect(await px('main h1')).toBeCloseTo(28, 0);
    expect(await px('main h2')).toBeCloseTo(20, 0);
    // A serif name is 24px on its own axis (D70), so the h1 must clear it.
    expect(await px('main h1')).toBeGreaterThan(24);
  });
```

The second test asserts `main h2` at 20 — with no leagues on the signed-out
page the first `h2` is "In cinemas now" or "Season leaderboard", both of which
are 20px Archivo. If the shelf is absent (no TMDB key in the run),
`locator.first()` will still find "Season leaderboard".

- [ ] **Step 7: Run the spec, and prove it can fail**

```bash
npx playwright test e2e/dashboard.spec.ts
```

Expected: green. Then revert `Shelf` to `as="h3"` and confirm the outline test
goes red; revert the `SIZE` map to a single size and confirm the size test goes
red. Restore both.

- [ ] **Step 8: The browser pass, all four widths, both schemes**

`npm run dev`, at 1440, 1280, 1024 and 390px in both schemes, on `/`,
`/browse`, `/award-shows` and a film page:

- **Measured:** on `/`, `getComputedStyle` of the `h1` is 28px, of each `h2` is
  20px, of each `h3` is 17px, and of a league name (signed in) is 24px.
- **Measured:** at 390px the 28px `h1` does not wrap "Season" and does not push
  `document.scrollingElement.scrollWidth` past 390.
- **Measured:** on every page checked, the `right` slot of each `SectionHead`
  still sits on the heading's baseline at `sm`+ — the 28px heading is 11px
  taller than before and `items-end` has to still be doing its job. At 390px
  the leaderboard's slot stacks (`rightStacksOnMobile`, D79) and must still
  stack.
- **Measured, both schemes:** nothing about the size change altered a colour;
  a diff of the two screenshots should differ only in glyph size.

- [ ] **Step 9: Commit**

```bash
npm run lint && npm run typecheck && npx vitest run components/
git add components/SectionHead.tsx components/SectionHead.test.tsx components/Shelf.tsx components/Shelf.test.tsx e2e/dashboard.spec.ts docs/PROGRESS.md
git commit -m "P17.T1: headings get a size, and the dashboard gets an outline"
```

Tick `P17.T1` in `docs/PROGRESS.md` as part of this commit.

---

## P17.T3 — the stepper anchors to the next show, whether or not it has a date

**Files:**
- Modify: `components/SeasonStepper.tsx`
- Test: `components/SeasonStepper.test.tsx`
- Story: `components/SeasonStepper.stories.tsx` (one new story)

**Interfaces:** none. `SeasonPhase` and the component's props are unchanged.

**Context an implementer needs — read the file first, it was rewritten hours
ago.**

🔴 `components/SeasonStepper.tsx` was rewritten in commit `a97ec64` (P15.T2).
**Do not plan or implement against the pre-`a97ec64` shape.** What is true now:

- The visible box count is **measured**, not constant: a `ResizeObserver` reads
  the window's `contentRect` and `boxesIn()` converts it to whole boxes at the
  reader's actual root font size. A fixed five-box window made five of
  twenty-four boxes unreachable at 390px, including the last three shows of the
  season.
- A press moves **exactly one window** (`visible`), not a constant three, so
  consecutive windows abut and skipping is arithmetically impossible.
- The end-anchor is **`requested === null` resolved at render**:
  `offset = requested === null ? maxOffset : Math.min(requested, maxOffset)`.
  Null rather than a number is deliberate — the window is sized after first
  paint, and a numeric initial offset would be the end of a five-box window on
  a phone that turns out to hold two.
- `SeasonStepper.test.tsx` states widths by stubbing
  `Element.prototype.getBoundingClientRect` (jsdom has no layout), and walks
  the whole rail through the `aria-live` announcement. **That machinery is the
  right machinery and this task reuses it rather than replacing it.**

**What is wrong.** Two lines:

```ts
const next = phases.find((phase) => !phase.complete && phase.date != null);
```

and the `maxOffset` end-anchor. Against live data the widget highlights
**nothing**: the real season's phases are either complete or not yet scheduled,
so `next` is `undefined`, no box gets `aria-current="step"`, no chip says
"Next", and the window opens at the arithmetic end of the array rather than at
anything meaningful.

**Three changes, decided:**

1. **Fall back to the last incomplete show, regardless of date.** The primary
   rule is unchanged — the earliest incomplete phase that *has* a date is the
   next moment, and an undated phase can never beat a dated one, because it has
   no date to be next *by*. The fallback only fires when no incomplete phase
   has a date at all.
   🔴 **`findLast`, not `find`, and that is what PLAN and PROGRESS both say.**
   The reason it is defensible: `lib/services/dashboard.ts` sorts undated
   phases to the end with `POSITIVE_INFINITY` and nothing orders them among
   themselves, so "the first undated phase" is whichever row the database
   happened to return — an unstable highlight. The last is at least a fixed
   position, and it is where D81's end-anchor already points, so the highlight
   and the opening window agree instead of fighting.
2. **Chip it `Next · date TBA`.** The box already renders a separate "Date TBA"
   line; when the box is `next`, that line would repeat the chip, so it is
   suppressed for that box only.
3. **Anchor the window to that show, not to the end of the array.** With the
   fallback in place these usually coincide, but not always: a season whose
   last two shows are complete and whose middle show is incomplete-and-undated
   should open on the middle show.

**Forward collision:** P17.T20 (a later tranche) spends the `beam` token on the
live surface and on **this chip**. T3 leaves the chip `carmine`, which is what
the `next` box uses today; T20 retones it. Leave a note in the file so the T20
implementer does not have to find it.

- [ ] **Step 1: Write the failing tests**

Add to `components/SeasonStepper.test.tsx`, using its existing `atWidth`,
`announced` and `DAY` helpers:

```tsx
  /**
   * 🔴 The live-data state, which none of the existing tests construct: every
   * phase is either finished or not yet scheduled. The rail highlighted
   * nothing at all on the real dashboard while every test here was green,
   * because `phases(n)` gives every box a date.
   */
  function unscheduledSeason(): SeasonPhase[] {
    return [
      { key: '1-nominations', eventId: 1, phase: 'nominations', name: 'Golden Globes', abbreviation: 'gg', date: Date.now() - 40 * DAY, complete: true },
      { key: '1-ceremony', eventId: 1, phase: 'ceremony', name: 'Golden Globes', abbreviation: 'gg', date: Date.now() - 10 * DAY, complete: true },
      { key: '2-nominations', eventId: 2, phase: 'nominations', name: 'Academy Awards', abbreviation: 'oscars', date: null, complete: false },
      { key: '2-ceremony', eventId: 2, phase: 'ceremony', name: 'Academy Awards', abbreviation: 'oscars', date: null, complete: false },
    ];
  }

  it('🔴 highlights the last incomplete show when nothing left is scheduled', () => {
    render(<SeasonStepper phases={unscheduledSeason()} />);

    // Something is current. Before this task, nothing was — `next` required a
    // date, and a real season's remaining phases have none.
    const current = screen.getByRole('listitem', { current: 'step' });
    expect(within(current).getByText('Academy Awards')).toBeInTheDocument();
    expect(within(current).getByText('Ceremony')).toBeInTheDocument();
  });

  it('🔴 says the date is unknown in the chip, once', () => {
    render(<SeasonStepper phases={unscheduledSeason()} />);

    const current = screen.getByRole('listitem', { current: 'step' });
    expect(within(current).getByText('Next · date TBA')).toBeInTheDocument();
    // And not twice: the standalone "Date TBA" line would say the same thing
    // an inch lower.
    expect(within(current).queryByText('Date TBA')).toBeNull();
    // An undated box that is *not* next still carries the plain line.
    const others = screen.getAllByRole('listitem').filter((li) => li !== current);
    expect(others.some((li) => within(li).queryByText('Date TBA') != null)).toBe(true);
  });

  it('🔴 a dated incomplete phase still wins over an undated one', () => {
    const soon = Date.now() + 5 * DAY;
    render(
      <SeasonStepper
        phases={[
          { key: '1-ceremony', eventId: 1, phase: 'ceremony', name: 'BAFTA', abbreviation: 'bafta', date: soon, complete: false },
          { key: '2-ceremony', eventId: 2, phase: 'ceremony', name: 'Academy Awards', abbreviation: 'oscars', date: null, complete: false },
        ]}
      />,
    );

    const current = screen.getByRole('listitem', { current: 'step' });
    expect(within(current).getByText('BAFTA')).toBeInTheDocument();
    expect(within(current).getByText('in 5 days')).toBeInTheDocument();
  });

  it('🔴 opens on the next show rather than on the end of the array', () => {
    atWidth(PHONE_WINDOW); // two boxes
    const twelve = phases(12);
    // Box 4 is the only incomplete one; 5..12 are finished. The end-anchor
    // would open on 11–12 and the reader would never see the one thing the
    // rail exists to point at.
    const doctored = twelve.map((phase, index) => ({
      ...phase,
      complete: index !== 3,
      date: index === 3 ? null : phase.date,
    }));

    render(<SeasonStepper phases={doctored} />);

    const [first, last] = announced();
    expect(first).toBeLessThanOrEqual(4);
    expect(last).toBeGreaterThanOrEqual(4);
  });

  it('anchors to the end when the season is genuinely over', () => {
    atWidth(PHONE_WINDOW);
    render(<SeasonStepper phases={phases(12).map((p) => ({ ...p, complete: true }))} />);

    // Nothing is next, so there is nothing to anchor to and D81's end-anchor
    // is still the right answer.
    expect(announced()).toEqual([11, 12, 12]);
  });
```

Import `within` from `@testing-library/react` if the file does not already.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run components/SeasonStepper.test.tsx`
Expected: the four 🔴 tests FAIL — no element carries `aria-current="step"` in
the unscheduled season, no chip reads `Next · date TBA`, and the window opens
at `maxOffset`. The existing tests must all still pass; if any of them break,
the change is wrong, not the test.

- [ ] **Step 3: Fall back, and anchor to what was found**

In `components/SeasonStepper.tsx`, replace the `next` line and the `offset`
line. They move next to each other because they are now one decision:

```ts
  const now = Date.now();

  /**
   * The moment the league is waiting for.
   *
   * The earliest incomplete phase **that has a date** is the answer whenever
   * there is one: an undated phase has no date to be next *by*, and promoting
   * one would push the real next moment off the highlight.
   *
   * 🔴 The fallback is what makes this true of live data. A real season's
   * remaining phases are routinely all unscheduled — the ceremony calendar is
   * published months after the season opens — and the rail then highlighted
   * *nothing*: no `aria-current`, no chip, no countdown, on the dashboard's
   * most prominent widget. Every test was green, because they all gave every
   * box a date.
   *
   * 🔴 `findLast`, not `find`. `lib/services/dashboard.ts` sorts undated
   * phases to the end with `POSITIVE_INFINITY` and nothing orders them among
   * themselves, so "the first undated phase" is whichever row the database
   * happened to return — an unstable highlight that could move between
   * renders. The last is a fixed position, and it is where D81's end-anchor
   * already points, so the highlight and the opening window agree.
   */
  const next =
    phases.find((phase) => !phase.complete && phase.date != null) ??
    phases.findLast((phase) => !phase.complete);

  const maxOffset = Math.max(0, phases.length - visible);

  /**
   * Where the window opens.
   *
   * 🔴 Anchored to `next`, not to the end of the array (amending D81's
   * mechanism, not its intent — D81 chose the end because the end *was* the
   * next thing). A season whose last two shows are finished and whose middle
   * show is still open would otherwise open on two completed boxes.
   *
   * `next` sits at the window's left edge so what follows it is on screen
   * too; clamped to `maxOffset` so the last window is never short.
   *
   * `requested === null` still carries "wherever the anchor is", and still for
   * the reason D81 records: the window is measured after first paint, so a
   * numeric initial offset would be computed against a box count that turns
   * out to be wrong. That survives here — the anchor is recomputed on the
   * render that follows the measurement.
   */
  const nextIndex = next == null ? -1 : phases.findIndex((phase) => phase.key === next.key);
  const anchor = nextIndex < 0 ? maxOffset : Math.min(nextIndex, maxOffset);
  const offset = requested === null ? anchor : Math.min(requested, maxOffset);
```

Delete the old `const now = Date.now();` further down if this moved it, and
make sure `maxOffset` is declared once.

- [ ] **Step 4: Chip the unknown date, once**

In the box, the chip:

```tsx
                <StatusChip
                  // 🔴 P17.T20 (a later tranche) spends the `beam` token here
                  // and on the live surface. Carmine until then — do not
                  // "tidy" this to neutral in the meantime, or T20 will have
                  // nothing to change and the token will stay unspent.
                  tone={isNext ? 'carmine' : 'neutral'}
                  className={cn('self-start', !isNext && 'bg-bg-surface')}
                >
                  {phase.complete
                    ? 'Complete'
                    : isNext
                      ? // An unscheduled next show is a real and common state:
                        // the ceremony calendar is published months into the
                        // season. Saying so in the chip means the box carries
                        // its status and its date in one line instead of
                        // leaving a reader to pair "Next" with a "Date TBA"
                        // three lines down.
                        phase.date == null
                        ? 'Next · date TBA'
                        : 'Next'
                      : 'Upcoming'}
                </StatusChip>
```

and the standalone line:

```tsx
                {phase.date == null ? (
                  // Suppressed on the next box, where the chip above already
                  // said it. Unscheduled phases still belong on the rail:
                  // omitting them makes the season look shorter than it is.
                  isNext ? null : (
                    <span className="text-text-dim text-xs">Date TBA</span>
                  )
                ) : (
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run components/SeasonStepper.test.tsx`
Expected: PASS — the new tests and every pre-existing one, including
`reaches every box of the season on a phone`, which is the one that must not
regress.

- [ ] **Step 6: Story**

Add to `components/SeasonStepper.stories.tsx` a story named `LiveSeason`: two
completed dated phases followed by two incomplete undated ones — the shape the
real dashboard has had all along and that no story or test constructed. That
absence is why the defect shipped.

- [ ] **Step 7: The browser pass, all four widths, both schemes**

`npm run dev`, `/` signed out, at 1440, 1280, 1024 and 390px in both schemes:

- **Measured:** exactly one box carries `aria-current="step"`:
  ```js
  document.querySelectorAll('[aria-current="step"]').length
  ```
  must be `1` at every width. Against the restored production database this is
  `0` today — that is the defect, and the number is the proof it closed.
- **Measured:** that box is on screen when the page loads — its
  `getBoundingClientRect()` sits inside the window element's rect, at 390px
  (where the window holds two boxes) as well as at 1440px (where it holds six).
- **Measured:** the box's chip reads `Next · date TBA`, and the box contains
  the string "Date TBA" exactly **once**.
- **Measured:** the `aria-live` line's "Showing shows N to M of T" names a
  range that includes the current box.
- **Both schemes:** the carmine chip on the `raised` box is legible in light as
  well as dark — this is the token pairing D69 measured, and the light theme is
  where it usually fails.

- [ ] **Step 8: Commit**

```bash
npm run lint && npm run typecheck && npx vitest run components/SeasonStepper.test.tsx
git add components/SeasonStepper.tsx components/SeasonStepper.test.tsx components/SeasonStepper.stories.tsx docs/PROGRESS.md
git commit -m "P17.T3: the season rail points at something again"
```

Tick `P17.T3` in `docs/PROGRESS.md` as part of this commit.

---

## P17.T5 — a signed-out reader is told what this is

**Files:**
- Modify: `app/(app)/page.tsx` (the first `<section>`, and the signed-out `EmptyState`)
- Test: `e2e/dashboard.spec.ts`

**Interfaces:** none. No new component — the lede is two elements and a `Button`
in the page that owns the decision, and a component for it would be an
abstraction with one consumer.

**Context an implementer needs.**

`/` is public (D44) and is the app's front door during awards season. Signed
out it opens with an `h1` reading **"Season"**, an eyebrow counting completed
shows, and a rail of award-show dates. Nothing on the first screen says what
the product is or offers a way in. The invitation — an `EmptyState` titled
"Play the season" with a Register action — sits **below the leaderboard**, four
sections down.

The fix: **one line and one action, above `SeasonStepper`, when `user == null`,
gone the moment somebody signs in.**

**Placement, as a call this plan makes explicitly.** "Above `SeasonStepper`"
is read literally: inside the first `<section>`, after the `SectionHead` and
before the stepper. Above the `SectionHead` would put content before the
document's first heading, which breaks the outline P17.T1 just fixed.

**The duplication, and what happens to it.** With a Register action at the top,
the `EmptyState` four sections down offers a second identical one 2,000px
apart. The lede takes the action; the `EmptyState` **keeps its text and loses
its action**, because the half of its copy that the lede cannot carry is the
returning-member path — "Played before? Register with the same email and your
leagues, drafts and points come with you" — and that belongs at the end of a
page somebody has read, not in a one-line lede. 🔴 Flagged rather than assumed:
if the browser pass says the page now ends weakly, restore the action and
shorten the lede instead. Record which way it went.

**The copy.** One sentence, in the app's own vocabulary — "log in", never "sign
in"; the game is drafting films and scoring nominations; no invented claims.

> Draft a team of films before awards season, and score every nomination and
> win they pick up.

Action: **Register**, to `/auth/register`, as a `Button` (D73 — 6px radius,
never squared, never a pill).

- [ ] **Step 1: Write the failing test — it is an e2e test, and here is why**

`app/(app)/page.tsx` is an async Server Component that awaits `getCurrentUser`,
`availableSeasons`, `getDashboard` and `getLeaderboard`. Rendering it in jsdom
means mocking four services to assert on two elements, and the property that
actually matters — *the lede is gone once you are signed in* — is a session
property that only the real app resolves. Add to `e2e/dashboard.spec.ts`:

```ts
  test('🔴 a signed-out reader is told what this is, above the fold', async ({ page }) => {
    await page.goto('/');

    const lede = page.getByTestId('signed-out-lede');
    await expect(lede).toBeVisible();
    await expect(lede).toContainText(/draft a team of films/i);
    await expect(lede.getByRole('link', { name: 'Register' })).toBeVisible();

    // Above the fold, which is the whole point — the invitation already
    // existed, four sections down, where nobody arriving mid-ceremony met it.
    const box = await lede.boundingBox();
    expect(box?.y ?? Infinity).toBeLessThan(600);

    // And above the rail it introduces.
    const rail = await page.getByTestId('season-window').boundingBox();
    expect(box?.y ?? Infinity).toBeLessThan(rail?.y ?? 0);
  });

  test('🔴 and it is gone the moment they are signed in', async ({ page }) => {
    await signInAs(page, { email: `${TAG}-lede@example.test`, firstName: 'Reader' });
    await page.goto('/');

    await expect(page.getByTestId('signed-out-lede')).toHaveCount(0);
    // The heading it sat under is still there, so this is the lede going and
    // not the whole section.
    await expect(page.getByRole('heading', { level: 1, name: 'Season' })).toBeVisible();
  });
```

If `e2e/dashboard.spec.ts` has no `TAG` and no cleanup, add both, following
`e2e/season-setup.spec.ts`'s pattern — `const TAG = 'e2e-dashboard'`, a
`withDb` helper, and an `afterAll` that deletes
`users where email like '${TAG}-%@example.test'`. 🔴 Nothing else. League 1 and
the real user rows are never touched.

- [ ] **Step 2: Run it and watch it fail**

```bash
npm run db:up
npx playwright test e2e/dashboard.spec.ts
```

Expected: FAIL — no element carries `data-testid="signed-out-lede"`.

- [ ] **Step 3: Write the lede**

In `app/(app)/page.tsx`, in the first `<section>`, between the `SectionHead`
and `<SeasonStepper …>`:

```tsx
        {/* 🔴 The front door, for the only reader who needs one (P17.T5).
            `/` is public during awards season and opened with an h1 reading
            "Season" and a rail of dates — nothing that says what the product
            is, and no way in until four sections further down. One line and
            one action, and it is gone for a member, who does not need to be
            told what the app they are logged into does. */}
        {user == null ? (
          <div
            data-testid="signed-out-lede"
            className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-text-secondary max-w-prose text-sm">
              Draft a team of films before awards season, and score every nomination
              and win they pick up.
            </p>
            <Button href="/auth/register" className="shrink-0">
              Register
            </Button>
          </div>
        ) : null}
```

Read `components/Button.tsx` before writing this: if it does not accept an
`href`, wrap a `Link` the way the rest of the app does, and match whatever the
existing primary-action pattern is. Do not invent a second one.

- [ ] **Step 4: Drop the duplicate action below**

In the same file, the signed-out `EmptyState`: remove its `action` prop, keep
its title and its returning-member copy.

```tsx
        <EmptyState title="Play the season">
          Draft a team of films before awards season and score points as they pick up
          nominations and wins. Played before? Register with the same email and your
          leagues, drafts and points come with you.
        </EmptyState>
```

with a comment saying why:

```tsx
      {/* No action here any more: the lede at the top of the page carries it
          (P17.T5), and two identical Register buttons 2,000px apart is a
          choice a reader has to make twice. What stays is the half the lede
          cannot carry — the returning member's reassurance that their history
          follows their email — which belongs at the end of a page somebody has
          read rather than in a one-line opener. */}
```

Check `EmptyState`'s props allow an omitted `action`; it is already optional on
the `view.leagues.length === 0` branch's sibling usage, but confirm rather than
assume.

- [ ] **Step 5: Run the spec**

```bash
npx playwright test e2e/dashboard.spec.ts
```

Expected: PASS, both new tests. Then **delete the `user == null` guard** so the
lede renders for everybody, and confirm the second test goes red. Restore it —
a lede that never disappears is the defect this task would otherwise ship.

- [ ] **Step 6: The browser pass, all four widths, both schemes**

`npm run dev`, `/` signed out, then signed in (see **Verification protocol**),
at 1440, 1280, 1024 and 390px in both schemes:

- **Measured, signed out:** the lede's `getBoundingClientRect().top` is less
  than the viewport height at every width — it is above the fold at 390px, not
  only at 1440px.
- **Measured, signed out at 390px:** the sentence and the Register button stack
  rather than colliding (`flex-col` below `sm`), the button is ≥44px tall, and
  `document.scrollingElement.scrollWidth` ≤ 390.
- **Measured, signed in:** `document.querySelectorAll('[data-testid="signed-out-lede"]').length`
  is `0`, and the "Season" `h1` is still the first heading.
- **Measured, both schemes:** `text-text-secondary` on the panel ground clears
  its contrast pairing — check the light theme, which is where the secondary
  ink is closest to its floor.
- **Judgement call to record:** does the page now end weakly with an
  action-less `EmptyState`? If so, restore its action and shorten the lede to
  the sentence alone. Write which way it went into `docs/PROGRESS.md` →
  Phase 17 notes.

- [ ] **Step 7: Commit**

```bash
npm run lint && npm run typecheck && npm run test
git add "app/(app)/page.tsx" e2e/dashboard.spec.ts docs/PROGRESS.md
git commit -m "P17.T5: the front page says what the game is"
```

Tick `P17.T5` in `docs/PROGRESS.md` as part of this commit.

---

## P17.T4 — the leaderboard becomes readable on a touch screen

**Files:**
- Create: `components/SeasonPicker.tsx`, `components/SeasonPicker.test.tsx`, `components/SeasonPicker.stories.tsx`
- Modify: `components/LeaderboardTable.tsx`
- Modify: `app/(app)/page.tsx` (the year `<nav>` in the leaderboard's `right` slot)
- Test: `components/LeaderboardTable.test.tsx`, `e2e/dashboard.spec.ts`
- Story: `components/LeaderboardTable.stories.tsx`

**Interfaces:**
- Produces, from `components/SeasonPicker.tsx`:

```ts
export function SeasonPicker({
  year,
  seasons,
  className,
}: {
  /** The season currently on screen. */
  year: number;
  /** Every season with data, newest first, as `availableSeasons()` returns them. */
  seasons: readonly number[];
  className?: string;
}): ReactNode;
```

  It renders nothing when `seasons.length <= 1`, which is the guard the page
  applies today.
- `LeaderboardTable`'s props are unchanged: `{ leaderboard, className }`.

**Context an implementer needs.** Four defects in one component, all of them
the same underlying mistake — the table was designed for a mouse on a 1440px
screen and then hidden, rather than rethought, below `lg`.

**1. The column labels are `title` tooltips.** Each per-show header renders
`event.abbreviation.toUpperCase()` with `title={event.name}`. `title` never
fires on a touch screen and is unreliable for keyboard users, so on every
device except a mouse the columns are unlabelled three-letter codes. The app's
twelve award bodies are its primary vocabulary and this is one of the two
places it assumes the reader already knows them.

The fix is a **persistent legend**, not a wider header: twelve full show names
will not fit twelve columns at any width. A wrapped legend line beneath the
table maps each abbreviation to its name, is readable by touch, keyboard and
screen reader alike, and costs one element. It carries the same
`hidden lg:block` visibility as the columns it explains — a legend for columns
nobody can see is noise.

**2. Ten 33.6×20px targets.** The year `<nav>` in
`app/(app)/page.tsx` renders one `<Link>` per season. Ten seasons is ten
links measured at 33.6×20px, less than a quarter of the 44px minimum, laid out
as a wrapping row in a `SectionHead`'s right slot.

The fix is **the current year plus a picker**. Native `<details>`/`<summary>`:
one control at rest showing the year on screen, opening to a list of years each
with a 44px target. `<details>` is keyboard-operable, screen-reader-announced
and works before JavaScript arrives — the years are real links, so Back,
open-in-new-tab and `aria-current` all keep working, which is what the flat row
got right and must not be lost. No `<select>`: navigating on change needs
JavaScript and degrades to a control that does nothing.

**3. No sticky film column.** D79 removed the horizontal scroll **below `lg`**
and the reasoning is specific to that range — on a phone the scroll put Total
off screen at every width. At `lg` (1024px) with twelve shows the per-show
columns return and the table simply overflows its container, taking the
document with it. The fix restores a scroll container **at `lg` and up only**,
with the film column sticky inside it.
🔴 **D79 is untouched.** Below `lg` there is still no `min-width` and no
scroll, and `LeaderboardTable.test.tsx`'s existing assertion to that effect
stays — it narrows from "no `overflow-x-auto` class" to "no *unconditional*
one", because the class is now `lg:overflow-x-auto`. Say so in the test.

A sticky cell in a `border-collapse` table shows the scrolled columns through
itself unless it paints its own ground. The table sits directly inside
`AppShell`'s content panel, which is `Panel as="main"` at its default tone —
`bg-bg-surface`. Use that exact token and **verify in both schemes** that
nothing bleeds through; this is precisely the kind of thing that looks right in
dark and wrong in light.

**4. Below `lg` the per-show numbers are unreachable.** D79 hides them, which
was right — but it leaves the reader a total with no account of where it came
from, on the device most of them use. The fix is an expandable row: the film
title becomes a disclosure below `lg`, and opening it inserts a row listing
that film's shows and points.

- [ ] **Step 1: Write the failing `SeasonPicker` test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SeasonPicker } from './SeasonPicker';

describe('SeasonPicker', () => {
  it('shows the season on screen without opening anything', () => {
    render(<SeasonPicker year={2026} seasons={[2026, 2025, 2024]} />);

    // The year the reader is looking at is stated, not hidden behind the
    // control — the flat row of links got that right and it must survive.
    expect(screen.getByRole('group')).toHaveTextContent('2026');
  });

  it('🔴 every year is a real link, so Back and open-in-new-tab keep working', () => {
    render(<SeasonPicker year={2026} seasons={[2026, 2025, 2024]} />);

    for (const year of [2026, 2025, 2024]) {
      expect(screen.getByRole('link', { name: String(year) })).toHaveAttribute(
        'href',
        `/?year=${year}`,
      );
    }
  });

  it('marks the season on screen', () => {
    render(<SeasonPicker year={2025} seasons={[2026, 2025]} />);
    expect(screen.getByRole('link', { name: '2025' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: '2026' })).not.toHaveAttribute('aria-current');
  });

  it('renders nothing for a single season', () => {
    const { container } = render(<SeasonPicker year={2026} seasons={[2026]} />);
    // One season is not a choice, and a picker offering one option is furniture.
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run it, watch it fail, and write `SeasonPicker`**

Run: `npx vitest run components/SeasonPicker.test.tsx` — FAIL, no module.

```tsx
import Link from 'next/link';

import { cn } from '@/lib/utils/cn';

/**
 * The leaderboard's season control (P17.T4).
 *
 * 🔴 Replaces a flat row of one `<Link>` per season. With ten seasons that was
 * ten targets measured at **33.6 × 20px** — under a quarter of the 44px
 * minimum — wrapping across the right slot of a `SectionHead`. The year the
 * reader is on was one underline among ten.
 *
 * 🔴 A native `<details>`, not a `<select>` and not a JavaScript menu. The
 * years have to stay real links: Back, open-in-new-tab and `aria-current` are
 * all things the flat row got right and none of them survive a `<select>` that
 * navigates on change, which also does nothing at all before hydration.
 * `<details>` brings the disclosure, the keyboard handling and the
 * expanded-state announcement from the platform — the same argument D75 makes
 * for `<dialog>`.
 *
 * The current year renders in the summary, so the season on screen is legible
 * without opening anything.
 */
export function SeasonPicker({
  year,
  seasons,
  className,
}: {
  year: number;
  seasons: readonly number[];
  className?: string;
}) {
  // One season is not a choice. The page used to apply this guard itself.
  if (seasons.length <= 1) return null;

  return (
    <details
      role="group"
      aria-label="Season"
      className={cn('relative', className)}
    >
      <summary className="text-text-primary hover:text-accent-text focus-visible:outline-accent-fill flex min-h-11 cursor-pointer list-none items-center gap-2 focus-visible:outline-2">
        <span className="tabular font-mono">{year}</span>
        <span aria-hidden="true" className="text-text-dim text-xs">
          ▾
        </span>
      </summary>

      {/* Absolute so the open list does not shove the table down — the control
          lives in a `SectionHead` right slot and the section below it must not
          move under the reader's finger. */}
      <ul className="bg-bg-raised rounded-md absolute right-0 z-20 mt-1 flex max-h-64 flex-col overflow-y-auto p-1">
        {seasons.map((entry) => (
          <li key={entry}>
            <Link
              href={`/?year=${entry}`}
              aria-current={entry === year ? 'page' : undefined}
              className={cn(
                'focus-visible:outline-accent-fill tabular flex min-h-11 items-center justify-end rounded-sm px-4 font-mono text-sm focus-visible:outline-2',
                entry === year
                  ? 'text-accent-text'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {entry}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
```

`list-none` on the `summary` removes the disclosure triangle in Chrome; Safari
needs `[&::-webkit-details-marker]:hidden` as well — add it, and check both in
Step 9's browser pass.

Run the test again: PASS.

- [ ] **Step 3: Swap it into the page**

In `app/(app)/page.tsx`, replace the `right={seasons.length > 1 ? (<nav …>…</nav>) : undefined}`
expression with:

```tsx
          right={<SeasonPicker year={year} seasons={seasons} />}
```

and keep `rightStacksOnMobile` — the picker is still a wide right slot beside a
heading that wraps at 390px (D79). The `seasons.length > 1` guard moves into
the component, which is where it belongs; delete it here rather than leaving it
in both places.

- [ ] **Step 4: Write the failing `LeaderboardTable` tests**

Add to `components/LeaderboardTable.test.tsx`, and **narrow** the existing
no-scroll test rather than deleting it:

```tsx
  it('🔴 names every column in a legend, not in a tooltip', () => {
    render(
      <LeaderboardTable
        leaderboard={{
          year: 2026,
          events: [
            { abbreviation: 'oscars', name: 'Academy Awards' },
            { abbreviation: 'gg', name: 'Golden Globes' },
          ],
          rows: [{ movieId: 1, title: 'Sinners', events: { oscars: 20 }, total: 20 }],
        }}
      />,
    );

    // `title` never fires on a touch screen, which is most readers. The names
    // have to be on the page.
    expect(screen.getByText('Academy Awards')).toBeInTheDocument();
    expect(screen.getByText('Golden Globes')).toBeInTheDocument();
    for (const header of screen.getAllByRole('columnheader')) {
      expect(header).not.toHaveAttribute('title');
    }
  });

  it('🔴 breaks a total into its shows, for the reader who cannot see the columns', async () => {
    const user = userEvent.setup();
    render(
      <LeaderboardTable
        leaderboard={{
          year: 2026,
          events: [
            { abbreviation: 'oscars', name: 'Academy Awards' },
            { abbreviation: 'gg', name: 'Golden Globes' },
          ],
          rows: [
            { movieId: 1, title: 'Sinners', events: { oscars: 20, gg: 15 }, total: 35 },
          ],
        }}
      />,
    );

    const toggle = screen.getByRole('button', { name: /Sinners/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    // The breakdown names the show, not the abbreviation: the reader opening
    // this is the one who cannot see the legend either.
    const breakdown = screen.getByTestId('breakdown-1');
    expect(within(breakdown).getByText('Academy Awards')).toBeInTheDocument();
    expect(within(breakdown).getByText('20')).toBeInTheDocument();
    expect(within(breakdown).getByText('Golden Globes')).toBeInTheDocument();
    expect(within(breakdown).getByText('15')).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByTestId('breakdown-1')).toBeNull();
  });

  it('🔴 lists only the shows a film actually scored at', async () => {
    const user = userEvent.setup();
    render(
      <LeaderboardTable
        leaderboard={{
          year: 2026,
          events: [
            { abbreviation: 'oscars', name: 'Academy Awards' },
            { abbreviation: 'razzies', name: 'Razzies' },
          ],
          rows: [{ movieId: 1, title: 'Sinners', events: { oscars: 20 }, total: 20 }],
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Sinners/ }));
    // A row of zeroes is noise; the columns show zeroes because a grid has to
    // be rectangular and a list does not.
    expect(within(screen.getByTestId('breakdown-1')).queryByText('Razzies')).toBeNull();
  });
```

Replace the existing `never scrolls horizontally — no min-width on the table`
test with:

```tsx
  it('🔴 never scrolls horizontally below `lg` (D79), and does scroll above it', () => {
    const { container } = render(<LeaderboardTable leaderboard={leaderboardOf(3)} />);
    const table = container.querySelector('table');

    // D79 is unchanged: on a phone the reader gets Film and Total with no
    // sideways scroll, because the scroll put Total off screen at every width.
    expect(table?.className).not.toMatch(/(^|\s)min-w-/);
    expect(container.querySelector('.overflow-x-auto')).toBeNull();

    // Above `lg` the per-show columns return, and twelve of them overflow the
    // content panel at 1024px — taking the document with them. The scroll is
    // restored there and only there, which is a range D79 never spoke about.
    expect(container.querySelector('.lg\\:overflow-x-auto')).not.toBeNull();
    expect(table?.className).toMatch(/lg:min-w-/);
  });
```

- [ ] **Step 5: Run them and watch them fail**

Run: `npx vitest run components/LeaderboardTable.test.tsx`
Expected: FAIL — no legend, headers carry `title`, no disclosure button, no
`lg:overflow-x-auto`.

- [ ] **Step 6: Rework `LeaderboardTable`**

Four changes to the existing file. Keep the `PAGE = 10` reveal, the empty
state, and the `<caption>` exactly as they are.

**(a) The header cells lose `title` and the table gains a legend.**

```tsx
              <th
                key={event.abbreviation}
                scope="col"
                className="text-text-dim hidden py-2 px-2 text-right text-xs font-normal lg:table-cell"
              >
                {event.abbreviation.toUpperCase()}
              </th>
```

and after the `</table>`:

```tsx
      {/* 🔴 The columns' names, on the page rather than in a `title`.
          `title` never fires on a touch screen and is unreliable from a
          keyboard, so on every device but a mouse these were unlabelled
          three-letter codes — and the twelve award bodies are the app's
          primary vocabulary, not something a reader arrives knowing.

          Twelve full names will not fit twelve columns at any width, so the
          mapping goes underneath. `hidden lg:flex` matches the columns it
          explains: a legend for columns nobody can see is noise, and below
          `lg` the expandable row does this job instead. */}
      <ul className="text-text-dim hidden flex-wrap gap-x-4 gap-y-1 text-xs lg:flex">
        {leaderboard.events.map((event) => (
          <li key={event.abbreviation}>
            <span className="tabular font-mono">{event.abbreviation.toUpperCase()}</span>{' '}
            {event.name}
          </li>
        ))}
      </ul>
```

**(b) The scroll container returns at `lg` only, and the film column sticks.**

```tsx
    <div className={cn('flex flex-col gap-4', className)}>
      {/*
        🔴 `lg:overflow-x-auto`, not `overflow-x-auto`. D79 removed the scroll
        *below* `lg` and that stays removed: on a phone it put Total off screen
        at every width, which is the one number this section exists to report.
        D79 said nothing about `lg`, where the per-show columns return — and
        twelve of them overflow the content panel at 1024px, taking the whole
        document sideways with them. The scroll is restored exactly there.
      */}
      <div className="lg:overflow-x-auto">
        <table className="w-full border-collapse text-sm lg:min-w-[48rem]">
```

and both the header's Film cell and every row's film cell gain:

```tsx
className="... bg-bg-surface lg:sticky lg:left-0 lg:z-10"
```

```tsx
{/* 🔴 The sticky cell paints its own ground or the scrolled columns show
    through it. `bg-bg-surface` is the tone of the `Panel as="main"` this
    table sits directly inside (`components/Panel.tsx` defaults to `surface`)
    — not a guess, and it must be re-checked if the table is ever moved into
    a `raised` panel. Verified in **both** schemes: a background chosen
    against the dark ground is exactly the kind of thing that is invisibly
    wrong in light. */}
```

**(c) The film title becomes a disclosure below `lg`.**

Add one piece of state beside `shown`:

```tsx
  /**
   * Which films have their breakdown open.
   *
   * A Set rather than a single id: two readers comparing two films is the
   * normal use, and closing one to open another is a fight with the reader.
   */
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());

  const toggle = (movieId: number) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(movieId)) next.add(movieId);
      return next;
    });
```

The row's film cell renders a button below `lg` and plain text at `lg` and up:

```tsx
              <th
                scope="row"
                className="text-text-primary bg-bg-surface py-2 pr-3 text-left font-normal lg:sticky lg:left-0 lg:z-10"
              >
                {/* 🔴 Below `lg` the per-show columns are hidden (D79), which
                    left the reader a total with no account of where it came
                    from — on the device most of them use. The title opens the
                    breakdown there; at `lg` and up the columns are on screen
                    and a disclosure would be a control that reveals what is
                    already visible. */}
                <button
                  type="button"
                  onClick={() => toggle(row.movieId)}
                  aria-expanded={open.has(row.movieId)}
                  aria-controls={`breakdown-${row.movieId}`}
                  className="focus-visible:outline-accent-fill flex min-h-11 items-center gap-2 text-left focus-visible:outline-2 lg:hidden"
                >
                  {row.title}
                  <span aria-hidden="true" className="text-text-dim text-xs">
                    {open.has(row.movieId) ? '▾' : '▸'}
                  </span>
                </button>
                <span className="hidden lg:inline">{row.title}</span>
              </th>
```

and after each `<tr>`, the breakdown row:

```tsx
            {open.has(row.movieId) ? (
              <tr id={`breakdown-${row.movieId}`} data-testid={`breakdown-${row.movieId}`} className="lg:hidden">
                <td colSpan={2 + leaderboard.events.length} className="pb-3">
                  <dl className="text-text-secondary flex flex-col gap-1 pl-2 text-xs">
                    {leaderboard.events
                      // 🔴 Only the shows this film actually scored at. The
                      // columns print zeroes because a grid has to be
                      // rectangular; a list does not, and a list of zeroes is
                      // noise the reader has to read past.
                      .filter((event) => (row.events[event.abbreviation] ?? 0) !== 0)
                      .map((event) => (
                        <div key={event.abbreviation} className="flex justify-between gap-4">
                          {/* The full name, not the code: the reader who opened
                              this is the one who cannot see the legend either. */}
                          <dt>{event.name}</dt>
                          <dd className="tabular font-mono">
                            {row.events[event.abbreviation]}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </td>
              </tr>
            ) : null}
```

`colSpan` counts Film + every show + Total; the show cells are hidden below
`lg` but still present in the markup, so the count is the full width.

**(d) Update the component docstring** with a 🔴 paragraph for each of the four
changes, in the register the file already uses — including the sentence that
D79 is upheld, not amended.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run components/LeaderboardTable.test.tsx components/SeasonPicker.test.tsx`
Expected: PASS, including the pre-existing reveal tests.

- [ ] **Step 8: Stories**

`components/SeasonPicker.stories.tsx`: `TenSeasons` (the case that produced the
33.6×20px targets), `TwoSeasons`, `OneSeason` (renders nothing).

`components/LeaderboardTable.stories.tsx`: add `TwelveShows` — twelve events,
which is the real count and the case the sticky column and the legend both
exist for. Keep `Short`, `Long` and `Empty`.

- [ ] **Step 9: 🔴 Geometry, which only a browser can measure**

Add to `e2e/dashboard.spec.ts`:

```ts
  test('🔴 every season target clears 44px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // The defect: ten year links at 33.6 × 20px. Rendered geometry is the only
    // place that number was ever real, which is why no test caught it.
    const picker = page.getByRole('group', { name: 'Season' });
    const summary = await picker.locator('summary').boundingBox();
    expect(summary?.height ?? 0).toBeGreaterThanOrEqual(44);

    await picker.locator('summary').click();
    for (const link of await picker.getByRole('link').all()) {
      const box = await link.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test('🔴 the film column stays put while the shows scroll (1024px)', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto('/');

    const film = page.getByRole('rowheader').first();
    const before = (await film.boundingBox())?.x ?? 0;

    await page.locator('.lg\\:overflow-x-auto').first().evaluate((el) => {
      el.scrollLeft = 400;
    });

    const after = (await film.boundingBox())?.x ?? -1;
    expect(after).toBeCloseTo(before, 0);

    // And the document itself did not move: the scroll belongs to the table.
    expect(await page.evaluate(() => document.scrollingElement.scrollWidth)).toBeLessThanOrEqual(1024);
  });

  test('🔴 a phone can see where a total came from', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const first = page.getByRole('button', { name: /./ }).filter({ hasNotText: 'Show' }).first();
    await page.getByRole('rowheader').first().getByRole('button').click();

    await expect(page.locator('[data-testid^="breakdown-"]').first()).toBeVisible();
    expect(await page.evaluate(() => document.scrollingElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
```

Drop the unused `first` locator if the selector above resolves directly —
written out so the implementer can see which row is meant, not as a placeholder.

- [ ] **Step 10: Run the spec, and prove it can fail**

```bash
npx playwright test e2e/dashboard.spec.ts
```

Expected: green. Then, one at a time: put `title` back on a header and confirm
the legend test still passes (it should — they are independent); remove
`lg:sticky` and confirm the 1024px test goes red; restore the flat year `<nav>`
and confirm the 44px test goes red. Restore everything.

- [ ] **Step 11: The browser pass, all four widths, both schemes**

`npm run dev`, `/` signed out, at 1440, 1280, 1024 and 390px in both schemes:

| Width | Measured |
|---|---|
| 1440 | Every per-show column visible with no scroll. Legend below the table names every column. No header carries `title`. |
| 1280 | Same. If the table scrolls here, record the show count that caused it. |
| 1024 | 🔴 The table scrolls **inside its own container**: `document.scrollingElement.scrollWidth ≤ 1024`. The film column's `x` is unchanged after `scrollLeft = 400`, and nothing shows through it in **either** scheme. |
| 390 | Film and Total only, no sideways scroll, `scrollWidth ≤ 390`. Every row's title is a ≥44px disclosure. Opening one inserts a breakdown listing full show names. The year control is one ≥44px target; opening it gives ≥44px targets and does **not** push the table down. |

Both schemes at every width: the sticky cell's `bg-bg-surface`, the legend's
`text-text-dim` at 12px (🔴 the exact pairing P17.T34 will audit — record the
measured ratio rather than fixing it here), and the picker's open list on
`bg-bg-raised`.

Also confirm in **Safari** that the `<summary>` marker is hidden — the
`::-webkit-details-marker` rule is the only thing standing between the design
and a stray triangle.

- [ ] **Step 12: Commit**

```bash
npm run lint && npm run typecheck && npx vitest run components/
git add components/SeasonPicker.tsx components/SeasonPicker.test.tsx components/SeasonPicker.stories.tsx components/LeaderboardTable.tsx components/LeaderboardTable.test.tsx components/LeaderboardTable.stories.tsx "app/(app)/page.tsx" e2e/dashboard.spec.ts docs/PROGRESS.md
git commit -m "P17.T4: the leaderboard stops assuming a mouse and a 1440px screen"
```

Tick `P17.T4` in `docs/PROGRESS.md` as part of this commit.

---

## Tranche 1 gate

Before tranche 2 is planned, let alone started:

```bash
npm run verify          # lint, typecheck, layering, both test suites, build
npm run build-storybook # every story still compiles
npm run db:up && npm run test:e2e
```

Then **one browser pass over the whole tranche**, at 1440px, 1280px, 1024px and
390px, in **both** schemes, signed out and signed in:

| Route | What tranche 1 changed there |
|---|---|
| `/` | The shell around it (T2), heading sizes and outline (T1), the stepper's anchor (T3), the lede (T5), the leaderboard (T4) |
| `/browse` | The cursor in the URL (T6), and the shell (T2) |
| `/rules-and-scoring` | Reachable signed out (T0) |
| A scratch league's draft console | The two messages (T7) |
| Any page, at 1024px | 🔴 The dead zone. Rail hidden, bar present, identity and search and the way in all on screen |

Record in `docs/PROGRESS.md` → **Phase 17 notes**:

- The 390px tab-bar slot widths and which chrome branch shipped (T2, Step 1).
- The 1024px content-panel width, before and after T2.
- The rendered `h1`/`h2`/`h3` sizes on `/` (T1).
- Whether the signed-out `EmptyState` kept or lost its action (T5).
- The `text-dim` legend's measured contrast ratio at 12px (T4) — as an input to
  P17.T34, not as something to fix here.
- The list of amendments awaiting a D-number (T6 today; later tranches append).

🔴 **Anything found but not fixed goes under "Open questions carried forward"
in `docs/PROGRESS.md`**, with its measurement. A defect nobody wrote down is a
defect the next browser pass finds again from scratch.

---

## Tranche 2 onward

_Not yet written. Planned just-in-time after tranche 1 executes, for the reason
given at the top of this file: T18's body-size move, T22's surface rename,
T23's spacing step and T33/T34's signed-in audit are all sweeps whose right
shape depends on the heading scale T1 settles and the shell T2 settles._

When each tranche is planned, append it here as
`## Tranche N — <group> (Tx–Ty)`, in the task format above, and update the
pointer in `docs/PROGRESS.md`. The grouping in `docs/PLAN.md` is the natural
tranche boundary:

| Tranche | Tasks | Group |
|---|---|---|
| 1 | T0–T7 | Product and structure — **this document** |
| 2 | T8–T10 | Accessibility and correctness |
| 3 | T11–T17 | Visual |
| 4 | T18–T25 | Type and colour system |
| 5 | T26–T36 | Signed-in surfaces, **and the D85+ ledger entries (T26)** |

Two standing notes for whoever plans them:

- 🔴 **P17.T26 records D85–D97 in one pass, and runs after every amendment
  exists.** No other tranche edits `docs/DECISIONS.md`; each records its
  amendments in `docs/PROGRESS.md` → Phase 17 notes instead, so numbers are
  assigned once and nothing is renumbered.
- 🔴 **P17.T28 (`/admin/season`) is safety-bearing and gets its own reviewer
  pass**, the way P15.T10 did. Ten adjacent buttons that re-scope the app for
  every user with no confirmation and no undo is not a visual defect.

# Phase 10 — Remaining Features to Parity

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every open row in `docs/PARITY.md`, so cutover is a decision about a date rather than about a gap.

**Architecture:** No new architecture. Every row is a page, a Server Action, or a repository method, built on what phases 2–9 established.

**Tech Stack:** No new dependencies expected.

---

## 🔴 Nothing is reachable

Found while planning this phase, and it changes the order of everything: **the
app has no navigation.** `app/layout.tsx` renders `{children}` inside the
providers and nothing else — no header, no nav, no account menu. Every page
built so far is an island you can only reach by typing its URL.

The source app has seven nav entries
(`src/layouts/dashboard/navbar/NavConfig.js`): Home, Browse, Award Shows,
Leagues, Watchlist, Draft list, Rules & Scoring.

🔴 **The port ships four, not seven** — spec §6.9, already approved:

> `Home · Films · Award Shows · Leagues`
>
> Browse, Watchlist and Draft List are three views of one idea. Rules &
> Scoring becomes contextual help surfaced inside the ledger, not a nav peer.

That consolidation is load-bearing for the batches below: **Films** is one
destination with views, not three siblings, so T7 (browse), T20 (draft list)
and T33–37 (watchlist) build *into* it rather than beside it. It also keeps the
count at four, inside the five-item ceiling a bottom bar can carry on a phone.

Navigation is not a `PARITY.md` row, because the matrix records *capabilities*
and navigation is what makes capabilities findable — invisible in an audit and
immediately obvious to a person. **It is therefore T1.**

## 🔴 The order is what the league needs, not what the audit found

`PARITY.md` numbers its rows P10.T1–T50 in matrix order. This plan groups them
into batches by what makes the app usable, and the task ids stay as the matrix
assigned them so the two documents keep agreeing.

| Batch | Why it comes here | Rows |
|---|---|---|
| **A. The shell** | Nothing is reachable without it | nav, account menu, error boundary (T50) |
| **B. Leagues can form** | Without these, no new league can exist at all — the single biggest functional hole | T1 join by link, T11 create, T12 your leagues, T13 invite link |
| **C. Running a season** | The owner's yearly work, currently impossible | T14 groups, T15 seats, T16 edit/remove seat, T17 start/complete, T18 stage next, T19 settings |
| **D. Films** | The most-visited pages in the source app | T5 movie page, T6 avg draft position, T7 browse, T9 similar |
| **E. Personal** | What members do between ceremonies | T20 draft list, T33–37 watchlist, T38–39 reviews, T40–42 profile |
| **F. Season surfaces** | Complete the picture | T2 now playing, T3 live banner, T4 leaderboard, T10 league standings |
| **G. Admin & reference** | Rare but blocking when needed | T26–27 show/category CRUD, T30 needs-entering, T43–45 notifications, T46–48 rules/points/active year, T49 relink UI |
| **H. Calendar** | One of three permitted `/api` routes (D8) | T25 ical feed |

**Batches A and B are the cutover-critical ones.** Everything else is a member
noticing something is missing; without B, a new league cannot be created at
all.

## 🔴 What every component built in this phase must satisfy

Set by the owner 2026-08-16: components are modern, fit the design system, and
follow UI/UX standards. Written here as checkable rules rather than an
aspiration, because "looks right" is not something a reviewer can fail.

**The design system is ours and it is already built** (§6, phase 3). Use it
rather than inventing beside it:

- **Tokens only.** `bg-bg-base`, `text-text-primary`, `border-border-rule`,
  `accent-fill` / `accent-text`. A hex literal in `app/` or `components/` fails
  CI, and every token swaps between dark and light with no branch (D15).
- **Type**: Archivo for display and body, IBM Plex Mono for numbers — and
  numbers are **tabular** (`tabular font-mono`) so columns do not jitter.
- **Carmine is meaning, not decoration.** It marks *this one*: the winner, the
  seat on the clock, the current page, you. Something accented for emphasis
  alone devalues every real signal.
- **One signal per fact**, and never colour alone (§6.7, §12). A state gets a
  word; colour may reinforce it.
- **Motion**: `150ms` fast, `200ms` base, `cubic-bezier(0.2, 0, 0, 1)` — the
  tokens in `theme/tokens.ts`. Honour `prefers-reduced-motion`.
- **Existing components are the idiom.** `PosterFrame`, `LetterboxRule`,
  `EmptyState`, `PointsLedger`. Reach for one before writing a new one.

**UI/UX standards, in priority order.** These are the ones this app can
plausibly get wrong:

1. **Touch targets ≥ 44×44px with ≥ 8px between them.** The draft board and
   nav are used one-handed on a phone.
2. **Visible focus on everything interactive.** Never remove a focus ring;
   `focus-visible:outline-accent-fill` is the house style.
3. **Contrast ≥ 4.5:1.** `theme/contrast.ts` computes it and `theme/tokens.test.ts`
   pins the palette — a new colour pairing gets a test, not a guess.
4. **State is announced, not implied**: `aria-current` for the current page,
   `aria-live` for results that arrive, real labels on icon-only controls.
5. **Mobile-first (D49)**: no horizontal page scroll, `min-h-dvh` not `100vh`,
   wide content scrolls inside its own container.

**Prefer a native element over a built one.** `PointsLedger` is a `<details>`
and gets keyboard operation, no JavaScript, and pre-hydration behaviour for
free. MUI is available for genuinely complex controls (D3); Tailwind carries
everything bespoke (D29).

## Global Constraints

- **D8** — Server Components and Server Actions. The only `/api` routes permitted are the Clerk webhook, the ical feed (T25) and the live stream (phase 14).
- **D33/D37** — `app/`, `actions/`, `components/` import no Prisma, no db client, no hex literals. Five CI checks enforce this.
- **D41** — scoring goes through `lib/services/scoring.ts`. `awards.points` is a foreign key; resolve through `pointsId`.
- **D44/D45** — visibility is a per-page decision and the source was public by default. Check `PARITY.md` for the row's recorded visibility; add public routes to `proxy.ts` deliberately.
- **D49** — mobile-friendly by default; owner-only tooling is the desktop-first exception.
- **D59** — scores are computed on read. 🔴 **Every new surface that shows a score adds a case to `lib/services/scoring.batching.test.ts`** — the board is 10 queries for 144 picks, and an N+1 would be 144.
- **D60** — `nominations.year` is an integer now. No `String()` conversions.
- **D54** — the source tree is read-only, whatever is found in it.
- 🔴 **`PARITY.md` lists ten source bugs deliberately not ported.** Read that section before closing any row, or one comes back as a "fix".
- Data-backed suites go in `vitest.ci.config.mts` **before** pushing.
- **39 of 71 source endpoints have no captured fixture.** Where a task depends on a response shape, capture it from Heroku *before* porting — the old app is still running, and after cutover that evidence is gone.

---

## Batch A — The shell

### Task A1: Navigation and the account menu

**Files:** `components/AppNav.tsx`, `app/(app)/layout.tsx`, tests

- [ ] **Step 1: Four entries (§6.9)** — Home, Films, Award Shows, Leagues. Not the source's seven. Films is one destination with views; Rules & Scoring is contextual help in the ledger, not a peer.

- [ ] **Step 2: 🔴 Mobile-first (D49).** A fixed bottom bar under `md` — four items sits inside the five-item ceiling — and a horizontal bar above it. Not a desktop bar that wraps. `pb-[env(safe-area-inset-bottom)]` so it clears the home indicator, and the page reserves room so the bar never covers content.

- [ ] **Step 3: 44px targets, 8px apart, with a visible focus ring.** Measured in the test, not eyeballed.

- [ ] **Step 4: Icon *and* label.** Icon-only navigation harms discoverability, and this app's audience uses it once a year.

- [ ] **Step 5: 🔴 Current page carries `aria-current="page"`** and a carmine mark — the word plus the colour, never colour alone.

- [ ] **Step 6: The account menu is Clerk's `<UserButton>`**, with a sign-in link when signed out. The dashboard is public (D44), so signed-out visitors get the nav too.

- [ ] **Step 7: Test** — four entries render, the current one is marked, targets meet 44px, and a signed-out visitor sees sign-in rather than an account menu.

- [ ] **Step 8: Commit.**

### Task A2: An error boundary (P10.T50)

**Files:** `app/error.tsx`, `app/(app)/error.tsx`, `app/not-found.tsx`

- [ ] **Step 1: 🔴 The app has none today.** An unhandled error in any Server Component shows Next's default overlay in development and a blank page in production.

- [ ] **Step 2: Distinguish the app's own errors.** `lib/errors.ts` defines `NotFoundError`, `ForbiddenError`, `ConflictError` and `isAppError` — which exists precisely because RSC payloads lose prototypes. Use it: a `FORBIDDEN` should not read "something went wrong".

- [ ] **Step 3: Never render a raw message.** The source app returned Postgres errors verbatim, leaking the SQL and column list (`lib/errors.ts` records this). The boundary shows a written message and logs the rest.

- [ ] **Step 4: Commit.**

---

## Batch B — Leagues can form

### Task B1: Create a league (P10.T11, T13)

**Files:** `lib/repositories/leagues.ts` (write methods), `actions/leagues/create-league.ts`, `app/(app)/leagues/new/page.tsx`

- [ ] **Step 1: 🔴 `leagues.owner` is TEXT holding a JSON array.** Writing it means `JSON.stringify([userId])`. The repository already *parses* it into `ownerIds` (D47); the write must produce the same shape, and a test should round-trip through `findById` to prove it.

- [ ] **Step 2: The creator gets a seat.** The source's `POST /league/add` enrols them; a league whose owner is not in it renders an empty board.

- [ ] **Step 3: `uuid` is the invite link.** Generate it at creation — `gen_random_uuid()` or `randomUUID()`.

- [ ] **Step 4: Draft type is linear or snake** (`leagues.type`). The measured reality is snake (D50), but the column exists and the source's create form asks.

- [ ] **Step 5: Test the refusals first** — signed out cannot create.

- [ ] **Step 6: Commit.**

### Task B2: Join by invite link (P10.T1)

**Files:** `actions/leagues/join-league.ts`, `app/(app)/join/[uuid]/page.tsx`

- [ ] **Step 1: 🔴 Joining twice must not create a second seat.** The source guarded on `league.selections.length === 0` in one place and not in another (`PARITY.md` bug 6 is the unguarded one). Check for an existing seat in *this* league-year and return it.

- [ ] **Step 2: Signed out goes to sign-up carrying the uuid**, and joins after. That flow exists in the source (`Register.js` reads `?uuid=`) and is how every member was onboarded.

- [ ] **Step 3: An unknown uuid is a 404, not an error page.** A mistyped invite is a user mistake.

- [ ] **Step 4: Test** — joining twice yields one seat; an unknown uuid 404s; a signed-out visitor reaches sign-up.

- [ ] **Step 5: Commit.**

### Task B3: Your leagues (P10.T12)

**Files:** `app/(app)/leagues/page.tsx`

- [ ] **Step 1: Replace the Phase 4 placeholder.** It currently renders the signed-in email and nothing else.

- [ ] **Step 2: Membership is a seat** — `draftRepository.findLeagueIdsByUserId`. There is no members table.

- [ ] **Step 3: 🔴 Do not redirect to the first league** the way the source did (`league/redirect.js`). It rendered `null` and bounced, which means no page ever showed a member their leagues. Show the list; it is one of the few places the port should be better.

- [ ] **Step 4: Commit.**

---

## Batches C–H

Each batch follows the same shape and is planned in detail when it starts —
this document is amended rather than replaced, so `PARITY.md` and `PROGRESS.md`
keep referring to one plan. The constraints above apply to every task in them.

🔴 **Before starting each batch**, re-read:
1. The batch's rows in `PARITY.md`, including the source evidence column.
2. The source bugs list — several rows in batches C and E touch code that
   carries one.
3. `scoring.batching.test.ts`, for any row that shows a score.

---

## Notes for the executor

- **A row is closed when a person can do the thing**, not when a service exists. `PARITY.md` has no "partial" (D53).
- **Update `PARITY.md` in the same commit as the row it closes.** The matrix and the code disagreeing is how the audit stops being trustworthy.
- **Capture a fixture before porting a shape that has none.** The old app is still running; after cutover it is not.
- **Batches A and B are cutover-critical.** If the schedule tightens, everything from D onward can ship after cutover; B cannot.

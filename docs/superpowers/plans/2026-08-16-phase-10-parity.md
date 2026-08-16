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

🔴 **The port ships all seven** (D62). Spec §6.9 proposed consolidating to four
— `Home · Films · Award Shows · Leagues` — and the owner overrode it: the
league knows the app by these seven names.

That shapes the batches below. Browse (T7), Watchlist (T33–37) and the Draft
list (T20) are **their own destinations**, not views inside a Films page, and
each one's task ends by flipping its `ready` flag in `NAV_LINKS`.

It also decides the phone pattern: seven will not fit a bottom bar at 44px
targets, so navigation is a **drawer** — which is what the source app used too.

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

🔴 **Before starting each batch**, re-read:
1. The batch's rows in `PARITY.md`, including the source evidence column.
2. The source bugs list — several rows in batches C and E touch code that
   carries one.
3. `scoring.batching.test.ts`, for any row that shows a score.

---

## Batch C — Running a season

The owner's yearly work, and currently impossible: a league can be created but
not *run*. Every task is owner-gated through `actions/leagues/guard.ts`, which
is the same `canManageLeague` every other write uses (D47).

🔴 **Three source bugs live in this batch.** Read `PARITY.md`'s bug list before
touching any of it:
- bug 4 — `verifyLeagueOwner` is a no-op on the route that adds a seat, so any
  logged-in user can add one to any league;
- bug 5 — `DELETE /draft/:id` authenticates but does not authorise;
- bug 6 — `PUT /league/:id/status` writes the whole request body and inserts a
  duplicate seat for the caller on every call.

Bug 6 is the dangerous one to copy: `req.body` straight through means a request
could set `owner` and take the league.

### Task C1: The group assignment rule

**Files:** `lib/services/group-assignment.ts` + test

- [ ] **Step 1: Port `makeGroups` as a pure function.** The source deals
  round-robin (`src/pages/league/orderAndGroups/utils.js`), which keeps groups
  balanced by construction.
- [ ] **Step 2: 🔴 Do not "simplify" it to chunking a shuffled list.** They look
  equivalent and are not: 17 people into 4 chunks gives 5/5/5/2, a group of
  two. Dealing gives 5/4/4/4. Test the remainder cases, not just 16 into 4.
- [ ] **Step 3: Separate the shuffle from the dealing**, so the rule that
  decides fairness is testable without randomness.
- [ ] **Step 4: Commit.**

### Task C2: Seat and league writes

**Files:** `lib/repositories/drafts.ts`, `lib/repositories/leagues.ts`

- [ ] **Step 1: `updateSeat` / `assignSeats` / `deleteSeat`**, each scoped by
  `leagueId` in the WHERE clause so a seat id from another league matches
  nothing rather than being rewritten. That is what makes bug 4 and bug 5
  unrepeatable here.
- [ ] **Step 2: 🔴 `assignSeats` is one transaction.** A half-applied layout
  leaves some people grouped and others not, and the owner cannot tell what
  saved.
- [ ] **Step 3: 🔴 `deleteSeat` refuses a seat that holds picks.** `draft_picks`
  has no foreign key, so nothing cascades — the picks would belong to nobody,
  and the board drops them while the standings keep them.
- [ ] **Step 4: `leagueRepository.update` takes named fields only** — name,
  type, status, active year. Never a body object (bug 6).
- [ ] **Step 5: Commit.**

### Task C3: The season actions

**Files:** `actions/leagues/guard.ts`, `actions/leagues/manage-seats.ts`,
`actions/leagues/manage-league.ts`

- [ ] **Step 1: One guard, `authorizeLeague`**, mirroring the draft actions'.
- [ ] **Step 2: 🔴 Refusals tested before successes**, asserting the database is
  unchanged rather than that the call failed.
- [ ] **Step 3: `addDummySeat`** — 17 placeholder seats exist in production;
  they are normal, not an edge case.
- [ ] **Step 4: `randomiseGroups` refuses once drafting has started.**
  Reshuffling mid-draft moves people away from picks they have already made.
- [ ] **Step 5: `startDraft` / `completeDraft` change only the status.** The
  source's version also inserted a seat for the caller every time it ran.
- [ ] **Step 6: `stageNextSeason`** — copy this year's members into next year's
  seats, skipping anyone already seated, so running it twice is safe.
- [ ] **Step 7: Commit.**

### Task C4: The owner's season console

**Files:** `components/SeasonSetup.tsx`, `app/(app)/leagues/[id]/setup/page.tsx`

- [ ] **Step 1: Owner-only, 404 to everyone else**, like the draft console —
  a bounce to login would confirm the league exists.
- [ ] **Step 2: Desktop-first (D49)**, the stated exception: this is a laptop
  task done once a year.
- [ ] **Step 3: Group assignment is keyboard-operable.** Reuse
  `@hello-pangea/dnd` as `PickList` does, or a select per seat — but not
  drag-only (a11y `gesture-alternative`).
- [ ] **Step 4: 🔴 Destructive actions confirm.** Removing a seat and starting
  the draft are both hard to undo mid-season.
- [ ] **Step 5: Commit.**

### Task C5: E2E and close-out

- [ ] **Step 1: E2E** — as owner: add a placeholder, randomise groups, start the
  draft; as a member: see none of it. Scratch league, not league 1.
- [ ] **Step 2:** Full verification, CI excludes, close `PARITY.md` T14–T19.
- [ ] **Step 3: Commit.**

---

## Batch D — Films

The most-visited pages in the source app, and the reason TMDB is a hard
requirement (D56). `/browse` and `/movie/:id` are where members spend time
between ceremonies.

### 🔴 What the source actually looks like

The owner supplied screenshots (2026-08-16), kept in `docs/reference/`:
`source-browse.png`, `source-film-top.png`, `source-film-detail.png`. Read them
before building — several things in them were not in this plan and would not
have been guessed:

**Browse** (`/browse`)
- A **backdrop hero** carrying the word "Browse", not a bare heading.
- A single **"The Future / The Past"** toggle — one control that flips the sort
  between upcoming and past releases and resets the list.
- Results are **grouped by month**, each group labelled `MM/YYYY` in a card to
  the left of its films. Not an undifferentiated grid.
- Every poster carries a **green `+` badge in its corner** — add to watchlist,
  one tap, without leaving the page. That is the browse page's whole job
  beyond looking at things.
- Titles sit **below** each poster, wrapping to as many lines as they need.

**A film** (`/movie/:tmdbId` — note: **TMDB id in the URL**, not our local id)
- A **backdrop banner** with the title over it, the year beside it, and the
  **MPAA rating in a bordered box**.
- A left column of **labelled facts**: Runtime, Language, Tagline, Overview,
  Genres, Release date, Budget, Box Office Gross, Production companies,
  Ratings.
- **Ratings are a coloured chip** — Metacritic 66 on green — not plain text.
- A right column with a **trailer carousel** (YouTube, arrows both sides), then
  a **poster carousel** showing a counter like `1/112`, then **Similar Movies**.
- **Credits are grouped by department** — "Directing" listing each person with
  their exact role beside the name ("Second Unit Director", "Script
  Supervisor") — with a **`+ More`** control rather than a wall of names.

**What this changes about the plan below:**
1. The film route is keyed by **TMDB id**, so it resolves for films the app has
   never ingested. `ensureFilm` (D56) is what makes a local row when one is
   needed.
2. Browse needs **watchlist writes** (batch E's T34) to be useful at all — the
   `+` badge is the point. Build the action with browse rather than after it.
3. The month grouping and the two carousels are real components, not styling.
4. Box office and budget come from TMDB; **Metacritic and Rotten Tomatoes come
   from OMDb**, a second key that may be absent — the chip must be omitted
   rather than rendered empty.

### Task D1: The film page (P10.T5, T6)

**Files:** `lib/services/film.ts`, `app/(app)/films/[id]/page.tsx`

- [ ] **Step 1: 🔴 Capture the fixture first.** `movie-by-id` and `movie-details`
  exist; the *rendered* shape does not. The old app is still running — capture
  before porting, because after cutover that evidence is gone.
- [ ] **Step 1b: Route on the TMDB id** (`/films/[tmdbId]`), as the source does.
  A film nobody has drafted has no local id, and the screenshots show the page
  working for exactly such a film.
- [ ] **Step 2: Local row first, TMDB for the rest.** The film page needs cast,
  crew, trailers and images that `movies` does not store.
- [ ] **Step 3: Points by award show, and average draft position.** Reuse
  `ledgerForMovies` (D41) — do not write a second scoring path. **Add a case to
  `scoring.batching.test.ts`** (D59).
- [ ] **Step 4: 🔴 OMDb is a second key and a second failure mode.** Rotten
  Tomatoes scores come from it in the source (`movie/movie.js:53`). Absent a
  key, the page renders without them rather than failing.
- [ ] **Step 5: Public (D44).** Commit.

### Task D2: Browse (P10.T7, T9)

**Files:** `app/(app)/browse/page.tsx`

- [ ] **Step 1: TMDB discovery, paged.** The source infinite-scrolls and drops
  posterless results.
- [ ] **Step 2: Mark what is already on the viewer's watchlist** — one batched
  query, never one per film.
- [ ] **Step 3: Similar films on the film page** (T9) comes from the same TMDB
  call as D1 and belongs there rather than in a second request.
- [ ] **Step 4: Flip `browse.ready` in `NAV_LINKS`.** Commit.

---

## Batch E — Personal

What members do between ceremonies. Every row here is *about the viewer*, so
every page is private and every query is scoped to their id.

### Task E1: The draft list (P10.T20)

**Files:** `lib/repositories/lists.ts` (writes), `app/(app)/list/page.tsx`

- [ ] **Step 1: A private ranked pre-draft list**, dragged into order — people
  prepare with this for weeks before a draft.
- [ ] **Step 2: Reuse `PickList`'s reordering**, which is already keyboard-
  operable and optimistic.
- [ ] **Step 3: Statuses are `none` / `selected` / `unavailable`** — the enum
  already exists. "Unavailable" means someone else took it.
- [ ] **Step 4: 🔴 `POST /lists/:year` accepts any single segment as a year**
  in the source (bug 10) and then ignores it. Validate.
- [ ] **Step 5: Flip `list.ready`.** Commit.

### Task E2: Watchlist (P10.T33–T37)

**Files:** `app/(app)/watchlist/page.tsx`, watchlist write actions

- [ ] **Step 1: Paged and sorted**, as `watchlist-paged` captures it.
- [ ] **Step 2: Three progress views** — by award show, by nomination count, by
  what the league drafted. All three are captured fixtures; verify against them.
- [ ] **Step 3: 🔴 Put the tab in the URL.** The source held it in component
  state, so a watchlist tab could not be linked. `PARITY.md` records this as a
  deliberate betterment, not a parity row.
- [ ] **Step 4: 🔴 Do not port `Watchlist.getByAwards`** — it validates the
  user then never filters by them, and would return every user's rows.
- [ ] **Step 5: Flip `watchlist.ready`.** Commit.

### Task E3: Reviews and profiles (P10.T38–T42)

- [ ] **Step 1: Rate and review a film**, 0.5-star precision as the source has.
- [ ] **Step 2: A member's profile and activity feed.**
- [ ] **Step 3: 🔴 `ProfileFeeds.components` is a JSON string** beside a
  `componentsArray` virtual that parses it, and the getter throws on null
  (trap 6). Handle both forms.
- [ ] **Step 4: Commit.**

---

## Batch F — Season surfaces

Completing the picture. Each of these shows a score, so **each adds a case to
`scoring.batching.test.ts`** (D59).

- [ ] **T2 — films in cinemas now.** TMDB `now_playing`, cached like search.
- [ ] **T3 — the live banner**, which is the only route into the live page.
  Renders only while an event is active; the flags are `events.nom_active` /
  `awards_active`.
- [ ] **T4 — the season leaderboard**, verified against `points-by-year`.
- [ ] **T10 — league standings on the league page**, so a visitor on a shared
  link sees scores. Comes free from the board's existing load.

---

## Batch G — Admin and reference

Rare but blocking when needed.

- [ ] **T26/T27 — edit a show, add and delete categories.** Admin-gated, and
  🔴 deleting a category orphans its nominations exactly as removing a seat
  orphans picks: refuse, or delete both deliberately.
- [ ] **T30 — which shows still need entering.** Already built on
  `/award-shows`; confirm and close the row.
- [ ] **T43–T45 — notifications.** 🔴 `DELETE /notifications/:id` is dead in the
  source (no auth middleware, so the controller's guard throws on every call).
  Rebuild it only if the owner wants it.
- [ ] **T46 — rules and scoring page.** Static copy; cheapest row in the phase.
- [ ] **T47 — the scoring rulebook by tier**, from `points`.
- [ ] **T48 — the active-season control.** The action exists
  (`actions/admin/set-active-year.ts`); it needs a page (D22).
- [ ] **T49 — the relink UI.** `actions/admin/relink.ts` exists and is the only
  code that can move an account between people — the page must say so.

---

## Batch H — The calendar feed

- [ ] **T25 — `/api/ical/[...slug]`.** One of the three `/api` routes D8
  permits. Every nominations announcement and ceremony as a subscribable feed,
  matching `GET /events/calendar.ics`.
- [ ] **🔴 It is a public URL with no session.** Serve only what the public
  award-show pages already show — dates and names, never anything about a
  person.

---

## Notes for the executor

- **A row is closed when a person can do the thing**, not when a service exists. `PARITY.md` has no "partial" (D53).
- **Update `PARITY.md` in the same commit as the row it closes.** The matrix and the code disagreeing is how the audit stops being trustworthy.
- **Capture a fixture before porting a shape that has none.** The old app is still running; after cutover it is not.
- **Batches A and B are cutover-critical.** If the schedule tightens, everything from D onward can ship after cutover; B cannot.

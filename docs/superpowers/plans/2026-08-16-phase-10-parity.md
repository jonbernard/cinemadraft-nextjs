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

### 🔴 What the source code actually does

Read after the screenshots, before writing anything. Four things here contradict
the older draft of this batch, and one is a security note.

**"Watchlist" means *watched*, not *want to watch*.** `WatchButton` is titled
"Mark as watched" / "Watched!", the toast reads "Marked as watched", and the
follow-up action it offers is "Write a review" (`src/components/WatchButton.js`).
The green `+` is therefore an *I have seen this* mark, and it flips to a
check. `PARITY.md` already calls the row "Your watched films" — the UI copy
must match that and never say "add to watchlist".

**The film route takes a TMDB id.** `GET /points/movie/:tmdbId` resolves it via
`Movies.getByTmdbId`, and `GET /movie/:id` passes it straight to TMDB. So does
the link out of browse (`PATH_PAGE.movie/${item.id}`, where `item.id` is a TMDB
id).

**🔴 The source hard-codes an OMDb key in committed source.**
`server/routes/movie/details.js:15` — `apikey: 'e4d963ed'`. Not ported, and not
touched (D54). It belongs in the bug table as a secret disclosure.

**🔴 The source film page prints the wrong runtime for every film.**
`src/pages/movie/index.jsx:88` — `moment.duration(101, 'minutes')`, a literal.
`movie.runtime` is fetched (129 for La La Land in `fixtures/movie-by-id.json`)
and never read. Every film on the site claims 1 hour 41 minutes. Ported
correctly here, and recorded as a source bug.

**Discovery is two different queries, not a sort flip.** `discovery.js`:
past = `release_date.lte` today + `vote_average.gte 4` + `vote_count.gte 200`,
sorted `release_date.desc`; future = `release_date.gte` today, sorted ascending,
with no vote floor (an unreleased film has no votes). Both pass
`with_release_type=3`, `region=US`, then drop `popularity <= 10` server-side and
`poster_path === null` client-side. Copying only the sort would return unwatched
1970s obscurities on the past side.

**Fixtures already exist.** `fixtures/movie-by-id.json`, `movie-details.json`,
`points-by-movie.json`, `movie-discovery.json` were captured on 2026-08-14 and
are the shape contract for this batch. Nothing more needs capturing — the
rendered shape is the three screenshots. Note `points-by-movie.json` has
`"year": "2017"`, a **string**, because `nominations.year` was TEXT then; it is
an integer now (D60) and the port returns a number.

### Task D1: One TMDB client, and an OMDb one beside it

**Files:**
- Create: `lib/external/tmdb-client.ts`
- Modify: `lib/external/tmdb.ts` (use the client; no behaviour change)
- Create: `lib/external/omdb.ts`, `lib/external/omdb.test.ts`
- Modify: `lib/env.ts` (add `omdbEnv`)

**Interfaces:**
- Produces: `tmdbFetch<T>(path: string, params: Record<string,string>, cache: {key: string; tags: readonly string[]; name: string}): Promise<T | null>`
- Produces: `fetchOmdb(imdbId: string): Promise<OmdbFacts | null>` where
  `OmdbFacts = { mpaaRating: string | null; boxOffice: string | null; metacritic: number | null; rottenTomatoes: number | null; imdbRating: string | null; imdbVotes: number | null }`

- [ ] **Step 1: Extract the fetch.** `tmdb.ts` already holds `BASE`,
  `TTL_SECONDS`, `TIMEOUT_MS`, the key read, the `cached` wrapper and the
  try/catch that turns every failure into an absorbed miss. The film page and
  discovery both need all six. Copying them would give three places to forget
  the timeout. Move them to `tmdb-client.ts`:

```ts
export async function tmdbFetch<T>(
  path: string,
  params: Record<string, string>,
  cache: { key: string; tags: readonly string[]; name: string },
): Promise<T | null> {
  const key = tmdbEnv.apiKey;
  if (!key) return null;

  return cached(cache.key, { ttlSeconds: TTL_SECONDS, tags: cache.tags, name: cache.name }, async () => {
    try {
      const query = new URLSearchParams({ api_key: key, include_adult: 'false', ...params });
      const response = await fetch(`${BASE}${path}?${query}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) return null;
      return (await response.json()) as T;
    } catch {
      return null;
    }
  });
}
```

- [ ] **Step 2: Rewrite `searchTmdb` and `fetchTmdbFilm` on top of it** and run
  `lib/external/tmdb.test.ts` unchanged. It must stay green without edits —
  that is the whole proof the refactor changed nothing.

Run: `npx vitest run lib/external/tmdb.test.ts`
Expected: PASS, no test file changes.

- [ ] **Step 3: 🔴 `omdbEnv` is optional where `tmdbEnv` is required.** Write it
  as such in `lib/env.ts`, with the reason in the comment: TMDB absent means no
  film can be drafted at all; OMDb absent means a ratings chip and a box-office
  line are missing from one page. One is a broken install, the other is a
  degraded panel.

```ts
export const omdbEnv = {
  get apiKey(): string | null {
    return process.env.OMDB_API_KEY ?? null;
  },
};
```

- [ ] **Step 4: Write the failing test for `fetchOmdb`.** Four cases, and the
  first two matter most:

```ts
it('returns null when no key is configured', async () => {
  delete process.env.OMDB_API_KEY;
  expect(await fetchOmdb('tt3783958')).toBeNull();
});

it('treats OMDb’s literal "N/A" as absent', async () => {
  // OMDb answers 200 with the string "N/A" rather than omitting a field, so a
  // naive port renders "Rated: N/A" and "Box office: N/A" on every old film.
  process.env.OMDB_API_KEY = 'k';
  mockFetchJson({ Rated: 'N/A', BoxOffice: 'N/A', Metascore: 'N/A' });
  const facts = await fetchOmdb('tt0000001');
  expect(facts).toEqual({
    mpaaRating: null, boxOffice: null, metacritic: null,
    rottenTomatoes: null, imdbRating: null, imdbVotes: null,
  });
});

it('reads Metacritic and Rotten Tomatoes out of the Ratings array', async () => {
  process.env.OMDB_API_KEY = 'k';
  mockFetchJson({
    Rated: 'PG-13',
    BoxOffice: '$151,101,803',
    Metascore: '94',
    imdbRating: '8.0',
    imdbVotes: '652,341',
    Ratings: [
      { Source: 'Internet Movie Database', Value: '8.0/10' },
      { Source: 'Rotten Tomatoes', Value: '91%' },
      { Source: 'Metacritic', Value: '94/100' },
    ],
  });
  const facts = await fetchOmdb('tt3783958');
  expect(facts).toMatchObject({ metacritic: 94, rottenTomatoes: 91, imdbVotes: 652_341 });
});

it('returns null rather than throwing when OMDb fails', async () => { /* 500, then a timeout */ });
```

Run: `npx vitest run lib/external/omdb.test.ts`
Expected: FAIL — `fetchOmdb` is not defined.

- [ ] **Step 5: Implement `lib/external/omdb.ts`.** Cache on the imdb id, one
  day, tag `omdb`. Numbers are parsed here, not in a component: `'91%'` and
  `'94/100'` become `91` and `94`, `'652,341'` becomes `652341`.

```ts
function score(value: string | undefined, strip: RegExp): number | null {
  if (!value || value === 'N/A') return null;
  const parsed = Number.parseInt(value.replace(strip, ''), 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
```

Prefer the `Ratings` array over `Metascore`/`tomatoMeter`: the fixture shows
both present and agreeing, and the array is the one field OMDb documents.
Fall back to `Metascore` when the array is missing.

Run: `npx vitest run lib/external/omdb.test.ts`
Expected: PASS

- [ ] **Step 6: Full verification, then commit.**

```bash
npm run verify
git add lib/external lib/env.ts && git commit -m "feat: one TMDB fetch, and an OMDb client beside it"
```

### Task D2: The film service (P10.T5, T6, T9)

**Files:**
- Create: `lib/external/tmdb-film.ts`, `lib/external/tmdb-film.test.ts`
- Create: `lib/services/film.ts`, `lib/services/film.test.ts`
- Modify: `lib/repositories/nominations.ts` (add `findYearsByMovieId`)
- Modify: `lib/services/scoring.batching.test.ts` (add the film-page case)

**Interfaces:**
- Consumes: `tmdbFetch` (D1), `fetchOmdb` (D1), `ledgerForMovies` and
  `MovieLedger` from `lib/services/scoring.ts`, `movieRepository.findByTmdbId`,
  `draftPickRepository.findByMovieId`, `posterUrl`.
- Produces:

```ts
export type FilmPage = {
  tmdbId: string;
  title: string;
  year: number | null;
  tagline: string | null;
  overview: string | null;
  runtimeMinutes: number | null;
  language: string | null;          // resolved English name, not an iso code
  genres: string[];
  releaseDate: Date | null;         // the US entry, as everywhere else
  budget: number | null;            // 0 from TMDB means unknown, not free
  revenue: number | null;
  productionCompanies: string[];
  backdropUrl: string | null;
  posterUrls: string[];             // English posters, for the carousel
  trailers: { key: string; name: string }[];
  credits: { department: string; people: { name: string; role: string; photoUrl: string | null }[] }[];
  cast: { name: string; character: string; photoUrl: string | null }[];
  similar: { tmdbId: string; title: string; posterUrl: string | null }[];
  facts: OmdbFacts | null;          // null when OMDb has no key or no answer
  scoring: FilmScoring | null;      // null when the film was never nominated
};

export type FilmScoring = {
  year: number;
  total: number;
  averageDraftPosition: number | null;
  byEvent: { abbreviation: string; name: string; total: number }[];
  ledger: MovieLedger;
};

export async function loadFilmPage(tmdbId: string): Promise<FilmPage | null>;
```

- [ ] **Step 1: Write the failing test for the TMDB half**
  (`lib/external/tmdb-film.test.ts`), driven off the committed fixture rather
  than a hand-written stub — the fixture is the contract:

```ts
import fixture from '@/fixtures/movie-by-id.json';

it('maps the captured La La Land response', async () => {
  process.env.TMDB_API_KEY = 'k';
  mockFetchJson(fixture);
  const film = await fetchTmdbFilmPage('313369');
  expect(film).toMatchObject({
    title: 'La La Land',
    runtimeMinutes: 129,          // 🔴 not 101 — see the source bug above
    language: 'English',
    genres: ['Comedy', 'Drama', 'Romance'],
    budget: 30_000_000,
  });
});

it('keeps only English posters and drops the rest', async () => { /* 68 in, en only out */ });
it('takes at most seven similar films, as the source did', async () => { /* take(7) */ });
it('groups crew by department and keeps each person’s exact job', async () => {
  // "Second Unit Director" must survive — it is what the screenshot shows.
});
it('returns null when TMDB has no key', async () => { /* not [] — one film, not a list */ });
```

Run: `npx vitest run lib/external/tmdb-film.test.ts`
Expected: FAIL — `fetchTmdbFilmPage` is not defined.

- [ ] **Step 2: Implement `fetchTmdbFilmPage`.** One request, with
  `append_to_response=release_dates,videos,images,credits,similar` — the same
  five sections the source appended, for the same reason: five round trips per
  page view against a rate-limited third party is the difference between a page
  and an outage.

  Three rules that are easy to get wrong:
  - **`budget: 0` and `revenue: 0` mean unknown**, not zero. TMDB stores 0 for
    "we do not know", and `numeral(0).format('$0,0')` in the source printed
    `$0` for every unreleased film. Map 0 to null and omit the line.
  - **`language` resolves through the iso table.** The source shipped a
    732-line `iso.js` for this. Do not port 732 lines: TMDB already returns
    `spoken_languages[].english_name`, and `original_language` can be matched
    against it. Fall back to the raw code when it cannot be matched.
  - **Trailers are filtered to `site === 'YouTube'`** and sorted `official`
    first. 32 videos came back for La La Land; the first one being a fan edit
    is a bad first impression, not a bug, but it is free to avoid.
  - **Image paths are bare paths** and go through `posterUrl` at the service
    boundary. 🔴 The *fixture* holds absolute URLs because the old server
    rewrote them (`req.tmdb.transformArray`) — the live API does not. Assert on
    the fixture but strip its host in the test helper, or the mapper will be
    written to expect URLs and break against real TMDB.

Run: `npx vitest run lib/external/tmdb-film.test.ts`
Expected: PASS

- [ ] **Step 3: `nominationRepository.findYearsByMovieId`.** `ledgerForMovies`
  takes a year, and the film page does not know one. The source read it off the
  first nomination row (`data[0].year`). Be explicit instead: return the
  distinct years descending, and the service scores the most recent.

```ts
async findYearsByMovieId(movieId: number): Promise<number[]> {
  const rows = await db.nomination.findMany({
    where: { movieId: BigInt(movieId), year: { not: null } },
    select: { year: true },
    distinct: ['year'],
    orderBy: { year: 'desc' },
  });
  return rows.flatMap((row) => (row.year == null ? [] : [row.year]));
}
```

Test it against the restored data: La La Land (local id from
`fixtures/points-by-movie.json`) returns `[2017]`.

- [ ] **Step 4: Write the failing test for `loadFilmPage`.** The cases that
  matter are the absences, so write those first:

```ts
it('renders a film the app has never ingested', async () => {
  // No local row, so no scoring, and 🔴 no write either.
  const before = await db.movie.count();
  const page = await loadFilmPage('1185806');
  expect(page?.scoring).toBeNull();
  expect(await db.movie.count()).toBe(before);
});

it('omits the ratings panel when OMDb has no key', async () => {
  delete process.env.OMDB_API_KEY;
  expect((await loadFilmPage('313369'))?.facts).toBeNull();
});

it('returns null when TMDB does not know the id', async () => { /* -> notFound() */ });

it('scores the film’s most recent nominated season', async () => {
  const page = await loadFilmPage('313369');
  expect(page?.scoring).toMatchObject({ year: 2017, total: 335 });
});

it('agrees with the captured per-event totals', async () => {
  const byEvent = new Map(page.scoring.byEvent.map((e) => [e.abbreviation, e.total]));
  expect(byEvent.get('oscars')).toBe(170);
  expect(byEvent.get('gg')).toBe(65);
  expect(byEvent.get('bafta')).toBe(55);
  expect(byEvent.get('sag')).toBe(10);
});

it('sums byEvent to the same total as the ledger', () => {
  // 🔴 The same guarantee `MovieLedger.total` makes. byEvent is a regrouping of
  // ledger.lines, never a second query.
  expect(sum(page.scoring.byEvent)).toBe(page.scoring.ledger.total);
});
```

Run: `npx vitest run lib/services/film.test.ts`
Expected: FAIL

- [ ] **Step 5: 🔴 Implement it, and do NOT ingest on view.** The obvious port
  of `movie.js` writes on a GET: it calls `Movies.update` to refresh posters,
  and `ensureFilm` would create a row. This page is **public** (D44), so a
  crawler hitting `/films/<any id>` would write a row per request and turn a
  read into unbounded insert traffic on the free tier. A film enters `movies`
  when somebody drafts or nominates it, and only then. Record as **D63**.

  Scoring composition — no second path:

```ts
const local = await movieRepository.findByTmdbId(tmdbId);
if (!local) return { ...film, facts, scoring: null };

const years = await nominationRepository.findYearsByMovieId(local.id);
const year = years[0];
if (year == null) return { ...film, facts, scoring: null };

const [ledgers, picks] = await Promise.all([
  ledgerForMovies([local.id], year),   // D41: the only scoring path
  draftPickRepository.findByMovieId(local.id),
]);
const ledger = ledgers.get(local.id);
if (!ledger) return { ...film, facts, scoring: null };

// byEvent is a regrouping of ledger.lines, so it cannot disagree with total.
const byEvent = new Map<string, { abbreviation: string; name: string; total: number }>();
for (const line of ledger.lines) {
  const seen = byEvent.get(line.eventAbbreviation);
  if (seen) seen.total += line.earned;
  else byEvent.set(line.eventAbbreviation, {
    abbreviation: line.eventAbbreviation,
    name: line.eventName,
    total: line.earned,
  });
}

const orders = picks.flatMap((pick) => (pick.order == null ? [] : [pick.order]));
const averageDraftPosition =
  orders.length === 0 ? null : orders.reduce((a, b) => a + b, 0) / orders.length;
```

  🔴 `averageDraftPosition` is null, not 0, when nobody drafted it. The source's
  `average([])` returned 0, and "average draft position: 0" reads as *first
  overall in every league* — the exact opposite of never picked.

Run: `npx vitest run lib/services/film.test.ts`
Expected: PASS

- [ ] **Step 6: Add the D59 case to `scoring.batching.test.ts`.** Every surface
  that shows a score gets one. Assert `loadFilmPage` issues a bounded number of
  queries and that none of them is per-nomination.

- [ ] **Step 7: Commit.**

```bash
npm run verify
git add lib/external lib/services lib/repositories/nominations.ts && \
  git commit -m "feat: the film page's data, scored through the one ledger path"
```

### Task D3: Mark as watched (P10.T34)

Built here rather than in batch E because browse is useless without it — the
green badge is what browse is *for*.

**Files:**
- Modify: `lib/repositories/watchlists.ts` (add `add`, `deleteByUserAndMovie`)
- Create: `actions/watchlist/toggle-watched.ts`, `actions/watchlist/watchlist-actions.test.ts`
- Create: `components/WatchedToggle.tsx`, `components/WatchedToggle.test.tsx`

**Interfaces:**
- Produces: `toggleWatched(input: { tmdbId: string; watched: boolean }): Promise<ActionResult<{ watched: boolean }>>`
- Produces: `<WatchedToggle tmdbId={string} title={string} watched={boolean} />`

- [ ] **Step 1: Write the failing action test — refusals first**, as every
  other action's test does:

```ts
it('refuses an anonymous caller and writes nothing', async () => {
  mockNoSession();
  const before = await db.watchlist.count();
  const result = await toggleWatched({ tmdbId: '313369', watched: true });
  expect(result.ok).toBe(false);
  expect(await db.watchlist.count()).toBe(before);
});

it('is idempotent — marking twice leaves one row', async () => {
  await toggleWatched({ tmdbId: '313369', watched: true });
  await toggleWatched({ tmdbId: '313369', watched: true });
  expect(await countFor(user, movieId)).toBe(1);
});

it('deletes only the caller’s row', async () => {
  // 🔴 The source took a watchlist id off the URL and deleted by it:
  // DELETE /watchlist/item/:id. Deleting by (userId, movieId) makes another
  // user's id match nothing rather than delete their row.
});
```

Run: `npx vitest run actions/watchlist/watchlist-actions.test.ts`
Expected: FAIL

- [ ] **Step 2: 🔴 Add the repository writes keyed on `(userId, movieId)`, not
  on the row id.** The pair is what the caller actually knows and what the
  guard can check in one place.

```ts
async add(userId: number | bigint, movieId: number | bigint): Promise<Watchlist> {
  const existing = await db.watchlist.findFirst({
    where: { userId: BigInt(userId), movieId: BigInt(movieId) },
    select: SELECT,
  });
  if (existing) return toDto(existing);
  const now = new Date();
  const row = await db.watchlist.create({
    data: { userId: BigInt(userId), movieId: BigInt(movieId), createdAt: now, updatedAt: now },
    select: SELECT,
  });
  return toDto(row);
},

async deleteByUserAndMovie(userId: number | bigint, movieId: number | bigint): Promise<void> {
  await db.watchlist.deleteMany({
    where: { userId: BigInt(userId), movieId: BigInt(movieId) },
  });
},
```

`deleteMany` rather than `delete`: unmarking a film that was never marked is
not an error, and the schema has no unique constraint to lean on.

- [ ] **Step 3: The action, with `ensureFilm` — here it is correct.** Marking a
  film watched is a deliberate write by a logged-in person, so ingesting the
  film is exactly right; the same call on the *page render* of D2 was not.
  `revalidatePath` the browse and watchlist routes afterwards.

Run: `npx vitest run actions/watchlist/watchlist-actions.test.ts`
Expected: PASS

- [ ] **Step 4: `WatchedToggle`, optimistic, 44px, and honest about its label.**

```tsx
<button
  type="button"
  aria-pressed={watched}
  onClick={...}
  className="... min-h-11 min-w-11 ..."
>
  <span className="sr-only">
    {watched ? `Mark ${title} as not watched` : `Mark ${title} as watched`}
  </span>
</button>
```

  - `aria-pressed` rather than two different buttons, so a screen reader hears
    the state rather than inferring it from an icon swap.
  - `useOptimistic` — the badge flips on click, reverts on failure. The source
    set local state and never reverted, so a failed write showed a permanent
    check for a row that does not exist.
  - The label names the film. Twenty identical "Mark as watched" buttons on a
    browse grid are indistinguishable in a screen reader's element list.
  - Hidden entirely when logged out, as the source did — but as a *server*
    decision (`isSignedIn` prop), because Clerk 7 removed `<SignedIn>`.

- [ ] **Step 5: Component test** — click flips `aria-pressed`, a rejected
  action flips it back, and the accessible name contains the title.

- [ ] **Step 6: Commit.**

### Task D4: The film page UI (P10.T5, T6, T9)

**Files:**
- Create: `app/(app)/films/[tmdbId]/page.tsx`
- Create: `components/FilmFacts.tsx`, `components/RatingChip.tsx`,
  `components/CreditsPanel.tsx`, `components/MediaCarousel.tsx`,
  `components/FilmPointsPanel.tsx`
- Create: a test beside each component
- Modify: `docs/PARITY.md` (T5, T6, T9)

**Interfaces:**
- Consumes: `loadFilmPage` (D2), `PointsLedger`, `LetterboxRule`,
  `PosterFrame`, `WatchedToggle` (D3), `ErrorPanel`.

- [ ] **Step 1: The route.** `notFound()` when `loadFilmPage` returns null;
  public, so no `auth()` gate — but `auth()` is still read, to decide whether
  `WatchedToggle` renders.

```tsx
export default async function FilmPage({ params }: PageProps<'/films/[tmdbId]'>) {
  const { tmdbId } = await params;
  if (!/^\d+$/.test(tmdbId)) notFound();   // TMDB ids are integers
  const film = await loadFilmPage(tmdbId);
  if (!film) notFound();
  const { userId } = await auth();
  ...
}
```

  🔴 Validate the id shape before spending a TMDB request on it. `/films/../..`
  and `/films/%00` both reach this handler.

- [ ] **Step 2: `generateMetadata`.** This is the app's most-shared URL — a
  Slack unfurl of a film page should show the film, not "Cinemadraft". Title,
  description from the tagline or overview, `openGraph.images` from the
  backdrop.

- [ ] **Step 3: The banner.** Backdrop, title, year, MPAA rating in a bordered
  box, `WatchedToggle` at top right when logged in. The rating box is a
  `<span>` with the `border-border-rule` token and `tabular` — **not** the
  source's eleven SVG rating glyphs (`src/pages/movie/icons`), which are US
  MPAA trademarks and would need redrawing to no benefit.

  🔴 Text over an arbitrary photograph is the one place the token palette
  cannot guarantee contrast (§6.7 requires 4.5:1). Lay a
  `bg-gradient-to-t from-bg-base` scrim over the backdrop and put the text on
  the dark end, rather than trusting the image.

- [ ] **Step 4: `FilmFacts`** — the labelled left column, `<dl>` not a table.
  Label in `text-text-secondary`, right-aligned at `md` and above as the
  screenshot shows, stacked above the value on a phone (a 30%/70% split at
  375px leaves ten characters for "Production companies").

  🔴 Every row omits itself when its value is absent. The source rendered
  `Stat` with `text=undefined` and got a label with nothing beside it; a
  "Budget" label with an empty column reads as a loading failure.

- [ ] **Step 5: `RatingChip`.** Metacritic's own colour rule, ported exactly
  (`>= 61` green, `>= 40` yellow, else red — `movie.js:117`).

  🔴 **Colour cannot be the only signal** (a11y `color-not-only`, §6.7). The
  chip prints the number inside it and names the source beside it, so it reads
  correctly in greyscale and to a colour-blind viewer. The three colours are
  new tokens — `--color-score-high|mid|low` — not hex literals, because
  `scripts/layering.sh` fails the build on a hex in a component, and that rule
  is right.

  Rotten Tomatoes: the number and the word, no tomato image. The source loaded
  `/images/rt.png` and applied `certified`/`fresh`/`rotten` classes; the
  imagery is Fandango's trademark.

- [ ] **Step 6: `CreditsPanel`** — grouped by department, each person with
  their exact job. Directing and Writing first, then the rest alphabetically,
  Cast as a photo grid.

  Use a native `<details>` per department with the first four visible, as
  `PointsLedger` does — **not** the source's `+ More` button holding a length
  in `useState`. `<details>` gives the disclosure semantics, keyboard operation
  and find-in-page for free, and a film with 62 "Crew" entries is exactly what
  find-in-page is for.

- [ ] **Step 7: `MediaCarousel`** — trailers, then posters with a `1/112`
  counter.

  🔴 **Not `react-slick`.** A CSS scroll-snap strip with `overflow-x-auto` plus
  prev/next buttons is smaller, works before hydration, is keyboard-scrollable
  natively, and honours `prefers-reduced-motion` by using `scroll-behavior:
  smooth` in a media query rather than a JS animation.

  🔴 **Do not mount 32 YouTube iframes.** The source rendered every trailer
  into the DOM at once — 32 third-party frames, each loading its own player.
  Render a poster-and-play-button facade and swap in the iframe on click.
  The counter is `aria-live="polite"` so the position is announced.

- [ ] **Step 8: `FilmPointsPanel`** — total, average draft position, per-event
  totals, and the existing `PointsLedger` behind a `<details>` for the
  award-by-award breakdown (D41, reused rather than reimplemented).

  Renders nothing at all when `scoring` is null. "Total points: 0" on a film
  that was never in a league is a false statement, not an empty state; the
  empty state belongs to films that were nominated and scored nothing.

  Each event row links to `/award-shows/[abbreviation]`, as the source did.

- [ ] **Step 9: `SimilarFilms`** — seven posters via `PosterFrame`, each
  linking to `/films/[tmdbId]`. T9 closes here, out of the same request as the
  rest of the page.

- [ ] **Step 10: Component tests.** For each: the absent case renders nothing,
  the present case renders the value, and the interactive ones are operable
  from the keyboard. `MediaCarousel` gets the jsdom caveat the nav drawer got —
  scroll position is not simulated, so assert the button wiring and leave the
  scrolling to E2E.

- [ ] **Step 11: Commit**, and close `PARITY.md` T5, T6, T9.

### Task D5: Browse (P10.T7)

**Files:**
- Create: `lib/external/tmdb-discover.ts`, `lib/external/tmdb-discover.test.ts`
- Create: `lib/services/browse.ts`, `lib/services/browse.test.ts`
- Create: `app/(app)/browse/page.tsx`, `components/BrowseMonth.tsx`
- Modify: `lib/nav/links.ts` (`browse.ready`), `docs/PARITY.md` (T7)

**Interfaces:**
- Produces: `discoverFilms(input: { when: 'past' | 'future'; page: number }): Promise<DiscoverPage>`
  where `DiscoverPage = { page: number; pageCount: number; films: DiscoveredFilm[] }`
- Produces: `loadBrowse(input: { when: 'past' | 'future'; page: number; userId: number | null }): Promise<BrowsePage>`
  where `BrowsePage = { when, page, pageCount, months: { label: string; films: BrowseFilm[] }[] }`
  and `BrowseFilm = { tmdbId, title, posterUrl, releaseDate, watched: boolean }`

- [ ] **Step 1: Write the failing test for discovery**, pinning the two
  different queries rather than a sort flip:

```ts
it('asks for released, well-reviewed films on the past side', async () => {
  await discoverFilms({ when: 'past', page: 1 });
  const url = new URL(lastFetchedUrl());
  expect(url.searchParams.get('sort_by')).toBe('release_date.desc');
  expect(url.searchParams.get('release_date.lte')).toBe(today());
  expect(url.searchParams.get('vote_count.gte')).toBe('200');
});

it('asks for unreleased films with no vote floor on the future side', async () => {
  // 🔴 An unreleased film has no votes. Keeping vote_count.gte here returns
  // an empty page, which is what "just flip the sort" would have shipped.
  const url = new URL(lastFetchedUrl());
  expect(url.searchParams.get('sort_by')).toBe('release_date.asc');
  expect(url.searchParams.has('vote_count.gte')).toBe(false);
});

it('drops posterless and unpopular results', async () => {
  mockFetchJson({ page: 1, total_pages: 21, results: [
    { id: 1, title: 'A', poster_path: null, popularity: 90, release_date: '2026-08-01' },
    { id: 2, title: 'B', poster_path: '/b.jpg', popularity: 3, release_date: '2026-08-01' },
    { id: 3, title: 'C', poster_path: '/c.jpg', popularity: 90, release_date: '2026-08-01' },
  ]});
  const page = await discoverFilms({ when: 'past', page: 1 });
  expect(page.films.map((f) => f.tmdbId)).toEqual(['3']);
});

it('returns an empty page rather than throwing when TMDB is down', async () => { ... });
```

Run: `npx vitest run lib/external/tmdb-discover.test.ts`
Expected: FAIL

- [ ] **Step 2: Implement it on `tmdbFetch`.** The date in the query is
  `new Date()` truncated to a day, which is also the cache key's suffix — a key
  containing a timestamp would never hit.

  🔴 `popularity > 10` and `poster_path != null` are applied **here**, not in
  the component. The source filtered popularity on the server and posters in
  the browser, so its page counter counted rows the user never saw and "load
  more" sometimes appeared to do nothing.

- [ ] **Step 3: Write the failing test for `loadBrowse`.**

```ts
it('groups films by release month, newest group first on the past side', async () => {
  expect(page.months.map((m) => m.label)).toEqual(['08/2026', '07/2026']);
});

it('orders groups oldest-first on the future side', async () => {
  // Coming next is the top of the page when you are looking forward.
});

it('marks what the viewer has already watched in one query', async () => {
  await countQueries(() => loadBrowse({ when: 'past', page: 1, userId: 3 }));
  expect(queries).toBe(1);   // 🔴 not one per film
});

it('marks nothing for an anonymous viewer and asks the database nothing', async () => {
  expect(await countQueries(() => loadBrowse({ ..., userId: null }))).toBe(0);
});

it('files a film with no release date under its own group rather than dropping it', async () => {
  expect(page.months.at(-1)?.label).toBe('Undated');
});
```

Run: `npx vitest run lib/services/browse.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement `loadBrowse`.** Watched marks are one
  `findByUserAndMovieIds` — but the ids are *TMDB* ids and the table stores
  local ids, so it is two queries at most: `movieRepository` by tmdbId set,
  then watchlist by the local ids found. Both batched, neither per film.
  Skip both entirely when `userId` is null.

  Month labels use `Intl.DateTimeFormat` with an explicit `timeZone: 'UTC'`.
  🔴 Without it a film released on the 1st shows in the previous month for
  anyone west of UTC, and the grouping silently differs by viewer.

- [ ] **Step 5: The page.** `?when=past|future&page=N` in the URL, not
  component state.

  🔴 **No infinite scroll.** The source's `useInView` loop meant a film could
  not be linked, the back button lost your position, and there was no way to
  reach page 12 with a keyboard. A "Load more" link that is a real `<a>` to the
  next page works before hydration, is crawlable, and makes the state
  shareable. Recorded in `PARITY.md` as a deliberate betterment, not a parity
  row.

  The toggle is a two-option control, not a `<Switch>`: "The Future / The Past"
  as a switch does not say which side is which when unlabelled, and the
  source's label read as one string. Two links styled as a segmented control,
  with `aria-current` on the active one.

- [ ] **Step 6: `BrowseMonth`.** The month card sticky at `md` and above (as
  the source had it), the poster grid beside it, `WatchedToggle` in each
  poster's corner, title below the poster wrapping freely.

  Grid: 2 columns at 375px, up to 6 at `lg`. 🔴 Posters get explicit
  `aspect-[2/3]` so the grid does not reflow as images arrive (CLS).

- [ ] **Step 7: Flip `browse.ready`, close T7 in `PARITY.md`, commit.**

### Task D6: E2E and close-out

**Files:** `e2e/films.spec.ts`, `e2e/browse.spec.ts`, `docs/PARITY.md`,
`docs/PROGRESS.md`

- [ ] **Step 1: E2E for the film page.** Against a real film (La La Land,
  313369, which the restored data has nominations for): the banner names it,
  the facts list shows the real runtime, the points panel shows the per-event
  totals, the credits disclosure opens with Enter, and the poster carousel's
  counter advances.

- [ ] **Step 2: E2E for browse.** Toggle to The Future and back — the URL
  changes both times and the month groups reverse. Mark a film watched as a
  logged-in user, reload, and the badge is still set. Then unmark it, so the
  test leaves the database as it found it.

- [ ] **Step 3: 🔴 A film TMDB does not know 404s** rather than 500s. Hit
  `/films/999999999`.

- [ ] **Step 4: Full verification**, CI excludes if any, close `PARITY.md`
  T5, T6, T7, T9, T34, add the two betterments and the two new source bugs
  (hard-coded OMDb key, hard-coded runtime), and update `PROGRESS.md`.

- [ ] **Step 5: Commit and push.**

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

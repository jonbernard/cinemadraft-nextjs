# Phase 17 — Tranche 3: Visual

Covers **P17.T11–P17.T17**: roster media, award-show marks, the film-detail
lockup, the nav rail's column, the winner seal, the `/live/[abbr]` route, and
LCP priority on the first shelf frames.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the product's pictures work. Seven findings from the 2026-09-12
design review, all marked ship: artwork that never reaches the roster, award
marks rendered as grey smudges, a title cut from its year by a hard edge, a rail
that ends two-thirds up its own column, a winner seal that has never once
rendered, a second peak moment that 404s, and a lazy-loaded LCP.

**Architecture:** Five of the seven are contained — one component, its test, its
story. Two are not. **T15** turns the seal from dead code into a rendered
signal, which means the dashboard has to learn which films won, and it learns it
from the ledger that already exists rather than from a second rule. **T16** is
the only new route in Phase 17: `/live/[abbr]` composes `getAwardShow` and
`getLeagueBoard` and adds **no new scoring path** — it filters `LedgerLine`s by
`eventAbbreviation`, which is a pure in-memory narrowing of numbers the board
already computed (D19/D41).

**Tech Stack:** Next 16 App Router, React 19, TypeScript strict, Prisma,
Tailwind 4 + MUI, Vitest + Testing Library, Playwright, Storybook 10.

**Spec:** `docs/PLAN.md` § Phase 17 (T11–T17) and `docs/PROGRESS.md` § Phase 17.
The published design review of 2026-09-12 against `7a1e8d8` is the artifact of
record for the reasoning; the tasks below are the work.

---

## What this tranche does not own

Phase 17 is being executed as five tranches, planned in parallel. Read this
before you touch a shared file.

**1. The boundary.**

| Concern | Owner |
|---|---|
| `proxy.ts` public matcher, `SectionHead` sizes, `AppShell` breakpoints + tab bar, `SeasonStepper`, `LeaderboardTable`, signed-out lede, `/browse` URL, draft console `assign` | **Tranche 1 (T0–T7)** |
| Skip link, `/browse` poster links, sidebar + theme-toggle focus rings, Clerk appearance contrast, `contrast.test.ts`, `/films/[tmdbId]` 390px overflow | **Tranche 2 (T8–T10)** |
| **This file: roster posters, award marks, film lockup, `NavRail`, winner seal, `/live/[abbr]`, LCP priority** | **Tranche 3 (T11–T17)** |
| Body size 15/13, poster captions to serif, `beam`, brass, surface rename, 40px section step, 4px grid, radius | **Tranche 4 (T18–T25)** |
| `not-found` in the shell, `/admin/season`, signed-in home, league page, roster beside standings, `/leagues`, signed-in type, `text-dim`, brass meaning, `/list` gutters, D85+ | **Tranche 5 (T26–T36)** |

**2. The shared files.** Measured 2026-09-12: the T18 size sweep touches **75 of
181** `.tsx` files under `app/` and `components/`; the T22 surface rename touches
**58**. Both will reach almost everything below.

- **`app/(app)/page.tsx`** — edited by tranche 1 (T1/T4/T5), **this tranche
  (T11/T17)** and tranche 5 (T29/T31). Before editing it: `git log --oneline -5 -- "app/(app)/page.tsx"` and re-read the lines you are about to change. T11 and T17 are written against the line numbers in the PLAN (`:171`, `:315`); **match on the surrounding code, not on the line number** — tranche 1's T1 changes the `SectionHead` block above them and will move every number in this file.
- **`components/PosterFrame.tsx`** — this tranche (T15, T17). Tranche 4's T19 puts the caption in serif at 15px and T25 may touch the radius. Do not pre-empt either.
- **`components/NavRail.tsx`** — this tranche (T14). Tranche 2's T8 fixes `focus-visible:outline-accent-fill` on the seven rail links in the *same file*. Rebase, do not resolve: T14 adds one layout class, T8 changes a focus class, and they do not overlap.
- **`components/AppShell.tsx`** — tranche 1 (T2) and tranche 2 (T8). **This tranche does not edit it.** T14 is deliberately written to work without touching it; if it turns out it cannot, stop and say so rather than editing the file two other tranches are rewriting.
- **`app/(app)/films/[tmdbId]/page.tsx`** — this tranche (T13, the banner lockup) and tranche 2 (T10, the 390px overflow and the light-vs-dark `<details>` width). Different regions of the same file. Rebase.
- **`app/globals.css`** — this tranche adds one `@keyframes` + one `--animate-*` for T15. Tranche 4 owns every `--color-*` and every radius in that file (T20, T22, T25). Add your animation, touch nothing else.
- 🔴 **`proxy.ts`** — tranche 1 owns it (T0 adds `/rules-and-scoring` to `isPublic`), and **this tranche has to cross that line once**: the owner has ruled `/live/[abbr]` public, so T16a adds one entry to the same list. This is the sanctioned exception to rule 3 below. T0 lands there first; **match on the surrounding code, not a line number**, add your entry beside the award-show entries, and say in the commit message that you crossed into tranche 1's file and why.

**3. The rule.** Do not opportunistically fix something another tranche owns —
not a stray `text-sm`, not a `bg-raised`, not a 6px gap, even when it is right
under your cursor and obviously wrong. It will be swept deliberately, and T22's
verification is a **screenshot diff that must come back empty**; a partial early
fix makes that unreadable. If a task genuinely cannot be finished without
crossing the line, cross it and say so in the commit message body.

**4. Known entanglements that touch this tranche.**

- 🔴 **`beam` (T20) is not done until it renders somewhere, and T16 is where.**
  Tranche 4 decides `beam` is spent on live and countdowns. **This plan spends
  it** — `LiveCountdown` and the live header are its first consumers. Do not
  change the token's value, its mirror in `theme/tokens.ts`, or its MUI
  `info.main` binding; just consume it. If T16 slips, tell tranche 4 immediately,
  because their task cannot close.
- **Brass (T21) is blocked on T35** — brass already means "drafted" in 320
  places on the draft board. Nothing in this tranche introduces a new brass
  meaning. T16's live surface uses **carmine** for the live state (per the
  Phase 10 surface table: `CinemaFrame`, carmine `StatusChip`, `Shelf`) and
  brass only where it already means an award — a category's won/points chip,
  matching `PointsLedger.tsx:111`.
- 🔴 **The surface rename (T22) is confirmed: `base → ground`, `surface → panel`,
  `raised → surface`.** Write every new file in this tranche against the **old**
  names — `bg-bg-base`, `bg-bg-surface`, `bg-bg-raised` — because that is what
  compiles today. Tranche 4 sweeps them later and its guard grep catches anything
  missed. **Do not pre-empt the rename in your own files**, and do not mix the two
  vocabularies: a half-renamed file is the one thing the sweep's
  no-visual-diff verification cannot read.
- **T8's skip link lands in the shell T2 is rewriting.** Not your problem, but
  it is why T14 stays out of `AppShell` — and why T14's avatar half is handed to
  T2 rather than resolved here.

**5. If tranches run concurrently.** Take your own `git worktree` and your own
port. **Never reuse a dev server you did not start** — today an agent measured
another agent's server on 3000 and nearly recorded a clean baseline for broken
code. Start yours explicitly (`PORT=3103 npm run dev`) and verify the port in the
URL bar of every screenshot you take. The DB-backed vitest project is **serial by
design**: one Postgres on 5433, and `available_years_one_active` is a global
partial unique index with no per-worker copy — two suites racing it fail about
one run in three. Do not run `npm run test` while another tranche is running it.

---

## Global Constraints

Every task's requirements implicitly include these.

- **Biome, not ESLint or Prettier.** `npm run lint` covers linting, formatting
  and import order; `npm run typecheck` is separate.
- **MUI for components, Tailwind for custom styling**, coexisting through CSS
  cascade layers ordered `theme, base, mui, components, utilities`. Never
  `!important`.
- **All local databases run in Docker** — `npm run db:up` before anything that
  touches the database. Port **5433 is a restored copy of production**: league 1
  is sixty real people's history. Anything that writes uses a scratch row and
  cleans up after itself.
- **Never regenerate `package-lock.json` on macOS.** Nothing here adds a
  dependency; if that changes, `npm install <pkg>` then `npm run lock`.
- **`fixtures/` is generated.** Never hand-edit it.
- **Every new surface is built from the Phase 3.5 primitives** — `SectionHead`,
  `Panel`, `Shelf`, `Button`, `StatusChip`, `Eyebrow`, `CinemaFrame`,
  `PosterFrame` — and **carries a Storybook story**. No hairline card border, no
  all-caps heading outside `Eyebrow`, no squared or pill button, no
  machine-formatted date. `LetterboxRule`, `font-display` and the Archivo `wdth`
  axis no longer exist (D69–D77); do not reach for any of them.
- **No raw hex outside the token system.** `scripts/layering.sh` greps
  `components/`, `app/` and `.storybook/`. Tailwind's `white` is a keyword, not
  a hex literal, and is already in use (`StatusChip.tsx:29`).
- **No `next/image` outside `RemoteImage`.** `scripts/layering.sh` enforces it.
- **The repository layer is the only code allowed to touch Prisma**, and
  `components/` may not import from `lib/services/` (D33) — types that cross
  that line are re-declared in the component file.
- **`data-testid` is the only test handle** (D66), stripped from production
  output unless `KEEP_TEST_IDS=1`. Assertions still go through roles and
  accessible names.
- **Touch targets ≥44px**, focus rings never removed, colour never the only
  carrier of state, and **every animation has a `prefers-reduced-motion` path**
  that delivers the same information instantly (the `GroupCeremony` precedent).
- **`scoring.ts` is the single definition of the rule (D19/D41).** A new surface
  that shows a score adds a case to `lib/services/scoring.batching.test.ts` —
  standing instruction since Phase 9 — and the bound is a **constant**.
- **One commit per task**, message starting with the task ID (`P17.T13: ...`).
  T16 is the exception and ships as two commits; see the task.
- **Do not edit `docs/PROGRESS.md`.** The tranches are being indexed centrally.
- **`npm run verify` before pushing** — lint, typecheck, layering, both test
  suites, build.

---

## Browser verification is part of the gate, and it is measured

The Phase 17 gate requires every item verified in a browser at **1440 / 1280 /
1024 / 390px in both schemes**. "Check it looks right" does not satisfy it. Each
task below names the numbers to read. The standing procedure:

```bash
npm run db:up
PORT=3103 npm run dev          # YOUR port. Never someone else's server.
```

Then, for each width, in **both** schemes (the theme toggle is in the desktop
strip at `xl`; below that it is in the More sheet):

```js
// Paste in the console. Prints the box of whatever you name.
const box = (sel) => { const e = document.querySelector(sel); const r = e.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) }; };
// Horizontal overflow, the defect that keeps shipping green:
document.documentElement.scrollWidth <= window.innerWidth;
```

🔴 **Where a fix cannot be pinned by a component test, it goes in e2e, not in
jsdom.** jsdom has no layout: every box measures zero, every computed width is
empty. Three defects shipped with green tests over them because no test set a
narrow width or asserted geometry. T14 and T13 are both of that kind and both
get a real Playwright geometry assertion.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `components/LiveCountdown.tsx` | The ticking clock to a ceremony, in `beam`. Client. |
| `components/LiveCountdown.test.tsx`, `.stories.tsx` | Its pin and its story |
| `components/LiveBoard.tsx` | Each seat's films at one show, with what they have earned there |
| `components/LiveBoard.test.tsx`, `.stories.tsx` | Its pin and its story |
| `lib/services/live.ts` | Composes `getAwardShow` + `getLeagueBoard` into one live view. **No scoring of its own.** |
| `lib/services/live.test.ts` | Its unit pin |
| `app/(app)/live/[abbr]/page.tsx` | The route (replaces the empty `.gitkeep`) |
| `e2e/live.spec.ts` | The route's journey, against a scratch show and a scratch league |

**Modified**

| File | Change |
|---|---|
| `components/ShowLogo.tsx` | 64px floor, a neutral plate that stays light in both schemes |
| `app/(app)/award-shows/page.tsx` | Pluralise the category count |
| `app/(app)/award-shows/[abbr]/page.tsx` | A "Follow live" link when the ceremony is on air |
| `proxy.ts` | `/live/(.*)` joins `isPublic`. 🔴 Tranche 1's file; the one sanctioned crossing. Amends D40 |
| `app/(app)/films/[tmdbId]/page.tsx` | The year joins the title inside the scrim |
| `components/NavRail.tsx` | The rail owns its column |
| `app/(app)/page.tsx` | Real posters on the roster strip and both shelves; priority on the first two `In cinemas now` frames |
| `lib/services/dashboard.ts` | `RosterEntry` carries `posterUrl` and `status`; totals come from the ledger |
| `lib/dashboard/shelves.ts` | `ShelfFilm` carries `posterUrl` and `status` |
| `components/PosterFrame.tsx` | `priority` prop; the winner seal stamps |
| `app/globals.css` | One `@keyframes stamp` and one `--animate-stamp` |
| `lib/services/scoring.batching.test.ts` | A case for the live page; the dashboard's bound re-measured |

---

## Task order, and why

`T12 → T13 → T14 → T11 → T17 → T15 → T16`.

The three self-contained ones first (T12, T13, T14) — each is one component or
one region of one page, and none of them touches `app/(app)/page.tsx`, so they
land while tranche 1 is still moving that file around. Then the
`page.tsx`/`PosterFrame` cluster in dependency order: **T11** puts artwork into
the roster, **T17** makes the first two frames eager, **T15** makes the seal
stamp on top of the data T11 opened the way for. Keeping those three adjacent
means the window in which this tranche is rebasing against tranche 1's edits to
`page.tsx` is one contiguous block rather than three scattered ones. **T16** is
last because it consumes `PosterFrame`'s `status` (T15) and `priority` (T17),
and because it is the biggest task in the phase.

---

## Task T11: Media through to rosters

**Files:**
- Modify: `lib/services/dashboard.ts` (the `RosterEntry` type; `buildRoster`)
- Modify: `lib/dashboard/shelves.ts` (`ShelfFilm`; `toShelf`)
- Modify: `app/(app)/page.tsx` — the `RosterStrip` mapping (PLAN says `:171`) and
  the `FilmShelf` frame (PLAN says `:315`)
- Test: `lib/services/dashboard.test.ts`, `lib/dashboard/shelves.test.ts`

**Interfaces:**
- Consumes: `posterUrl(path, size)` from `lib/utils/poster.ts` — unchanged.
- Produces: `RosterEntry` gains `posterUrl: string | null`. `ShelfFilm` gains
  `posterUrl: string | null`. Both are read by T15, which adds a second field
  alongside them, and by T16's `LiveBoard`.

**Context an implementer needs.**

`app/(app)/page.tsx` passes `posterUrl: null` in two places with the comment
"Posters arrive in Phase 11 with the media migration". 🔴 **That comment is
wrong and has been since Phase 11 shipped.** `movies.poster` exists in the
schema (`prisma/schema.prisma`, `model Movie`), it is in the repository's
`SELECT` and in the `Movie` DTO (`lib/repositories/movies.ts`), and **nine other
services already render it** through `posterUrl()` — the draft console, the
draft list, the watchlist, the profile, the award-show nominee grid. The
dashboard is the only surface still handing `PosterFrame` a null and getting a
two-letter initials box back for a member's own team.

So there is no migration to wait for and no TMDB fallback to build. The fix is
the call every sibling service already makes.

🔴 **`w342`, not `w185`.** `lib/utils/poster.ts` records the buckets: `w185` is
the draft-board cell, `w342` is "the console's search results and roster strip".
`RosterStrip` lays out `minmax(10rem,1fr)` frames — 160px CSS, 320px at 2×, so
`w185` would be visibly soft. The shelves use the same 10rem frame (`w-40`), so
they get `w342` too. `getDashboard`'s `nowPlaying` already uses `w342`, which is
the precedent.

🔴 **The URL is built in the service, never in the component.** `components/`
may not import from `lib/services/` (D33) and the host/size decision belongs to
one place. The page maps a field; it does not call `posterUrl`.

- [ ] **Step 1: Write the failing service tests**

Add to `lib/services/dashboard.test.ts`:

```ts
  it('🔴 sends the roster real artwork, not an initials box', async () => {
    // The dashboard was the last surface handing PosterFrame a null. A member's
    // own drafted team rendered as grey two-letter squares while the draft
    // console two clicks away showed the same films with posters.
    const view = await getDashboard(6);
    const entries = view.leagues.flatMap((league) => league.roster);
    expect(entries.length).toBeGreaterThan(0);

    const withArtwork = entries.filter((entry) => entry.posterUrl != null);
    expect(withArtwork.length).toBeGreaterThan(0);
    for (const entry of withArtwork) {
      // Built from the stored bare path through the one helper, at the roster
      // bucket — not w185, which is the draft-board cell.
      expect(entry.posterUrl).toMatch(/^https:\/\/image\.tmdb\.org\/t\/p\/w342\//);
    }
  });

  it('leaves a film with no stored poster on null rather than a broken URL', async () => {
    const view = await getDashboard(6);
    for (const entry of view.leagues.flatMap((league) => league.roster)) {
      if (entry.movie.poster == null) expect(entry.posterUrl).toBeNull();
    }
  });
```

Add to `lib/dashboard/shelves.test.ts` — this file has no database, so it builds
its own `LeagueView`. Follow the fixture helper already at the top of that file;
if it has none, this is the shape:

```ts
  it('carries each film’s artwork onto the shelf', () => {
    const leagues = [
      {
        id: 1,
        name: 'Test',
        total: 10,
        standings: [],
        position: 1,
        roster: [
          {
            movie: { id: 1, title: 'Sinners', poster: '/abc.jpg' },
            posterUrl: 'https://image.tmdb.org/t/p/w342/abc.jpg',
            round: 1,
            points: 10,
            share: 1,
            pickedAt: 1,
          },
        ],
      },
    ] as unknown as Parameters<typeof topScorers>[0];

    expect(topScorers(leagues).films[0]?.posterUrl).toBe(
      'https://image.tmdb.org/t/p/w342/abc.jpg',
    );
  });
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run lib/services/dashboard.test.ts lib/dashboard/shelves.test.ts
```

Expected: FAIL — `posterUrl` is not a property of `RosterEntry` or `ShelfFilm`
(a TypeScript error, which vitest surfaces as a failed file).

- [ ] **Step 3: Carry the URL on `RosterEntry`**

In `lib/services/dashboard.ts`, add the field to the type:

```ts
export type RosterEntry = {
  movie: Movie;
  /**
   * The film's artwork at the roster bucket, or null when the row has no
   * stored path.
   *
   * 🔴 Built here rather than in the page. `movies.poster` is a bare TMDB path
   * and the host and size are a presentation decision that lives in exactly one
   * place (`lib/utils/poster.ts`); `components/` may not reach a service (D33),
   * so a page that built the URL itself would be the second place.
   *
   * `w342`, not `w185`: RosterStrip's frames are 10rem — 160px CSS, 320px at
   * 2× — and the draft-board bucket is visibly soft at that size.
   */
  posterUrl: string | null;
  // ...unchanged fields
};
```

and in `buildRoster`, inside the `roster` mapping, beside `movie`:

```ts
        movie,
        posterUrl: posterUrl(movie.poster, 'w342'),
```

`posterUrl` is already imported at the top of this file (it builds
`nowPlaying`). No new import.

- [ ] **Step 4: Carry it onto the shelves**

In `lib/dashboard/shelves.ts`, add to `ShelfFilm`:

```ts
  /** The film's artwork, already resolved by the dashboard service. */
  posterUrl: string | null;
```

and in `toShelf`'s mapping:

```ts
    films: films.map((entry) => ({
      id: entry.movie.id,
      title: entry.movie.title ?? 'Untitled',
      posterUrl: entry.posterUrl,
      points: entry.points,
      share: best > 0 ? entry.points / best : 0,
    })),
```

- [ ] **Step 5: Render it**

In `app/(app)/page.tsx` — 🔴 **match on the code, not the line number; tranche 1
is moving this file.** Find the `RosterStrip` mapping and replace the `posterUrl:
null` line and its two-line comment:

```tsx
                      films={league.roster.map((entry) => ({
                        id: entry.movie.id,
                        title: entry.movie.title ?? 'Untitled',
                        posterUrl: entry.posterUrl,
                        round: entry.round,
                        points: entry.points,
                        share: entry.share,
                      }))}
```

Then find `FilmShelf` and do the same to its `PosterFrame`:

```tsx
          <PosterFrame
            title={film.title}
            posterUrl={film.posterUrl}
            points={film.points}
            share={film.share}
            // No draft round: a film held in two leagues has two of them, and
            // printing whichever survived the dedupe would be wrong half the
            // time. The strips above are where round belongs.
          />
```

Both stale "Posters arrive in Phase 11" comments go with the nulls.

- [ ] **Step 6: Run the tests**

```bash
npx vitest run lib/services/dashboard.test.ts lib/dashboard/shelves.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Look at it**

`PORT=3103 npm run dev`, sign in against the restored database, open `/` at
1440px in **both** schemes. Read and record:

- The roster strip shows artwork, not `SI`/`ON` initials boxes.
- Any film still showing initials — note its title; that is a row with no
  `movies.poster`, which is honest, not a bug. Record how many.
- `document.documentElement.scrollWidth <= window.innerWidth` is `true`.
- Repeat at 390px: the strip wraps to two columns of ~160px frames and still
  does not overflow.

- [ ] **Step 8: Commit**

```bash
npm run lint && npm run typecheck && npm run layering
git add lib/services/dashboard.ts lib/services/dashboard.test.ts lib/dashboard/shelves.ts lib/dashboard/shelves.test.ts "app/(app)/page.tsx"
git commit -m "P17.T11: a member's own team gets its artwork"
```

---

## Task T12: Award-show marks

**Files:**
- Modify: `components/ShowLogo.tsx`
- Modify: `app/(app)/award-shows/page.tsx` (the category count)
- Test: `components/ShowLogo.test.tsx`, `e2e/award-shows.spec.ts`
- Story: `components/ShowLogo.stories.tsx`

**Interfaces:**
- Produces: `ShowLogo` keeps `{ imageUrl, size?, className? }`. `size` stays
  `'sm' | 'lg'`; the pixel values change from `{ sm: 40, lg: 72 }` to
  `{ sm: 64, lg: 96 }`. T16's live header consumes `size="lg"`.

**Context an implementer needs.**

Twelve award bodies are the app's primary vocabulary, and `/award-shows` — the
page whose job is to teach them — renders each one as a 40px thumbnail on
`bg-bg-raised`. Two things go wrong at once. 40px is below the size at which a
wordmark-style logo is identifiable, and `bg-bg-raised` **inverts with the
scheme**: it is `#211c29` in dark and `#e7e1d7` in light. The marks are PNG/JPEG
with transparency, mostly dark-on-transparent, so in dark mode they render dark
on near-black — the "grey smudges" the review names.

🔴 **The plate has to be the same colour in both schemes.** That is the whole
fix: a mark drawn for print paper needs paper behind it regardless of what the
reader's theme is doing. `object-contain` is already correct and stays.

**The plate is `bg-white`, not a new token.** `white` is a CSS keyword, not a hex
literal, so it passes `scripts/layering.sh`, and `StatusChip.tsx:29` already uses
`text-white` for exactly this reason — a value that must not follow the scheme.
Adding a `--color-plate` token would mean editing `app/globals.css` **and**
`theme/tokens.ts` (they are asserted to agree by `theme/tokens.test.ts`), which
is the file tranche 4 is sweeping for T20/T22/T25. One class beats a token
negotiation.

🔴 **Known risk, and it is a real one.** A white plate rescues every
dark-on-transparent mark and would *kill* a light-on-transparent one. The review
measured the twelve and chose the light plate, so follow it — but Step 6 below
is where you confirm it, mark by mark. If one of the twelve turns out to be light
on transparent, **record it and raise it**; do not invent a per-show rule.

Separately: `app/(app)/award-shows/page.tsx` prints `{show.categoryCount}
categories` unconditionally, so a show with one category reads "1 categories".
The detail page one directory down already does this correctly
(`[abbr]/page.tsx:120-122`) — copy that, do not invent a second form.

- [ ] **Step 1: Write the failing component tests**

Add to `components/ShowLogo.test.tsx`:

```tsx
  it('🔴 renders the mark at 64px or larger', () => {
    // Twelve award bodies are the app's primary vocabulary. At 40px a wordmark
    // logo is not identifiable, which makes the page that teaches them useless.
    render(<ShowLogo imageUrl="https://x.public.blob.vercel-storage.com/a.jpg" />);
    const mark = screen.getByTestId('image');
    expect(Number(mark.getAttribute('width'))).toBeGreaterThanOrEqual(64);
    expect(Number(mark.getAttribute('height'))).toBeGreaterThanOrEqual(64);
  });

  it('🔴 puts the mark on a plate that does not follow the scheme', () => {
    // The marks are dark-on-transparent. bg-raised is #211c29 in dark and
    // #e7e1d7 in light, so half the schemes render them dark on near-black.
    // A plate that inverts with the theme is the defect, whatever its value.
    render(<ShowLogo imageUrl="https://x.public.blob.vercel-storage.com/a.jpg" />);
    const classes = screen.getByTestId('image').className;
    expect(classes).toContain('bg-white');
    expect(classes).not.toMatch(/\b(dark|light):bg-/);
    // The mark is letterboxed onto the plate, never cropped to it.
    expect(classes).toContain('object-contain');
  });
```

🔴 The existing mock in that file (`vi.mock('next/image', …)`) drops every prop
except `src` and `alt`. Widen it so `width`, `height` and `className` reach the
element, or the two assertions above can never pass:

```tsx
vi.mock('next/image', () => ({
  default: ({ src, alt, width, height, className }: Record<string, unknown>) => (
    // biome-ignore lint/performance/noImgElement: this is the stand-in for next/image inside the test
    <img
      src={src as string}
      alt={alt as string}
      width={width as number}
      height={height as number}
      className={className as string}
      data-testid="image"
    />
  ),
}));
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run components/ShowLogo.test.tsx
```

Expected: FAIL — width is 40, and the className contains `bg-bg-raised`.

- [ ] **Step 3: Fix `ShowLogo`**

```tsx
/**
 * How big a mark has to be to be a mark.
 *
 * 🔴 64px is a floor, not a taste call (2026-09-12 design review). Twelve award
 * bodies are this product's primary vocabulary and most of their logos are
 * wordmarks; at the previous 40px they were unreadable, so the page whose job is
 * to teach the twelve taught nothing. `lg` moves with it so the two sizes stay
 * distinguishable — 64 beside 72 is a prop with no visible effect.
 */
const DIMENSIONS = { sm: 64, lg: 96 } as const;
```

and the element:

```tsx
  return (
    <RemoteImage
      src={imageUrl}
      alt=""
      width={px}
      height={px}
      className={cn(
        // 🔴 `bg-white` in both schemes, deliberately, and it is the only
        // surface in the product that does not follow the theme. The marks are
        // third-party artwork drawn dark-on-transparent for print; `bg-raised`
        // is #211c29 in dark, which rendered nine of the twelve as dark shapes
        // on a near-black square. A plate is paper, and paper does not have a
        // dark mode. `white` is a keyword, not a hex literal, so it passes the
        // layering grep — the same reason StatusChip's carmine tone uses it.
        //
        // `object-contain` plus padding: the mark is letterboxed onto the plate
        // with a margin, never cropped to it and never bled to the edge.
        'bg-white shrink-0 rounded-sm object-contain p-1.5',
        className,
      )}
      style={{ width: px, height: px }}
    />
  );
```

🔴 `rounded-sm` is `--radius-sm`, 6px — D73's documented default, which tranche
4's T25 is upholding. Do not reach for `rounded-md`.

- [ ] **Step 4: Run them and watch them pass**

```bash
npx vitest run components/ShowLogo.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Pluralise the count**

In `app/(app)/award-shows/page.tsx`, the grid card's last line:

```tsx
                <span className="text-text-secondary tabular font-mono text-xs">
                  {show.categoryCount}{' '}
                  {show.categoryCount === 1 ? 'category' : 'categories'}
                </span>
```

Add the assertion to `e2e/award-shows.spec.ts` — that spec's `seedShow()` builds
a show with **exactly one category**, so it is already the fixture this needs.
Put it in the public test near the top of the describe:

```ts
  test('says "1 category", not "1 categories"', async ({ page }) => {
    // seedShow() builds exactly one category, which is why this is the spec
    // that can assert it. The detail page already gets this right; the index
    // printed the plural unconditionally.
    await seedShow();

    await page.goto('/award-shows');

    await expect(page.getByText('1 category', { exact: true })).toBeVisible();
  });
```

- [ ] **Step 6: Look at all twelve, in both schemes**

```bash
PORT=3103 npm run dev
```

Open `/award-shows` at 1440px, **dark then light**. For each of the twelve
cards, record: mark legible / mark not legible. Then `/award-shows/oscars` for
the `lg` size in the header.

🔴 Specifically look for the failure mode this fix introduces: a mark that is
**light on transparent** now vanishes into the white plate. If any of the twelve
does, stop, record which, and raise it — do not add a per-show branch.

Then 390px, both schemes: the grid is `minmax(14rem,1fr)`, so it drops to one
column; confirm a 64px mark above a two-line show name does not push
`scrollWidth` past `innerWidth`.

- [ ] **Step 7: Story**

`components/ShowLogo.stories.tsx` already exists. Add a story that shows the
plate doing its job:

```tsx
export const OnAPlate: StoryObj<typeof meta> = {
  name: 'Dark mark on the neutral plate',
  args: { size: 'lg' },
  parameters: {
    docs: {
      description: {
        story:
          'The plate stays white in both schemes. These marks are third-party ' +
          'artwork drawn dark-on-transparent; a plate that followed the theme ' +
          'rendered them dark on near-black in dark mode.',
      },
    },
  },
};
```

- [ ] **Step 8: Commit**

```bash
npm run lint && npm run typecheck && npm run layering
npx vitest run components/ShowLogo.test.tsx
git add components/ShowLogo.tsx components/ShowLogo.test.tsx components/ShowLogo.stories.tsx "app/(app)/award-shows/page.tsx" e2e/award-shows.spec.ts
git commit -m "P17.T12: the twelve award bodies get marks you can read"
```

---

## Task T13: The film-detail lockup

**Files:**
- Modify: `app/(app)/films/[tmdbId]/page.tsx` — `FilmBanner` only
- Test: `e2e/films.spec.ts`

**Interfaces:** none change. `FilmBanner` is a local function in that file.

**Context an implementer needs.**

Today the banner renders the title inside the scrim and the year on the line
*below* it, in 14px mono `text-text-secondary`, in a row shared with the MPAA
box. The `-mt-16` pull means the title sits over the gradient and the year sits
under the frame's bottom edge — so the film's name and the film's year are
separated by the hard edge of the image. A film is identified by both; the
lockup is `Title 2016`, not `Title` and then, elsewhere, `2016`.

🔴 **Put the year inside the `<h1>`, as an inline `<span>`.** That is the whole
change, and it buys three things at once:

1. **Baseline alignment comes free.** Two inline boxes in one line box share a
   baseline by definition. A flex row with `items-baseline` would also work and
   is more code for the same result.
2. **The accessible name becomes "Title 2016"**, which is what
   `generateMetadata` already produces (`${film.title}${year}` → `Sinners
   (2025)`), so the page announces itself the way its own share card does.
3. **It is in the scrim**, because the `<h1>` is.

**Smaller optical size, same face, `text.secondary`.** Instrument Serif at
`text-3xl`/`md:text-5xl` for the title; the year one-and-a-bit steps down at
`text-xl`/`md:text-3xl`. Not `font-mono` — D70 assigns the serif to names and
this is part of a name. Not `tabular` either: a year never changes on screen, so
there is no column to keep from jittering.

🔴 **This file is also edited by tranche 2's T10** (the 390px light overflow and
the `<details>` width delta). Different region. Rebase; do not resolve.

- [ ] **Step 1: Write the failing e2e assertion**

This cannot be a component test. `FilmBanner` is a local function inside an async
Server Component that calls TMDB, and the thing under test is a line box, which
jsdom does not have. Add to `e2e/films.spec.ts`:

```ts
  test('🔴 the year is part of the title, inside the scrim', async ({ page }) => {
    // A film is identified by name AND year. The year used to sit below the
    // banner in 12px dim mono, cut from the name by the image's hard edge.
    await page.goto('/films/313369'); // La La Land

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toContainText('La La Land');
    await expect(heading).toContainText('2016');

    // Geometry, because that is the actual defect. The year's box must share a
    // line with the title's, not sit on the row beneath it: same top within a
    // few px, and a bottom inside the heading's own bottom.
    const title = await heading.boundingBox();
    const year = await heading.getByText('2016', { exact: true }).boundingBox();
    expect(title).not.toBeNull();
    expect(year).not.toBeNull();
    // Optically smaller type sits lower in the line box, never below it.
    expect(year!.y).toBeGreaterThanOrEqual(title!.y - 2);
    expect(year!.y + year!.height).toBeLessThanOrEqual(title!.y + title!.height + 2);
  });
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm run test:e2e -- films.spec.ts
```

Expected: FAIL — the `h1` does not contain "2016"; it is in a sibling `div`.

🔴 If the run says "Timed out waiting from config.webServer", something is
already on port 3000 from another tranche. Kill it or wait; do not
`reuseExistingServer` somebody else's build.

- [ ] **Step 3: Move the year into the heading**

In `FilmBanner`, replace the heading and the row beneath it:

```tsx
        <div className="flex flex-col gap-2">
          {/* 🔴 The year is part of the name, so it is inside the h1 rather
              than on the row below it. Two inline boxes in one line box share a
              baseline for free — no flex, no `items-baseline`. It also makes
              the accessible name "La La Land 2016", which is exactly what
              `generateMetadata` already puts on the share card, and it keeps the
              year inside the scrim instead of below the image's hard edge.

              The serif at a smaller optical size rather than mono: D70 renders
              names in Instrument Serif and this is half of one. No `tabular` —
              a year is static, so there is no column to stop jittering. */}
          <h1 className="font-serif text-text-primary text-3xl font-bold tracking-[-0.02em] md:text-5xl">
            {film.title}
            {film.year ? (
              <span className="text-text-secondary ml-3 text-xl font-normal md:text-3xl">
                {film.year}
              </span>
            ) : null}
          </h1>
          {film.facts?.mpaaRating ? (
            <div className="flex flex-wrap items-center gap-3">
              {/* The MPAA rating in a bordered box, as the screenshot shows —
                  but as type in a rule, not one of the source's eleven
                  trademarked rating glyphs, which would have to be redrawn to
                  no benefit. */}
              <span className="border-border-rule text-text-secondary border px-2 py-0.5 font-sans text-xs">
                {film.facts.mpaaRating}
              </span>
            </div>
          ) : null}
        </div>
```

🔴 The `<span>` inherits `font-serif` from the `h1`, which is the point — do not
restate it. It does need `font-normal` to shed the `h1`'s `font-bold`.

🔴 The row wrapper now renders **only** when there is an MPAA rating. Previously
it rendered an empty flex row for every film with no year and no rating, which
contributed a stray `gap-2`. That is a correctness improvement, not a spacing
decision — tranche 4 owns spacing, and this changes no gap value.

- [ ] **Step 4: Run it and watch it pass**

```bash
npm run test:e2e -- films.spec.ts
npx vitest run
```

Expected: PASS. The full unit run is there because this file has other
consumers' snapshots of its metadata.

- [ ] **Step 5: Measure it in a browser**

`/films/313369` at **1440, 1280, 1024 and 390px**, both schemes. Record:

- The year's box top is within 2px of the title's box top at every width (the
  console snippet at the top of this plan).
- At 390px the title wraps to two lines and the year stays attached to the last
  word, not orphaned onto a third line of its own.
- The title and year are both inside the gradient, i.e. their boxes' bottoms are
  above the `CinemaFrame`'s bottom + 64px (`-mt-16`).
- `scrollWidth <= innerWidth` in **light** at 390px. 🔴 It will probably still be
  `false` — that is tranche 2's T10, a pre-existing 430/390 overflow. Record the
  number so T10 can confirm this task did not move it.

- [ ] **Step 6: Commit**

```bash
npm run lint && npm run typecheck
git add "app/(app)/films/[tmdbId]/page.tsx" e2e/films.spec.ts
git commit -m "P17.T13: a film's title and year are one lockup"
```

---

## Task T14: `NavRail` owns its column

**Files:**
- Modify: `components/NavRail.tsx` — one class
- Test: `components/NavRail.test.tsx`, `e2e/nav.spec.ts`

**Interfaces:** none change.

**Context an implementer needs.**

At `xl` and up, `AppShell` renders `<div className="hidden xl:block"><NavRail
/></div>` as the first child of an `xl:flex` row. The wrapper `div` stretches to
the row's height (flex `align-items: stretch` is the default), but the `<nav>`
inside it is `height: auto` — so the card ends after the seventh link and leaves
roughly 530px of visible ground below it at 1440×900. D67 specifies a floating
panel; a panel that stops two-thirds of the way up its own column reads as a
list that ran out, not as a surface.

**The fix is `h-full` on the `<nav>`.** One class.

🔴 **The other option in the PLAN — "pull the avatar into the card" — is
deliberately not taken here, and the reason must be recorded rather than
silently dropped.** The review describes "the avatar detached at the bottom".
Read the code: today the account control is in `AppShell`'s desktop `Strip`, at
the **top right of the content column**, not at the bottom of the rail
(`AppShell.tsx`, `AccountControl`). Moving it into the rail would mean editing
`AppShell.tsx` — which **tranche 1's T2 is rewriting** (it folds identity, search
and sign-in into the tab bar row) and **tranche 2's T8 is also editing** (the
skip link). Two tranches are already in that file and a third would guarantee a
conflict over a question neither has settled.

🔴 **The owner has ruled: trust the code.** The review's description of the
avatar does not match the source, and this task is **the one class** — `h-full`
on the `<nav>` — which closes the ~530px dead column and is the whole of T14.

**The avatar question is formally handed to tranche 1's T2**, which owns
`AppShell.tsx` and is already deciding where identity, search and sign-in live.
Record the hand-off in the commit message (Step 7 does), so whoever executes T2
finds it in `git log` rather than rediscovering it.

- [ ] **Step 1: Write the failing tests**

Add to `components/NavRail.test.tsx`:

```tsx
  it('🔴 runs the full height of its column', () => {
    // D67 specifies a floating panel. `height: auto` made the card stop after
    // the seventh link with ~530px of ground below it at 1440x900, which reads
    // as a list that ran out rather than as a surface.
    const { container } = render(<NavRail pathname="/" />);
    expect(container.querySelector('nav')?.className).toContain('h-full');
  });
```

And the real one, in `e2e/nav.spec.ts` — jsdom has no layout, so the class
assertion above is a pin, not a proof:

```ts
  test('🔴 the rail reaches the bottom of the window at desktop width', async ({
    page,
  }) => {
    // Geometry, not a class name. Three defects in this codebase shipped with
    // green tests over them because nothing measured a box.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const rail = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
    const main = await page.getByRole('main').boundingBox();
    expect(rail).not.toBeNull();
    expect(main).not.toBeNull();

    // The rail and the content panel are siblings in the shell's flex row and
    // must end together. 4px of slack for sub-pixel layout.
    expect(Math.abs((rail!.y + rail!.height) - (main!.y + main!.height))).toBeLessThan(4);
    // And it is genuinely tall, not merely aligned because both are short.
    expect(rail!.height).toBeGreaterThan(600);
  });
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run components/NavRail.test.tsx
npm run test:e2e -- nav.spec.ts
```

Expected: FAIL — no `h-full`, and the rail's bottom is ~500px above the panel's.

- [ ] **Step 3: One class**

In `components/NavRail.tsx`:

```tsx
    <nav
      aria-label="Main"
      // 🔴 `h-full`, not a height value. The rail is the first child of
      // AppShell's `xl:flex` row and its wrapper already stretches; the <nav>
      // itself was `height: auto`, so the card stopped after the seventh link
      // and left ~530px of ground below it at 1440x900. D67 asks for a floating
      // panel and a panel occupies its column. Nothing is added to fill the
      // space — empty surface is the point, and inventing rail content to
      // justify the height would be the wrong fix.
      className="bg-bg-surface rounded-md flex h-full w-[208px] flex-col gap-6 p-3"
    >
```

- [ ] **Step 4: Run them and watch them pass**

```bash
npx vitest run components/NavRail.test.tsx
npm run test:e2e -- nav.spec.ts
```

- [ ] **Step 5: Measure it**

At **1440, 1280** (the rail's `xl` gate is 1280, so it exists at both) in both
schemes:

- The rail's bottom edge and the content panel's bottom edge are within 4px.
- `rail.height > 600` at 1440×900.
- Scroll the page to its bottom with a long page (`/browse`): the rail's surface
  still ends level with the panel, and there is no scrollbar inside the rail.
- At **1024 and 390px** the rail is not rendered at all (`hidden xl:block`) —
  confirm nothing about the tab bar moved.

- [ ] **Step 6: Story**

`components/NavRail.stories.tsx` exists. Its default story renders the rail with
no surrounding column, so `h-full` collapses to the content height there. Add a
decorator so the story shows the real thing:

```tsx
export const InItsColumn: StoryObj<typeof meta> = {
  name: 'Full height, as the shell renders it',
  decorators: [
    (Story) => (
      <div className="bg-bg-base flex h-[720px] gap-2.5 p-2.5">
        <Story />
        <div className="bg-bg-surface rounded-md flex-1" />
      </div>
    ),
  ],
};
```

- [ ] **Step 7: Commit**

```bash
npm run lint && npm run typecheck
git commit -am "P17.T14: the rail owns its column

One class. The <nav> was height:auto inside a stretched wrapper, so the card
stopped after the seventh link with ~530px of ground below it at 1440x900.

🔴 HAND-OFF TO P17.T2. The review describes 'the avatar detached at the
bottom'; the code does not agree — the account control is in AppShell's
top-right desktop strip, not at the rail's foot. The owner ruled: trust the
code. Where the avatar belongs is T2's call, because T2 owns AppShell.tsx and
is already deciding where identity, search and sign-in live. Nothing here
blocks either answer."
```

---

## Task T15: The winner seal stamps

🔴 **This does not close P14.T4.** P14.T4 is "make the seal fire from a live
event". After this task it fires from a render — an admin marks a winner, the
next render of any page showing that film stamps it. What P14.T4 still owes is
the *transport*: making a seal appear on a page nobody reloaded. Leave P14.T4's
checkbox alone and say so in the commit.

**Files:**
- Modify: `app/globals.css` (one keyframe, one `--animate-*`)
- Modify: `components/PosterFrame.tsx`
- Modify: `lib/services/dashboard.ts` (`RosterEntry.status`; `buildLeague` totals)
- Modify: `lib/dashboard/shelves.ts` (`ShelfFilm.status`)
- Modify: `app/(app)/page.tsx` (pass `status` through, both places)
- Modify: `lib/services/scoring.batching.test.ts` (the dashboard's bound)
- Test: `components/PosterFrame.test.tsx`, `lib/services/dashboard.test.ts`
- Story: `components/PosterFrame.stories.tsx`

**Interfaces:**
- Consumes: `RosterEntry.posterUrl` and `ShelfFilm.posterUrl` from T11.
- Produces: `RosterEntry` gains `status: 'none' | 'nominated' | 'won'`.
  `ShelfFilm` gains the same. `PosterFrame`'s existing `status?: PosterStatus`
  prop is unchanged in shape. T16's `LiveBoard` re-declares the same union.

**Context an implementer needs.**

🔴 **The seal has never rendered.** `PosterFrame` has carried `status='won'` and
a carmine corner triangle since Phase 3.5, `RosterStrip` has passed it through,
and **nothing in the application has ever set it** — grep: the only `status:
'won'` in the repository is in `PosterFrame.stories.tsx`. So "animate the seal"
is half the task. The other half is making the seal reachable, and it is the
root-cause half: an animation on a branch no data ever takes is still zero
renders.

**Where the win comes from.** `lib/services/scoring.ts` already knows. Today
`getDashboard`'s `buildLeague` calls `pointsForMovieIds(allMovieIds, year)`,
which returns totals and throws the detail away. `ledgerForMovies(allMovieIds,
year)` runs the **same** `loadScoringInputs` and returns `MovieLedger` — whose
`lines` each carry `won: boolean`, and whose `total` is by construction the sum
of those lines (D41, and the docstring in `scoring.ts` says why that matters).

So:

```
status = lines.some(l => l.won) ? 'won' : lines.length > 0 ? 'nominated' : 'none'
totals = new Map([...ledgers].map(([id, l]) => [id, l.total]))
```

🔴 **No second scoring path.** `ledger.total` and `pointsForMovieIds`'s total are
the same arithmetic over the same inputs — `earned = won ? points*2 : points`,
summed, versus `value + (won ? value : 0)`, summed. One call replaces the other;
the rule is still defined once.

**The cost is one query.** `ledgerForMovies` additionally calls
`eventRepository.findManyByIds` to name the shows. It is a batched call and it
does not grow with seats, which is the property `scoring.batching.test.ts`
guards. Its dashboard case has a ceiling of 15; you will re-measure and adjust.

**The animation.** 🔴 **Pure CSS, no client component.** `PosterFrame` is a
Server Component rendered into HTML, so it cannot call `matchMedia` the way
`GroupCeremony` does — and it should not become a client component for one
animation. Tailwind's `motion-reduce:` variant compiles to `@media
(prefers-reduced-motion: reduce)` and is exactly the right tool: with motion
reduced, `animation: none` means the seal is simply **present, immediately, in
its final state**. That is the `GroupCeremony` contract — same information,
delivered at once — expressed in two classes instead of a state machine.

**"Reads as permanent afterwards"** means the animation runs once and stops. No
loop, no pulse, no lingering glow. The final frame is the seal that already
exists today, unchanged. A reload re-stamps, and that is correct: the seal is not
a notification, it is a mark, and re-stamping on a reload during a ceremony is
the moment working rather than a bug. The `both` fill mode is load-bearing so
the seal is not visible at full size for one frame before the animation starts.

- [ ] **Step 1: Write the failing service test**

Add to `lib/services/dashboard.test.ts`:

```ts
  it('🔴 tells the roster which films were nominated and which won', async () => {
    // The winner seal has existed in PosterFrame since Phase 3.5 and has never
    // rendered: nothing in the app ever set `status`. The ledger already knows
    // — `MovieLedger.lines` carry `won` — so this is a read, not a new rule.
    const view = await getDashboard(6);
    const entries = view.leagues.flatMap((league) => league.roster);
    expect(entries.length).toBeGreaterThan(0);

    for (const entry of entries) {
      expect(['none', 'nominated', 'won']).toContain(entry.status);
      // A film that scored nothing cannot have been nominated; a film that
      // scored something must have been. The two can never disagree, because
      // both come out of the same ledger.
      if (entry.points === 0) expect(entry.status).toBe('none');
      else expect(entry.status).not.toBe('none');
    }
  });

  it('🔴 keeps the seat totals it had before the ledger swap', async () => {
    // ledgerForMovies and pointsForMovieIds are the same arithmetic over the
    // same inputs (D41). If this ever disagrees, one of them has grown a second
    // definition of the rule and that is the bug to fix, not this number.
    const view = await getDashboard(6);
    for (const league of view.leagues) {
      const fromRoster = league.roster.reduce((sum, entry) => sum + entry.points, 0);
      expect(league.total).toBe(fromRoster);
    }
  });
```

- [ ] **Step 2: Write the failing component test**

Add to `components/PosterFrame.test.tsx`:

```tsx
  it('🔴 stamps the seal rather than having it simply be there', () => {
    render(<PosterFrame {...base} status="won" />);
    expect(screen.getByLabelText('Winner')).toHaveClass('animate-stamp');
  });

  it('🔴 delivers the seal instantly when motion is reduced', () => {
    // The GroupCeremony contract: same information, no animation. The seal is
    // present in its final state, not delayed and not omitted.
    render(<PosterFrame {...base} status="won" />);
    const seal = screen.getByLabelText('Winner');
    expect(seal).toBeInTheDocument();
    expect(seal.className).toContain('motion-reduce:animate-none');
  });
```

- [ ] **Step 3: Run both and watch them fail**

```bash
npx vitest run lib/services/dashboard.test.ts components/PosterFrame.test.tsx
```

Expected: FAIL — `status` is not on `RosterEntry`; the seal has no animation
class.

- [ ] **Step 4: The keyframe**

In `app/globals.css`, inside the `@theme` block, after `--animate-deal-in`:

```css
  /* The winner seal (P17.T15, pulled forward from P14.T4). A stamp, not a fade:
   * it arrives oversized and rotated and settles, which is what a seal pressed
   * into a page does. `both` holds the from-state so the seal is never visible
   * at full size for one frame before the animation begins, and the overshoot in
   * the easing is what makes it land rather than glide.
   *
   * Runs exactly once and stops on the existing static seal — a win is a mark,
   * not a notification, and anything that loops reads as "pending". */
  --animate-stamp: stamp 260ms cubic-bezier(0.2, 0.9, 0.3, 1.4) both;
```

and below the existing `@keyframes deal-in` block:

```css
@keyframes stamp {
  from {
    opacity: 0;
    transform: scale(2.2) rotate(-14deg);
  }
}
```

🔴 `transform-origin` is the element's centre by default, and the seal is a
clip-path triangle pinned to the frame's top-right corner — so it scales toward
and away from the corner it lives in. That is the right behaviour; do not set an
origin.

🔴 Do not touch any `--color-*` or `--radius-*` in this file. Tranche 4 owns
them.

- [ ] **Step 5: Animate the seal**

In `components/PosterFrame.tsx`:

```tsx
        {status === 'won' && (
          // 🔴 CSS, not a client component. PosterFrame is a Server Component
          // and cannot read matchMedia; `motion-reduce:` compiles to the media
          // query, so a reader who asked for less motion gets the seal present
          // in its final state immediately — the GroupCeremony contract in two
          // classes rather than a state machine.
          //
          // One run, then the static mark this has always rendered. A seal is
          // permanent; anything that loops would read as "pending".
          <span
            aria-label="Winner"
            role="img"
            className="bg-accent-fill animate-stamp motion-reduce:animate-none absolute right-0 top-0 h-6 w-6 [clip-path:polygon(100%_0,100%_100%,0_0)]"
          />
        )}
```

- [ ] **Step 6: Add `priority` too — no. Add the status to the services**

In `lib/services/dashboard.ts`, add to `RosterEntry`:

```ts
  /**
   * Whether this film has been nominated this season, and whether it won.
   *
   * 🔴 Read out of the ledger, never computed here. `MovieLedger.lines` each
   * carry `won`, and the ledger is the same load as the totals (D41) — so this
   * costs nothing and, more importantly, cannot disagree with the number beside
   * it. The string union matches `PosterFrame`'s `PosterStatus`, re-declared
   * there rather than imported because `components/` may not reach a service
   * (D33).
   */
  status: 'none' | 'nominated' | 'won';
```

Change the import at the top:

```ts
import { ledgerForMovies, sumTotals } from './scoring';
```

In `buildLeague`, replace the scoring call and derive both:

```ts
  // 🔴 The ledger rather than the totals, because the roster needs to know
  // which films won and the ledger already does. Same rule, same load, same
  // inputs — `ledgerForMovies` and `pointsForMovieIds` both go through
  // `loadScoringInputs`, and `MovieLedger.total` is by construction the sum of
  // its lines (D41). One extra batched query names the shows; it does not grow
  // with seats, which is the property scoring.batching.test.ts guards.
  const [ledgers, users] = await Promise.all([
    ledgerForMovies(allMovieIds, year),
    userRepository.findManyByIds([
      ...new Set(drafts.flatMap((draft) => (draft.userId == null ? [] : [draft.userId]))),
    ]),
  ]);
  const totals = new Map([...ledgers].map(([id, ledger]) => [id, ledger.total]));
```

`sumTotals(totals, movieIds)` below is unchanged — it takes a
`ReadonlyMap<number, number>` and that is what `totals` still is.

In `buildRoster`, the signature already takes `totals`; add the ledgers beside
it. Change the call site in `buildLeague`:

```ts
    ...(await buildRoster(drafts, picksByDraft, totals, ledgers, viewerId)),
```

and the function:

```ts
async function buildRoster(
  drafts: { id: number; userId: number | null }[],
  picks: {
    draftId: number;
    movieId: number | null;
    order: number | null;
    createdAt: Date | null;
  }[],
  totals: ReadonlyMap<number, number>,
  ledgers: ReadonlyMap<number, { lines: readonly { won: boolean }[] }>,
  viewerId: number,
): Promise<{ roster: RosterEntry[]; total: number }> {
```

with, inside the `roster` mapping, beside `posterUrl`:

```ts
        posterUrl: posterUrl(movie.poster, 'w342'),
        status: statusOf(ledgers.get(movie.id)),
```

and one small helper at the bottom of the file:

```ts
/**
 * What a film's poster should be marked with.
 *
 * 🔴 Three states from one source. A film with no ledger entry was not
 * nominated this season; one with lines was; one with a winning line won. Any
 * other derivation — a second query, a separate winners lookup — could
 * disagree with the points printed under the same poster.
 */
function statusOf(
  ledger: { lines: readonly { won: boolean }[] } | undefined,
): RosterEntry['status'] {
  if (!ledger || ledger.lines.length === 0) return 'none';
  return ledger.lines.some((line) => line.won) ? 'won' : 'nominated';
}
```

In `lib/dashboard/shelves.ts`, add to `ShelfFilm`:

```ts
  /** Nominated, won, or neither — already resolved by the dashboard service. */
  status: 'none' | 'nominated' | 'won';
```

and in `toShelf`'s mapping, beside `posterUrl`:

```ts
      status: entry.status,
```

- [ ] **Step 7: Pass it through the page**

In `app/(app)/page.tsx`, the `RosterStrip` mapping gains one line — `RosterFilm`
already has an optional `status`:

```tsx
                        share: entry.share,
                        status: entry.status,
```

and `FilmShelf`'s `PosterFrame`:

```tsx
            share={film.share}
            status={film.status}
```

- [ ] **Step 8: Re-measure the dashboard's query bound**

```bash
npx vitest run lib/services/scoring.batching.test.ts
```

The dashboard case (`expect(queries).toBeLessThanOrEqual(15)`) may now fail by
one or two. 🔴 **Read the actual number, do not guess a bigger ceiling.** Add a
temporary `console.log(queries)`, run, note it, remove the log, then set the
bound to that number **+1** and record why:

```ts
  it('the signed-in dashboard costs a fixed number of queries', async () => {
    const { queries } = await countQueries(() => getDashboard(6));

    // P17.T15 swapped pointsForMovieIds for ledgerForMovies so the roster can
    // mark winners. The ledger additionally names the shows, which is one more
    // batched call; measured <N> on the restored data, bound at <N>+1. A loose
    // ceiling is how a guard keeps passing while the thing it guards gets worse.
    expect(queries).toBeLessThanOrEqual(/* the number you measured, +1 */);
    expect(queries).toBeGreaterThan(0);
  });
```

Also add the property, which is the assertion that actually matters:

```ts
  it('🔴 the dashboard costs no more for a member with two leagues than one', async () => {
    // The count may grow with the number of LEAGUES a member is in — each is a
    // separate board — but never with the number of seats or picks inside one.
    // User 6 plays league 1's 2026 season: 16 seats, 144 picks.
    const big = await countQueries(() => getDashboard(6));
    const again = await countQueries(() => getDashboard(6));

    expect(big.queries).toBe(again.queries);
  });
```

- [ ] **Step 9: Run everything and watch it pass**

```bash
npx vitest run lib/services/dashboard.test.ts lib/services/scoring.batching.test.ts components/PosterFrame.test.tsx lib/dashboard/shelves.test.ts
npm run typecheck
```

- [ ] **Step 10: Watch it stamp, twice**

```bash
PORT=3103 npm run dev
```

1. Open `/` signed in, 1440px, both schemes. Find a roster film that won
   something this season. The seal stamps once on load, from oversized-and-rotated
   to its resting corner, and then sits still.
2. Turn on reduced motion (macOS: System Settings → Accessibility → Display →
   Reduce motion) and reload. **The seal is there immediately, at full size, with
   no movement.** It is not missing and it is not delayed.
3. Now the real test: as an admin, open `/award-shows/<a show with a nominee on
   your roster>`, mark a winner, then reload `/`. The seal stamps. That is "a win
   marked by an admin stamps on the next render", which is the whole task.
   🔴 Use a **scratch show** for this, seeded the way `e2e/award-shows.spec.ts`
   does — marking a winner on the real Oscars changes what sixty real people are
   playing for. Delete the scratch rows afterwards.
4. Check `PosterFrame`'s `nominated` state too: the top hairline is carmine and
   2px, and it did not fight the light-mode border (there is a long comment in
   `PosterFrame.tsx` about exactly that cascade problem — confirm it still
   holds in **light** mode at 1440px).

- [ ] **Step 11: Story**

In `components/PosterFrame.stories.tsx`, the default already sets `status:
'won'`. Add the two neighbours so a reviewer sees all three states:

```tsx
export const Nominated: StoryObj<typeof meta> = { args: { status: 'nominated' } };
export const NotNominated: StoryObj<typeof meta> = { args: { status: 'none' } };
```

- [ ] **Step 12: Commit**

```bash
npm run lint && npm run typecheck && npm run layering
git add app/globals.css components/PosterFrame.tsx components/PosterFrame.test.tsx components/PosterFrame.stories.tsx lib/services/dashboard.ts lib/services/dashboard.test.ts lib/services/scoring.batching.test.ts lib/dashboard/shelves.ts "app/(app)/page.tsx"
git commit -m "P17.T15: the winner seal stamps

Half of this is the animation and half is that the seal had never rendered:
nothing in the app ever set PosterFrame's status. The roster now reads it out
of the ledger it was already loading.

Does NOT close P14.T4, which still owes making the seal fire from a live event
rather than from the next render."
```

---

## Task T17: LCP priority on the first shelf frames

**Files:**
- Modify: `components/PosterFrame.tsx` (one prop)
- Modify: `app/(app)/page.tsx` (`NowPlayingShelf`)
- Test: `components/PosterFrame.test.tsx`

**Interfaces:**
- Produces: `PosterFrame` gains `priority?: boolean` (default `false`). T16's
  `LiveBoard` does **not** set it — the live page's own LCP is its header.

**Context an implementer needs.**

Next warns on every load of `/` that the largest contentful paint is a lazily
loaded TMDB poster. `PosterFrame` passes no `priority` and no `loading` to
`RemoteImage`, so `next/image` defaults to `loading="lazy"` — the browser does
not begin fetching until layout says the frame is near the viewport, and for the
`In cinemas now` shelf it is *in* the viewport on a desktop first paint.

🔴 **One or two frames, not the whole shelf.** `priority` emits a
`<link rel="preload">` per image; preloading twelve posters would contend for the
same connections and make the LCP *worse*, which is the standard way this fix
goes wrong. Two is what fits above the fold at 1440px before the shelf starts
scrolling.

🔴 `priority` and `loading` are mutually exclusive in `next/image` — passing both
is a runtime error. Pass only `priority`, and only when true.

The banner on `/films/[tmdbId]` already does this correctly (`priority` on the
backdrop, with a comment saying why); this is the same fix on the other side of
the app.

- [ ] **Step 1: Write the failing test**

Add to `components/PosterFrame.test.tsx`:

```tsx
  it('does not preload a poster by default', () => {
    // `priority` emits a <link rel=preload> per image. A shelf of twelve of
    // them contends for the same connections and makes the LCP worse, which is
    // the usual way this fix backfires.
    render(<PosterFrame {...base} posterUrl="https://image.tmdb.org/t/p/w342/a.jpg" />);
    expect(document.querySelector('img')).not.toHaveAttribute('fetchpriority', 'high');
  });

  it('🔴 preloads the poster when the page says it is the LCP', () => {
    render(
      <PosterFrame
        {...base}
        posterUrl="https://image.tmdb.org/t/p/w342/a.jpg"
        priority
      />,
    );
    expect(document.querySelector('img')).toHaveAttribute('fetchpriority', 'high');
  });
```

🔴 `fetchpriority="high"` is what `next/image` actually renders for `priority`,
and it is the attribute that survives into the DOM — `priority` itself is a React
prop and never appears as an attribute. Assert on the DOM, not on the prop.

- [ ] **Step 2: Run them and watch one fail**

```bash
npx vitest run components/PosterFrame.test.tsx
```

Expected: the first passes, the second FAILS — `priority` is not a prop.

- [ ] **Step 3: Add the prop**

In `components/PosterFrame.tsx`, in `PosterFrameProps`:

```ts
  /**
   * Preload this poster instead of lazy-loading it.
   *
   * 🔴 For the one or two frames that are the page's LCP, and nothing else.
   * `priority` emits a `<link rel="preload">` per image, so setting it on a
   * whole shelf makes twelve preloads race for the same connections and the
   * LCP gets slower, not faster. Next warns on every load of `/` that the LCP
   * is a lazy TMDB poster; this is the answer to that warning, applied
   * narrowly by the page that knows which frame is first.
   *
   * 🔴 Never pass this together with a `loading` value — `next/image` rejects
   * the pair at runtime.
   */
  priority?: boolean;
```

Destructure it (`priority = false`) and pass it to the image:

```tsx
        {posterUrl ? (
          <RemoteImage
            src={posterUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 50vw"
            priority={priority}
            className="object-cover"
          />
        ) : (
```

- [ ] **Step 4: Run them and watch them pass**

```bash
npx vitest run components/PosterFrame.test.tsx
```

- [ ] **Step 5: Mark the first two frames on the dashboard**

In `app/(app)/page.tsx`, in `NowPlayingShelf` — 🔴 again, **match on the code,
not the line number**:

```tsx
      {films.map((film, index) => (
        <li key={film.tmdbId} className="w-40">
          <Link
            href={`/films/${film.tmdbId}`}
            className="focus-visible:outline-accent-fill block focus-visible:outline-2"
          >
            {/* 🔴 Two, not twelve. This shelf is the dashboard's LCP element and
                Next warns about it on every load, but `priority` is a preload
                link per image — marking the whole shelf would put twelve of them
                in contention and make the metric worse. Two is what sits above
                the fold at 1440px before the shelf starts scrolling. */}
            <PosterFrame
              title={film.title}
              posterUrl={film.posterUrl}
              priority={index < 2}
            />
          </Link>
        </li>
      ))}
```

- [ ] **Step 6: Confirm the warning is gone, and the metric moved**

```bash
npm run build        # the warning is a build/runtime console warning, not a test failure
PORT=3103 npm run dev
```

Open `/` at 1440px with the console open. Record:

- The `Image with src … was detected as the Largest Contentful Paint … please
  add the "priority" property` warning **is no longer emitted**. This is the
  literal acceptance criterion; paste the before/after console line.
- In the Network panel, exactly **two** poster requests carry `Priority: High`,
  and the rest are `Low`.
- In DevTools → Performance → LCP, record the element and the time before and
  after. 🔴 If the LCP element turns out to be something else entirely (the
  `SeasonStepper`, a heading), say so — marking the wrong element is worse than
  marking none, and the review's premise would then be wrong.
- Repeat at 390px: at that width the shelf shows two frames, so both preloads are
  still earning their place.

- [ ] **Step 7: Commit**

```bash
npm run lint && npm run typecheck
git add components/PosterFrame.tsx components/PosterFrame.test.tsx "app/(app)/page.tsx"
git commit -m "P17.T17: the dashboard stops lazy-loading its own LCP"
```

---

## Task T16: A live page that does not need a transport

🔴 **This does not close P14.T0–T3.** The realtime transport decision (D23)
stays deferred. What this removes is a 404 at the product's second peak moment:
`/live/[abbr]` today resolves to an empty `.gitkeep` and — because
`app/(app)/not-found.tsx` renders outside the shell (tranche 5's T27) — a member
who reaches it during a ceremony is dropped out of the application entirely.
After this task the page renders the show, a countdown, the categories as they
resolve, and every seat's films with what they have earned **at this show** —
all server-side, refreshed by reloading. P14.T0–T3 then only have to make it
update without the reload.

🔴 **This is the only new route in Phase 17 and the biggest task in it.** It
ships as **two commits with a reviewer gate between them**: T16a is the show
half (route, countdown, categories), T16b is the league half (per-seat rosters).
T16a is independently useful — it is what removes the 404 — and T16b is the part
that costs queries and needs the batching case. Do not start T16b until T16a is
reviewed and green.

🔴 **The task id stays `P17.T16` for both commits.** Task ids are referenced from
`PROGRESS.md`, `PARITY.md` and a year of commit messages, and the owner has ruled
against renumbering. The commit *subjects* distinguish the halves —
`P17.T16a: …` and `P17.T16b: …` — and the single `PROGRESS.md` box records both
SHAs against it, the way P15.T10 records `05e2a4c` + `1ab3702`. **You do not
write that line** (the tranches are being indexed centrally); hand both SHAs back
instead.

**Files:**
- Create: `lib/services/live.ts`, `lib/services/live.test.ts`
- Create: `app/(app)/live/[abbr]/page.tsx` (deleting `app/(app)/live/[abbr]/.gitkeep`)
- Create: `components/LiveCountdown.tsx`, `.test.tsx`, `.stories.tsx`
- Create: `components/LiveBoard.tsx`, `.test.tsx`, `.stories.tsx`
- Create: `e2e/live.spec.ts`
- Modify: `app/(app)/award-shows/[abbr]/page.tsx` (the way in)
- Modify: `lib/services/scoring.batching.test.ts` (the new surface's case)

**Interfaces:**
- Consumes: `getAwardShow(abbreviation, year)` from `lib/services/award-show.ts`;
  `getLeagueBoard(leagueId, year)` from `lib/services/draft.ts`;
  `draftRepository.findLeagueIdsByUserId(userId)`;
  `eventRepository.findByAbbreviation(abbr)`; `getActiveYear()`;
  `PosterFrame`'s `status` (T15) and `PosterStatus`.
- Produces:

```ts
// lib/services/live.ts
export type LiveCategory = {
  awardId: number;
  name: string;
  /** What a nomination here is worth. A win is worth it twice (D41). */
  points: number;
  nomineeCount: number;
  /** The winning film, once one is marked. Null while the category is open. */
  winner: { movieId: number; title: string; posterUrl: string | null } | null;
};

export type LiveFilm = {
  movieId: number;
  title: string;
  posterUrl: string | null;
  /** Points earned at THIS show only, not the season total. */
  earned: number;
  status: 'none' | 'nominated' | 'won';
};

export type LiveSeat = {
  draftId: number;
  name: string;
  isViewer: boolean;
  /** The sum of `films[].earned` — this seat's take from this show. */
  earned: number;
  /** Only the seat's films that are in play here. A seat may have none. */
  films: LiveFilm[];
};

export type LiveLeague = { id: number; name: string | null; seats: LiveSeat[] };

export type LiveShowView = {
  eventId: number;
  abbreviation: string;
  name: string;
  year: number;
  imageUrl: string | null;
  /** Epoch ms of the ceremony start, or null if it is not scheduled. */
  startsAt: number | null;
  /** The source's own `awards_active` flag: the broadcast window is open. */
  onAir: boolean;
  resolved: number;
  total: number;
  categories: LiveCategory[];
  /** Empty for a reader with no leagues, and for a reader signed out. */
  leagues: LiveLeague[];
};

export async function getLiveShow(
  abbreviation: string,
  year: number,
  userId: number | null,
): Promise<LiveShowView>;   // throws NotFoundError for an unknown show
```

**Context an implementer needs.**

🔴 **No second scoring path, and this is the constraint that shapes the whole
task.** `lib/services/scoring.ts` is the single definition of the rule (D19/D41)
and `scoring.batching.test.ts` asserts a **constant** query count. The live
page's numbers therefore come from `getLeagueBoard`, which already returns every
pick carrying `ledger: LedgerLine[]` — and `LedgerLine` already carries
`eventAbbreviation`. Narrowing a season ledger to one show is a **pure in-memory
filter**:

```ts
const lines = pick.ledger.filter((line) => line.eventAbbreviation === abbreviation);
const earned = lines.reduce((sum, line) => sum + line.earned, 0);
```

Do not write a query. Do not call `scoreMovies`. Do not add a
`pointsForEvent(...)`. The ledger comes free with the board (that is why it is on
the pick — read the comment on `BoardPick.ledger`), and the filter is the entire
scoring content of this page.

**The countdown.** `events.awards_date` is UTC midnight of the ceremony day in
epoch ms and `events.awards_time` is ms past midnight; the events repository
normalizes both off bigint. `startsAt = awardsDate + (awardsTime ?? 0)`, `null`
if `awardsDate` is null.

🔴 **The countdown is the second consumer of `beam` and the first that
renders** — tranche 4's T20 does not close until it does. Consume
`--color-beam` via `text-beam`; do not change its value, its mirror in
`theme/tokens.ts`, or its MUI `info.main` binding.

🔴 **Hydration.** A ticking clock rendered on the server and again on the client
disagrees on the first paint, and React discards the server HTML to fix it.
`SeasonStepper` solved the same problem by rendering a fixed-UTC absolute date
server-side; do the same and let the relative string appear after mount. The
absolute date in a `<time datetime>` is the fallback for a reader whose
JavaScript never arrives.

**Access.** 🔴 **The route is PUBLIC. The owner ruled on this; it is not a
judgement the executor re-opens.** A stranger handed the link during a ceremony
has to be able to watch — that is the whole reason the route exists, and a
sign-in wall at the product's second peak moment is the same mistake D44 exists
to prevent on `/`. `/live/(.*)` therefore joins `isPublic` in `proxy.ts`.

🔴 **This amends D40**, which says the proxy enumerates public routes and a page
under `(app)` is protected by default, so forgetting one fails closed. The
mechanism is untouched: the list still enumerates the public, the default is
still protected, and this is one deliberate addition to it — the same shape as
the six entries already there. Write it as a **narrow amendment**, exactly the
way tranche 1's T6 handles D80: state what changed and what did not, and leave
it at that.

🔴 **Do not edit `docs/DECISIONS.md`.** P17.T26 assigns D85+ in one pass, so a
number claimed here would renumber somebody else's. Hand the amendment back as
prose for the Phase 17 notes — "awaiting a number" — and let T26 place it. You do
not edit `PROGRESS.md` either; the tranches are indexed centrally.

🔴 **Public means the page has to be right for a stranger.** `getLiveShow(abbr,
year, null)` already returns `leagues: []` and — like `getDashboard(null)` — does
not query leagues rather than querying with a sentinel, so there is no code path
on which this page can resolve somebody else's team. **What a signed-out reader
sees in the space where a member sees their roster is specified below in T16a,
Step 9** — it is not left to the executor, and it is not the same empty state a
signed-in member with no league gets.

**The way in.** Nothing links to `/live` today and it is not in
`lib/nav/links.ts` (there is no `ready` flag to flip). Add one link, on
`/award-shows/[abbr]`, rendered whenever the show is on air. 🔴 **No session
gate** — that was the old design's workaround for a protected route and it is now
wrong: the link is exactly what a stranger should be able to follow.

**`?year=`.** `/award-shows/[abbr]` accepts `?year=` and falls back to
`getActiveYear()`. Do the same. 🔴 This is not symmetry for its own sake: it is
what lets `e2e/live.spec.ts` use a scratch year (2995) instead of flipping
`available_years.active`, which is a **global** partial unique index with no
per-worker copy and is how concurrent suites deadlock each other.

---

### T16a — the route, the show, the countdown

- [ ] **Step 1: Write the failing countdown test**

`components/LiveCountdown.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LiveCountdown } from './LiveCountdown';

afterEach(() => vi.useRealTimers());

describe('LiveCountdown', () => {
  it('renders the absolute date as the server-safe fallback', () => {
    // 🔴 The server has no clock the client agrees with. A relative string
    // rendered on both sides is a hydration mismatch on the most prominent
    // element of the page, and React discards the server HTML to fix it. The
    // <time> is what both sides render; the relative string arrives after mount.
    const { container } = render(<LiveCountdown startsAt={Date.UTC(2027, 2, 14, 1, 0)} />);
    expect(container.querySelector('time')).toHaveAttribute(
      'datetime',
      new Date(Date.UTC(2027, 2, 14, 1, 0)).toISOString(),
    );
  });

  it('counts down to a ceremony in the future', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2027, 2, 13, 1, 0)));
    render(<LiveCountdown startsAt={Date.UTC(2027, 2, 14, 4, 30)} />);
    // 1 day, 3 hours, 30 minutes.
    expect(screen.getByText(/1d 03:30:00/)).toBeInTheDocument();
  });

  it('🔴 says the show is under way rather than counting backwards', () => {
    // "in -12 minutes" is the kind of defect that makes a whole page look
    // untrustworthy, and a live page is the worst place to do it.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2027, 2, 14, 5, 0)));
    render(<LiveCountdown startsAt={Date.UTC(2027, 2, 14, 4, 30)} />);
    expect(screen.getByText(/under way/i)).toBeInTheDocument();
    expect(screen.queryByText(/-/)).not.toBeInTheDocument();
  });

  it('says so when a ceremony has no date yet', () => {
    render(<LiveCountdown startsAt={null} />);
    expect(screen.getByText(/date to be announced/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run components/LiveCountdown.test.tsx
```

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write `LiveCountdown`**

`components/LiveCountdown.tsx`, a `'use client'` component:

- Props: `{ startsAt: number | null; className?: string }`.
- `const [now, setNow] = useState<number | null>(null)` — 🔴 **null until
  mounted**, which is what makes the server and the first client render produce
  identical HTML. A `useEffect` sets it and starts a `setInterval(…, 1000)`,
  cleared on unmount.
- `startsAt == null` → the words "Date to be announced" and no `<time>`.
- Otherwise always render
  `<time dateTime={new Date(startsAt).toISOString()}>` containing the absolute
  date, formatted with a **fixed-UTC `Intl.DateTimeFormat`** — copy the
  reasoning and the construction from `SeasonStepper`'s `showDate`, which exists
  for exactly this hydration problem. 🔴 Not `toLocaleString()` with no zone:
  that is the mismatch.
- When `now != null`: if `startsAt - now <= 0`, render "Under way". Otherwise
  render `Xd HH:MM:SS`, zero-padded, with the `tabular` utility so the digits do
  not jitter once a second — that is what `tabular` was added for (see
  `app/globals.css`).
- Colour: `text-beam`. 🔴 The first consumer of the token. Nothing pulses,
  nothing glows: a second-by-second number is information, not animation, so
  there is no `prefers-reduced-motion` branch to write — say so in the
  docstring, because the next reader will look for one.
- No `Panel`, no border. It is a line of type the page places.

- [ ] **Step 4: Run it and watch it pass; write the story**

```bash
npx vitest run components/LiveCountdown.test.tsx
```

`components/LiveCountdown.stories.tsx` — three stories, each with a fixed
`startsAt` so they are stable: `Upcoming` (a week out), `UnderWay` (in the past),
`Unscheduled` (`null`).

- [ ] **Step 5: Write the failing service test**

`lib/services/live.test.ts` — this one is DB-backed, like
`lib/services/award-show.test.ts` beside it. Follow that file's header
(`// @vitest-environment node`, the `afterAll` disconnect).

```ts
describe('getLiveShow', () => {
  it('returns the show, its schedule and how far through it is', async () => {
    const view = await getLiveShow('oscars', 2025, null);

    expect(view.abbreviation).toBe('oscars');
    expect(view.total).toBe(view.categories.length);
    expect(view.resolved).toBe(
      view.categories.filter((category) => category.winner != null).length,
    );
    expect(view.resolved).toBeLessThanOrEqual(view.total);
  });

  it('🔴 resolves the point value, never the foreign key (D41)', async () => {
    // `awards.points` is an FK into `points.id`. "Performance by an Ensemble"
    // stores 1 and is worth 5. This page is one a reader would check a score
    // against, so a confident wrong number here is the worst kind.
    const view = await getLiveShow('oscars', 2025, null);
    const ensemble = view.categories.find((c) => /ensemble/i.test(c.name));
    if (ensemble) expect(ensemble.points).toBeGreaterThan(1);
  });

  it('shows a signed-out reader no leagues at all', async () => {
    // Same rule as the public dashboard (D44): the signed-out path does not
    // query leagues rather than querying with a sentinel, so there is no code
    // path on which this page can resolve somebody else's team.
    const view = await getLiveShow('oscars', 2025, null);
    expect(view.leagues).toEqual([]);
  });

  it('throws NotFoundError for a show that does not exist', async () => {
    await expect(getLiveShow('not-a-show', 2025, null)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
```

- [ ] **Step 6: Write `lib/services/live.ts` — the show half only**

```ts
/**
 * The live surface for one award show (P17.T16).
 *
 * 🔴 **Composition, not computation.** Every number on this page comes from
 * `getAwardShow` and `getLeagueBoard`, which already go through
 * `lib/services/scoring.ts`. There is exactly one definition of the scoring rule
 * (D19/D41) and this file does not become a second one: narrowing a season to
 * one show is `line.eventAbbreviation === abbreviation`, an in-memory filter over
 * a ledger the board already loaded (see `BoardPick.ledger`).
 *
 * 🔴 **It does not close P14.T0–T3.** There is no transport here and no
 * subscription. The page renders the state at request time; a reload is what
 * advances it. That is enough to stop `/live/[abbr]` being a 404 during a
 * ceremony, which is what this task is for. Phase 14 still owes making it move
 * on its own.
 */
```

For T16a, return `leagues: []` unconditionally and declare the seat types in
T16b. 🔴 Do not ship types with no producer.

🔴 **Take `userId: number | null` in the signature now, in T16a**, even though
nothing reads it yet, and document it as "the signed-out path does not query
leagues rather than querying with a sentinel — the same rule `getDashboard(null)`
follows (D44), and the reason this page can be public at all". Adding the
parameter in T16b would change the signature the route, the unit test and the
batching case all call.

The show half:

1. `eventRepository.findByAbbreviation(abbreviation)` → throw `NotFoundError` on
   null (import from `lib/errors`). This is where `startsAt` and `onAir` come
   from; `getAwardShow` does not return the schedule columns.
2. `getAwardShow(abbreviation, year)` for the categories.
3. `startsAt = event.awardsDate == null ? null : event.awardsDate + (event.awardsTime ?? 0)`.
   🔴 `awardsTime` is nullable and `0` is a meaningful value, so `?? 0` not `|| 0`.
4. `onAir = event.awardsActive === true`.
5. Each `LiveCategory` from the `Category`: `winner` is the first nominee with
   `isWinner`, mapped to `{ movieId, title, posterUrl }` — `Nominee` already
   carries a resolved `posterUrl`. `nomineeCount = category.nominees.length`.
6. `resolved` counts categories with a winner; `total` is `categories.length`.

- [ ] **Step 7: Run the service test**

```bash
npm run db:up
npx vitest run lib/services/live.test.ts
```

- [ ] **Step 8: Make the route public**

🔴 **`proxy.ts` is tranche 1's file and this is the one sanctioned crossing.**
Tranche 1's T0 is adding `/rules-and-scoring` to the same `isPublic` array —
assume it landed there first. **Do not reproduce the array from this plan and do
not go by line number.** Open the file, find the block of comments around the
existing `'/award-shows/(.*)'` and `'/films/(.*)'` entries, and add yours
alongside them, keeping whatever T0 left:

```ts
  // 🔴 The live surface, public by the owner's ruling (P17.T16). A stranger
  // handed the link during a ceremony has to be able to watch — that is the
  // whole reason the route exists, and a sign-in wall at the product's second
  // peak moment is the mistake D44 exists to prevent on `/`.
  //
  // 🔴 This is a narrow amendment to D40. The mechanism is unchanged: the list
  // still enumerates PUBLIC routes, a page under `(app)` is still protected by
  // default, and forgetting one still fails closed. This is one deliberate
  // addition to the list, the same shape as the six above it.
  //
  // Safe for the same reason `/` is: `getLiveShow(abbr, year, null)` does not
  // query leagues rather than querying with a sentinel, so there is no code path
  // on which an anonymous reader resolves somebody else's team. The page never
  // writes.
  '/live/(.*)',
```

🔴 **Do not touch `docs/DECISIONS.md`.** P17.T26 assigns D85+ in one pass; a
number claimed here renumbers somebody else's. Carry the amendment back as prose.

- [ ] **Step 9: Write the route**

```bash
git rm "app/(app)/live/[abbr]/.gitkeep"
```

`app/(app)/live/[abbr]/page.tsx`. Built **only** from the Phase 3.5 primitives,
per the Phase 10 surface table (`CinemaFrame`, carmine `StatusChip`, `Shelf`)
and the phase gate:

```tsx
export async function generateMetadata({
  params, searchParams,
}: PageProps<'/live/[abbr]'>): Promise<Metadata> {
  // A title and a canonical, because the route is public now. The canonical
  // drops `?year=`, the same way `/award-shows/[abbr]` does — twelve shows times
  // ten seasons is 120 URLs for one page otherwise.
  //
  // 🔴 Deliberately NOT added to `app/sitemap.ts`. Public and crawlable are
  // different questions: this page is a thing you open during the two hours a
  // show is on air, and the twelve URLs it would add are all `/award-shows`
  // duplicates the rest of the year. Leave the sitemap alone.
  const { abbr } = await params;
  const { year } = await searchParams;
  const requested = Number(year);
  const season =
    Number.isSafeInteger(requested) && requested > 0 ? requested : await getActiveYear();
  try {
    const show = await getAwardShow(abbr, season);
    return {
      title: `${show.name} ${season}, live`,
      alternates: { canonical: canonical(`/live/${abbr}`) },
    };
  } catch {
    return { title: 'Not here' };
  }
}
```

`canonical` comes from `@/lib/seo`, the same helper `/award-shows/[abbr]` and
`/films/[tmdbId]` use.

The page body, in order:

- `notFound()` on `NotFoundError` from `getLiveShow`, matching
  `/award-shows/[abbr]`'s `try`/`catch`.
- A header inside a `CinemaFrame`: the `ShowLogo` at `size="lg"` (96px after
  T12), a `SectionHead as="h1" name eyebrow={show.abbreviation}` with the show's
  name, `right={String(show.year)}`.
  - 🔴 `CinemaFrame` is `aspect-ratio: 2.39/1` with `overflow-hidden`. At 390px
    that is a 163px-tall box; check the mark plus a two-line show name fits
    before committing to it. If it does not, use a `Panel` and say why in the
    commit — the surface table is guidance, not a locked decision, and a
    clipped heading is worse than a different container.
- A carmine `StatusChip` reading `Live` when `show.onAir`, beside the countdown.
  🔴 Carmine, not brass: brass means "drafted" in 320 places on the draft board
  (T35) and T21's meaning is not settled. Carmine is urgency, which a broadcast
  in progress is.
- `<LiveCountdown startsAt={show.startsAt} />`.
- `<SectionHead as="h2" right={`${show.resolved} of ${show.total}`}>Categories</SectionHead>`
  and an `<ol>` of them: the category name, a `StatusChip tone="brass"` carrying
  the winner's title once there is one (brass here **is** an award, which is its
  existing meaning — same usage as `PointsLedger.tsx:111`), and
  `{category.points} pts` in the `SectionHead`'s right slot per category, as
  `/award-shows/[abbr]` does.
- An `EmptyState` when `show.total === 0`.
- 🔴 **The roster slot, which in T16a is always the empty branch** — `show.leagues`
  is `[]` until T16b. Two different empty states, and which one renders is the
  only thing on this page that depends on who is reading:

```tsx
        {/* 🔴 Two empty states, not one, because the page is public (P17.T16,
            amending D40). A signed-out reader must never be offered "Find a
            league": `/leagues` is protected, so that link is a login page
            wearing a league's name. They get the same invitation `/` gives a
            stranger, in the same words, for the same reason (D44).

            T16b puts <LiveBoard> above this; the branch itself does not change. */}
        {user == null ? (
          <EmptyState
            title="Play the season"
            action={{ label: 'Register', href: '/auth/register' }}
          >
            Draft a team of films before awards season and score points as they pick
            up nominations and wins. Played before? Register with the same email and
            your leagues, drafts and points come with you.
          </EmptyState>
        ) : (
          <EmptyState
            title="No league yet"
            action={{ label: 'Find a league', href: '/leagues' }}
          >
            Join a league to draft a team and watch it score as this show resolves.
          </EmptyState>
        )}
```

🔴 The signed-out copy is **lifted verbatim from `app/(app)/page.tsx`**, not
rewritten. A stranger who has now met this invitation twice should meet the same
sentence, and the version on `/` is the one the owner signed off.

🔴 **Everything else on the page renders identically signed in or out**, because
none of it is user-scoped. Resolve the session once — `const user = await
getCurrentUser()` — and pass `user?.id ?? null` into `getLiveShow`. Use
`getCurrentUser()`, not Clerk's `auth()`, which throws when `clerkMiddleware` is
absent, and under `E2E_TEST_AUTH` it is (D82/D84). This is the same call
`/films/[tmdbId]` makes for the same reason.

- [ ] **Step 10: The way in**

In `app/(app)/award-shows/[abbr]/page.tsx`, inside the `<header>`, after the
category count paragraph:

```tsx
          {/* The live surface, while the ceremony is on air. No session gate:
              `/live/[abbr]` is public (P17.T16, amending D40), and a stranger
              handed this link during a ceremony being able to follow it is the
              whole point of the route. */}
          {show.needsWinners ? (
            <Link
              href={`/live/${show.abbreviation}?year=${show.year}`}
              className="text-accent-text hover:text-text-primary focus-visible:outline-accent-fill w-fit text-sm focus-visible:outline-2"
            >
              Follow live →
            </Link>
          ) : null}
```

🔴 `show.needsWinners` is `events.awards_active`, the source's own flag for "the
winners are being worked on" — i.e. the broadcast window. The prop name reads
admin-ish because that is the only thing it fed until now; it is the right
column.

- [ ] **Step 11: Write `e2e/live.spec.ts` — the show half**

Copy the `withDb` / `cleanup` / scratch-show shape from `e2e/award-shows.spec.ts`
verbatim, with `TAG = 'e2e-live'` and `YEAR = 2995`. 🔴 A scratch show and a
scratch year, because the database on 5433 is a restored copy of production and a
stray nomination against the real Oscars changes what sixty real people are
playing for. `test.beforeAll(cleanup)`, `test.afterEach(cleanup)`,
`test.afterAll(cleanup)` — the third is not redundant; see the comment in
`award-shows.spec.ts` about requests in flight re-provisioning a deleted account.

Seed the show with `awards_date` set to a future midnight and `awards_active`
true, so the countdown has something to count and the chip has something to say:

```ts
    const events = (await query(
      `insert into events (name, abbreviation, awards_active, awards_date, awards_time,
                           created_at, updated_at)
         values ($1, $2, true, $3, $4, now(), now()) returning id`,
      [`${TAG} Show`, abbreviation, futureMidnightMs, 60 * 60 * 1000],
    )) as { id: number }[];
```

Four tests for T16a. 🔴 **The first two sign nobody in — that is the point of
them.** The route is public now, and a spec that only ever tested the
signed-in path would go green over a redirect to `/auth/login`:

```ts
  test('🔴 the route exists, and a stranger can reach it', async ({ page }) => {
    // Two failures in one assertion. It used to be an empty .gitkeep, so anyone
    // opening it during a ceremony got a 404 — and, because not-found renders
    // outside the shell (P17.T27), got dropped out of the application with one
    // link back. And it is PUBLIC (P17.T16, amending D40): a stranger handed the
    // link during a show has to be able to watch. This test signs nobody in.
    const { abbreviation } = await seedShow();

    const response = await page.goto(`/live/${abbreviation}?year=${YEAR}`);
    expect(response?.status()).toBe(200);
    // Not bounced. A redirect to the login page would also answer 200.
    expect(new URL(page.url()).pathname).toBe(`/live/${abbreviation}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(`${TAG} Show`);
  });

  test('counts down to the ceremony, signed out', async ({ page }) => {
    const { abbreviation } = await seedShow();
    await page.goto(`/live/${abbreviation}?year=${YEAR}`);

    // The <time> is server-rendered; the relative string arrives after mount.
    await expect(page.locator('time')).toBeVisible();
    await expect(page.getByText(/\d+d \d\d:\d\d:\d\d/)).toBeVisible();
  });

  test('🔴 shows the resolved point value, not the raw foreign key', async ({ page }) => {
    // The scratch category points at a tier worth 7 (D41). Same trap as the
    // award-show page, and this is the other surface that could print the
    // column and be believed.
    const { abbreviation } = await seedShow();
    await signInAsMember(page);
    await page.goto(`/live/${abbreviation}?year=${YEAR}`);

    await expect(page.getByText('7 pts')).toBeVisible();
  });

  test('🔴 a stranger is invited in, not shown an empty league box', async ({ page }) => {
    // The public surface's own empty state. `/leagues` is protected, so offering
    // "Find a league" to someone with no account is a link to a login page —
    // the exact defect the public-by-default reasoning exists to avoid.
    const { abbreviation } = await seedShow();

    await page.goto(`/live/${abbreviation}?year=${YEAR}`);

    await expect(page.getByRole('link', { name: 'Register' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Find a league' })).toHaveCount(0);
  });
```

`signInAsMember` is `signInAs(page, { email: `${TAG}-${Date.now()}@example.test`,
firstName: 'Member' })` — no admin role needed; this half only reads.

🔴 **`e2e/live.spec.ts` must not be `test.describe.configure({ mode: 'serial' })`
by accident and then run signed-out tests after a signed-in one in the same
context** — Playwright gives each `test` a fresh browser context, so the cookie
`signInAs` sets does not leak. Serial mode is still needed here for the same
reason `award-shows.spec.ts` needs it: the shared `TAG` cleanup.

- [ ] **Step 12: Run it, then look at it — signed out first**

```bash
npm run test:e2e -- live.spec.ts
PORT=3103 npm run dev
```

At **1440, 1280, 1024, 390px**, both schemes, on a seeded scratch show, **in a
private window with no session** and then again signed in:

- 🔴 Signed out, the URL stays on `/live/<abbr>`. If it becomes `/auth/login`,
  the `proxy.ts` entry did not land — check whether tranche 1's T0 rewrote the
  array after you added it.
- The header's mark, name and countdown all fit; nothing is clipped by
  `CinemaFrame`'s `overflow-hidden`. Record the header's height at each width.
- `scrollWidth <= innerWidth` at every width, both schemes, **both sessions**.
- The countdown's digits do not change the line's width as the seconds tick
  (`tabular`). Watch it for ten seconds.
- The countdown renders in `beam` — sample the computed colour and confirm it is
  `#7fa6b8` in dark and `#3f6273` in light. 🔴 **Record this; tranche 4's T20
  needs it as evidence that the token is finally spent.**
- Signed out, the invitation reads "Play the season" with a **Register** button
  and there is **no** "Find a league" link anywhere on the page.
- Reload with the console open: **no hydration warning**. That is the one this
  design is built around.

- [ ] **Step 13: Commit T16a**

```bash
npm run lint && npm run typecheck && npm run layering
npx vitest run lib/services/live.test.ts components/LiveCountdown.test.tsx
git add lib/services/live.ts lib/services/live.test.ts components/LiveCountdown.tsx components/LiveCountdown.test.tsx components/LiveCountdown.stories.tsx "app/(app)/live" "app/(app)/award-shows/[abbr]/page.tsx" proxy.ts e2e/live.spec.ts
git commit -m "P17.T16a: /live/[abbr] stops being a 404

The show, the countdown and the categories as they resolve, rendered on the
server. Spends the beam token for the first time (P17.T20 depends on this).

🔴 PUBLIC, by the owner's ruling, which AMENDS D40. The mechanism is unchanged
— proxy.ts still enumerates public routes, a page under (app) is still
protected by default, forgetting one still fails closed — and this is one
deliberate addition to that list. A stranger handed the link during a ceremony
has to be able to watch; that is the whole reason the route exists. Safe for
the same reason / is: getLiveShow(abbr, year, null) does not query leagues
rather than querying with a sentinel, and the page never writes.
DECISIONS.md is deliberately untouched: P17.T26 assigns D85+ in one pass.

🔴 Crosses into tranche 1's proxy.ts for that one line. There was no other way
to make a route under (app) public.

Does NOT close P14.T0-T3: there is no transport here and the decision stays
deferred. A reload is what advances the page."
```

🔴 **Stop here for review.** T16b is a separate gate. Hand this SHA back — the
single `P17.T16` box in `PROGRESS.md` records both it and T16b's, the way
P15.T10 records `05e2a4c` + `1ab3702`.

---

### T16b — each member's roster, with points as categories resolve

- [ ] **Step 14: Write the failing board test**

`components/LiveBoard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LiveBoard } from './LiveBoard';

const league = {
  id: 1,
  name: 'The Main League',
  seats: [
    {
      draftId: 10,
      name: 'Ada',
      isViewer: true,
      earned: 14,
      films: [
        { movieId: 1, title: 'Sinners', posterUrl: null, earned: 14, status: 'won' as const },
        { movieId: 2, title: 'Marty Supreme', posterUrl: null, earned: 0, status: 'none' as const },
      ],
    },
    { draftId: 11, name: 'Grace', isViewer: false, earned: 7, films: [] },
  ],
};

describe('LiveBoard', () => {
  it('ranks the seats by what they have taken from this show', () => {
    render(<LiveBoard leagues={[league]} />);
    const seats = screen.getAllByRole('heading', { level: 4 });
    expect(seats.map((seat) => seat.textContent)).toEqual(['Ada', 'Grace']);
  });

  it('🔴 shows the points earned at THIS show, not the season total', () => {
    // The whole point of the page. A seat's season total is on the dashboard;
    // what it took tonight is the thing nobody can otherwise see.
    render(<LiveBoard leagues={[league]} />);
    expect(screen.getByText('14')).toBeInTheDocument();
  });

  it('marks the reader’s own seat', () => {
    render(<LiveBoard leagues={[league]} />);
    // Not by colour alone (§6.4): the word is in the markup.
    expect(screen.getByText(/your seat/i)).toBeInTheDocument();
  });

  it('says so when a seat holds nothing in play here', () => {
    // A real and common state — twelve shows, and most seats are not in most of
    // them. An empty strip with no words reads as a failed load.
    render(<LiveBoard leagues={[league]} />);
    expect(screen.getByText(/nothing in play/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 15: Run it and watch it fail**

```bash
npx vitest run components/LiveBoard.test.tsx
```

- [ ] **Step 16: Write `LiveBoard`**

`components/LiveBoard.tsx`, a Server Component (no state, no effects — do not
add `'use client'`).

- 🔴 **Re-declare its prop types locally.** `components/` may not import from
  `lib/services/` (D33), and a type-only import still points the dependency the
  wrong way. Copy the `LiveFilm` / `LiveSeat` / `LiveLeague` shapes with a
  docstring saying they mirror `lib/services/live.ts` — this is the same pattern
  `SeasonStepper` uses for `SeasonPhase`.
- One `<section>` per league. `SectionHead as="h3" name` with the league's name;
  `right` is the league's own total from this show.
- One row per seat, seats sorted by `earned` descending (sort in the **service**,
  not here — `RosterStrip`'s docstring explains why a component must not re-sort
  what a service ordered; the service's order is the meaning).
- Each seat: `SectionHead as="h4" name` with the seat name, an `Eyebrow` reading
  `Your seat` when `isViewer`, the `earned` number in the `right` slot, and a
  `Shelf` of that seat's films as `PosterFrame`s with `points={film.earned}` and
  `status={film.status}` — so T15's seal stamps here the moment a category
  resolves.
  - 🔴 No `round`: a film's draft round is not what this page is about, and
    `PosterFrame`'s `round` is optional for exactly this reason.
  - 🔴 No `priority`: this is not the page's LCP, and T17's docstring says why
    marking a shelf is worse than marking nothing.
- `films.length === 0` → the words "Nothing in play here", not an empty strip.

- [ ] **Step 17: Extend the service**

Add the `LiveFilm` / `LiveSeat` / `LiveLeague` types from the **Interfaces**
block above, and in `getLiveShow`, when `userId != null`:

```ts
  // 🔴 The board's ledger, narrowed. `BoardPick.ledger` already carries every
  // award this film earned this season, each line naming its show — so "what
  // has this seat taken tonight" is a filter, not a query and not a second
  // scoring rule (D19/D41). Writing `pointsForEvent(...)` here would be the
  // second definition, and the first thing to disagree with the standings.
  const leagueIds = await draftRepository.findLeagueIdsByUserId(userId);
  const boards = await Promise.all(
    leagueIds.map((leagueId) => getLeagueBoard(leagueId, year)),
  );
```

then, per board, per group, per seat:

```ts
      const films = seat.picks.flatMap((pick) => {
        const lines = pick.ledger.filter(
          (line) => line.eventAbbreviation === abbreviation,
        );
        // A film with no line at this show is not on this page. The seat's
        // other picks are real and are on the dashboard; here they are noise.
        if (lines.length === 0) return [];
        return [{
          movieId: pick.movie.id,
          title: pick.movie.title ?? 'Untitled',
          posterUrl: posterUrl(pick.movie.poster, 'w342'),
          earned: lines.reduce((sum, line) => sum + line.earned, 0),
          status: lines.some((line) => line.won) ? ('won' as const) : ('nominated' as const),
        }];
      });
```

🔴 `status` can only be `'won'` or `'nominated'` on this page — a film with no
line here is dropped above, so `'none'` is unreachable. Keep it in the union
anyway so the type matches `PosterStatus` and `LiveBoard` does not need a
narrower one; say so in a comment, or the next reader deletes it.

Seats sort by `earned` descending, then by name so the order is total and stable
between renders. Leagues keep `findLeagueIdsByUserId`'s order.

- [ ] **Step 18: Add the batching case — this is the standing instruction**

In `lib/services/scoring.batching.test.ts`, in the
`every page that shows a score loads them in bulk` describe:

```ts
  it('🔴 the live show page (P17.T16) costs a fixed number of queries', async () => {
    // Every surface that shows a score arrives with a case here — the standing
    // rule since Phase 9. This one composes getAwardShow and getLeagueBoard and
    // filters their ledgers in memory; it must never query per film, per seat or
    // per category.
    const { queries } = await countQueries(() => getLiveShow('oscars', 2026, 6));

    expect(queries).toBeLessThanOrEqual(/* the number you measure, +2 */);
    expect(queries).toBeGreaterThan(0);
  });

  it('🔴 the live page costs no more for a big show than a small one', async () => {
    // The actual property. The Oscars carry ~24 categories and hundreds of
    // nominations; a smaller body carries a handful. If the count moves with
    // either, or with the seats in the viewer's league, something is querying
    // per row — which is what would make this page fall over during the one
    // hour a year it matters.
    const big = await countQueries(() => getLiveShow('oscars', 2026, 6));
    const small = await countQueries(() => getLiveShow('gg', 2026, 6));

    expect(big.queries).toBe(small.queries);
  });
```

🔴 Measure the first bound, do not guess it. Log it once, note it, remove the
log, set the ceiling to measured + 2 and say so in the comment — a loose ceiling
is how a guard keeps passing while the thing it guards gets worse.

🔴 `'gg'` is a placeholder: run
`npm run db:psql -c "select abbreviation from events order by abbreviation"`
and pick a real second show with fewer categories in 2026. If no second show has
2026 data, use 2025 for both and say why.

- [ ] **Step 19: Render it on the page**

In `app/(app)/live/[abbr]/page.tsx`, **wrap** the two empty states T16a wrote —
do not replace them, and do not collapse them back into one:

```tsx
        {show.leagues.length > 0 ? (
          <LiveBoard leagues={show.leagues} />
        ) : user == null ? (
          // The public branch. Unchanged from T16a, and it is the one a stranger
          // following a link during a ceremony lands on — never "Find a league",
          // which points at a protected route (P17.T16, amending D40).
          <EmptyState
            title="Play the season"
            action={{ label: 'Register', href: '/auth/register' }}
          >
            Draft a team of films before awards season and score points as they pick
            up nominations and wins. Played before? Register with the same email and
            your leagues, drafts and points come with you.
          </EmptyState>
        ) : (
          <EmptyState
            title="No league yet"
            action={{ label: 'Find a league', href: '/leagues' }}
          >
            Join a league to draft a team and watch it score as this show resolves.
          </EmptyState>
        )}
```

🔴 `show.leagues` is `[]` for a signed-out reader **by construction** — the
service does not query leagues when `userId` is null — so the first branch can
never render for a stranger even if the `user == null` check were removed. Two
locks, the same shape as `/`'s.

- [ ] **Step 20: Extend the e2e spec**

Add to `e2e/live.spec.ts` a scratch **league** alongside the scratch show,
following `e2e/draft.spec.ts`'s `signInAsOwner` seeding (a league with
`drafting_status = 'active'`, one real draft seat for the signed-in user, one
dummy). Then a nomination and a win against the seat's film, and:

```ts
  test('🔴 a seat’s roster carries what it earned at THIS show', async ({ page }) => {
    const { abbreviation } = await seedShowWithLeague(page);
    await page.goto(`/live/${abbreviation}?year=${YEAR}`);

    // The category is worth 7. The film is nominated AND won, so it earned 14
    // (D41: a win is worth the category twice, because a winner was nominated).
    await expect(page.getByText(`${TAG} Alpha`)).toBeVisible();
    await expect(page.getByText('14')).toBeVisible();
    await expect(page.getByLabel('Winner')).toBeVisible();
  });

  test('a seat with nothing nominated here says so', async ({ page }) => {
    const { abbreviation } = await seedShowWithLeague(page);
    await page.goto(`/live/${abbreviation}?year=${YEAR}`);

    await expect(page.getByText(/nothing in play/i)).toBeVisible();
  });

  test('🔴 a stranger sees the show and no seat of anybody’s', async ({ page }) => {
    // The public surface's load-bearing guarantee. The league exists and has
    // real rosters; an anonymous reader must see the ceremony and none of them.
    // Not a permission check bolted on top — getLiveShow(abbr, year, null) never
    // queries leagues at all, the same shape D44 gives getDashboard(null).
    const { abbreviation } = await seedShowWithLeague(page);
    await page.context().clearCookies();

    await page.goto(`/live/${abbreviation}?year=${YEAR}`);

    await expect(page.getByRole('heading', { level: 1 })).toContainText(`${TAG} Show`);
    // The seeded seat's name and its film are both absent.
    await expect(page.getByText('Ada')).toHaveCount(0);
    await expect(page.getByText(`${TAG} Alpha`)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Register' })).toBeVisible();
  });
```

🔴 `clearCookies()` rather than a second `test` with no `signInAs`: the point is
that the *same* league, seeded and populated, is invisible without a session —
a fresh spec with no league proves nothing.

🔴 Extend `cleanup()` with the league, drafts and draft_picks deletes from
`e2e/draft.spec.ts` — matched on `leagues.name like 'e2e-live%'`. A scratch
league left behind breaks `lib/db.test.ts`, which counts the restored rows.

- [ ] **Step 21: Run everything**

```bash
npm run db:up
npx vitest run lib/services/live.test.ts components/LiveBoard.test.tsx lib/services/scoring.batching.test.ts
npm run test:e2e -- live.spec.ts
npm run verify
npm run build-storybook
```

- [ ] **Step 22: Watch a ceremony**

`PORT=3103 npm run dev`, against a scratch show and a scratch league you seeded
yourself. At **1440, 1280, 1024, 390px**, both schemes:

- With no winners marked: every seat shows its nominated films with their
  nomination points and a carmine top hairline. `resolved` reads `0 of N`.
- Mark a winner in another tab, reload: that film's points double, the seal
  stamps, `resolved` becomes `1 of N`, and the seat order re-sorts. **That is
  the task's acceptance criterion** — "points as categories resolve", without a
  transport.
- With reduced motion on, the same reload: the seal is there instantly, no
  movement.
- At 390px: the seat shelves scroll horizontally and the page does not
  (`scrollWidth <= innerWidth`). Record it in both schemes.
- 🔴 Record the countdown's computed colour in both schemes again, now with the
  board below it, for tranche 4's T20 evidence.
- 🔴 **Then do the whole pass again in a private window with no session.** The
  page is public. Confirm: the show, the countdown and the categories render;
  **no seat name and no seat's film appears anywhere**; the invitation says
  "Play the season" with a Register button; and there is no "Find a league"
  link. Walk the DOM for the league owner's name if you want to be sure —
  `document.body.innerText.includes('<the seat name you seeded>')` should be
  `false`. This is the one check that would catch a leak, and jsdom cannot do it.

- [ ] **Step 23: Commit T16b**

```bash
npm run lint && npm run typecheck && npm run layering
git add lib/services/live.ts lib/services/live.test.ts components/LiveBoard.tsx components/LiveBoard.test.tsx components/LiveBoard.stories.tsx "app/(app)/live/[abbr]/page.tsx" lib/services/scoring.batching.test.ts e2e/live.spec.ts
git commit -m "P17.T16b: every seat's films, scoring as the show resolves

No new scoring path: BoardPick.ledger already names each line's show, so
narrowing a season to one ceremony is a filter (D19/D41). Adds the surface's
case to scoring.batching.test.ts per the standing Phase 9 rule.

The route is public (P17.T16a), so the signed-out path is load-bearing:
getLiveShow(abbr, year, null) does not query leagues rather than querying with
a sentinel, and a stranger gets the ceremony and nobody's roster. Covered
signed-out in e2e, not only signed in.

Does NOT close P14.T0-T3."
```

🔴 **Hand this SHA back with T16a's.** One `P17.T16` box, two commits, the way
P15.T10 records `05e2a4c` + `1ab3702`. You do not write that line yourself.

---

## Tranche gate

Before this tranche is handed back:

```bash
npm run verify          # lint, typecheck, layering, both test suites, build
npm run build-storybook
npm run test:e2e
```

Then the browser pass the phase gate requires — **1440, 1280, 1024 and 390px, in
both schemes**, over `/`, `/award-shows`, `/award-shows/<a show>`, a film page,
and `/live/<a scratch show>`. Record, as numbers rather than impressions:

| What | Where measured | Recorded |
|---|---|---|
| Roster frames showing artwork vs initials | `/` signed in, 1440 | |
| Award marks legible, all twelve, both schemes | `/award-shows` | |
| Any mark that is light-on-transparent and now lost | `/award-shows` | |
| Year box top vs title box top, px delta | `/films/313369`, all four widths | |
| Rail bottom vs panel bottom, px delta; rail height | `/`, 1440×900 and 1280 | |
| Poster requests at `Priority: High` | `/`, Network panel | |
| The Next LCP warning, before and after | `/`, console | |
| Countdown computed colour, both schemes | `/live/<show>` | |
| `/live/<show>` signed out: URL not bounced, no seat name in `innerText` | private window, all four widths | |
| `scrollWidth <= innerWidth` | every page × every width × both schemes | |

🔴 **Do not tick anything in `docs/PROGRESS.md` and do not touch
`docs/DECISIONS.md`** — the tranches are being indexed centrally and P17.T26
assigns D85+ in one pass. Hand back instead:

1. The table above.
2. **The D40 amendment, as prose awaiting a number**, for the Phase 17 notes:
   *`/live/(.*)` is public. D40's mechanism is unchanged — `proxy.ts` still
   enumerates public routes, a page under `(app)` is still protected by default,
   and forgetting one still fails closed. This is one deliberate addition to the
   list, on the owner's ruling that a stranger handed the link during a ceremony
   has to be able to watch. Safe for the same reason `/` is: the signed-out path
   does not query leagues, and the page never writes.*
3. **Both T16 SHAs** against the single `P17.T16` box.
4. Anything found-but-not-fixed.

---

## Self-review notes

- **Spec coverage.** T11 → Task T11. T12 (64px, contain, neutral plate,
  pluralise) → Task T12, all four. T13 → Task T13. T14 → Task T14, layout half
  only, with the avatar half explicitly deferred to the T2 reconciliation and
  the reason recorded (and the avatar half handed to T2). T15 → Task T15, with
  the extra half (the seal had never rendered) folded in because the animation is
  otherwise on an unreachable branch. T16 → Task T16a + T16b, one task id, two
  commits, a reviewer gate between them. T17 → Task T17.
- **Decisions.** One amendment: D40, narrowed to "`/live/(.*)` joins the public
  list; the mechanism is unchanged". Written the way tranche 1's T6 writes its
  D80 amendment, carried back as prose, **not** written into `DECISIONS.md` —
  P17.T26 assigns D85+ in one pass and a number claimed here would renumber
  somebody else's. D19/D41 (one scoring rule, resolved point values), D33
  (component/service boundary), D44 (public surfaces render no user-scoped data),
  D59 (batched reads), D66, D70, D73 and D75 are all obeyed rather than touched.
- **The public ruling reaches four places, not one:** `proxy.ts` (T16a Step 8),
  the metadata's canonical (Step 9), the two empty states (Step 9 and Step 19),
  and the link's dropped session gate (Step 10) — plus three signed-out e2e cases
  and a signed-out browser pass. A route made public in the matcher alone is a
  leak waiting for the first page that assumed a session.
- **The gate's Phase 3.5 clause.** Two new components, both built from the
  primitives, both with a story: `LiveCountdown`, `LiveBoard`. No hairline card
  border, no all-caps outside `Eyebrow`, no pill or squared button, no
  machine-formatted date (the countdown's absolute date goes through a fixed-UTC
  `Intl.DateTimeFormat`, matching `SeasonStepper`).
- **Where jsdom cannot reach, the assertion is in e2e**: T13's baseline geometry,
  T14's rail height, T16's hydration and horizontal-overflow checks, T17's LCP.
  Each says so in its own step rather than pretending a class-name assertion is
  a proof.
- **Type consistency.** `posterUrl: string | null` and `status: 'none' |
  'nominated' | 'won'` are the same two fields on `RosterEntry` (T11, T15),
  `ShelfFilm` (T11, T15) and `LiveFilm` (T16), and the union matches
  `PosterFrame`'s existing `PosterStatus`. `priority?: boolean` (T17) is
  consumed only by `NowPlayingShelf`. `getLiveShow(abbreviation, year, userId)`
  is the one signature the route, the unit test and the batching case all call.

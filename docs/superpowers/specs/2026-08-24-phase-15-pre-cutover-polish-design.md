# Phase 15 — Pre-cutover polish

**Date:** 2026-08-24
**Status:** approved, awaiting implementation plan
**Supersedes nothing. Amends:** D65 (browse paging), D49 (leaderboard mobile).

---

## Why this phase exists

The build reached `next.cinemadraft.com` and the owner used it. Everything
below is a defect found by that use, plus the release work (brand, SEO, Clerk
flow, end-to-end coverage) that a live site needs and a port did not.

**It runs before Phase 12.** It carries the number 15 because the plan's phase
numbers are referenced from `PROGRESS.md`, `PARITY.md` and a year of commit
messages, and renumbering 12–14 to make room would invalidate all of them. The
old Phase 15 ("New features") moves verbatim to Phase 16. `PLAN.md` states the
ordering in the phase header so nobody reads the number as the schedule.

**Clerk stays split.** P13.T1 still owns creating the Production instance and
swapping `pk_live_`/`sk_live_` at cutover — that needs a verified apex domain,
which does not exist yet. This phase owns only the sign-in flow defect, which
is reproducible today on the Development instance.

---

## 1. Leaderboard — row count and mobile layout (T1)

Two defects in one component, `components/LeaderboardTable.tsx`, plus its
heading in `app/(app)/page.tsx`.

**Too many rows.** A full season's nominated films render on first paint. The
table becomes a client component that renders the first 10 rows and a "Show 10
more" button revealing 10 at a time, with a count of what remains. The data
already arrives whole from `getLeaderboard(year)` — the button reveals, it does
not fetch, so there is no new endpoint, no loading state, and no second query.
Hidden rows are not in the DOM; the leaderboard is not a crawl target, and the
top 10 is what a search result should show anyway.

**Mobile break** (screenshots 2 and 3). Two independent causes:

1. The year links live in `SectionHead`'s `right` slot. At 390px the heading
   wraps to two lines and the slot renders over it. Fix: below `sm` the year
   nav renders beneath the heading instead of beside it. `SectionHead` gains a
   `rightBelow` behaviour rather than the page hand-rolling a second layout —
   the same collision exists anywhere a long title meets a wide right slot.
2. The table sets `min-w-[36rem]` and scrolls horizontally, so Total is off
   screen at every phone width. D49 chose that over the source's hidden
   columns. It was wrong: the two columns a phone reader wants are Film and
   Total, and they are the two the horizontal scroll separates. Fix: below
   `lg` the table drops its min-width and renders Film + Total only; the
   per-show columns return at `lg`, where they already do. No horizontal
   scroll at any width. **This amends D49** and needs a decision row.

---

## 2. Season stepper (T2)

`components/SeasonRail.tsx` becomes `components/SeasonStepper.tsx`.

**Two boxes per show.** `events.nom_date` and `events.awards_date` are separate
columns and the events repository already normalizes both.
`lib/services/dashboard.ts:149-158` collapses them, emitting one `SeasonEvent`
per row carrying `awardsDate` only — so nominations, which are half the
season's scoring moments, appear nowhere on the dashboard. The service will
emit one entry per *phase*:

```
{ eventId, phase: 'nominations' | 'ceremony', name, abbreviation, date, complete }
```

`complete` keeps its current rule per phase (`date != null && date < now`).
A phase with no date is still rendered — "Date TBA" — because an unscheduled
ceremony is a real state, but it can never be the "next" box.

**Stepper, not a scroll container.** A fixed-width window over the list, `‹`
and `›` stepping **3 boxes** each way, disabled at the ends. Initial position is
the **end** of the list, so the most recent and next boxes are what the reader
sees without touching anything. Transform-based slide, ~200ms ease-out;
`prefers-reduced-motion` jumps instead. Both buttons are ≥44px, labelled, and
the visible range is announced through `aria-live="polite"`. The list remains an
ordered list in DOM order, so a screen reader and a no-JS reader get the whole
season regardless of the window.

---

## 3. Global search panel (T3)

Today the search icon in `AppShell`'s desktop `Strip` is a `Link` to `/browse`
(`components/AppShell.tsx:148-154`). Browse is a release calendar, not a search.

A new `SearchOverlay` client component, mounted once in `AppShell`:

- Opens from the `Strip` icon, from the More sheet on mobile, and from `/` and
  `⌘K`/`Ctrl-K`.
- Scrim with backdrop blur — blur signals dismissable background, and the
  design system already uses it nowhere else, so it reads as one thing.
- `components/FilmSearch` at the top, unchanged, with `autoFocus`. It already
  debounces, handles arrow keys and Enter, and never drops focus.
- Top ~9 results as a poster-first grid (poster, title, year), matching the
  screenshot the owner supplied from the current site.
- Select → `/films/[id]`. Esc closes, focus returns to the trigger.
- A native `<dialog>`, matching `MoreSheet` (D75): the focus trap, `Escape`,
  `inert` background and backdrop stay the platform's job.

Data path is the existing `actions/search/find-films.ts` with
`context: { kind: 'browse' }`. No new endpoint, no new search backend.

---

## 4. Clerk — unknown email cannot become an account (T4)

Screenshot 4: a pre-migration member enters their address on `/auth/login` and
gets "Couldn't find your account", with no path forward except noticing the
Register link in Clerk's footer.

The account data is not the problem. `lib/auth.ts` → `syncClerkIdentity`
already links a new Clerk identity to the existing row by **verified email**,
so registering with the same address carries a member's history across. The
problem is that Clerk's `<SignIn>` will not create an identity for an unknown
address, and *every* member is unknown to Clerk until their first login.

Fix, in two parts:

1. **Enable Clerk's combined sign-in-or-up flow** on the instance, so an
   unrecognised address proceeds into registration in place rather than
   erroring. This is an instance setting, not code — the phase writes the exact
   dashboard steps and the owner applies them to the Development instance now
   and to Production at P13.T1.
2. **Rewrite the login copy** so the fallback is stated before the error can
   appear, and verify the flow end to end with a fresh address.

Also in scope: the `Development mode` banner visible in the screenshot is
expected on `pk_test_` keys and disappears with P13.T1's swap. Noted here so it
is not re-reported as a defect.

---

## 5. Brand mark (T5)

`public/` is empty; there is no favicon, no icon, no OG image, and
`DECISIONS.md` records the mark as still open (three directions were explored
and rendered poorly).

Three SVG mark options are produced and published as an artifact for the owner
to choose from. They are built from what already exists — Instrument Serif, the
carmine accent, and the panel/rule geometry of the design system — not from a
new visual language. The MUI template's pinwheel is not ours and does not
carry over.

Once chosen: `app/icon.svg`, `app/apple-icon.png`, a `favicon.ico` fallback,
and the mark paired with the wordmark in `NavRail`. Both colour schemes are
checked, since the icon renders against a browser chrome this app does not
control.

The mark lands before the SEO task, because the OG images use it.

---

## 6. SEO and metadata (T6)

Today: two lines in `app/layout.tsx`, a handful of static `Metadata` exports,
no canonical URLs, no robots file, no sitemap, no OG images.

- `metadataBase` and a title template in the root layout.
- `generateMetadata` per dynamic route: film, award show, league, plus static
  metadata for browse, dashboard, rules, and the auth pages
  (`robots: { index: false }` on anything session-scoped).
- Canonical URLs everywhere, so `?year=` and `?page=` variants do not compete.
- `app/robots.ts` and `app/sitemap.ts` — the sitemap lists public routes:
  films that exist locally, award shows, browse, and the dashboard.
- `opengraph-image.tsx` via `next/og` for film and award-show pages: poster or
  show logo, title, year, and the mark. Static fallback image sitewide.
- JSON-LD `Movie` on film pages.

Constraint: everything public here must render for a logged-out reader, which
D44 already guarantees for these routes.

---

## 7. Browse (T7, T8, T9)

**Infinite scroll (T7).** The owner asked for auto-append and, when shown what
D65 bought (linkable pages, working Back, keyboard reachability, crawlability),
chose to drop the "Show more" link outright. Implemented as an intersection
sentinel appending pages into a client list. **This amends D65** and needs a
decision row recording what was traded away and why. One mitigation is kept
because it costs nothing: a `<noscript>` link to the next page, so the sitemap
work in §6 still has a crawl path into the catalogue.

**Header photo (T8).** `/browse` is a heading over a grid and reads as an
unfinished page. A hero band using a TMDB backdrop from the page's own top
result, with a gradient scrim and the `Browse` heading over it. No new asset
pipeline, no new external dependency — the backdrop path is already in the
discover response. Reserved aspect ratio so it cannot shift layout.

**The 2006 film on `?when=future&page=3` (T9).** Cause: the future query sends
`release_date.gte=today` alongside `with_release_type=3`, and TMDB matches
*any* theatrical release of that film — including a re-release. A 2006 title
with a 2026 re-issue therefore passes the filter, while the `release_date`
field rendered on the card is its original release. Fix: the future side
queries `primary_release_date.gte` and sorts `primary_release_date.asc`, plus a
defensive drop in `toFilm` of any film whose parsed date is before today.
Covered by a fixture test built from a real response containing a re-release.

---

## 8. End-to-end coverage (T10, T11)

**Test auth (T10).** The existing specs sign in through Clerk with
`@clerk/testing/playwright`, which is slow, needs live keys, and churns test
users. The owner's call: stub it, seed users locally, assume league admin.

`getCurrentUser` gains a test-only branch that resolves a signed test cookie
**only when `E2E_TEST_AUTH=1` and `NODE_ENV !== 'production'`**, with a
build-time assertion that the flag cannot be set in a production build. The
cookie is signed with a secret that exists only in the test environment, so a
forged cookie is not a login even if the flag were somehow set.

🔴 **This is the one security-bearing task in the phase.** It gets a reviewer
pass of its own, and the plan states the invariants the review must confirm:
the branch is unreachable in a production build; the flag is absent from
`vercel env` in every environment; an unsigned or wrongly-signed cookie is
rejected; and no existing auth path changes behaviour when the flag is unset.

**Specs (T11)**, one per flow, all running in CI alongside the current suite:

- Create a league; add players; add dummy players.
- Set the pick order and the groups (including the randomiser).
- Start the draft; search for a film and add a pick; verify the snake order
  advances correctly across the turn; finalize the draft.
- Search for and add nominations to a show's category; pick winners; verify
  the points land on the leaderboard and the roster.
- The logged-out dashboard, and the watchlist mark.

---

## 9. Group randomisation ceremony (T12)

`randomiseGroups` returns instantly and the groups simply appear — the moment
the league has been waiting for reads as a page refresh.

A full-screen takeover, launched from the existing "deal" button in
`components/SeasonSetup.tsx`:

1. Names cycle in a shuffle reel.
2. Groups resolve one at a time, rows staggered ~40ms.
3. Confetti burst on the last group.
4. Headline, then the group listing settles into the page beneath it.

**The result is known before the animation starts.** The server action runs
first and the ceremony animates data it already holds — nothing is invented,
nothing is re-rolled, and a viewer who reloads mid-animation sees the same
groups. `prefers-reduced-motion`, and a JS-off reader, get the final groups
immediately with no takeover. The takeover is dismissable at any point
(`Escape`, and a visible Skip), and dismissing it never changes the outcome.

---

## Testing

Per task: vitest unit tests, a Storybook story for every new or changed
component, `npm run verify` green, and the new Playwright specs. The design
gates from Phase 3.5 apply unchanged — the new surfaces are built from the
existing primitives, and `scripts/layering.sh` still has to pass.

## Decisions this phase must record

- **D79** — leaderboard shows Film + Total below `lg` (amends D49).
- **D80** — browse auto-appends and drops the paging link (amends D65).
- **D81** — the season rail is a stepper with a box per show *phase*.
- **D82** — test-only auth bypass: the flag, the guard, and why it is safe.
- **D83** — the chosen brand mark (closes the open item in `DECISIONS.md`).

## Out of scope

Realtime (Phase 14), the timed self-service draft (Phase 16's note), and
anything in the old Phase 15 list, which moves to Phase 16 unchanged.

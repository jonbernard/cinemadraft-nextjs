# Phase 14 — The live room

**Goal:** `/live/[abbr]` becomes the screen a league puts on the television
during a ceremony: every award as its nominees' posters, one league's standings
down the right, the active award scrolling itself into view, and the winner
landing on the poster as an admin marks it — over the SSE transport D102
decided and nothing else.

**Owner's decisions, 2026-09-13** (asked and answered before any code):

1. **The standings are pinned by URL.** `/live/oscars?league=7` shows that
   league. With no parameter, a signed-in reader sees their own league (a
   picker if they have several); a signed-out reader sees none.
2. **Phase 14 lands now.** Live standings during a ceremony *is* the realtime
   phase, so T2/T3/T5/T7 of the original plan happen here rather than after
   the cutover.
3. 🔴 **Auto-scroll and the winner animation are always on** — they are the
   product, not a mode. **TV mode is chrome only**: it hides the top bar and
   the left rail so a full-screen browser shows nothing but the room. It
   changes no behaviour, and the page works identically without it.

**Why it is worth the phase:** the ceremony is one of the product's two peak
moments (the draft is the other). Sixty people watch one screen for three
hours, and today that screen is a list of category names.

---

## What already exists, and what it costs to reuse

- `lib/services/live.ts` → `getLiveShow(abbr, year, userId)` returns
  `LiveShowView`. 🔴 **It already has the nominees and throws them away**:
  `getAwardShow` returns `Category.nominees` and `toCategory` collapses each to
  `nomineeCount` plus a single `winner`. The posters view is mostly *stop
  discarding them* — no new query.
- `leagues` is `[]` for a signed-out reader and for a reader with no leagues
  (`live.ts:163`). The `?league=` rule widens this deliberately; see T2.
- `PosterFrame` carries `status="won"` and the seal, with
  `animate-stamp motion-reduce:animate-none` already shipped (P17.T15).
- The transport is decided (D102) and specced:
  `docs/superpowers/specs/2026-09-12-realtime-transport.md`.

## The traps, recorded before anyone hits them

- 🔴 **`/api/live/…` is not covered by `/live/(.*)`.** `config.matcher`
  includes `/(api|trpc)(.*)`, so a stranger's `EventSource` is bounced the
  moment it opens and the page sits there never updating. **No spec can catch
  it**: under `E2E_TEST_AUTH=1` the proxy is a pass-through with no route
  protection at all. `proxy.test.ts`'s verbatim list is the only guard.
- 🔴 **Stop conditions are load-bearing.** One forgotten tab pins Neon awake at
  0.25 CU — 720 hours is **180 CU-hrs against a 100 CU-hr free allowance**, so
  one spare monitor left on this page exhausts the tier by itself. The stream
  closes when the tab is hidden and when the show is not on air.
- 🔴 **The signed-out page leaks no seat name, league name or score today, and
  the stream must hold that same line.** A stream is a second door into the
  same data and it is easy to forget it has its own audience.
- 🔴 **A ceremony is ~36 forced disconnects per viewer** at the platform's 300s
  ceiling. A pushed delta landing in a gap is lost forever, so **the first
  frame of every connection is complete current state**. That is what makes a
  gap unmissable, and why no broker is needed.

---

## Tasks

### T1 — Every award is its nominees' posters

`lib/services/live.ts` stops collapsing `nominees`; `LiveCategory` carries them
with `posterUrl`, `title`, and whether each is the winner. The page renders a
poster row per award, the winner marked by the seal `PosterFrame` already has.

Legibility is the point: this is read from a sofa. State the poster size you
chose and the distance test you applied. A category with no posters (a person
category, or artwork not yet ingested) must not collapse to an empty row.

### T2 — One league's standings, down the right

`?league=<id>` pins a league; otherwise the reader's own; otherwise none. A
reader with several and no parameter gets a picker. 🔴 **A pinned league is
readable by whoever opens the link** — league pages are already public (D44/
D45), so this grants nothing new, but say so out loud in the code and prove it:
a signed-out reader pinned to a league sees the same standings a league page
would show them, and nothing more. Totals come from the same service the board
uses; no second arithmetic.

At `lg` and up the standings sit beside the awards; below that they stack above
them, because on a phone the standings are what you came for.

### T3 — The stream

`/api/live/[abbr]/stream`, Node runtime, SSE. Server polls Postgres every 2s
and writes an event when the state it reads differs from the state it last
sent. Closes itself at ~290s, ahead of the platform's 300s kill. **Every
connection's first frame is complete current state**, not a delta. Add the
`isPublic` entry and pin it in `proxy.test.ts`. Decide deliberately what an
anonymous reader's stream contains, and make the signed-out shape a test.

### T4 — The client, its reconnect, and its stop conditions

One `EventSource`. Reconnects after the server's own close, and re-renders from
the full frame it receives. 🔴 Closes on `visibilitychange` when hidden and
reopens when visible; never opens at all when the show is not on air. Report
the measured connection count for a 10-minute idle tab — the number that says
whether the free tier survives a forgotten monitor.

### T5 — The active award scrolls itself into view, and the winner lands

The active award — the first without a winner — scrolls into view as the
ceremony moves. A winner arriving stamps the seal on its poster.
`prefers-reduced-motion` gets the finished state without the movement, and
without losing the information. 🔴 Never scroll the page under a reader who is
scrolling it themselves: if they have moved, stop following until they return.

### T6 — TV mode is chrome only

A control on the page, and `?tv=1`, hide the top bar and the left rail so a
full-screen browser shows only the room. 🔴 **It changes nothing else** —
same data, same stream, same scrolling, same animation. Prove that with the
same assertions passing in both modes rather than by inspection.

### T7 — The gate

Two clients, an admin marks a winner, the viewer receives it without a reload.
Plus: the signed-out stream carries no seat names; a hidden tab closes its
stream; the page renders at 1920 (the television), 1440 and 390.

**Gate:** a live event works end to end with two concurrent clients, at 1920 in
both schemes, with the stream closing when it should.

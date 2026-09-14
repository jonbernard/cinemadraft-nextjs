# Phase 12 — Parallel run

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Prove the port can carry a real season on the free tier, against real data, before Phase 13 points the apex at it.

**Architecture:** Nothing is built here. Phase 12 is measurement and repair: run the deployed app against a copy of production, walk every capability, put real load on the one path that gets hammered on a single day of the year, and fix what that finds.

**Spec:** `docs/PLAN.md` § Phase 12. **Parity:** `docs/PARITY.md` — 69 ported / **0 deficient** / 15 dropped as of 2026-09-14, so T2 starts from zero known gaps for the first time.

## Global Constraints

- 🔴 **Never point a test run at the owner's database (5432) or at Neon.** `playwright.config.mts` refuses 5432 off-CI; `lib/db.test.ts` refuses 5432 and Neon. Agent environments come from `npm run agent:up <name>`.
- 🔴 **Measure in a production build or against the deployed site**, never `next dev` — a dev server answers 403 for every `_next/static` chunk on `127.0.0.1`.
- 🔴 **A verification step that cannot fail is not verification.** Every measurement states the threshold it would fail at, decided *before* the number is read.
- **Free tier is the constraint, not an aspiration** (D23): Neon Free is 100 CU-hrs/month, Vercel Hobby's function ceiling is 60s (D115).
- One commit per task, message starting `P12.Tn:`.

---

## What is already true, measured 2026-09-14

Recorded so nobody re-measures it and so the thresholds below have a baseline.

| Probe | Result |
|---|---|
| `next.cinemadraft.com` reachable | `/`, `/award-shows`, `/how-it-works` all **200** |
| Deployed build carries tranche 2 | `?tv=1` on a league renders `data-tv-mode` — so **T1 is done** |
| **Cold** `/` (first hit after idle) | **2.98s**, TTFB 2.94s |
| Warm `/` (hits 2–5) | 0.68 / 0.65 / 0.50 / **0.44s** |
| `/leagues/1` (16 seats, picks, ledger) | 1.00 → 0.77 → **0.62s** |
| `/how-it-works` | 0.46s |

🔴 **The cold number is the finding.** Neon Free scales to zero, so the first visitor after an idle period waits ~3 seconds — and the shape of this product is a link pasted into a group chat, which means the *first* visitor is the common case, not the rare one. T3 decides whether that is acceptable or wants a keep-warm.

---

### Task P12.T1: the deploy — **already satisfied, verify and record**

- [ ] **Step 1: Confirm the deployed commit is the current `main`**

```bash
git fetch origin && git log origin/main -1 --oneline
curl -s https://next.cinemadraft.com/ -o /dev/null -w '%{http_code}\n'
```

Then confirm the build is recent in the Vercel dashboard (owner). 🔴 If `main` has moved since the last deploy, redeploy before T2 — a manual pass against a stale build measures nothing.

- [ ] **Step 2: Confirm which database it is pointed at**

Owner, in the Vercel dashboard: Production `DATABASE_URL` must be the **Neon** copy, not anything local. Record the Neon branch name in `docs/PROGRESS.md`'s Phase 12 notes.

🔴 **Check `events.image` before anything else.** Phase 11 wrote twelve Blob URLs into that column and Phase 13's restore will clobber them; if a restore has *already* happened, they are gone now and `/award-shows` renders twelve broken marks. `PLAN.md`'s Phase 13 T3 holds the idempotent SQL to put them back.

---

### Task P12.T2: the capability sweep

**The manual pass, with the mechanical half automated.** `docs/PARITY.md` has 69 ported rows; a human clicking all of them is how rows get skipped. Automate reachability and let the owner judge *quality*.

**Files:** Create `scripts/sweep-deployed.mjs`.

- [ ] **Step 1: Enumerate what must answer**

`e2e/inventory.spec.ts` already enumerates the app's routes and `test/route-protection.ts` holds the public list. Build the sweep from those two rather than a hand-typed list — a hand-typed list is a list that goes stale.

- [ ] **Step 2: Write the sweep**

For every **public** route, against the deployed origin: assert the status is 200 (or a deliberate 404 for `/[...notFound]`), that the HTML contains the page's own `<h1>`, and that it carries no `Application error` or `That did not work` boundary text.

🔴 **Signed-out only.** Do not put a session cookie in a script that hits production — `E2E_TEST_AUTH` must never be enabled there, and the signed-in half is the owner's judgement anyway.

Record each route's TTFB in the same pass; T3 reads it.

- [ ] **Step 3: Run it, and fail it deliberately once**

Point it at a nonexistent path and confirm it reports red. A sweep that reports 69 greens without ever having shown a red is not evidence.

- [ ] **Step 4: The owner's half**

The rows a script cannot judge — does the draft console *feel* right on a call, do the standings read correctly, is the live page legible on the television. Walk `PARITY.md` top to bottom and mark each row pass/fail in `docs/PROGRESS.md`. 🔴 Note the known exception: `e2e/award-shows.spec.ts`'s Blob-logo test reads production-copy data, so it is red against a freshly migrated database and that is not a regression.

---

### Task P12.T3: free-tier headroom

**Gate:** a season's worth of traffic fits inside 100 CU-hrs/month with room to spare, or we know exactly what to change.

- [ ] **Step 1: Read the actual consumption**

Owner, Neon console → the project's **Usage**: compute hours used this month, and the autosuspend setting. Record both in `docs/PROGRESS.md`.

🔴 **The number that matters is not today's — it is a ceremony's.** The live stream polls every 2s per connected viewer (D102) and the function lives 50s per connection (D115). Twenty viewers for three hours is the shape to reason about; the arithmetic is in `docs/superpowers/specs/2026-09-12-realtime-transport.md`, sized against a 300s ceiling that is now 60, so redo it rather than quoting it.

- [ ] **Step 2: Decide the cold-start question**

The measurement above says ~3s cold, ~0.5s warm. **Decide, do not drift:** is a 3s first paint acceptable for a link shared in a group chat? If not, the options are a cron ping (costs CU-hrs, which is the thing being conserved), a longer autosuspend window, or accepting it. Record the decision with its reason — this is exactly the kind of thing that gets silently re-litigated.

- [ ] **Step 3: Runtime Cache**

`lib/external/cache.ts` is the only caching layer and it fronts TMDB, not the database. Measure its hit rate by counting TMDB calls under the T4 load, and state plainly if the answer is "there is no meaningful cache on the database path" — which is what the code currently says.

---

### Task P12.T4: load-test draft-day search

**The one path that gets hammered.** The owner types a title per pick, live, while a dozen people watch; `findFilms` runs local Postgres search plus a TMDB call per keystroke-debounce.

**Files:** Create `scripts/load-search.mjs`.

- [ ] **Step 1: Decide the threshold first**

🔴 Before running anything, write down what failure looks like: p95 under **400ms** for the local-only path, and no 5xx at all. A threshold chosen after seeing the numbers is not a threshold.

- [ ] **Step 2: Write and run the load**

Against a **local production build** on an agent database, not against the deployed site — the deployed site shares Neon Free with whatever else is running and a load test there spends the allowance being measured.

Realistic shape: 4 concurrent "owners", each issuing a debounced query every 400ms for 2 minutes, drawn from real titles in the restored data plus deliberate misses.

- [ ] **Step 3: Report against the threshold, not against a feeling**

p50/p95/p99, error count, and the query count per request from Prisma's log. 🔴 `scoring.batching.test.ts` already pins query counts as equalities — if the load reveals an N+1 the unit suite missed, that is the finding, and it belongs in that file as a new equality.

---

### Task P12.T5: fix what the above found

Open a task per finding rather than one sprawling commit. Anything that turns out to be a defect rather than a tuning question gets a test that fails against the unfixed code, per the tranche-2 standard.

---

## The gate

- [ ] `docs/PARITY.md` — every ported row confirmed on the deployed build
- [ ] Free-tier headroom stated as a number with its ceiling, not "seems fine"
- [ ] Draft-day search inside its stated threshold
- [ ] Every finding either fixed or recorded as accepted, with a reason

🔴 **Phase 13 is gated on this and carries its own hazard**: `PLAN.md`'s T3b — the final Heroku→Neon restore reverts six schema changes this port added, and `nominations.year` reverting to TEXT **fails silently**, scoring every film zero on a site that looks perfectly healthy.

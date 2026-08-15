# Phase 7 — Parity Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure the gap between the source app and the port, exactly, so that cutover is a decision about a closed list rather than a guess.

**Architecture:** Three independent enumerations of the source app — server routes, server controllers, client pages — reconciled into one matrix in `docs/PARITY.md`, where every row carries evidence from both sides and one of three verdicts. Every deficient row becomes a numbered Phase 10 task.

**Tech Stack:** No new dependencies. This phase writes documentation and reads two codebases.

---

## 🔴 What this phase is for

After the priority trio the app is **visibly incomplete**, and the danger is not
that anyone thinks otherwise — it is that "incomplete" stays a feeling instead
of a list. A feeling cannot gate a cutover. Sixty people's leagues, drafts,
reviews and watchlists live in the source app, and the question this phase
answers is the only one that matters on cutover day: *what will someone open
tomorrow that is not there?*

**The audit does not change application code.** Its output is `docs/PARITY.md`
and a set of Phase 10 tasks. If it finds a bug, the bug becomes a row and a
task — the way D47 became one — rather than a fix smuggled into an audit
commit. The single exception is a security finding on the **live Heroku app**,
which is surfaced to the owner immediately rather than filed.

## 🔴 The unit of parity is the capability, not the endpoint

D8 removed the HTTP layer: the port has no `/api` for domain reads, only three
permitted route handlers (webhook, ical, live stream). Auditing
endpoint-for-endpoint would therefore mark the entire application deficient
while being true of nothing.

So each source endpoint, controller function and page is reduced to the
**capability** it delivers to a person — "see a movie's award history", "join a
league by link" — and that capability is what carries a verdict. A capability is
**ported** when a page, service or Server Action in the new app delivers it,
cited by file. Where the port deliberately delivers it differently (a Server
Action rather than a POST, a Server Component rather than a fetch), the row says
so and stays ported.

## The three verdicts, and no fourth

| Verdict | Means | Requires |
|---|---|---|
| **ported** | A person can do this in the new app today | A `path/file.ts` citation in this repo |
| **deficient** | They cannot, and they should be able to | A Phase 10 task id |
| **dropped** | They cannot, and that is intended | One line of why |

🔴 **There is no "partial".** A capability that half works is **deficient** — the
whole point of the matrix is that a green row means someone can be told "yes,
that works". A row that means "mostly" cannot gate anything.

## Global Constraints

- **The source tree is read-only.** `/Users/jonbernard/Development/cinemadraft` is reference. Nothing in this phase writes to it.
- **Every row cites evidence on both sides.** Source `file:line`, and for a ported row the file in this repo that delivers it. A row without a citation is a guess, and a matrix of guesses is worse than no matrix — it would be believed.
- **Counts are recorded in the header of `PARITY.md`** — 19 route files, 71 endpoints, 17 controller modules, 80 page files, 32 captured fixtures — so a later reader can tell whether the source moved underneath the audit.
- **D14** — new features are post-cutover. A capability the source app never had is not a deficiency; it does not belong in this matrix at all.
- **D44** — route visibility is a per-page decision, and the source app was public by default. When a row records a page as ported, it records whether the visibility matches.
- Phase 10's task list lands in `docs/PROGRESS.md`, numbered `P10.Tn`, in the order the matrix implies rather than the order the audit happened to find them.

## File structure

| File | Responsibility |
|---|---|
| `docs/PARITY.md` | The matrix. Sections by surface, a row per capability, counts in the header. |
| `docs/PROGRESS.md` | Phase 7 ticked; Phase 10 filled in with `P10.Tn` derived from the deficient rows. |
| `docs/PLAN.md` | Phase 10's expected-surfaces line reconciled with what the audit actually found. |
| `docs/DECISIONS.md` | Any decision the audit forces — chiefly the capability-not-endpoint rule, and anything the owner is asked to confirm dropped. |
| `scratch/parity/*.md` | The three raw enumerations, kept until the matrix is written, then deleted. Working notes, not deliverables. |

---

## Task 1: Enumerate the server routes

**Files:** `scratch/parity/routes.md`

Source: `server/routes/` — 19 files, 71 `router.<verb>` registrations, plus
`server/routes/movie/` which splits across five files.

- [ ] **Step 1: One row per endpoint.** Method, path as mounted (not as declared — `index.js` mounts each router under a prefix, and the declared path is relative), the handler it calls, whether `requireUser` is applied, and the source line.

- [ ] **Step 2: Say what it does in one sentence,** in terms of the person using it, not the SQL. "Every award a film was nominated for" beats "joins nominations to awards".

- [ ] **Step 3: 🔴 Mark the ones with a captured fixture.** `fixtures/*.path` holds 32 real captured responses; an endpoint with one has a shape contract the port can be checked against, and an endpoint without one is a place where a differently-nested return would go unnoticed (spec §13). This column is what tells Phase 10 which rows need a fixture captured before they are ported.

- [ ] **Step 4: Record the auth guard as written, not as intended.** `requireUser` present or absent is a fact about the row; whether it *should* be is a D44 question the classification answers.

- [ ] **Step 5: Commit.**

---

## Task 2: Enumerate the server controllers

**Files:** `scratch/parity/controllers.md`

Source: `server/controllers/` — 17 modules, one of which is a barrel.

- [ ] **Step 1: One row per exported function.** Module, export name, the tables it reads or writes, and the source line.

- [ ] **Step 2: Note every function no route reaches.** A controller export with no caller is dead code in the source and must not become a task in the port — but it must be *seen* to be dead rather than assumed, so the row records which route calls it or says "no caller".

- [ ] **Step 3: 🔴 Note anything that returns a shape the port renamed.** `awards.points` is a foreign key into `points.id` and the port exposes it as `pointsId` — that rename is recorded in DECISIONS and any similar case found here must be recorded too. A silent rename is how a scoring bug ships.

- [ ] **Step 4: Commit.**

---

## Task 3: Enumerate the client pages

**Files:** `scratch/parity/pages.md`

Source: `src/routes/index.js` (the route table) and `src/pages/` — 80 files
across roughly 20 page directories.

- [ ] **Step 1: One row per *route*, not per file.** The route table is the list of things a person can navigate to; a `components/` directory under a page is implementation. Record the URL, the page module, and whether it sits behind `AuthGuard`.

- [ ] **Step 2: List what the page actually shows,** by reading it — the panels, tables and actions on it. This is the column the classification is made from, because a page is ported when its *contents* exist, not when its URL resolves.

- [ ] **Step 3: 🔴 Record the visibility as the source app had it (D44).** The source was public by default and only guarded pages about *you*. A page the port made private that the source did not is a parity regression and gets a row, exactly as it would if it were missing.

- [ ] **Step 4: Commit.**

---

## Task 4: Classify

**Files:** `scratch/parity/classified.md`

- [ ] **Step 1: Reduce the three enumerations to one list of capabilities.** Several endpoints and one page often deliver one capability; that is one row. The matrix is read by a person deciding whether to cut over, not by a compiler.

- [ ] **Step 2: For each, check this repo before deciding.** `grep` for the service, page or action that would deliver it. A verdict from memory is a guess — this is the step where the phase either earns the matrix or invents it.

- [ ] **Step 3: 🔴 Assign exactly one of the three verdicts.** No "partial", no "mostly". If it half works it is deficient.

- [ ] **Step 4: Every dropped row gets its one-line reason,** and any drop the owner has not already decided is flagged for review rather than settled here. Dropping something sixty people use is the owner's call, not the auditor's.

- [ ] **Step 5: Commit.**

---

## Task 5: Write `docs/PARITY.md`

- [ ] **Step 1: Header carries the counts and the date,** so drift is detectable: 19 route files / 71 endpoints / 17 controllers / 80 page files / 32 fixtures, and the source commit the audit read.

- [ ] **Step 2: Group by surface, not by source file** — films, leagues, draft, events and live, reviews, users and profiles, watchlist and lists, notifications, admin, auth. That is the order someone thinks in when asking "is it ready".

- [ ] **Step 3: Deficient rows carry their Phase 10 task id.** The matrix and the task list are the same list seen twice; if they can disagree, they will.

- [ ] **Step 4: A summary line at the top** — how many ported, deficient, dropped. That number is the answer to "how far are we", and it is the only place it exists.

- [ ] **Step 5: Commit.**

---

## Task 6: Decompose into Phase 10

**Files:** `docs/PROGRESS.md`, `docs/PLAN.md`

- [ ] **Step 1: One `P10.Tn` per deficient row,** ordered by what the league needs first, not by the order the audit found them.

- [ ] **Step 2: Reconcile `PLAN.md`'s expected-surfaces line for Phase 10** with what the audit actually found. It was written before the audit and names its surfaces from memory; where the audit disagrees, the audit is right.

- [ ] **Step 3: Tick P7.T1–T6 in `PROGRESS.md`** and write the what-the-next-phase-needs-to-know notes.

- [ ] **Step 4: Record the decisions this phase forced in `DECISIONS.md`** — at minimum the capability-not-endpoint rule, which is the one that makes the matrix mean anything.

- [ ] **Step 5: Delete `scratch/parity/`.** The enumerations were working notes; `PARITY.md` is the deliverable, and two copies of a list that can disagree is exactly the failure this phase exists to prevent.

- [ ] **Step 6: Commit, and put the matrix in front of the owner.** 🔴 **The gate is the owner's review, not the file's existence.** Cutover is blocked while any row is open.

---

## Notes for the executor

- **Read both trees. Do not remember either.** The whole value of this document is that it is checked rather than recalled.
- **The three enumerations are independent and should run in parallel** — they read different directories and share nothing until Task 4.
- **A capability the source app never had is not a deficiency** (D14). It is a Phase 15 idea, and it does not belong in this matrix.
- **If the audit finds a live security bug**, tell the owner the same day. D47 is still live on Heroku; a second one would be too.

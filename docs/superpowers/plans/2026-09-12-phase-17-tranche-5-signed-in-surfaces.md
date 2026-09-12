# Phase 17 — Tranche 5: Signed-in surfaces

Covers **P17.T27–P17.T36** (the "Signed-in surfaces" group) plus **P17.T26**, the
phase's closing task, which records the decision ledger for all five tranches.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the half of the product that only a signed-in member ever sees
hold the same standard as the public half — a 404 that keeps the application
around it, an admin action that cannot re-scope the product by accident, a home
page that is about the reader, a league page whose controls are controls, one
left edge per column, and type and colour that inherit tranche 4's system
rather than forking a second one. Then record the phase's decisions.

**Architecture:** Ten surface tasks over pages that already exist, plus one
decision task and one ledger task. Nothing here adds a service, a repository or
a dependency. Three tasks (T33, T34, T35) are deliberately *not* new systems —
they are the signed-in half of work tranche 4 owns, and their job is to inherit
it and prove it arrived. Two tasks (T27, T36) are structural and fix a class of
defect rather than an instance.

**Tech Stack:** Next 16 App Router, React 19, TypeScript strict, Prisma,
Tailwind 4 + MUI, Vitest + Testing Library, Playwright, Storybook 10.

**Spec:** `docs/PLAN.md` § Phase 17 → "Signed-in surfaces" and "Recording the
decisions"; `docs/PROGRESS.md` § Phase 17 carries the same list with the decided
detail. The design review of 2026-09-12 is the artifact of record for the
reasoning — 5,744 text elements measured across six signed-in routes, against
1,272 on the public ones, signed in with the `E2E_TEST_AUTH` cookie against the
restored production database (a complete 18-member league, 1,020 picks, an
active 4-seat draft). Both earlier reviews carried "signed-in surfaces
unmeasured" as a caveat; this closed it.

### 🔴 The review's numbers are claims to reproduce, not targets

Every figure quoted in this plan comes from that review, and **the review does
not record how it measured.** At least one of its numbers does not survive
contact with the code:

- It reports **320 brass instances, all on the draft board**. A source grep of
  `app/` and `components/` finds **11** brass class references in total, and
  neither `DraftBoard.tsx` nor `DraftConsole.tsx` is among them. Task 1 exists to
  resolve that, and it is written as *measure, then decide* rather than as
  *implement the conclusion*.
- The 2026-09-12 baseline in `docs/PROGRESS.md` is not internally consistent
  either: it reports 1,272 visible text elements while its own font histogram
  sums to 1,312, and it does not say how either was taken.

So treat the rest the same way. **88% of signed-in text at 12px (5,065 of
5,744)** and **`text-dim` 3,349 against `text-primary` 920** are from the same
source and deserve the same caution. Tranche 4 is treating its own harness's
pre-sweep run as the authoritative before-number and recording both; T33 and T34
below do the same.

The rule for this tranche: **before any number becomes a target, re-measure it
with a stated method, and record the method beside the number.** A source grep
and a rendered-element count are different measurements of different things, and
a component inside a loop turns one into the other. Where your number disagrees
with the review's, that is a finding — report it, do not quietly adopt either.

---

## 🔴 Two screens this phase does not touch

**The draft console (`app/(app)/leagues/[id]/draft/page.tsx`,
`components/DraftConsole.tsx`) and the watchlist
(`app/(app)/watchlist/page.tsx`, `components/SeenMeter.tsx`,
`components/WatchedToggle.tsx`) are out of scope.**

They are the best-designed screens in the product. They **inherit tokens and
nothing else**: when tranche 4 renames a surface class or moves the body size,
those files change with every other file in the sweep, and that is the only
reason either of them may appear in a diff from this phase.

Concretely, in this tranche:

- No task below lists either file under **Files**. If you find yourself editing
  one, stop — you have misread the task.
- T34's `dim → secondary` audit **excludes both screens.** Their use of `dim`
  was reviewed and is deliberate.
- T35 finds one genuinely off-label brass use, and it is `SeenMeter` on the
  watchlist. T35 **records** it and does not change it. See T35, step 6.

If a later phase wants to redesign either screen, it needs its own task and its
own owner's decision. Not this one.

---

## What this tranche does not own

Phase 17 is being planned and executed as five tranches **in parallel**. You are
tranche 5. Read this before your first edit.

**1. The boundary.** Four other tranches are live in this repo:

| Tranche | Tasks | Owns |
|---|---|---|
| 1 — Product and structure | T0–T7 | `proxy.ts`, `components/SectionHead.tsx`, `components/AppShell.tsx` breakpoints + tab bar, `components/SeasonStepper.tsx`, `components/LeaderboardTable.tsx`, the signed-out lede, `/browse` URL cursor, draft console `assign` |
| 2 — Accessibility and correctness | T8–T10 | the a11y batch (skip link in `AppShell`, `/browse` poster links, sidebar focus rings, theme toggle), Clerk appearance contrast + `theme/contrast.test.ts`, `/films/[tmdbId]` overflow |
| 3 — Visual | T11–T17 | roster posters on `app/(app)/page.tsx`, award-show marks, film detail lockup, `components/NavRail.tsx`, the winner seal, the new `/live/[abbr]` route, LCP priority |
| 4 — Type and colour system | T18–T25 | body size 15/13, poster captions to serif, `beam`, brass's *spend*, the surface rename, 40px section spacing, 4px-grid enforcement in `scripts/layering.sh`, radius |
| **5 — Signed-in surfaces** | **T26–T36** | **yours** |

**2. The shared files.** Tranche 4's T18 size sweep touches **75 of 181** `.tsx`
files under `app/` and `components/`; its T22 surface rename touches **58**.
`app/(app)/page.tsx` is edited by tranche 1 (T1/T4/T5), tranche 3 (T11/T17) and
your T29/T31. `components/AppShell.tsx` is edited by tranche 1 (T2) and tranche
2 (T8), and your T32 needs one label in it.

Before you edit any of those files:

```bash
git log --oneline -15 -- <the file>     # has another tranche already landed here?
git status --porcelain                  # is anything of yours uncommitted in it?
```

Then rebase onto `main` before you start, and again before you commit. If your
edit and another tranche's are in the same JSX block, take the smallest change
that achieves your task, keep it in one hunk, and name the other tranche in the
commit body.

**3. The rule.** **Do not opportunistically fix something another tranche owns**
— not a stray `text-sm`, not a `bg-bg-raised`, not a 6px gap, not a `rounded-md`
that should be `rounded-sm`. It will be right there and it will be obviously
wrong. Tranche 4 sweeps it deliberately, and T22's verification is a
**screenshot diff that must come back zero** — a partial early fix makes that
unreadable and costs someone a day proving your change was the harmless one. If
a task genuinely cannot be completed without crossing the line, cross it, and
say so in the commit message: `crosses into T18's sweep: <file>:<line>, because
<reason>`.

**4. The known entanglements, which land hardest on you.**

- **T33 and T34 are the signed-in half of tranche 4's sweeps.** They **inherit**
  and must not fork a second, differently-decided pass. What they inherit, and
  from where, is written out in full at the top of each task. Both run *after*
  tranche 4's T18 and T22 have landed on `main`. If they have not, stop and say
  so — running T33 first produces two body scales and there is no clean way back.
- **T35 decides what brass means, and it is a blocker.** Tranche 4's T21 and
  Phase 18's P18.T6 are both waiting on it. It runs **first** in this tranche
  for that reason, and it writes its D-row immediately rather than waiting for
  T26, so the other tranches can read it. 🔴 **It is a measurement task before it
  is a decision task.** The review's "brass already means drafted in 320 places
  on the draft board" does not reproduce against the source, so T35 re-measures
  three ways and decides on whatever it finds — and "brass has no second meaning,
  T21 proceeds as written" is one of the permitted outcomes. Whoever runs T35
  must report the outcome to the blocked tranches explicitly; silence is not a
  green light.
- **T26 collects the D85+ entries from every tranche**, so it runs **last** and
  depends on all four others having made their decisions. It records what the
  tranches actually decided, not what anyone predicted on 2026-09-12.

**5. The two screens that are off limits** — the draft console and the watchlist
— are a boundary, not a note. See the section above this one.

**6. If tranches run concurrently.** Take your own `git worktree` (see
`superpowers:using-git-worktrees`), your own port, and never reuse a dev server
you did not start yourself. Today a running agent measured *another agent's* dev
server on port 3000 and nearly recorded a clean baseline for broken code. Set
your port explicitly on every run:

```bash
PORT=3105 npm run dev            # tranche 5's port. Not 3000.
```

The DB-backed vitest project is **serial by design**: one Postgres on 5433, and
`available_years_one_active` is a global partial unique index with no per-worker
copy. Two suites racing it fail about one run in three. Do not run `npm run
test:ci` or `npm run test:e2e` while another tranche is running one. Coordinate,
or wait.

---

## Global Constraints

- **Biome, not ESLint or Prettier.** `npm run lint` covers linting, formatting
  and import order; `npm run typecheck` is separate.
- **MUI for components, Tailwind for custom styling**, coexisting through CSS
  cascade layers ordered `theme, base, mui, components, utilities`. Never
  `!important`. Three Playwright tests in `e2e/smoke.spec.ts` pin this — do not
  relax them.
- **All local databases run in Docker** — `npm run db:up` before anything that
  touches the database. There is no native Postgres on the dev machine.
- 🔴 **The database on port 5433 is a restored copy of production.** League 1 is
  sixty real people's history and `lib/db.test.ts` asserts exact row counts.
  **Every step in this plan that needs data creates a scratch league, prefixed
  `e2e-p17`, and deletes it in `afterAll`.** Reading league 1 is allowed (three
  existing specs do, behind `skipWithoutRestoredCorpus()`); writing to it is
  not, ever.
- **Never regenerate `package-lock.json` on macOS.** `npm install <pkg>` to
  update `package.json`, then `npm run lock` before committing.
- **`fixtures/` is generated.** Never hand-edit it.
- **Every new surface is built from the Phase 3.5 primitives** — `SectionHead`,
  `Panel`, `Shelf`, `Button`, `StatusChip`, `Eyebrow`, `CinemaFrame`,
  `PosterFrame` — and carries a Storybook story. No hairline card border, no
  all-caps heading outside `Eyebrow`, no squared or pill button, no
  machine-formatted date. `LetterboxRule`, `font-display` and the Archivo `wdth`
  axis no longer exist (D69–D77).
- **No raw hex outside the token system.** `scripts/layering.sh` greps for it.
- **The repository layer is the only code allowed to touch Prisma**, and
  `components/` may not import from `lib/services/` (D33).
- **`data-testid` is the only test handle** (D66), stripped from production
  unless `KEEP_TEST_IDS=1`. Assertions still go through roles and accessible
  names.
- **Touch targets ≥44px**, focus rings never removed, colour never the only
  carrier of state, every animation has a `prefers-reduced-motion` path.
- **One commit per task**, message starting with the task ID (`P17.T30: ...`).
  Do **not** tick `docs/PROGRESS.md` — the phase owner is indexing it centrally.
- **`npm run verify` before pushing** — lint, typecheck, layering, both test
  suites, build.

### The gate, and where assertions live

The phase gate requires **every item verified in a browser at 1440 / 1280 / 1024
/ 390px in both schemes**. That is a human pass with a browser, and it is not
optional.

🔴 **Where a fix cannot be pinned by a component test, say so and put the
assertion in Playwright.** jsdom has no layout: `getBoundingClientRect` returns
zeros, no media query resolves, and `getComputedStyle` returns the inline value
rather than the cascaded one. Three defects have already shipped in this repo
with green tests over them because no test set a narrow width or asserted
geometry. Every task below states, per fix, which suite pins it. The rule:

- **Vitest/RTL** pins *what is on the page* — an element exists, has this
  accessible name, this role, this `aria-` state, this class token.
- **Playwright** pins *where it is and what it looks like* — a viewport width, a
  `boundingBox()`, a `getComputedStyle` read, a colour scheme, a scroll extent.
- A class-name assertion in RTL (`expect(el.className).toMatch(/min-h-11/)`) is
  a **proxy**, not a proof. Use it only where a browser test would be
  disproportionate, and never for anything measured in the review.

`e2e/support/session.ts`'s `signInAs(page, { email })` seeds a user row and puts
a signed test cookie in the browser jar — no Clerk (D82/D84). That is how every
signed-in measurement in this plan is taken.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `app/(app)/[...notFound]/page.tsx` | Catch-all that pulls every unmatched URL inside the app shell, so the group's `not-found.tsx` is what renders |
| `components/SeasonControl.test.tsx` | The confirmation gate on the active-season switch |
| `components/InviteAction.tsx` | The invite link behind a disclosure, replacing a raw URL printed on the page |
| `components/InviteAction.stories.tsx` | Its Storybook story (Phase 3.5 gate) |
| `components/InviteAction.test.tsx` | Its tests |
| `e2e/signed-in.spec.ts` | The tranche's browser gate: 404 in the shell, admin confirmation, home hierarchy, league hierarchy, left edges, type floor |

**Modified**

| File | Change |
|---|---|
| `components/ErrorPanel.tsx` | Stops rendering `<main>`; centres in whatever column it is given |
| `app/not-found.tsx`, `app/error.tsx` | Wrap `ErrorPanel` in the `<main>` it no longer renders (these two are outside the shell) |
| `app/(app)/not-found.tsx`, `app/(app)/error.tsx` | Docstrings only — the shell already supplies `<main>` |
| `components/ErrorPanel.test.tsx` | Two `getByRole('main')` reads move off the removed landmark |
| `components/SeasonControl.tsx` | One selection control plus a gated, blast-radius-naming confirm; `/admin/broadcast` is the model |
| `app/(app)/admin/season/page.tsx` | Passes the user count so the confirmation names a real number |
| `app/(app)/admin/page.tsx` | Marks the entry that re-scopes the product so the index is not a flat settings list |
| `components/AppShell.tsx` | One label: the strip's action matches `/leagues` |
| `app/(app)/leagues/page.tsx` | One label for one action |
| `app/(app)/leagues/[id]/page.tsx` | Owner actions become controls; invite moves behind `InviteAction` and disappears on a complete season; the viewer's own roster fills the column beside Standings |
| `app/(app)/page.tsx` | The member's own state moves above the season rail and the shelf |
| `app/(app)/list/page.tsx` | Drops the redundant `Panel`, which is the second of three left edges |
| `components/PickCell.tsx` | `text-[0.65rem]` joins the scale |
| `components/DraftListEditor.tsx`, `components/FilmSearch.tsx` | `text-[0.6rem]` joins the scale |
| `components/PointsLedger.tsx`, `components/DraftBoard.tsx`, `components/StandingsPanel.tsx` | `dim → secondary` where the token carries content |
| `scripts/layering.sh` | One grep: no arbitrary font size outside the three sanctioned literals |
| `docs/DECISIONS.md` | D85 (T35), then D86–D97 (T26) |

---

## Task order, and why

1. **T35 — re-measure brass, then decide what it means.** First, because tranche
   4's T21 and Phase 18's P18.T6 are both blocked on it. It is a measurement and
   a decision, not a build, so it is cheap and it unblocks two other agents on
   day one — in whichever direction the numbers point.
2. **T27 — 404 inside the shell.** Self-contained, structural, touches no file
   another tranche owns except `components/ErrorPanel.tsx` (nobody else's).
3. **T28 — `/admin/season` confirms.** Safety-bearing, gets its own reviewer
   pass. Early, so the review is not queued behind nine other tasks.
4. **T32 — one label, and mark the admin section.** Shares `app/(app)/admin/`
   with T28; do it while that page is in your head.
5. **T36 — one left edge per column.** Structural, independent, and it
   establishes the container rule the page tasks then obey.
6. **T30 — league page hierarchy.**
7. **T31 — roster beside standings.** Same file as T30, so consecutive.
8. **T29 — signed-in home.** The heaviest collision file in the phase
   (`app/(app)/page.tsx`, edited by tranches 1 and 3). Last of the page work, so
   it rebases onto their finished versions rather than racing them.
9. **T33 — signed-in type.** After tranche 4's T18 has landed.
10. **T34 — `text-dim` audit.** After tranche 4's T22 has landed.
11. **T26 — record the phase's decisions, D86 onwards.** Last. It collects what the other four tranches
    actually decided.

---

## Task 1 (P17.T35): Re-measure brass, then decide what it means

**Files:**
- Modify: `docs/DECISIONS.md` (adds **D85**)
- Modify: `components/SeenMeter.tsx` — **docstring only, and only if step 5's
  outcome calls for it**
- Test: no code ships from the decision itself. Steps 1–3 are the measurement,
  and they are the check.

**Interfaces:**
- Consumes: nothing.
- Produces: **D85**, which tranche 4's T21 and Phase 18's P18.T6 both read
  before spending brass. T26 later verifies D85 is present and starts its own
  block at D86.

### 🔴 Do not implement a conclusion. Measure, then decide.

The 2026-09-12 signed-in review reports **320 brass instances, all on the draft
board**, and reads them as brass having acquired a second meaning — "drafted" —
alongside the awards meaning D69 assigned it. That reading is the stated blocker
on tranche 4's T21 and on P18.T6.

**The figure does not reproduce, and nobody yet knows why.** The agent planning
tranche 4 grepped `app/` and `components/` on `main` and found **11** brass
class references in total, with **none in `DraftBoard.tsx` or
`DraftConsole.tsx`**. Two explanations are live and they lead to different
decisions:

- The review counted **rendered elements**, and a source grep counts **source
  sites**. Those are different measurements of different things, and a component
  rendered inside a loop multiplies one into the other. `PickCell` embeds a
  `PointsLedger` under every pick's score (`PickCell.tsx:78`), and
  `PointsLedger.tsx:111` renders `<StatusChip tone="brass">Won</StatusChip>` per
  winning nomination line — so a board with 1,020 picks and twelve award bodies
  could plausibly render hundreds of brass chips from **one** source site that
  no grep of `DraftBoard.tsx` would ever find.
- Or the review counted inherited CSS custom properties per element, which
  inflates a token defined once on an ancestor into a count per descendant.
- Or it measured a tree that is not `main` today.

**The review does not say which measurement it used.** So this task's
deliverable is a decision *and the method that produced it*, in that order.
🔴 **"Brass has no second meaning; T21 proceeds as written" is a permitted
outcome, not a surprise.** So is "it does, and here is the split". Write down
whichever the numbers give you.

### Context an implementer needs

Read the code before you read the review. Every brass render in the product
originates at one of these, and this list is itself a claim to verify in step 1:

| Site | What it marks | Reached from |
|---|---|---|
| `components/PointsLedger.tsx:111` | `<StatusChip tone="brass">Won</StatusChip>` | every pick on the draft board, every film's score panel |
| `components/NomineeGrid.tsx:57` | the winner on an award show | `/award-shows/[abbr]` |
| `components/CategoryAdmin.tsx:218` | the winner in award-entry admin | `/admin` flows |
| `app/(app)/award-shows/[abbr]/page.tsx:185` | the winner chip | `/award-shows/[abbr]` |
| `components/SeenMeter.tsx:30` | a brass `<progress>` bar — *how many films you have seen* | `/watchlist` |
| `components/GroupCeremony.tsx:195,223,300` | the randomisation takeover's headings and confetti palette | season setup |

Plus two opt-in tone props currently unused off the award surfaces: `Eyebrow`'s
`tone="brass"` and `Button`'s `accent="brass"` — whose own docstring already
says "`brass` is awards — anything about a nomination or a win. A brass 'Delete
league' or a carmine 'Winner' is a bug."

What `DraftBoard` and `PickCell` use for their own marks, which is the other
half of the question and is cheap to check: `PickCell` sets the round badge and
the initials placeholder in `text-dim` and the title in `text-primary`;
`DraftBoard` marks the viewer's own seat in **carmine**
(`border-l-accent-fill`, `DraftBoard.tsx:89,178`) and an unclaimed seat with
`StatusChip tone="neutral"`.

D69 is the standard the answer is measured against: *"brass for awards, carmine
for urgency. Brass carries nominations, wins, seals and eyebrows."* Giving one
token two meanings is the exact fault D69 split the two accents to fix — which
is why this is worth measuring properly rather than settling by impression in
either direction.

### Steps

- [ ] **Step 1: Count the source sites, and say that is what you counted**

```bash
cd /Users/jonbernard/Development/cinemadraft-nextjs
git rev-parse --short HEAD

echo "--- brass CLASS references (what a grep of the source finds) ---"
grep -rnE "brass" components app --include='*.tsx' \
  | grep -v '\.stories\.' | grep -v '\.test\.' | grep -vE '^\S+: *\*'

echo "--- brass TONE usages (call sites that ask a primitive for brass) ---"
grep -rnE 'tone="brass"|accent="brass"' components app --include='*.tsx' \
  | grep -v '\.stories\.' | grep -v '\.test\.'
```

Record both numbers **with the method beside each**: "N brass class references
in source", "M `tone=\"brass\"` call sites". Note explicitly whether
`DraftBoard.tsx` or `DraftConsole.tsx` appears in either list.

- [ ] **Step 2: Count the rendered elements, on a real board, with a stated method**

A source grep and a rendered-element count are different measurements. Take the
second one too, because it is the one the review's 320 most likely is.

```bash
npm run db:up
PORT=3105 E2E_TEST_AUTH=1 npm run dev
```

Sign in with the test cookie, open `/leagues/1` — **read-only; league 1 is sixty
real people's history and nothing here writes** — and run all three counts in the
console:

```js
({
  // (a) elements carrying a brass utility class
  byClass: document.querySelectorAll('[class*="brass"]').length,

  // (b) elements whose own computed background or colour resolves to the brass
  //     token — catches anything reaching it through a CSS variable
  byComputed: (() => {
    const brass = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-brass-fill').trim();
    const norm = (s) => s.replace(/\s/g, '').toLowerCase();
    return [...document.querySelectorAll('*')].filter((n) => {
      const s = getComputedStyle(n);
      return norm(s.backgroundColor) === norm(brass) || norm(s.color) === norm(brass);
    }).length;
  })(),

  // (c) what those elements actually SAY — the meaning, not the count
  words: [...document.querySelectorAll('[class*="brass"]')]
    .map((n) => n.textContent.trim())
    .reduce((a, t) => (a[t] = (a[t] ?? 0) + 1, a), {}),
})
```

🔴 **(b) will not equal (a), and the gap is the point.** A count that walks every
element and compares a computed value inflates a token inherited from an
ancestor into one hit per descendant — which is the most likely way a product
with 11 source sites produces a figure like 320. If (b) is hundreds while (a) is
tens, say so: the review's number is a measurement artifact and the "second
meaning" reading rests on it.

Record all three, the commit you measured, the route, and the viewport. Repeat
on `/award-shows/<abbr>` and `/watchlist` so the draft board's share is a share
of something.

- [ ] **Step 3: Read what the brass elements say**

The histogram from (c) is the decision's real input. A token's meaning is the
set of things it marks, not how many of them there are.

- If every key is `Won` (or `Winner`), brass is marking **award outcomes** and
  the draft board is simply where the ledgers live. The count follows the
  ledgers, not the picks.
- If a key is a film title, a round number, a seat name or anything else that
  says "this was drafted", brass has genuinely acquired a second meaning.
- `SeenMeter`'s bar has no text at all, so it will not appear in (c). Check it
  by hand on `/watchlist`: a brass progress bar for "films you have seen" is not
  an award outcome by any reading.

- [ ] **Step 4: Write the decision that the numbers support**

Exactly one of these three. Fill in the real numbers and the real method
wherever the text says so — a row that cites a figure nobody can reproduce is
how this task came to exist.

**Outcome A — the count is a measurement artifact and brass has one meaning.**
Expected if (c)'s only keys are `Won`/`Winner`. **T21 and P18.T6 proceed as
written.**

```markdown
| D85 | **Brass means an award outcome — a nomination, a win, a winner's seal, an awards eyebrow. It does not mean "drafted", and D69 is unchanged.** The 2026-09-12 signed-in review reported 320 brass instances on the draft board and read them as a second meaning, which would have been the exact fault D69 split carmine and brass to fix. Re-measured at `<commit>`, with the method stated because the review's was not: `<N>` brass class references in source, `<M>` `tone="brass"` call sites, `<A>` elements carrying a brass class on `/leagues/1` and `<B>` by computed value — the gap between the last two is inherited custom properties counted per descendant, which is how 11 source sites become a figure in the hundreds. What those elements **say** is the decision: `<histogram>`. They are `<StatusChip tone="brass">Won</StatusChip>` from `components/PointsLedger.tsx:111`, one per winning nomination line, and the board embeds a ledger under every pick's score — so the count follows the ledgers, not the picks. Nothing on the board colours a pick brass for being a pick: `PickCell` uses `text-dim` and `text-primary`, and `DraftBoard` marks the viewer's own seat in **carmine**. 🔴 **P17.T21 and P18.T6 are therefore unblocked** and spending brass as the awards accent on How-it-works is the *same* meaning reaching a public page, not a second one. Two consequences bind: the permitted brass call sites are `PointsLedger`, `NomineeGrid`, `CategoryAdmin`, the award-show page and `Eyebrow`/`Button`'s opt-in tone — a new one needs a reason in review; and **`components/SeenMeter.tsx:30` is the one off-label use in the product** — a brass progress bar for "films you have seen", which is not an award outcome. It is on the watchlist, which Phase 17 may not redesign, so it stands, recorded, until a phase owns that screen |
```

**Outcome B — brass genuinely marks picks as well as awards.** Expected if (c)
carries film titles, rounds or seat names. Then D69's fault has recurred and the
row must **split the meanings and say which token takes which job**, naming the
call sites that move and blocking T21/P18.T6 until they have:

```markdown
| D85 | **Brass means an award outcome only; `<the token you choose>` takes the "drafted" mark.** Re-measured at `<commit>` with the method stated: `<N>` source sites, `<A>`/`<B>` rendered, and the histogram shows `<the non-award words>` — so brass is marking picks as well as wins, which is the fault D69 split carmine and brass to fix, recurring. `<Which call sites move, and to what.>` 🔴 **P17.T21 and P18.T6 stay blocked until those call sites have moved**, because spending brass as the public awards accent while it also marks picks would publish the ambiguity rather than resolve it |
```

**Outcome C — the numbers are irreconcilable.** If (a), (b) and (c) do not add
up to a coherent story — the histogram is empty, or the draft board shows no
brass at all on a board that has wins — **do not write a row.** Report the three
numbers, the commit, and what you expected, and hand it to the phase owner. A
D-row is permanent and locked; an invented one is worse than a missing one.
🔴 Say plainly, in the same report, that **T21 and P18.T6 are still blocked**,
so nobody reads silence as a green light.

- [ ] **Step 5: Write it into `docs/DECISIONS.md`**

Append immediately after the `D84` row, keeping the table's shape. Then:

```bash
grep -n "^| D85 " docs/DECISIONS.md
grep -c "^| D8[6-9] \|^| D9" docs/DECISIONS.md
```

Expected: exactly one `D85` row, and `0` rows after it — T26 adds those, and it
starts at D86 because this task takes D85 on purpose, early, so the tranches
blocked on it can move.

- [ ] **Step 6: Correct `SeenMeter`'s docstring — only under outcome A or B**

Its comment currently justifies brass by elimination ("Brass rather than carmine
— carmine marks *this one*"), which is not a reason. If the decision names it as
off-label, replace only that sentence so the next reader finds the decision
rather than re-deriving it:

```tsx
 * 🔴 The brass fill is the one off-label use of that token in the product
 * (D85): brass means an award outcome, and "how many films you have seen" is
 * not one. Recorded rather than changed — this screen is out of scope for the
 * phase that found it, and the fix is a one-class swap whenever a phase owns
 * the watchlist.
```

🔴 **The pixels do not change.** The watchlist is off limits to this phase, and
a colour change there is a redesign, not an inherited token.

- [ ] **Step 7: Verify nothing rendered changed**

```bash
npm run lint && npm run typecheck && npm run test
```

Expected: green, with a diff of one comment and one ledger row. If a component
test moves, you edited more than the comment.

- [ ] **Step 8: Tell the blocked tranches, explicitly**

Tranche 4's T21 and Phase 18's P18.T6 are waiting on this and cannot read your
console. Report, in one line each: the outcome letter, the three counts with
their methods, and **whether T21 and P18.T6 may proceed**. Under outcome C the
answer is "no, still blocked" — say it, rather than reporting numbers and
leaving the conclusion to be inferred.

- [ ] **Step 9: Commit**

```bash
git add docs/DECISIONS.md components/SeenMeter.tsx
git commit -m "P17.T35: re-measure brass, then decide what it means

The review's '320 brass instances on the draft board' did not reproduce: a
source grep finds <N> brass class references and none in DraftBoard.tsx.
Re-measured three ways at this commit, with the method recorded beside each
number, because the review did not state its own: <a>/<b>/<c>.

Decision: <outcome, in one line>. T21 and P18.T6 <proceed | stay blocked>.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

## Task 2 (P17.T27): A 404 that keeps the application around it

**Files:**
- Create: `app/(app)/[...notFound]/page.tsx`
- Modify: `components/ErrorPanel.tsx:73-101`
- Modify: `app/not-found.tsx`, `app/error.tsx:34`
- Modify: `app/(app)/not-found.tsx`, `app/(app)/error.tsx` (docstrings)
- Test: `components/ErrorPanel.test.tsx:56-73` (two reads move), `e2e/errors.spec.ts` (add)

**Interfaces:**
- Consumes: `ErrorPanel` from `components/ErrorPanel.tsx`, unchanged signature
  `{ kind?: ErrorKind; onRetry?: () => void; className?: string }`.
- Produces: `ErrorPanel` renders a `<div>` rather than a `<main>`. Every caller
  **outside** the app shell now supplies its own `<main>`; every caller inside
  it relies on `AppShell`'s single `Panel as="main"`.

### Context an implementer needs

`app/(app)/not-found.tsx` already exists and its docstring already claims to fix
this. It does not fire for `/live` or `/members`, and the reason is Next's
resolution order rather than a bug in that file:

- A group's `not-found.tsx` is reached when a page **inside that group** calls
  `notFound()`. `/leagues/999999` does that, which is why
  `e2e/errors.spec.ts`'s existing "keeps the navigation" test passes.
- A URL that matches **no route at all** is answered by the **root**
  `app/not-found.tsx`, which sits outside `(app)` and renders under
  `app/layout.tsx` alone — no rail, no tab bar, no strip.
- `app/(app)/live/` and `app/(app)/members/` each contain only a dynamic child
  (`[abbr]/.gitkeep`, `[uuid]/page.tsx`) and no `page.tsx`, so `/live` and
  `/members` match nothing and land on the bare root page with one link back.

So the fix is not to duplicate the shell into the root file. It is to make
unmatched URLs *match something inside the group*: a catch-all page that does
nothing but call `notFound()`. Five lines, one file, and it fixes every mistyped
URL at once rather than the two the review happened to try.

`[...notFound]` is non-optional on purpose: an optional catch-all
(`[[...notFound]]`) also matches `/`, which would shadow the dashboard. Static
and dynamic segments both beat a catch-all in Next's route ranking, so
`/leagues/1`, `/auth/login` and `/api/*` are unaffected — the e2e run proves it.

🔴 **Rendering the panel inside the shell exposes a nested landmark.**
`ErrorPanel` renders `<main>` (`ErrorPanel.tsx:73`) and `AppShell` renders the
app's only content landmark as `Panel as="main"` (`AppShell.tsx:~126`). So
`app/(app)/not-found.tsx` and `app/(app)/error.tsx` have *already* been
producing `<main>` inside `<main>` whenever a page in the group calls
`notFound()` — a real a11y defect that nothing caught, because jsdom's
`getByRole('main')` is satisfied by the inner one. T27 makes that path the
common case, so it fixes it too. `ErrorPanel` also paints `bg-bg-base`, the
*ground*, which fights the `bg-bg-surface` panel it now sits inside.

Callers outside the shell that must gain their own `<main>`: `app/not-found.tsx`
and `app/error.tsx`. `app/global-error.tsx` already writes its own `<main>`
inline and does not use `ErrorPanel`. `app/auth/layout.tsx` already renders a
`<main>` for everything under `/auth`.

**On `/members`:** the review says "either build `/members` or stop the route
resolving". Nothing in the product links to a member index — `lib/nav/links.ts`
carries seven destinations and none of them is `/members`, and
`app/(app)/members/[uuid]/page.tsx` is only ever reached from a seat name on a
league board. A directory of sixty real people is a product decision with a
privacy dimension (the member profile is deliberately signed-in-only, R7), not
a gap to fill in a polish phase. **This task does not build it.** With the
catch-all in place `/members` answers a 404 inside the shell, which is "stop the
route resolving" done properly, and the question goes to the owner as a note.

**What pins what.** The nested landmark and the panel's copy are RTL. Everything
else — the 404 status, the rail being present, the panel being centred in the
content column, the behaviour at 390px — is **Playwright only**: jsdom resolves
no media query, so `xl:block` on the rail is invisible to it.

### Steps

- [ ] **Step 1: Write the failing component test**

In `components/ErrorPanel.test.tsx`, replace the two `getByRole('main')` reads
(lines 62 and 69) with a container read, and add the landmark assertion:

```tsx
  it('🔴 renders no landmark of its own', () => {
    // AppShell supplies the app's one <main> (Panel as="main"). A second one
    // nested inside it is what this component used to produce on every 404
    // and every caught error inside the shell.
    const { container } = render(<ErrorPanel kind="not-found" />);

    expect(container.querySelector('main')).toBeNull();
  });

  it('🔴 never renders a raw error message', () => {
    const { container } = render(<ErrorPanel kind="unknown" />);

    expect(container.textContent ?? '').not.toMatch(
      /select |from |column|postgres|prisma/i,
    );
  });

  it('does not apologise or shout', () => {
    for (const kind of ['not-found', 'forbidden', 'conflict', 'unknown'] as const) {
      const { container, unmount } = render(<ErrorPanel kind={kind} />);
      expect(container.textContent ?? '').not.toMatch(/sorry|oops|!/i);
      unmount();
    }
  });
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run components/ErrorPanel.test.tsx
```

Expected: `renders no landmark of its own` FAILS — `container.querySelector('main')`
returns the element. The other two pass already (they are a mechanical rewrite).

- [ ] **Step 3: Take the landmark and the ground out of `ErrorPanel`**

`components/ErrorPanel.tsx`, replacing lines 72–79:

```tsx
  return (
    // 🔴 A <div>, not a <main>. Inside the app shell this renders within
    // AppShell's `Panel as="main"`, and a nested landmark makes the landmark
    // list ambiguous for a screen reader. The two callers outside the shell —
    // app/not-found.tsx and app/error.tsx — wrap this in their own <main>.
    //
    // No `bg-bg-base` either: the ground belongs to whatever is hosting this.
    // Inside the shell the host is a surface panel, and repainting it the
    // colour of the ground punched a hole in it.
    <div
      className={cn(
        'text-text-primary flex min-h-[60dvh] items-center justify-center p-4 md:p-8',
        className,
      )}
    >
      <div className="flex w-full max-w-xl flex-col gap-4">
```

(`justify-center` replaces the `mx-auto` on the inner div, which is what centres
the panel in the content column at every width rather than only where the
column is wider than `max-w-xl`. Drop the `mx-auto`.)

- [ ] **Step 4: Give the two outside-the-shell callers their own `<main>`**

`app/not-found.tsx`:

```tsx
import { ErrorPanel } from '@/components/ErrorPanel';

/**
 * The last-resort 404: a URL that matched no route at all, outside the app
 * shell.
 *
 * 🔴 Since P17.T27 this is nearly unreachable for an app URL —
 * `app/(app)/[...notFound]/page.tsx` catches every unmatched path into the
 * group, so a mistyped URL keeps the rail, the tab bar and the strip. What
 * still lands here is a miss under `/auth` or `/api`, and Next's own internal
 * fallbacks.
 *
 * Several pages also call `notFound()` deliberately — a league that does not
 * exist, an award show that does not, and the draft console when the viewer is
 * not an owner. That last one answers 404 rather than 403 on purpose, so the
 * copy must not hint that anything is there. Those reach
 * `app/(app)/not-found.tsx`, which renders the same panel inside the shell.
 */
export default function NotFound() {
  return (
    <main className="bg-bg-base min-h-dvh">
      <ErrorPanel kind="not-found" />
    </main>
  );
}
```

`app/error.tsx`, line 34:

```tsx
  return (
    <main className="bg-bg-base min-h-dvh">
      <ErrorPanel kind={kindOf(error)} onRetry={reset} />
    </main>
  );
```

- [ ] **Step 5: Note the change in the two inside-the-shell callers**

`app/(app)/not-found.tsx` — append to the docstring:

```tsx
 * 🔴 It reaches here only for a `notFound()` thrown by a page in this group.
 * A URL that matches no route at all is caught by `[...notFound]/page.tsx`,
 * which calls `notFound()` from inside the group so that this file renders.
 * Before P17.T27 those URLs — `/live`, `/members`, anything mistyped — went to
 * the root `app/not-found.tsx` and lost the whole application.
 *
 * `ErrorPanel` supplies no `<main>`: `AppShell` already renders the one
 * content landmark.
```

`app/(app)/error.tsx` — append the same last paragraph.

- [ ] **Step 6: Run the component test and watch it pass**

```bash
npx vitest run components/ErrorPanel.test.tsx
```

Expected: PASS, all eight.

- [ ] **Step 7: Write the failing browser test**

Add to `e2e/errors.spec.ts`, inside the existing `describe`:

```ts
  test('🔴 an unmatched URL keeps the application, and there is one main', async ({
    page,
  }) => {
    // `/members` and `/live` are directories with a dynamic child and no index,
    // so before P17.T27 they matched no route and fell through to the root
    // not-found — a bare page with no rail, no tab bar and no strip, and one
    // link back out of the product.
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const url of ['/members', '/live', '/nonsense/deep/path']) {
      const response = await page.goto(url);

      expect(response?.status(), `${url} must answer 404`).toBe(404);
      await expect(
        page
          .getByRole('navigation', { name: 'Main' })
          .getByRole('link', { name: 'Leagues' }),
      ).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Not here' })).toBeVisible();

      // One content landmark, not two. ErrorPanel used to render its own.
      expect(await page.locator('main').count(), `${url} nests <main>`).toBe(1);
    }
  });

  test('🔴 the 404 panel is centred in the content column, not hugging its edge', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/members');

    const main = await page.locator('main').boundingBox();
    const heading = await page.getByRole('heading', { name: 'Not here' }).boundingBox();
    if (!main || !heading) throw new Error('no layout');

    // The panel caps at max-w-xl (576px), so in a ~1100px column it must sit
    // centred: the gap on the left and the gap on the right agree within a
    // few pixels.
    const left = heading.x - main.x;
    const right = main.x + main.width - (heading.x + heading.width);
    expect(Math.abs(left - right)).toBeLessThan(8);
  });

  test('the 404 still works on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/members');

    await expect(page.getByRole('heading', { name: 'Not here' })).toBeVisible();
    // Below xl the rail is gone and the tab bar carries navigation.
    await expect(
      page.getByRole('navigation', { name: 'Primary, mobile' }),
    ).toBeVisible();
    // No horizontal overflow: the document is no wider than the viewport.
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  });
```

- [ ] **Step 8: Run it and watch it fail**

```bash
npm run db:up
npx playwright test e2e/errors.spec.ts
```

Expected: the three new tests FAIL — `/members` has no `Main` navigation and, on
`/leagues/999999`, `main` count is 2.

- [ ] **Step 9: Add the catch-all**

Create `app/(app)/[...notFound]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';

/**
 * Every URL that matches nothing else, pulled inside the app shell.
 *
 * 🔴 Next answers a completely unmatched URL with the **root**
 * `app/not-found.tsx`, which sits outside the `(app)` group and therefore
 * renders with no rail, no tab bar and no strip — a member who mistyped a
 * league id was dropped out of the application with one link back. A group's
 * own `not-found.tsx` only fires for a `notFound()` thrown by a page *inside*
 * it, so `/live` and `/members`, which are directories with a dynamic child
 * and no index, never reached it.
 *
 * This page exists so that they do. It renders nothing of its own: calling
 * `notFound()` from inside the group is what makes `(app)/not-found.tsx` the
 * responder, and the shell comes with it.
 *
 * 🔴 Non-optional (`[...notFound]`, not `[[...notFound]]`). The optional form
 * also matches `/`, which would shadow the dashboard. Static and dynamic
 * segments both outrank a catch-all in Next's route ranking, so every real
 * route — `/leagues/1`, `/auth/login`, `/api/*` — is unaffected;
 * `e2e/errors.spec.ts` and `e2e/nav.spec.ts` are what prove it.
 */
export default function CatchAll() {
  notFound();
}
```

- [ ] **Step 10: Run the browser tests and watch them pass**

```bash
npx playwright test e2e/errors.spec.ts e2e/nav.spec.ts e2e/dashboard.spec.ts
```

Expected: PASS. `nav.spec.ts` and `dashboard.spec.ts` are the regression guard —
if the catch-all had stolen a real route, they go red.

- [ ] **Step 11: Verify by hand at all four widths, both schemes**

Load `/members` at 1440, 1280, 1024 and 390px, in light and dark. The panel must
sit centred in the content column with the shell intact, and the ground behind
the panel must be the surface, not the base. 🔴 **1024px is the width the review
called a dead zone** (tranche 1's T2 owns that fix) — record what you see there
rather than fixing it.

- [ ] **Step 12: Commit**

```bash
git add app/\(app\)/\[...notFound\]/page.tsx components/ErrorPanel.tsx \
  components/ErrorPanel.test.tsx app/not-found.tsx app/error.tsx \
  app/\(app\)/not-found.tsx app/\(app\)/error.tsx e2e/errors.spec.ts
git commit -m "P17.T27: a mistyped URL keeps the application

A catch-all inside the (app) group makes every unmatched path render the
group's not-found, so /live, /members and anything mistyped keep the rail,
the tab bar and the strip. ErrorPanel stops rendering its own <main>, which
had been nesting a landmark inside AppShell's on every in-shell 404.

/members is deliberately not built: nothing links to it, and a directory of
sixty real people is an owner's product decision, not a polish-phase gap.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 (P17.T28): 🔴 `/admin/season` confirms before re-scoping the app

**Files:**
- Modify: `components/SeasonControl.tsx` (whole component)
- Modify: `app/(app)/admin/season/page.tsx`
- Create: `components/SeasonControl.test.tsx`
- Modify: `app/(app)/admin/season/page.test.tsx`
- Test: `e2e/signed-in.spec.ts` (create, first test)

**Interfaces:**
- Consumes: `setActiveYear(year: number): Promise<ActionResult<AvailableYear>>`
  from `actions/admin/set-active-year.ts` — **unchanged**. The action already
  calls `requireAdmin()` and already logs who did it; this task changes only
  what the UI requires before calling it.
- Produces: `SeasonControl` gains one required prop —
  `{ seasons: readonly SeasonRow[]; memberCount: number; className?: string }`.
  `SeasonRow` is unchanged: `{ year: number; isActive: boolean }`.

### Context an implementer needs

🔴 **This is the safety-bearing task in the tranche and it gets its own reviewer
pass before anything merges on top of it** (step 11).

`/admin/season` renders ten adjacent "Make active" buttons
(`SeasonControl.tsx:59-67`). Each one changes the active year **for every user
in the product, immediately**, and the page's own copy says so: "Nearly every
page in the app scopes to this year — leagues, drafts, award shows, the whole
dashboard. Changing it re-scopes them immediately, without a redeploy."
`setActiveYear` calls `revalidatePath('/', 'layout')`, so the change lands
everywhere on the next render. There is no confirmation and no undo.

`SeasonControl`'s docstring argues it needs no confirmation because the change
"is fully reversible by pressing another year's button". That is true of the
row in `available_years` and false of everything else: between the mis-click and
the correction, sixty people's dashboards, leagues, drafts and award shows are
scoped to the wrong season. Ten mutually-exclusive buttons a few pixels apart is
also the classic fat-finger geometry — and this is a desktop-first page by
stated exception (D49), pressed once a year by someone who has not seen it in
twelve months.

🔴 **`/admin/broadcast` in the same section already does this correctly, and it
is the model.** Read `components/BroadcastPanel.tsx` and
`app/(app)/admin/broadcast/page.tsx` before you write a line:

- the page reads the recipient count **server-side** and passes it in, so the
  confirmation names a real number rather than a guess
  (`broadcast/page.tsx:20`);
- the page copy names the blast radius and says the action cannot be undone
  (`broadcast/page.tsx:26-30`);
- the panel says it **again**, in the form, immediately above the button
  (`BroadcastPanel.tsx:97-101`);
- and the submit handler gates on a `window.confirm` that interpolates both the
  content and the count (`BroadcastPanel.tsx:33-39`).

Match that, don't invent a variant. `window.confirm` is deliberate here and is
not a shortcut: it is the platform's own modal, it is focus-trapped and
keyboard-operable for free, and using anything else would make the two
destructive admin actions in the product behave differently from each other.

**And prefer one selection control over ten buttons.** A `<select>` plus one
button turns ten adjacent triggers into one choice and one commit, gives the
whole control a single 44px target, and makes the pending year explicit before
anything fires. It is also the native platform control for "pick one of ten",
which is the rung the ladder stops at.

**What pins what.** The confirmation gate, the copy and the disabled state are
RTL — `window.confirm` is stubbable with `vi.spyOn(window, 'confirm')`. The
44px target and the control's behaviour at 390px are **Playwright**.

### Steps

- [ ] **Step 1: Write the failing component test**

Create `components/SeasonControl.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SeasonControl } from '@/components/SeasonControl';

const setActiveYear = vi.hoisted(() => vi.fn());
vi.mock('@/actions/admin/set-active-year', () => ({ setActiveYear }));

const SEASONS = [
  { year: 2026, isActive: true },
  { year: 2025, isActive: false },
  { year: 2024, isActive: false },
];

/**
 * 🔴 The one control in the product that re-scopes every page for every user,
 * by its own page's description. `/admin/broadcast` is the standard it is held
 * to: name the blast radius in numbers, say twice that it cannot be undone, and
 * gate the action.
 */
describe('SeasonControl', () => {
  beforeEach(() => {
    setActiveYear.mockReset();
    setActiveYear.mockResolvedValue({ ok: true, data: { year: 2025 } });
  });

  it('🔴 does nothing when the confirmation is declined', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    await userEvent.selectOptions(screen.getByLabelText(/season/i), '2025');
    await userEvent.click(screen.getByRole('button', { name: /make 2025 active/i }));

    expect(confirm).toHaveBeenCalled();
    expect(setActiveYear).not.toHaveBeenCalled();
  });

  it('🔴 names the year and the number of people in the confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    await userEvent.selectOptions(screen.getByLabelText(/season/i), '2025');
    await userEvent.click(screen.getByRole('button', { name: /make 2025 active/i }));

    const message = confirm.mock.calls[0]?.[0] as string;
    expect(message).toContain('2025');
    expect(message).toContain('60 people');
    expect(message).toMatch(/cannot be undone|re-scope/i);
  });

  it('re-scopes the app once, when confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    await userEvent.selectOptions(screen.getByLabelText(/season/i), '2025');
    await userEvent.click(screen.getByRole('button', { name: /make 2025 active/i }));

    expect(setActiveYear).toHaveBeenCalledTimes(1);
    expect(setActiveYear).toHaveBeenCalledWith(2025);
  });

  it('🔴 offers one control, not one button per season', () => {
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    // Ten adjacent triggers that each re-scope the product is the defect.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('cannot fire for the season that is already active', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    // 2026 is already active; the control opens on it and the commit is off.
    expect(screen.getByRole('button', { name: /active/i })).toBeDisabled();
    expect(setActiveYear).not.toHaveBeenCalled();
  });

  it('states the blast radius in the form, not only in the dialog', () => {
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    expect(screen.getByText(/60 people/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run components/SeasonControl.test.tsx
```

Expected: FAIL — no labelled select exists, and `getAllByRole('button')` returns
two (one per inactive season).

- [ ] **Step 3: Rewrite `components/SeasonControl.tsx`**

```tsx
'use client';

import { useCallback, useState, useTransition } from 'react';

import { setActiveYear } from '@/actions/admin/set-active-year';
import { cn } from '@/lib/utils/cn';

export type SeasonRow = {
  year: number;
  isActive: boolean;
};

/**
 * Switch the active season (T48, D22).
 *
 * The source app read `REACT_APP_ACTIVE_YEAR` at build time, so changing
 * seasons meant a redeploy. This is the control that replaces it — and because
 * `setActiveYear` calls `revalidatePath('/', 'layout')`, pressing it re-scopes
 * nearly every page in the product, for every member, with no reload.
 *
 * 🔴 **It confirms, and it names the blast radius** (P17.T28). This used to be
 * ten adjacent "Make active" buttons with no confirmation, on the reasoning
 * that the change is reversible by pressing another one. The row in
 * `available_years` is reversible; the interval is not — between the mis-click
 * and the correction, every member's dashboard, league, draft and award show is
 * scoped to the wrong season. `/admin/broadcast` is the standard this matches:
 * state the count server-side, say it in the form, say it again in a
 * confirmation that interpolates both, and gate the call on it.
 *
 * `window.confirm` rather than a custom dialog, for the same reason
 * `BroadcastPanel` uses it: it is the platform's modal, focus-trapped and
 * keyboard-operable for free, and the two destructive admin actions in this
 * product must not behave differently from one another.
 *
 * One `<select>` rather than ten buttons: ten mutually-exclusive triggers a few
 * pixels apart is the fat-finger geometry, and this page is opened once a year
 * by someone who has not seen it in twelve months. It also drops ten 33.6×20px
 * targets to one that clears 44px.
 */
export function SeasonControl({
  seasons,
  memberCount,
  className,
}: {
  seasons: readonly SeasonRow[];
  /** Read server-side, so the confirmation names a real number (D22). */
  memberCount: number;
  className?: string;
}) {
  const active = seasons.find((season) => season.isActive)?.year ?? null;
  const [choice, setChoice] = useState<number | null>(active);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const people = memberCount === 1 ? '1 person' : `${memberCount} people`;

  const activate = useCallback(() => {
    if (choice == null || choice === active) return;

    if (
      !window.confirm(
        `Make ${choice} the active season? This re-scopes every league, draft, ` +
          `award show and dashboard in the app for all ${people}, immediately. ` +
          `It takes effect with no redeploy and cannot be undone — only replaced ` +
          `by activating another season.`,
      )
    ) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await setActiveYear(choice);
      setMessage(result.ok ? `${choice} is now the active season` : result.message);
    });
  }, [choice, active, people]);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <label className="flex flex-col gap-2">
        <span className="text-text-secondary text-sm">Season</span>
        <select
          value={choice ?? ''}
          onChange={(event) => setChoice(Number(event.target.value))}
          disabled={pending}
          className="border-border-rule bg-bg-raised text-text-primary focus-visible:outline-accent-fill tabular min-h-11 w-full max-w-xs rounded-sm border px-3 font-mono text-sm focus-visible:outline-2"
        >
          {seasons.map((season) => (
            <option key={season.year} value={season.year}>
              {season.year}
              {season.isActive ? ' — active' : ''}
            </option>
          ))}
        </select>
      </label>

      {/* Said here as well as in the dialog: someone who dismisses a browser
          modal by reflex must still have read the number. Same rule the
          broadcast form follows. */}
      <p className="text-text-secondary text-sm">
        Changing the season re-scopes every league, draft, award show and dashboard
        for all {people}, immediately and with no redeploy. Only activating another
        season undoes it.
      </p>

      <button
        type="button"
        disabled={pending || choice == null || choice === active}
        onClick={activate}
        className="bg-accent-fill focus-visible:outline-accent-fill min-h-11 w-fit rounded-sm px-4 text-sm text-white focus-visible:outline-2 disabled:opacity-60"
      >
        {pending
          ? 'Activating…'
          : choice === active
            ? `${choice ?? ''} is already active`
            : `Make ${choice ?? ''} active`}
      </button>

      <p aria-live="polite" className="text-text-secondary min-h-5 text-sm">
        {message ?? ''}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run the component test and watch it pass**

```bash
npx vitest run components/SeasonControl.test.tsx
```

Expected: PASS, all six.

- [ ] **Step 5: Pass the count from the page**

`app/(app)/admin/season/page.tsx` — import the user repository the broadcast
page already uses and hand the number down:

```tsx
import { SeasonControl } from '@/components/SeasonControl';
import { SectionHead } from '@/components/SectionHead';
import { requireAdmin } from '@/lib/auth';
import { availableYearRepository } from '@/lib/repositories/available-years';
import { userRepository } from '@/lib/repositories/users';

/**
 * The active-season control (T48, D22).
 *
 * `requireAdmin()` gates the page independently of `setActiveYear` gating the
 * action itself — a Server Action's id ships in the client bundle, so it is
 * reachable without ever loading this page, and page-level gating alone would
 * not be gating at all.
 *
 * 🔴 The member count is read here, server-side, so the confirmation on
 * `SeasonControl` names a real number rather than a guess — the same pattern,
 * and for the same reason, as `/admin/broadcast` (P17.T28).
 *
 * Desktop-first, the stated exception (D49): this is pressed once a year.
 */
export default async function AdminSeasonPage() {
  await requireAdmin();

  const [seasons, memberIds] = await Promise.all([
    availableYearRepository.findAll(),
    userRepository.findAllIds(),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <SectionHead as="h1">Active season</SectionHead>

      <p className="text-text-secondary max-w-prose text-sm leading-relaxed">
        Nearly every page in the app scopes to this year — leagues, drafts, award
        shows, the whole dashboard. Changing it re-scopes them immediately, for every
        member, without a redeploy. Nothing changes until it is confirmed, and the
        only way back is to activate another season.
      </p>

      <SeasonControl
        memberCount={memberIds.length}
        seasons={seasons
          // A null year cannot be activated by number; the season picker
          // elsewhere in the app drops the same rows for the same reason.
          .filter((season) => season.year != null)
          .map((season) => ({
            year: season.year as number,
            isActive: season.isActive === true,
          }))}
      />
    </div>
  );
}
```

- [ ] **Step 6: Update the page test**

`app/(app)/admin/season/page.test.tsx` — read it first, then make its
`SeasonControl` expectations match the new prop. Run:

```bash
npx vitest run "app/(app)/admin/season/page.test.tsx"
```

Expected: PASS. If the existing test asserts on "Make active" buttons, replace
those assertions with one that the page passes a `memberCount` through.

- [ ] **Step 7: Write the failing browser test**

Create `e2e/signed-in.spec.ts` with this first test. It writes **nothing**:

```ts
import { expect, test } from '@playwright/test';

import { signInAs } from './support/session';

const TAG = 'e2e-p17';

/**
 * The signed-in surfaces (P17.T27–T36).
 *
 * 🔴 Everything here that needs data creates its own, prefixed `e2e-p17`, and
 * deletes it in `afterAll`. The database on 5433 is a restored copy of
 * production: league 1 is sixty real people's history and `lib/db.test.ts`
 * asserts exact row counts against it.
 *
 * Geometry and viewport assertions live here rather than in jsdom on purpose.
 * jsdom resolves no media query and returns zeroed rects, so the three defects
 * this phase is fixing were all invisible to the component suite.
 */
test.describe('signed-in surfaces', () => {
  test('🔴 the active season cannot be changed without confirming', async ({ page }) => {
    // Admin-only, and this test never confirms — nothing is written.
    await signInAs(page, { email: `${TAG}-admin@example.test`, firstName: 'Admin' });
    await page.evaluate(() => {}); // no-op: keeps the cookie write ordered before nav

    await page.goto('/admin/season');
    // A non-admin is bounced; this test only runs where the seeded user is one.
    test.skip(
      page.url().includes('/auth') || (await page.title()) === 'Not here',
      'the seeded e2e user is not an admin in this database',
    );

    await page.setViewportSize({ width: 390, height: 844 });

    const commit = page.getByRole('button', { name: /make .* active|already active/i });
    await expect(commit).toBeVisible();

    // One control, not one per season.
    expect(await page.getByRole('button').count()).toBeGreaterThan(0);
    const box = await commit.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    // Declining the confirmation must leave the season alone.
    page.on('dialog', (dialog) => {
      expect(dialog.message()).toMatch(/re-scopes/i);
      expect(dialog.message()).toMatch(/\d+ (person|people)/);
      void dialog.dismiss();
    });

    const select = page.getByLabel(/season/i);
    const options = await select.locator('option').allTextContents();
    const other = options.find((text) => !text.includes('active'));
    if (other) {
      await select.selectOption({ label: other });
      await commit.click();
      await expect(page.getByText(/is now the active season/)).toHaveCount(0);
    }
  });
});
```

- [ ] **Step 8: Run it**

```bash
npx playwright test e2e/signed-in.spec.ts
```

Expected: PASS, or a visible skip if the seeded user is not an admin in your
database. A skip is an acceptable outcome here **only** if the reason prints —
never a silent pass.

- [ ] **Step 9: Verify by hand at all four widths, both schemes**

Sign in as an admin, load `/admin/season` at 1440, 1280, 1024 and 390px in both
schemes. Check that: the select's target clears 44px on a phone; the copy above
the button names the real member count; dismissing the confirm changes nothing;
accepting it says so in the live region. 🔴 **Use a throwaway database or accept
that you have changed the active season** — if you confirm against the restored
copy, put it back to the year it started on and say so in the commit body.

- [ ] **Step 10: Run the full gate**

```bash
npm run verify
```

- [ ] **Step 11: 🔴 Reviewer pass, before anything merges on top**

This task is safety-bearing, and the project's convention is a reviewer pass
before the next task lands. Use `superpowers:requesting-code-review` and ask
the reviewer, specifically:

1. Can `setActiveYear` be reached from this page without passing the
   confirmation — including via a double-submit, an Enter key on the select, or
   a rapid second click while `pending`?
2. Does the confirmation name the real number, or a number the client invented?
3. Is the action itself still gated independently of the page? (It must be:
   `requireAdmin()` inside `actions/admin/set-active-year.ts`. A Server Action's
   id ships in the client bundle.)
4. Does the disabled state on "already active" close the only remaining path to
   a no-op write?

Address the findings before Task 4. Do not batch this review with another task's.

- [ ] **Step 12: Commit**

```bash
git add components/SeasonControl.tsx components/SeasonControl.test.tsx \
  app/\(app\)/admin/season/page.tsx app/\(app\)/admin/season/page.test.tsx \
  e2e/signed-in.spec.ts
git commit -m "P17.T28: confirm before re-scoping the app for everyone

Ten adjacent 'Make active' buttons, each changing the active year for
every user immediately with no confirmation, become one select and one
gated commit. Matches /admin/broadcast: the count is read server-side, the
blast radius is named in the form and again in the confirmation, and the
action does not fire without it.

Safety-bearing; reviewed separately before the next task.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 (P17.T32): One label for one action, and an admin index that is not a settings list

**Files:**
- Modify: `components/AppShell.tsx:200-207` (the strip's create control)
- Modify: `app/(app)/leagues/page.tsx:28-49`
- Modify: `app/(app)/admin/page.tsx:31-61`
- Test: `components/AppShell.test.tsx`, `app/(app)/admin/page.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new. Two string changes and one list gains a marked entry.

### Context an implementer needs

**Part one — one label.** The same action has two names roughly 700px apart at
1440px: the strip renders "Create league" (`AppShell.tsx:206`) and the `/leagues`
page renders "Start a league" twice (`leagues/page.tsx:35` in the `SectionHead`
right slot, and `:45` in the `EmptyState` action). Both link to `/leagues/new`,
whose own heading is "Start a league" (`leagues/new/page.tsx:17`) and whose copy
is written in the second person about running it.

**Take "Start a league".** Three of the four occurrences already say it, the
destination page says it, and it is the one that describes what actually
happens — you become the person who runs the draft. "Create league" survives
only in `components/CreateLeagueForm.tsx:117` as the *submit* label, which is a
different act (committing the form) at a different moment, and it stays.

**Part two — mark the admin section.** 🔴 **This is the half of T32 I had to
interpret, and I am flagging it rather than resolving it.** The task text files
"mark the admin section" under `/leagues`, and `/leagues` has no admin section —
it is a list of the leagues you are in. The only page in the product that is "a
page that re-scopes the product … visually a settings list" is
`app/(app)/admin/page.tsx`, which renders `/admin/season` — the control T28 just
gated — as the first of three identical `Panel` cards, indistinguishable from
"Relink an account" and "Broadcast a notification". Two of those three are
irreversible for every member.

I have implemented it there. **If the phase owner meant something else on
`/leagues`, this half of T32 needs re-pointing; the label fix stands either
way.**

The marking must not be colour alone (a11y: colour-not-only) and must not
introduce a hairline border (D72). A `StatusChip tone="carmine"` naming the
reach — carmine is urgency and destructive actions (D69) — plus grouping the
two irreversible entries under their own `SectionHead` is the whole change.

**What pins what.** Both halves are RTL — they are text and structure, not
geometry.

### Steps

- [ ] **Step 1: Write the failing tests**

Append to `components/AppShell.test.tsx`:

```tsx
  it('🔴 names the create action the same as every other place it appears', () => {
    // "Create league" in the strip and "Start a league" on /leagues are the
    // same action, 700px apart at 1440px. One label.
    render(<AppShell isSignedIn>{null}</AppShell>);

    expect(screen.getByRole('link', { name: 'Start a league' })).toHaveAttribute(
      'href',
      '/leagues/new',
    );
    expect(screen.queryByRole('link', { name: 'Create league' })).toBeNull();
  });
```

(Match the surrounding file's existing render helper if it has one — read it
before pasting.)

Append to `app/(app)/admin/page.test.tsx`:

```tsx
  it('🔴 marks the entries that change the product for everyone', async () => {
    // Three identical cards, two of which are irreversible for every member,
    // reads as a settings list. The reach is named, in words, not by colour.
    render(await AdminPage());

    const scoped = screen.getByRole('link', { name: /Active season/ });
    expect(scoped.textContent).toMatch(/every member|everyone/i);

    expect(
      screen.getByRole('heading', { name: /affects every member/i }),
    ).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run components/AppShell.test.tsx "app/(app)/admin/page.test.tsx"
```

Expected: FAIL — "Start a league" is not in the shell, and the admin page has one
heading.

- [ ] **Step 3: Rename the strip's control**

`components/AppShell.tsx`, the `<Link href="/leagues/new">` inside `Strip`:

```tsx
      <Link
        href="/leagues/new"
        className="border-border-rule text-text-primary hover:bg-bg-raised focus-visible:outline-accent-fill flex min-h-11 items-center gap-2 border px-4 text-sm focus-visible:outline-2"
      >
        <PlusIcon />
        {/* One label for one action (P17.T32). `/leagues` and `/leagues/new`
            both say "Start a league", and so does the destination's own
            heading; "Create league" survives only as CreateLeagueForm's submit
            label, which is a different act at a different moment. */}
        Start a league
      </Link>
```

🔴 **`AppShell.tsx` is also edited by tranche 1 (T2, breakpoints and the tab bar)
and tranche 2 (T8, the skip link).** Rebase first, keep this to the one JSX
child, and name them in the commit body.

- [ ] **Step 4: Split the admin index into two named groups**

`app/(app)/admin/page.tsx`, replacing the single list:

```tsx
export default async function AdminPage() {
  await requireAdmin();

  return (
    <div className="text-text-primary mx-auto flex max-w-3xl flex-col gap-10">
      <SectionHead as="h1">Admin</SectionHead>

      {/* 🔴 Two groups, not one list (P17.T32). Three identical cards, two of
          which cannot be undone for any member, read as a settings page — and
          the first of them re-scopes every league, draft, award show and
          dashboard in the product. The reach is named in words on each entry,
          never carried by colour alone. */}
      <section className="flex flex-col gap-4">
        <SectionHead as="h2" eyebrow="Cannot be undone">
          Affects every member
        </SectionHead>

        <ul className="flex flex-col gap-3">
          <AdminEntry
            href="/admin/season"
            label="Active season"
            reach="Re-scopes every league, draft, award show and dashboard, for every member, immediately."
          />
          <AdminEntry
            href="/admin/broadcast"
            label="Broadcast a notification"
            reach="Sends one message to every member. Cannot be recalled."
          />
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHead as="h2">Affects one account</SectionHead>

        <ul className="flex flex-col gap-3">
          <AdminEntry
            href="/admin/relink"
            label="Relink an account"
            detail="Move an account between people. The only code that can."
          />
        </ul>
      </section>
    </div>
  );
}

/**
 * One admin destination.
 *
 * `reach` rather than `detail` marks an entry whose effect lands on everybody:
 * it renders a carmine chip beside the label — carmine is urgency and
 * destructive actions (D69) — *and* states the reach in words, because colour
 * is never the only carrier of state.
 */
function AdminEntry({
  href,
  label,
  reach,
  detail,
}: {
  href: string;
  label: string;
  reach?: string;
  detail?: string;
}) {
  return (
    <li>
      <Panel>
        <Link
          href={href}
          className="focus-visible:outline-accent-fill flex flex-col gap-1 focus-visible:outline-2"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm">{label}</span>
            {reach ? <StatusChip tone="carmine">Every member</StatusChip> : null}
          </span>
          <span className="text-text-secondary text-xs">{reach ?? detail}</span>
        </Link>
      </Panel>
    </li>
  );
}
```

Add `import { StatusChip } from '@/components/StatusChip';` to the imports.

- [ ] **Step 5: Rename both labels on `/leagues`**

`app/(app)/leagues/page.tsx` — the `SectionHead` right slot and the `EmptyState`
action both already read "Start a league"; confirm and leave them. If the
`SectionHead` right slot reads anything else, make it "Start a league".

```bash
grep -n "Start a league\|Create league" "app/(app)/leagues/page.tsx"
```

Expected: two matches, both "Start a league".

- [ ] **Step 6: Run the tests and watch them pass**

```bash
npx vitest run components/AppShell.test.tsx "app/(app)/admin/page.test.tsx"
```

- [ ] **Step 7: Verify by hand at all four widths, both schemes**

`/leagues` and `/admin` at 1440, 1280, 1024 and 390px. On `/admin` the two
groups must read as two groups from 40px of space (tranche 4's T23 sets that
step — **use whatever `gap-*` T23 landed on if it has shipped**, and `gap-10`
until then), never from a rule. The carmine chip must be legible in light.

- [ ] **Step 8: Commit**

```bash
git add components/AppShell.tsx components/AppShell.test.tsx \
  app/\(app\)/admin/page.tsx app/\(app\)/admin/page.test.tsx \
  app/\(app\)/leagues/page.tsx
git commit -m "P17.T32: one label for one action, and an admin index that reads its own reach

The strip said 'Create league' and /leagues said 'Start a league' 700px
apart; the destination page and three of the four sites already said the
latter, so that wins. /admin splits into 'Affects every member' and
'Affects one account' so the control that re-scopes the product is not
the first of three identical settings cards.

Touches AppShell.tsx, which tranche 1 (T2) and tranche 2 (T8) also edit —
one JSX child, rebased.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5 (P17.T36): One left edge per column

**Files:**
- Modify: `app/(app)/list/page.tsx:56` (the redundant `Panel`)
- Test: `e2e/signed-in.spec.ts` (add)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new. One wrapper deleted.

### Context an implementer needs

`/list` renders three left edges at 1440px — eyebrow and heading at x=445, the
search field at x=469, the empty state at x=493 — and they are exactly 24px
apart, which is the tell. Derived from the code rather than guessed:

| Edge | Source | Offset |
|---|---|---|
| 445 | `app/(app)/list/page.tsx:37` — `div.mx-auto.max-w-3xl`, the content column. `SectionHead` adds no padding. | +0 |
| 469 | `app/(app)/list/page.tsx:56` — `<Panel className="p-4 sm:p-6">` wrapping the whole editor. `FilmSearch`'s input is `w-full`, so its border box starts at the panel's content edge. | +24 |
| 493 | `components/EmptyState.tsx:38` — `p-6` on the empty-state card, *inside* that panel. | +48 |

The middle one is the bug, and it is not a spacing value to tune — it is a
**second content column nested inside the first**. `AppShell` already renders
the page's content in `Panel as="main"`, which is `tone="surface"` →
`bg-bg-surface` (`AppShell.tsx`, `Panel.tsx:34`). `/list` then wraps its body in
another `Panel`, also `tone="surface"`. A surface panel on a surface panel is
invisible: it contributes **padding and nothing else**. Delete it and edge two
disappears; edge three becomes a card's own internal padding, which is correct —
the card's *edge* aligns with the heading, and its text is inset because it is a
card.

The rule this establishes, which the audit checks: **a page body never wraps
itself in a `Panel` of the same tone as the shell's content panel.** A `Panel`
around *an item in a list* (as `/admin` does) is a card and is fine; a `Panel`
around *the whole page* is a duplicate column.

**Check the other single-column pages** — the audit is one grep plus one browser
pass:

```bash
grep -rn "<Panel" app/\(app\) | grep -v "as=\"main\""
```

Pages to sight-check at 1440px: `/leagues` (cards in a list — aligned), `/admin`
(cards in a list — aligned, and T32 just touched it), `/leagues/new`
(`max-w-lg`, no panel), `/members/[uuid]` (`max-w-3xl`). 🔴 **`/watchlist` is off
limits** — measure it, record the number, change nothing.

**What pins what.** This is pure geometry. jsdom cannot see it: `max-w-3xl`
resolves to nothing, `sm:p-6` never applies, and `getBoundingClientRect` returns
zeros. **Playwright only.**

### Steps

- [ ] **Step 1: Write the failing browser test**

Add to `e2e/signed-in.spec.ts`:

```ts
  test('🔴 a single-column page has one left edge, not three', async ({ page }) => {
    await signInAs(page, { email: `${TAG}-edges@example.test`, firstName: 'Edges' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/list');

    const heading = await page.getByRole('heading', { name: 'Draft list' }).boundingBox();
    const field = await page.getByLabel('Add a film').boundingBox();
    if (!heading || !field) throw new Error('no layout');

    // Nested containers each adding their own gutter produced 445 / 469 / 493.
    // The column has one edge; a card's internal padding is a card's business.
    expect(Math.abs(heading.x - field.x)).toBeLessThan(2);
  });

  test('no single-column page wraps itself in a second content panel', async ({
    page,
  }) => {
    await signInAs(page, { email: `${TAG}-edges@example.test`, firstName: 'Edges' });
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const url of ['/list', '/leagues', '/admin', '/leagues/new']) {
      await page.goto(url);
      if ((await page.title()) === 'Not here') continue; // admin-gated

      // The shell's <main> is the one content panel. A page body repeating its
      // background immediately inside it is a duplicate column.
      const nested = await page.evaluate(() => {
        const main = document.querySelector('main');
        if (!main) return 0;
        const ground = getComputedStyle(main).backgroundColor;
        return [...main.querySelectorAll(':scope > div > div')].filter((node) => {
          const style = getComputedStyle(node);
          return (
            style.backgroundColor === ground &&
            Number.parseFloat(style.paddingLeft) > 0 &&
            node.clientWidth > main.clientWidth * 0.9
          );
        }).length;
      });

      expect(nested, `${url} nests a second content panel`).toBe(0);
    }
  });
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm run db:up
npx playwright test e2e/signed-in.spec.ts -g "left edge|second content panel"
```

Expected: FAIL — the heading and the field are 24px apart on `/list`.

- [ ] **Step 3: Delete the redundant panel**

`app/(app)/list/page.tsx` — remove the `<Panel className="p-4 sm:p-6">` wrapper
and its closing tag, and drop the now-unused `Panel` import. The editor becomes
a direct child of the content column:

```tsx
        {/* 🔴 No `Panel` here (P17.T36). AppShell already renders the page's
            content in `Panel as="main"` at the same `surface` tone, so a second
            one is invisible and contributes only a 24px gutter — which is what
            put this page's heading, search field and empty state on three
            different left edges (445 / 469 / 493). A Panel around a list *item*
            is a card; a Panel around the whole page body is a duplicate column. */}
        <DraftListEditor
```

- [ ] **Step 4: Run the browser test and watch it pass**

```bash
npx playwright test e2e/signed-in.spec.ts -g "left edge|second content panel"
```

- [ ] **Step 5: Audit the other single-column pages**

```bash
grep -rn "<Panel" "app/(app)" | grep -v 'as="main"'
```

For each hit, decide in one line whether it wraps **a list item** (a card —
leave it) or **a page body** (a duplicate column — delete it), and write the
verdict into the commit body. Sight-check `/leagues`, `/admin`,
`/leagues/new` and `/members/<uuid>` at 1440px with the same heading-vs-first-
control comparison. 🔴 **Record `/watchlist`'s numbers and change nothing there.**

- [ ] **Step 6: Verify by hand at all four widths, both schemes**

`/list` at 1440, 1280, 1024 and 390px. At 390px the page had `p-4` on the panel
and `p-4` on the shell's main; check that removing the inner one has not pushed
the editor flush against the shell's edge — the shell's own `p-4` is the gutter
and is enough.

- [ ] **Step 7: Run the suites**

```bash
npm run test && npx playwright test e2e/signed-in.spec.ts
```

- [ ] **Step 8: Commit**

```bash
git add app/\(app\)/list/page.tsx e2e/signed-in.spec.ts
git commit -m "P17.T36: /list has one left edge, not three

445 / 469 / 493 came from a Panel wrapping the whole page body at the same
tone as AppShell's content panel — invisible, contributing only a 24px
gutter — with EmptyState's own p-6 stacked inside it. Deleting the wrapper
removes the middle edge and leaves the card's internal padding, which is a
card's business.

Audited the other single-column pages; /watchlist measured and left alone.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6 (P17.T30): The league page's controls become controls

**Files:**
- Modify: `app/(app)/leagues/[id]/page.tsx:135-188`
- Create: `components/InviteAction.tsx`, `components/InviteAction.stories.tsx`, `components/InviteAction.test.tsx`
- Test: `e2e/signed-in.spec.ts` (add)

**Interfaces:**
- Consumes: `getLeagueBoard(leagueId, year)` from `lib/services/draft.ts` and
  `canManageLeague(board, userId)` from `lib/services/league-access.ts` —
  **both unchanged**. `board.status` is `League['draftingStatus']`.
- Produces: `InviteAction` — `{ url: string; className?: string }`, a
  `'use client'` component. It renders a disclosure button labelled "Invite" and
  reveals the existing `InviteLink` inside it. `components/InviteLink.tsx` is
  **unchanged** and stays the thing that renders the URL and the copy button.

### Context an implementer needs

Three defects on one header (`leagues/[id]/page.tsx:135-188`):

1. **"Set up the season" and "Run the draft" are underlined metadata.** They sit
   inside a `flex flex-wrap items-baseline gap-x-4 text-sm` row, between the
   year and the status word, styled `text-accent-text underline` — visually a
   footnote. They are the two most consequential actions an owner takes, and
   `Run the draft` is the only way into the console.
2. **The raw `join/<uuid>` URL is the second element on the page.** `InviteLink`
   renders the whole URL in a `<code>` at `text-xs` (`InviteLink.tsx:38`), and
   at 390px it wraps to two mono lines directly under the league name. It is
   also still rendered on a league whose season is complete, when there is
   nobody left to invite.
3. Everything in that header is the same weight, so nothing in it is primary.

**Which control is primary depends on the state, and the state is already on the
page.** `board.status` is `'pending'` before a draft starts (`page.tsx:113`
computes `isPending` from it) and the page already branches on it below. So:

- `status === 'pending'` → **"Run the draft" is primary.** The season is set up
  and the league is waiting on the owner to start.
- no seats yet (`board.groups.length === 0`) → **"Set up the season" is
  primary.** There is nothing to draft.
- otherwise (a draft in progress or complete) → both are secondary; the page's
  subject is the board.

**Hiding the invite on a complete season.** The signal available is
`board.status`. Read it before you write the branch:

```bash
grep -rn "draftingStatus" lib/repositories/leagues.ts lib/services/draft.ts
```

Use the value that means finished. 🔴 If `draftingStatus` has no "complete"
value in this schema, **do not invent one** — fall back to "hide the invite once
every seat is claimed", which is derivable from data the page already has
(`board.groups.flatMap(g => g.seats).every(seat => !seat.isDummy)`), and say so
in the commit body. An unclaimed seat is the only thing an invite is for.

**Use `Button`, not a hand-rolled `<Link>` with border classes.** `Button` is a
Phase 3.5 primitive and the gate requires it. Read `components/Button.tsx`
first: it wraps MUI's and takes `accent?: 'carmine' | 'brass'`. 🔴 **Never
`accent="brass"` on either of these** — brass is award outcomes (D85), and "Run
the draft" is not one.

**What pins what.** That the controls exist, are links to the right hrefs, and
that the invite is absent in the complete state — RTL, on the page component
if it renders in jsdom, otherwise Playwright. The invite disclosure's
open/closed behaviour — RTL on `InviteAction`. That the primary control is
visually primary and that the header no longer wraps to two mono lines at 390px
— **Playwright**.

### Steps

- [ ] **Step 1: Write the failing tests for the new component**

Create `components/InviteAction.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { InviteAction } from '@/components/InviteAction';

const URL = 'https://cinemadraft.test/join/2f1c6d4e-0000-4000-8000-000000000000';

/**
 * The invite link, behind an action.
 *
 * The uuid is the join credential — whoever holds it can seat themselves — so
 * it is owners-only, and printing it as the second element on the page made it
 * both the loudest thing there and a two-line mono wrap on a phone.
 */
describe('InviteAction', () => {
  it('🔴 does not print the join credential until it is asked for', () => {
    render(<InviteAction url={URL} />);

    expect(screen.queryByText(URL)).toBeNull();
    expect(screen.getByRole('button', { name: /invite/i })).toBeInTheDocument();
  });

  it('reveals the link, and the copy control with it', async () => {
    render(<InviteAction url={URL} />);

    await userEvent.click(screen.getByRole('button', { name: /invite/i }));

    expect(screen.getByText(URL)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('says what the link is for, so it is not pasted by accident', async () => {
    render(<InviteAction url={URL} />);

    await userEvent.click(screen.getByRole('button', { name: /invite/i }));

    expect(screen.getByText(/anyone with this link can take a seat/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run components/InviteAction.test.tsx
```

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write `components/InviteAction.tsx`**

```tsx
'use client';

import { useState } from 'react';

import { InviteLink } from '@/components/InviteLink';
import { cn } from '@/lib/utils/cn';

/**
 * The invite, behind an action (P17.T30).
 *
 * 🔴 The uuid **is** the join credential — whoever holds it can seat
 * themselves — and it used to be the second element on the league page,
 * rendered in full as a `<code>` that wrapped to two mono lines at 390px,
 * directly beneath the league name. That is the loudest possible treatment for
 * the one string on the page that should not be shoulder-surfed, and it stayed
 * there long after the last seat was filled.
 *
 * A `<details>` rather than a dialog or a separate page: the link belongs next
 * to the league it invites people to, it costs no JavaScript, and it is
 * keyboard-operable without anything being written to make it so — the same
 * reasoning `PointsLedger` uses for the score breakdown.
 *
 * `InviteLink` is unchanged and still owns the URL and the copy button: the
 * value stays visible once revealed, because someone on a phone with a
 * clipboard that misbehaves still needs to be able to select it.
 */
export function InviteAction({ url, className }: { url: string; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
      className={cn('flex flex-col gap-2', className)}
    >
      <summary className="border-border-rule text-text-primary hover:bg-bg-raised focus-visible:outline-accent-fill flex min-h-11 w-fit cursor-pointer list-none items-center rounded-sm border px-4 text-sm focus-visible:outline-2">
        Invite
      </summary>

      <p className="text-text-secondary max-w-prose text-sm">
        Anyone with this link can take a seat in this league. Send it to whoever is
        playing, and nobody else.
      </p>

      <InviteLink url={url} />
    </details>
  );
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npx vitest run components/InviteAction.test.tsx
```

- [ ] **Step 5: Add the Storybook story (Phase 3.5 gate)**

Create `components/InviteAction.stories.tsx`, modelled on
`components/Panel.stories.tsx` — read that file for the meta shape this repo
uses, then:

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { InviteAction } from './InviteAction';

const meta = {
  title: 'Components/InviteAction',
  component: InviteAction,
  args: {
    url: 'https://cinemadraft.com/join/2f1c6d4e-0000-4000-8000-000000000000',
  },
} satisfies Meta<typeof InviteAction>;

export default meta;

export const Closed: StoryObj<typeof meta> = {};

export const Revealed: StoryObj<typeof meta> = {
  render: (args) => (
    <div style={{ maxWidth: 390 }}>
      <InviteAction {...args} />
    </div>
  ),
  name: 'Revealed, at phone width',
};
```

```bash
npm run build-storybook
```

Expected: builds. That is the gate that proves the story compiles.

- [ ] **Step 6: Write the failing browser test for the header**

Add to `e2e/signed-in.spec.ts`. It builds its own league — never league 1:

```ts
  test('🔴 an owner gets controls, not underlined metadata, and no raw invite URL', async ({
    page,
  }) => {
    const leagueId = await scratchLeague(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/leagues/${leagueId}`);

    // The two owner actions are controls a reader can see are controls.
    const run = page.getByRole('link', { name: 'Run the draft' });
    await expect(run).toBeVisible();
    const box = await run.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    // The join credential is not printed on arrival.
    await expect(page.getByText(/\/join\//)).toHaveCount(0);
    await page.getByRole('button', { name: /invite/i }).click();
    await expect(page.getByText(/\/join\//)).toBeVisible();
  });

  test('the league header does not wrap to two mono lines on a phone', async ({
    page,
  }) => {
    const leagueId = await scratchLeague(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/leagues/${leagueId}`);

    const heading = page.getByRole('heading', { level: 1 });
    const headingBox = await heading.boundingBox();
    const invite = await page.getByRole('button', { name: /invite/i }).boundingBox();
    if (!headingBox || !invite) throw new Error('no layout');

    // Whatever sits under the name, it is one control's height, not a wrapped
    // URL. 96px is two mono lines plus the copy button; the closed disclosure
    // is one 44px row.
    expect(invite.y - (headingBox.y + headingBox.height)).toBeLessThan(96);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  });
```

And the scratch helpers, at the top of the file:

```ts
/**
 * A throwaway league this spec owns, with the signed-in user as its owner.
 *
 * 🔴 Never league 1. The database on 5433 is a restored copy of production and
 * `lib/db.test.ts` asserts exact row counts against it; `e2e-` is the prefix
 * those counts deliberately exclude.
 */
async function scratchLeague(page: import('@playwright/test').Page): Promise<number> {
  const userId = await signInAs(page, {
    email: `${TAG}-owner@example.test`,
    firstName: 'Owner',
  });

  return withDb(async (query) => {
    const [league] = (await query(
      `insert into leagues (name, uuid, owner, drafting_status, created_at, updated_at)
       values ($1, gen_random_uuid(), $2, 'pending', now(), now())
       returning id`,
      [`${TAG}-league`, JSON.stringify([userId])],
    )) as { id: number }[];
    const leagueId = league?.id;
    if (leagueId == null) throw new Error('could not create the scratch league');

    await query(
      `insert into drafts (league_id, user_id, "group", "order", year, created_at, updated_at)
       values ($1, $2, 1, 1, $3, now(), now())`,
      [leagueId, userId, new Date().getUTCFullYear()],
    );

    return leagueId;
  });
}

async function withDb<T>(
  fn: (query: (sql: string, params?: unknown[]) => Promise<unknown[]>) => Promise<T>,
): Promise<T> {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(async (sql, params) => (await client.query(sql, params)).rows);
  } finally {
    await client.end();
  }
}

async function cleanup(): Promise<void> {
  await withDb(async (query) => {
    await query(
      'delete from drafts where league_id in (select id from leagues where name like $1)',
      [`${TAG}%`],
    );
    await query('delete from leagues where name like $1', [`${TAG}%`]);
    await query(`delete from users where email like '${TAG}-%@example.test'`);
  });
}
```

Register it: `test.beforeAll(cleanup); test.afterAll(cleanup);` inside the
describe, and `test.describe.configure({ mode: 'serial' })` — the scratch league
is shared by name, so two of these racing would see each other's rows.

🔴 **Check the column names against the schema before running.** `leagues.owner`
is a JSON string of ids (D47) and `drafts` uses quoted `"group"`/`"order"`;
`e2e/leagues.spec.ts` is the file to copy the exact shapes from. If a column
here does not match, fix this helper — do not fix the schema.

- [ ] **Step 7: Run it and watch it fail**

```bash
npx playwright test e2e/signed-in.spec.ts -g "underlined metadata|two mono lines"
```

Expected: FAIL — "Run the draft" is a 20px-high underlined link, and the join
URL is on the page immediately.

- [ ] **Step 8: Rewrite the header**

`app/(app)/leagues/[id]/page.tsx`, replacing lines 135–188's `<header>`:

```tsx
        <header className="flex flex-col gap-4">
          <SectionHead
            as="h1"
            name
            eyebrow={
              board.status ? `${board.year} · ${board.status}` : String(board.year)
            }
          >
            {board.leagueName ?? 'League'}
          </SectionHead>

          {/* 🔴 Controls, not metadata (P17.T30). These were `text-accent-text
              underline` inside a baseline row between the year and the status
              word — a footnote treatment on the two most consequential actions
              an owner takes, one of which is the only way into the console.

              Which one is primary comes from the state the page already has:
              no seats means there is nothing to draft, so setting up the season
              is the act; a pending draft means the season is set up and the
              league is waiting on the owner to start. */}
          {canManage ? (
            <div className="flex flex-wrap items-center gap-3">
              {board.groups.length === 0 ? (
                <>
                  <PrimaryAction
                    href={`/leagues/${board.leagueId}/setup?year=${board.year}`}
                  >
                    Set up the season
                  </PrimaryAction>
                  <SecondaryAction
                    href={`/leagues/${board.leagueId}/draft?year=${board.year}`}
                  >
                    Run the draft
                  </SecondaryAction>
                </>
              ) : isPending ? (
                <>
                  <PrimaryAction
                    href={`/leagues/${board.leagueId}/draft?year=${board.year}`}
                  >
                    Run the draft
                  </PrimaryAction>
                  <SecondaryAction
                    href={`/leagues/${board.leagueId}/setup?year=${board.year}`}
                  >
                    Set up the season
                  </SecondaryAction>
                </>
              ) : (
                <>
                  <SecondaryAction
                    href={`/leagues/${board.leagueId}/draft?year=${board.year}`}
                  >
                    Run the draft
                  </SecondaryAction>
                  <SecondaryAction
                    href={`/leagues/${board.leagueId}/setup?year=${board.year}`}
                  >
                    Set up the season
                  </SecondaryAction>
                </>
              )}

              {/* 🔴 Owners only, and only while there is somebody to invite.
                  The uuid is the join credential — anyone holding it can seat
                  themselves — so showing it to every member would make every
                  member able to re-share the league, and leaving it on a league
                  with no unclaimed seat is a standing credential on screen for
                  no reason. */}
              {board.uuid && hasUnclaimedSeat ? (
                <InviteAction url={`${await inviteBase()}/join/${board.uuid}`} />
              ) : null}
            </div>
          ) : null}

          {seasons.length > 1 ? (
            <nav aria-label="Seasons" className="flex flex-wrap gap-3 text-sm">
              {seasons.map((entry) => (
                <Link
                  key={entry}
                  href={`/leagues/${board.leagueId}?year=${entry}`}
                  aria-current={entry === board.year ? 'page' : undefined}
                  className={
                    entry === board.year
                      ? 'text-accent-text tabular font-mono'
                      : 'text-text-secondary tabular font-mono underline'
                  }
                >
                  {entry}
                </Link>
              ))}
            </nav>
          ) : null}
        </header>
```

Add above the component, beside `inviteBase`:

```tsx
/**
 * An owner action that is the act this state calls for.
 *
 * Carmine fill with white on it — 6.58:1, the pairing `accent.fill` was
 * measured for. Never `brass`: brass means an award outcome (D85), and running
 * a draft is not one.
 */
function PrimaryAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="bg-accent-fill focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {children}
    </Link>
  );
}

/** The same act, when the page's subject is the board rather than the action. */
function SecondaryAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="border-border-rule text-text-primary hover:bg-bg-raised focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm border px-4 text-sm focus-visible:outline-2"
    >
      {children}
    </Link>
  );
}
```

And, beside `isPending` at line 113:

```tsx
  // An invite exists for an empty seat. Once every seat is claimed there is
  // nobody left to send it to, and a standing join credential on screen is a
  // liability rather than an affordance.
  const hasUnclaimedSeat = board.groups
    .flatMap((group) => group.seats)
    .some((seat) => seat.isDummy || seat.userId == null);
```

Imports: add `InviteAction`, drop `InviteLink`, add `import type { ReactNode }
from 'react';`.

🔴 **`inviteBase()` is `await`ed inside JSX today (`page.tsx:167`).** Hoist it to
a `const base = board.uuid && hasUnclaimedSeat ? await inviteBase() : null;`
above the `return` — an `await` inside a conditional JSX expression is fragile
and hard to read, and it is now inside two conditionals.

- [ ] **Step 9: Run the browser tests and watch them pass**

```bash
npx playwright test e2e/signed-in.spec.ts -g "underlined metadata|two mono lines"
npx playwright test e2e/leagues.spec.ts e2e/draft.spec.ts
```

The second command is the regression guard: `leagues.spec.ts` follows the invite
flow end to end and will catch it if the link is now unreachable when it should
not be.

- [ ] **Step 10: Verify by hand at all four widths, both schemes**

A scratch league at 1440, 1280, 1024 and 390px, in both schemes, in **all three
states** — no seats, pending, and drafted. The primary control must be the one
the state calls for; the invite must be closed on arrival and absent once every
seat is claimed; nothing must wrap to two mono lines at 390px.

- [ ] **Step 11: Commit**

```bash
git add app/\(app\)/leagues/\[id\]/page.tsx components/InviteAction.tsx \
  components/InviteAction.test.tsx components/InviteAction.stories.tsx \
  e2e/signed-in.spec.ts
git commit -m "P17.T30: the league page's controls are controls

'Run the draft' and 'Set up the season' were underlined metadata in a
baseline row; they are now real controls, primary on the state that needs
them. The raw join/<uuid> URL — the join credential, previously the second
element on the page and two mono lines at 390px — moves behind an Invite
disclosure and disappears once every seat is claimed.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 7 (P17.T31): The reader's own roster, in the column standings leave empty

**Files:**
- Modify: `app/(app)/leagues/[id]/page.tsx:196-201` (the standings section)
- Test: `e2e/signed-in.spec.ts` (add)

**Interfaces:**
- Consumes: `RosterStrip` — `{ films: readonly RosterFilm[]; className?: string }`
  where `RosterFilm` is `{ id: number; title: string; posterUrl: string | null;
  round: number; points: number; share: number; accent?: string; status?:
  PosterStatus }` (`components/RosterStrip.tsx:4-15`). `board.groups[].seats[]`
  already carries `draftId`, `userId`, `total` and `picks[]` with `pickId`,
  `round`, `movie`, `points`, `ledger`; the page already maps them into
  `DraftBoard` at lines 254–268, and `posterUrl(pick.movie.poster, 'w185')` is
  already imported.
- Produces: nothing new. No service change.

### Context an implementer needs

At 1440px the standings section is `flex max-w-sm flex-col`
(`leagues/[id]/page.tsx:197`) — about 384px of an ~1100px content column, with
the rest empty — while the reader's own roster sits inside the draft board,
below thousands of pixels of page. The review measured 5,554px. The dead column
is exactly the space the roster needs.

**Everything needed is already on the page.** `viewerSeatId` is computed at
lines 106–111, and the seat it names carries `picks[]`. `RosterStrip` is the
component that renders exactly this on the dashboard, and it already handles the
empty case with its own sentence. The page already converts a pick's poster with
`posterUrl(pick.movie.poster, 'w185')`.

🔴 **`share` is not on the board's seat data.** `RosterFilm.share` drives the
contribution bar, and `getLeagueBoard` does not compute one. **Do not add it to
the service for this.** Derive it on the page from the numbers already there —
`pick.points / seat.total`, guarded against a zero total — which is exactly what
`lib/services/dashboard.ts` does for the dashboard's copy. One expression, no
new query.

**This is a two-column layout, so it is a Playwright fix.** Both the "standings
use 45% and the rest is empty" measurement and the "it stacks on a phone"
requirement are invisible to jsdom. That the roster is *present* for a member
with a seat, and *absent* for a visitor, is RTL-shaped but the page is an async
server component reading a service — assert it in Playwright too rather than
building a mock harness for one assertion.

**Order matters on a phone.** Below `lg` the two stack, and the reader's own
roster is more interesting to them than the table. Roster first, standings
second, both at every width — which also means the desktop layout puts the
roster on the **left** (the wide side) and the standings on the right, matching
the dashboard's existing arrangement (`app/(app)/page.tsx:157-183`).

### Steps

- [ ] **Step 1: Write the failing browser test**

Add to `e2e/signed-in.spec.ts`:

```ts
  test('🔴 the reader\'s own roster sits beside the standings, not 5,000px below', async ({
    page,
  }) => {
    const leagueId = await scratchLeagueWithPicks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/leagues/${leagueId}`);

    const standings = await page
      .getByRole('table', { name: /standings/i })
      .boundingBox();
    const roster = await page
      .getByRole('list', { name: 'Drafted films, in draft order' })
      .boundingBox();
    if (!standings || !roster) throw new Error('no layout');

    // Beside, not below: their vertical ranges overlap.
    expect(roster.y).toBeLessThan(standings.y + standings.height);
    // And the pair fills the column rather than leaving 55% empty.
    const main = await page.locator('main').boundingBox();
    const used = Math.max(roster.x + roster.width, standings.x + standings.width) -
      Math.min(roster.x, standings.x);
    expect(used).toBeGreaterThan((main?.width ?? 0) * 0.7);
  });

  test('on a phone the roster comes first and the standings follow', async ({
    page,
  }) => {
    const leagueId = await scratchLeagueWithPicks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/leagues/${leagueId}`);

    const roster = await page
      .getByRole('list', { name: 'Drafted films, in draft order' })
      .boundingBox();
    const standings = await page
      .getByRole('table', { name: /standings/i })
      .boundingBox();
    if (!roster || !standings) throw new Error('no layout');

    expect(roster.y).toBeLessThan(standings.y);
  });
```

And extend the scratch helper — one film, one pick, so the seat has a roster:

```ts
/** The scratch league, plus one drafted film for the signed-in seat. */
async function scratchLeagueWithPicks(
  page: import('@playwright/test').Page,
): Promise<number> {
  const leagueId = await scratchLeague(page);

  await withDb(async (query) => {
    const [movie] = (await query(
      `insert into movies (title, created_at, updated_at)
       values ($1, now(), now()) returning id`,
      [`${TAG} Film`],
    )) as { id: number }[];
    const [draft] = (await query(
      'select id from drafts where league_id = $1 limit 1',
      [leagueId],
    )) as { id: number }[];
    if (!movie || !draft) throw new Error('could not seed a pick');

    await query(
      `insert into draft_picks (draft_id, movie_id, round, created_at, updated_at)
       values ($1, $2, 1, now(), now())`,
      [draft.id, movie.id],
    );
  });

  return leagueId;
}
```

Extend `cleanup()` to remove the scratch film and its picks:

```ts
    await query(
      `delete from draft_picks where movie_id in (select id from movies where title like $1)`,
      [`${TAG}%`],
    );
    await query('delete from movies where title like $1', [`${TAG}%`]);
```

🔴 Order matters — picks before movies before drafts before leagues before
users. Check the actual column names against `lib/repositories/draft-picks.ts`
and `prisma/schema.prisma` before running, and fix the helper, never the schema.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx playwright test e2e/signed-in.spec.ts -g "beside the standings|roster comes first"
```

Expected: FAIL — the roster list is not on the page at all outside the board.

- [ ] **Step 3: Put the roster in the empty column**

`app/(app)/leagues/[id]/page.tsx`, replacing the standings `<section>`:

```tsx
        {/* P10.T10: standings for whoever has this link, signed in or not —
            the deficiency being closed is that the source only showed this on
            the dashboard, to a signed-in member.

            🔴 The viewer's own roster sits beside it (P17.T31). The standings
            table is `max-w-sm`, so at 1440px it used about 45% of the content
            column and left the rest empty — while the reader's own picks were
            inside the board, thousands of pixels down the page. Nothing new is
            queried: the seat and its picks are already loaded, and `share` is
            derived from the two numbers already on them rather than added to
            the service. Roster first in DOM order, so a phone reads the
            reader's own team before the table. */}
        {viewerRoster.length > 0 || standings.length > 0 ? (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
            {viewerRoster.length > 0 ? (
              <section className="flex min-w-0 flex-1 flex-col gap-3">
                <SectionHead as="h2" eyebrow="Yours">
                  Your roster
                </SectionHead>
                <RosterStrip films={viewerRoster} />
              </section>
            ) : null}

            {standings.length > 0 ? (
              <section className="flex w-full flex-col gap-3 lg:max-w-sm">
                <SectionHead as="h2">Standings</SectionHead>
                <StandingsPanel rows={standings} />
              </section>
            ) : null}
          </div>
        ) : null}
```

And above the `return`, beside `standings`:

```tsx
  // The viewer's own picks, from the seat already resolved above. `share` is
  // this film's slice of the seat's total — the contribution bar's input —
  // derived here rather than added to `getLeagueBoard`, because the two numbers
  // it needs are already on the seat. A zero total means nothing has scored,
  // and a bar showing a share of nothing is noise, so it is zero rather than
  // a division by zero.
  const viewerSeat =
    viewerSeatId == null
      ? null
      : (board.groups
          .flatMap((group) => group.seats)
          .find((seat) => seat.draftId === viewerSeatId) ?? null);

  const viewerRoster =
    viewerSeat == null
      ? []
      : viewerSeat.picks.map((pick) => ({
          id: pick.pickId,
          title: pick.movie.title ?? 'Untitled',
          posterUrl: posterUrl(pick.movie.poster, 'w185'),
          round: pick.round,
          points: pick.points,
          share: viewerSeat.total > 0 ? pick.points / viewerSeat.total : 0,
        }));
```

Imports: add `RosterStrip`.

- [ ] **Step 4: Run the browser tests and watch them pass**

```bash
npx playwright test e2e/signed-in.spec.ts -g "beside the standings|roster comes first"
```

- [ ] **Step 5: Check the visitor path is unchanged**

A signed-out visitor has no `viewerSeatId`, so `viewerRoster` is empty and only
the standings render — in a flex row with one child, which must still be
`max-w-sm` and not stretch. Verify in a fresh browser context:

```bash
npx playwright test e2e/leagues.spec.ts e2e/scoring.spec.ts
```

`scoring.spec.ts` reads league 1's real 2025 board and is the strongest
regression guard on this file. It must stay green.

- [ ] **Step 6: Verify by hand at all four widths, both schemes**

A scratch league with picks at 1440, 1280, 1024 and 390px, in both schemes, both
signed in with a seat and signed out. 🔴 At 1024px the rail is not yet shown
(tranche 1's T2 owns that); the two columns must still behave.

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/leagues/\[id\]/page.tsx e2e/signed-in.spec.ts
git commit -m "P17.T31: the reader's own roster, in the column standings left empty

Standings used ~45% of the content width at 1440px with the rest empty,
while the reader's own picks sat inside the board thousands of pixels down.
The seat and its picks were already loaded; share is derived from the two
numbers already on them rather than added to getLeagueBoard.

Roster first in DOM order, so a phone reads the reader's own team before
the table.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 8 (P17.T29): Signed in, home is about the reader

**Files:**
- Modify: `app/(app)/page.tsx:67-192`
- Test: `e2e/signed-in.spec.ts` (add)

**Interfaces:**
- Consumes: `getDashboard(userId)` → `DashboardView` from
  `lib/services/dashboard.ts` — **unchanged**. `LeagueView` is
  `{ id, name, roster, total, standings, position }`.
- Produces: nothing new. No service change.

### Context an implementer needs

🔴 **This is the heaviest collision file in the phase.** `app/(app)/page.tsx` is
edited by tranche 1 (T1 heading sizes and the `h1 → h3 → h2` order, T4 the
leaderboard's year control, T5 the signed-out lede) and tranche 3 (T11 roster
posters at `:171` and `:315`, T17 LCP priority on the first shelf frames). It is
scheduled **last of the page work in this tranche** so it rebases onto their
finished versions. Rebase, read the file fresh, and re-derive the line numbers
before you edit.

**The finding, and what it actually is.** The review reports that signed in, `/`
is `/` signed out plus three header icons — no standing, no roster, no league
name, no next action, for a member who has two leagues. The page does render
league sections with a name, a standing eyebrow, a roster strip and a standings
panel (`page.tsx:136-185`). They are simply **fourth**: the season stepper, the
"In cinemas now" shelf and the full season leaderboard all come first, so the
first two screens of a signed-in member's home page are identical to a
stranger's.

So the fix the task text asks for — "the season rail and shelf become supporting
material rather than the whole page" — is an **order change**, not new data.

🔴 **Confirm that before you reorder.** Step 1 is a diagnosis, and it has two
outcomes with two different actions, because there is a second possible cause:
`getDashboard` scopes to `getActiveYear()`, so a member whose picks are in a
different year gets `leagues: []` and the page falls through to the "No leagues
yet" `EmptyState` at `:129`. Both outcomes are specified below; neither is a
TBD.

**The next action, without a service change.** A "next action" that says "Run
the draft" needs `draftingStatus`, which `LeagueView` does not carry and
`MyLeague` does. Adding it means editing `lib/services/dashboard.ts` for a link.
Don't. The two actions derivable from what is already on `LeagueView`:

- `roster.length === 0` → **"Build your draft list"** → `/list`. That is the act
  that is actually available before a draft.
- otherwise → **the league itself** → `/leagues/{id}`, where T30 has just put
  the real controls and T31 the roster beside the standings.

That is a deliberate ceiling: home points at the league, and the league page
carries the state-specific action. Say so in the code comment so the next reader
does not think it was missed.

**The order after this task, signed in:** the member's leagues (name, standing,
points, roster, standings, next action) → the season stepper → the shelf → the
season leaderboard → the lower fold. Signed out: unchanged — the season stepper
stays the top of the page, and tranche 1's T5 lede sits above it.

**What pins what.** That the league name appears above the season heading, and
that a signed-out visitor's page is unchanged — **Playwright**, because it is
order and position in a rendered document with real data. The
`standingLabel()` helper is already pure and already covered.

### Steps

- [ ] **Step 1: Diagnose before you reorder**

```bash
npm run db:up
PORT=3105 E2E_TEST_AUTH=1 npm run dev
```

Sign in with the test cookie as a member who holds seats, load `/`, and answer
one question: **do the league sections render at all?**

- **They render, below the leaderboard** → the finding is an order problem.
  Continue to step 2.
- **They do not render, and the page shows "No leagues yet"** → the finding is a
  *data* problem: `getDashboard` scoped to `getActiveYear()` and this member's
  seats are in another year. **Stop and report it.** That is a service-layer
  defect in `lib/services/dashboard.ts`, it is not in any tranche's task list,
  and reordering a page that renders nothing would hide it. Record the active
  year, the member's seat years, and hand it to the phase owner.

Write the answer into the commit body either way.

- [ ] **Step 2: Write the failing browser test**

Add to `e2e/signed-in.spec.ts`:

```ts
  test('🔴 signed in, home opens with the reader\'s own state', async ({ page }) => {
    const leagueId = await scratchLeagueWithPicks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const league = await page
      .getByRole('heading', { name: `${TAG}-league` })
      .boundingBox();
    const season = await page.getByRole('heading', { name: 'Season' }).boundingBox();
    if (!league || !season) throw new Error('no layout');

    // The member's own league comes before the season rail, not 2,000px after
    // it. Signed in, the first screen must not be the signed-out page.
    expect(league.y).toBeLessThan(season.y);

    // And it carries the three facts the review found missing.
    await expect(page.getByRole('link', { name: /go to .*league|open the league/i }))
      .toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Drafted films, in draft order' }).first(),
    ).toBeVisible();
    await expect(page.getByRole('table', { name: /standings/i }).first()).toBeVisible();

    expect(league.y).toBeLessThan(900); // above the fold at 1440×900
    void leagueId;
  });

  test('signed out, home is still the season', async ({ page }) => {
    await page.context().clearCookies();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const season = await page.getByRole('heading', { name: 'Season' }).boundingBox();
    expect(season?.y ?? Infinity).toBeLessThan(400);
  });
```

- [ ] **Step 3: Run it and watch it fail**

```bash
npx playwright test e2e/signed-in.spec.ts -g "home opens with|home is still the season"
```

Expected: the first FAILS (the league heading is below the season heading); the
second PASSES and is the guard that this task does not break the public page.

- [ ] **Step 4: Reorder the page**

`app/(app)/page.tsx` — extract the signed-in league block into a fragment
rendered **first**, and leave everything else in its current order. The
structure after the edit:

```tsx
  return (
    <div className="text-text-primary mx-auto flex max-w-6xl flex-col gap-10">
      {/* 🔴 Signed in, the reader's own state comes first (P17.T29). Before
          this, a member with two leagues opened `/` to the same two screens a
          stranger sees — the season stepper, the shelf and the full season
          leaderboard — with their own standing, roster and league name fourth,
          two thousand pixels down. The season rail and the shelf are supporting
          material on a member's home page, not the page itself.

          Signed out the order is unchanged: the season *is* the page, which is
          deliberate and matches the source app (D44). */}
      {user != null ? <YourLeagues view={view} /> : null}

      <section className="flex flex-col gap-4">
        {/* ... the existing Season SectionHead and SeasonStepper, unchanged ... */}
      </section>

      <NowPlayingShelf films={view.nowPlaying} />

      <section className="flex flex-col gap-4">
        {/* ... the existing Season leaderboard section, unchanged ... */}
      </section>

      {user == null ? (
        <EmptyState
          title="Play the season"
          action={{ label: 'Register', href: '/auth/register' }}
        >
          Draft a team of films before awards season and score points as they pick up
          nominations and wins. Played before? Register with the same email and your
          leagues, drafts and points come with you.
        </EmptyState>
      ) : (
        <LowerFold leagues={view.leagues} />
      )}
    </div>
  );
```

And the extracted component, beside the other helpers at the bottom of the file:

```tsx
/**
 * The signed-in member's own state, at the top of their home page.
 *
 * 🔴 The heading level is `h2` under the page's `h1`, and the `h1` remains the
 * season — tranche 1's T1 owns the heading sizes and the `h1 → h3 → h2` order
 * on this page, so this must not introduce a second `h1`.
 *
 * The "next action" is deliberately the league itself rather than a
 * state-specific act. A "Run the draft" here would need `draftingStatus`, which
 * `LeagueView` does not carry and adding it means editing the dashboard service
 * for one link — while `/leagues/{id}` already carries the state-specific
 * controls as of P17.T30. The one exception is a member with no roster, for
 * whom the available act is the draft list, and that is derivable from
 * `roster.length` alone.
 */
function YourLeagues({ view }: { view: DashboardView }) {
  if (view.leagues.length === 0) {
    return (
      <EmptyState
        title="No leagues yet"
        action={{ label: 'Find a league', href: '/leagues' }}
      >
        Join a league to draft a team of films and play the season.
      </EmptyState>
    );
  }

  return (
    <>
      {view.leagues.map((league) => (
        <section key={league.id} className="flex flex-col gap-6">
          <SectionHead
            as="h2"
            name
            // Position is stated rather than left to be inferred from the row's
            // place in the table below: on a narrow screen the standings sit
            // far beneath the roster.
            eyebrow={standingLabel(league)}
            right={
              <span className="flex items-baseline gap-2">
                <span className="font-sans">Your points</span>
                <span className="tabular font-mono">{league.total}</span>
              </span>
            }
          >
            {league.name ?? 'League'}
          </SectionHead>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/leagues/${league.id}`}
              className="border-border-rule text-text-primary hover:bg-bg-raised focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm border px-4 text-sm focus-visible:outline-2"
            >
              Open the league
            </Link>
            {league.roster.length === 0 ? (
              <Link
                href="/list"
                className="bg-accent-fill focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm px-4 text-sm font-medium text-white focus-visible:outline-2"
              >
                Build your draft list
              </Link>
            ) : null}
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
            <div className="min-w-0 flex-1">
              {league.roster.length === 0 ? (
                <EmptyState title="Draft not started">
                  You have not drafted for this season yet. Your roster appears here
                  once the draft opens.
                </EmptyState>
              ) : (
                <RosterStrip
                  films={league.roster.map((entry) => ({
                    id: entry.movie.id,
                    title: entry.movie.title ?? 'Untitled',
                    // 🔴 Tranche 3's T11 owns this line. If it has landed, this
                    // reads the real poster; if it has not, leave the `null` and
                    // its comment exactly as they are.
                    posterUrl: null,
                    round: entry.round,
                    points: entry.points,
                    share: entry.share,
                  }))}
                />
              )}
            </div>

            <div className="w-full lg:max-w-sm">
              <StandingsPanel rows={league.standings} />
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
```

🔴 **The `posterUrl: null` at the old line 171 is tranche 3's T11.** If T11 has
landed before you, carry its version across verbatim. If it has not, carry the
`null` and its comment across verbatim. **Do not fix it** — see "What this
tranche does not own", rule 3.

- [ ] **Step 5: Run the browser tests and watch them pass**

```bash
npx playwright test e2e/signed-in.spec.ts -g "home opens with|home is still the season"
npx playwright test e2e/dashboard.spec.ts
```

`dashboard.spec.ts` reads member 6's real 2026 roster behind
`skipWithoutRestoredCorpus()` and is the regression guard on this file. It must
stay green, or skip visibly.

- [ ] **Step 6: Verify by hand at all four widths, both schemes**

Signed in and signed out, at 1440, 1280, 1024 and 390px, both schemes. Signed
in: the league name, the standing, the points and a control must be on the first
screen at 1440×900. Signed out: unchanged from before this task — compare
against a screenshot you took before step 4.

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/page.tsx e2e/signed-in.spec.ts
git commit -m "P17.T29: signed in, home opens with the reader's own state

The league sections rendered fourth, below the season stepper, the shelf
and the full leaderboard — so a member with two leagues opened / to the
same two screens a stranger sees. They move to the top; the season rail and
the shelf become supporting material. Signed out is byte-for-byte the same
page as before.

No service change: the next action is the league itself, where P17.T30 put
the state-specific controls.

Touches app/(app)/page.tsx, also edited by tranche 1 (T1/T4/T5) and tranche
3 (T11/T17) — rebased onto both.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 9 (P17.T33): 🔴 Signed-in type joins the scale tranche 4 set

**Files:**
- Modify: `components/PickCell.tsx:66`
- Modify: `components/DraftListEditor.tsx:225`
- Modify: `components/FilmSearch.tsx:244`
- Modify: `scripts/layering.sh`
- Test: `e2e/signed-in.spec.ts` (add)

**Interfaces:**
- Consumes: **tranche 4's T18 body scale.** Nothing else.
- Produces: nothing new.

### 🔴 What this inherits, and where it is written down

**T33 is the signed-in half of tranche 4's T18 sweep. It does not decide a size
and it does not sweep a second time.**

T18's decision is already made and recorded: **body moves to 15px with 13px as
the small step**, decided 2026-09-12, amending D71. It is written in
`docs/PLAN.md` § Phase 17 → T18 and in `docs/PROGRESS.md` § Phase 17 → "Type and
colour system". Its instruction is "**sweep every `text-sm` and `text-xs` rather
than adding a third size alongside them**" — and `text-sm`/`text-xs` in the
signed-in components live in the same `app/` and `components/` directories as
every other one. **T18's sweep already reaches these routes.** There is nothing
for T33 to re-sweep, and re-sweeping would fork the scale.

So T33 owns exactly the two things T18's grep cannot reach:

1. **The arbitrary values.** T18 sweeps `text-sm` and `text-xs`. It does not
   match `text-[0.65rem]`, which is not on the scale at all. The review found
   117 elements at 10.4px from `PickCell.tsx:66`'s round-number badge — below
   the 11px `Eyebrow` floor, which is the smallest sanctioned size in the
   product. **Two more exist that the review did not name**, both at
   `text-[0.6rem]` = 9.6px: `DraftListEditor.tsx:225` and `FilmSearch.tsx:244`,
   the two-letter poster placeholders. All three are in scope.
2. **Proving the sweep arrived.** The review's headline number is *88% of
   signed-in text at 12px* (5,065 of 5,744) against 14px-dominant in public. 🔴
   **That number is a claim, not a target** — the review does not say how it
   measured, and one of its other figures (320 brass instances) does not survive
   contact with the source. So T33 takes its own before-number with a stated
   method **before** T18's effect can be judged, then takes the same measurement
   after, and records both plus the method. If your before-number disagrees with
   the review's, report the disagreement; do not adopt either silently.

**Do not start this task until T18 is on `main`:**

```bash
git log --oneline main -- components/ | grep "P17.T18" || echo "T18 HAS NOT LANDED — STOP"
```

**Which class replaces the arbitrary values is T18's to name, not yours.** Read
tranche 4's plan and use whatever it landed on for the small step. The
invariants, in order:

- The badge is metadata over artwork, not body text, so the **small step** is
  the right size for it — the same class `PickCell.tsx:43` and `:62` already use
  for their siblings after T18's sweep.
- If a size genuinely below the small step is argued for, the **only** legal
  value is `text-[11px]`, which is `Eyebrow`'s floor and a sanctioned literal.
  Anything else is a new arbitrary value and is the defect, not the fix.
- **Never introduce a third body size.** If your change needs one, you have
  misread T18.

The lazy move, and the one to take unless T18 says otherwise: make all three
match their immediate siblings. In `PickCell` that means the round badge uses
the same class as the empty-cell round number two branches above it; in
`DraftListEditor` and `FilmSearch` the placeholder matches the poster caption
beside it.

### Steps

- [ ] **Step 1: Confirm T18 has landed, and read what it chose**

```bash
git log --oneline main -- components/ scripts/ | grep "P17.T18"
git show --stat $(git log --format=%H -1 --grep="P17.T18" main)
grep -rn "text-sm\|text-xs" components/PickCell.tsx
```

Write the class T18 landed on for the small step into the commit body. If T18 has
not landed, **stop and report** — running this first produces two body scales.

- [ ] **Step 2: Write the failing enforcement check**

Add to `scripts/layering.sh`, after the raw-hex check:

```bash
# An arbitrary font size is a size outside the scale, and the scale is the whole
# point of D71/P17.T18. Three literals are sanctioned and named here: Eyebrow's
# 11px floor, SectionHead's 17px, and the TabBar label at 11px. Anything else —
# `text-[0.65rem]` on the draft board's round badge at 10.4px, `text-[0.6rem]`
# on two poster placeholders at 9.6px — is a size somebody typed, below the
# smallest size the product sanctions, invisible to the T18 sweep because it
# matches neither `text-sm` nor `text-xs`.
#
# The Wordmark's `text-[20px]`/`text-[27px]` are exempt: D83 makes the lockup a
# deliberate exception to the type system, and it is the only consumer of Sora.
check "no arbitrary font size outside the scale" \
  "$(grep -rnE "text-\[[0-9.]+(rem|px|em)\]" components app \
     --include='*.tsx' 2>/dev/null \
     | grep -vE "text-\[11px\]|text-\[17px\]" \
     | grep -v '^components/Wordmark\.tsx:' || true)"
```

- [ ] **Step 3: Run it and watch it fail**

```bash
npm run layering
```

Expected: `✗ no arbitrary font size outside the scale`, listing
`components/PickCell.tsx:66`, `components/DraftListEditor.tsx:225` and
`components/FilmSearch.tsx:244`.

🔴 **`scripts/layering.sh` is also edited by tranche 4's T24** (the 4px grid
check). Both add one `check` block to the same file. Rebase, append below T24's
if it is already there, and name it in the commit body. **The phase owner may
prefer this grep folded into T24 — flag it and let them decide; do not move it
yourself.**

- [ ] **Step 4: Put the three values on the scale**

`components/PickCell.tsx:66` — match the class its siblings use after T18:

```tsx
        {/* 🔴 On the scale (P17.T33). This was `text-[0.65rem]` — 10.4px,
            below the 11px `Eyebrow` floor, and 117 elements of it on one
            board. An arbitrary value is invisible to the T18 sweep, which
            matches `text-sm` and `text-xs`, so it survived a scale change that
            moved everything around it. */}
        <span className="text-text-dim tabular absolute left-1 top-1 font-mono text-xs">
```

`components/DraftListEditor.tsx:225` and `components/FilmSearch.tsx:244` — the
same treatment on `text-[0.6rem]` (9.6px), matching the caption beside each.

**Substitute T18's actual small-step class for `text-xs` in all three if T18
renamed it.**

- [ ] **Step 5: Run the check and watch it pass**

```bash
npm run layering && npm run test
```

- [ ] **Step 6: Write the measurement test**

Add to `e2e/signed-in.spec.ts`:

```ts
  test('🔴 no signed-in text renders below the 11px floor', async ({ page }) => {
    const leagueId = await scratchLeagueWithPicks(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const url of ['/', `/leagues/${leagueId}`, '/leagues', '/list']) {
      await page.goto(url);

      const tooSmall = await page.evaluate(() =>
        [...document.querySelectorAll('*')]
          .filter((node) => (node.textContent ?? '').trim().length > 0)
          .filter((node) => node.children.length === 0)
          .map((node) => Number.parseFloat(getComputedStyle(node).fontSize))
          .filter((size) => size > 0 && size < 11),
      );

      expect(tooSmall, `${url} renders text below 11px`).toEqual([]);
    }
  });
```

- [ ] **Step 7: Run it and watch it pass**

```bash
npx playwright test e2e/signed-in.spec.ts -g "below the 11px floor"
```

If it fails on a route this task did not touch, **report it** — that is a T18
sweep miss, not a T33 defect, and it belongs to tranche 4.

- [ ] **Step 8: Re-measure the six signed-in routes, before and after, and record the method**

The gate requires "the type/colour measurements re-run and recorded in
`PROGRESS.md` so the change is a number, not an impression". **You are not
editing `PROGRESS.md`** — the phase owner indexes it. Produce the numbers and
put them in the commit body instead.

With your own server on your own port, signed in, at 1440px, for `/`,
`/leagues`, `/leagues/<scratch>`, `/list`, `/members/<uuid>` and `/admin`:

```js
[...document.querySelectorAll('*')]
  .filter(n => (n.textContent ?? '').trim() && n.children.length === 0)
  .map(n => Math.round(Number.parseFloat(getComputedStyle(n).fontSize) * 10) / 10)
  .reduce((a, s) => (a[s] = (a[s] ?? 0) + 1, a), {})
```

Run it **twice**: once on the commit immediately before T18 landed
(`git stash` is not enough — check out that commit in a scratch worktree), and
once on `main` with your change. Record both histograms, the totals, and this
exact method beside them.

🔴 **The method is part of the number.** This counts leaf elements with
non-empty text and reads their computed `font-size`. The review's 5,744 / 5,065
at 12px / 117 at 10.4px was taken by an unrecorded method, so it is a
cross-check, not the baseline. If your own before-number disagrees with it,
report the disagreement and treat **your** measurement as authoritative — the
same call tranche 4 made for its own sweep.

- [ ] **Step 9: Verify by hand at all four widths, both schemes**

The draft board at 1440, 1280, 1024 and 390px, in both schemes. 🔴 **The draft
console is off limits** — look at it to confirm the board's round badges are
legible there too, and change nothing.

- [ ] **Step 10: Commit**

```bash
git add components/PickCell.tsx components/DraftListEditor.tsx \
  components/FilmSearch.tsx scripts/layering.sh e2e/signed-in.spec.ts
git commit -m "P17.T33: the three arbitrary font sizes join the scale

text-[0.65rem] on the draft board's round badge (10.4px, 117 elements) and
text-[0.6rem] on two poster placeholders (9.6px) are below the 11px Eyebrow
floor and were invisible to T18's sweep, which matches text-sm and text-xs.
layering.sh now greps for any arbitrary font size outside the three
sanctioned literals.

Inherits T18's scale rather than re-deciding one. Signed-in histogram
re-measured across six routes: <numbers>.

Adds a check to scripts/layering.sh, which tranche 4's T24 also edits —
may belong folded into T24; flagged for the phase owner.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 10 (P17.T34): `text-dim` stops carrying the content it exists to de-emphasise

**Files:**
- Modify: `components/PointsLedger.tsx:109,113`
- Modify: `components/DraftBoard.tsx:151,159`
- Modify: `components/StandingsPanel.tsx:68,72,77`
- Modify: `app/(app)/leagues/[id]/page.tsx` (the `Group N` heading and the seat order)
- Modify: `components/PickCell.tsx` (docstring only — its two remain `dim` and the comment says why)
- Test: `e2e/signed-in.spec.ts` (add)

**Interfaces:**
- Consumes: **tranche 4's T22 surface rename**, and the token values and
  contrast floors pinned in `theme/tokens.ts` and `theme/contrast.test.ts`.
- Produces: a rule, recorded by T26: **`dim` is for text a reader never needs to
  read.**

### 🔴 What this inherits, and where it is written down

**T34 is the signed-in half of tranche 4's colour work. It changes no token
value and renames nothing.**

What it inherits:

- **The token names, post-T22.** T22 renames the surfaces to match reality
  (`bg-raised` renders 204 times, `bg-surface` 45, `bg-base` 8) as a pure
  token/class sweep with **no visual diff**, verified by a before/after
  screenshot that must match. T34 must therefore run **after** T22 has landed
  and must spell every class the way T22 left it. Editing a class T22 is about
  to rename makes its zero-diff verification unreadable.
- **The token values and their contrast floors**, from `theme/tokens.ts` and
  `theme/contrast.test.ts`. `text.dim` measures 4.69:1 on `raised` — it passes
  AA by 0.19 at 12px. **T34 does not re-tune it.** If `dim` is wrong somewhere,
  the answer is to stop using `dim` there, not to move the colour: the values
  are D68/D69 territory and a change would need its own D-row and tranche 4's
  owner.
- **D72**, unchanged: separation is a surface step, never a hairline border. No
  border comes back as a substitute for contrast.

What T34 adds, and what T26 records as a D-row: **the semantic rule for which
token a piece of text gets.** That rule does not exist in tranche 4's tasks — it
is this task's deliverable.

**Do not start until T22 is on `main`:**

```bash
git log --oneline main -- components/ | grep "P17.T22" || echo "T22 HAS NOT LANDED — STOP"
```

### Context an implementer needs

`text-text-dim` appears **92 times in source** — that is a grep, and it is the
one number here that reproduces. The review adds that it outnumbers
`text-text-primary` 3.6:1 in the rendered DOM (3,349 against 920) with 6,102 dim
elements at ≤12px on `/leagues/1` alone.

🔴 **Those rendered figures are claims, not targets.** The review does not state
its method, and one of its other numbers (320 brass instances) does not survive
contact with the source. Step 1 takes the before-number yourself, with the
method written down, and the test in step 2 asserts against **your** measurement.
Note in particular that 6,102 dim elements on a page whose source has 92 dim
classes means either the loop multiplier below, or an element-walk that counted
inherited values per descendant — and those two support different conclusions.

The multiplier is real either way: 92 source uses produce many times that in
renders, because the heaviest of them sit inside the draft board's per-pick,
per-round, per-ledger-line iteration. That is why four call sites carry nearly
all of it, and why the fix is four edits rather than ninety-two.

**The four sites that produce nearly all of it**, and what each actually says:

| Site | Text | Is it content? |
|---|---|---|
| `PointsLedger.tsx:109` | the **award name** on a ledger line | Yes. It is the ledger's entire subject. |
| `PointsLedger.tsx:113` | the **points earned** on that line | Yes. It is the number the ledger exists to explain. |
| `DraftBoard.tsx:151,159` | the `Seat` and round-number **column headers** | Yes. A table's column headers are how its cells are read. |
| `StandingsPanel.tsx:68,72,77` | `Pos` / `Member` / `Points` **column headers** | Yes. Same. |

And the sites where `dim` is correct and stays:

| Site | Text | Why it stays |
|---|---|---|
| `PointsLedger.tsx:85,88` | the `▸`/`▾` disclosure marks | `aria-hidden` decoration. |
| `PickCell.tsx:43` | the round number in an **empty** cell | Its job is to say "nothing here yet" without looking like a failed image. |
| `PickCell.tsx:62` | the two-letter **initials placeholder** | Stand-in for artwork that has not arrived. |

**The rule, stated so a reviewer can apply it in one pass:**

> **`dim` is for text a reader never needs to read** — decoration, disclosure
> marks, and placeholders standing in for content that is not there.
> **`secondary` is for real content that is subordinate** — column headers,
> metadata, ledger lines, status words. **`primary` is the subject.**
>
> The test: **if removing the text would lose information, it is not `dim`.**

**Scope discipline.** Apply the rule to the sites named above and nowhere else.
Do not sweep all 92. 🔴 **The draft console and the watchlist are excluded** —
their use of `dim` was reviewed and is deliberate. And
`components/SectionHead.tsx:74` sets the right-hand slot `text-text-dim`, which
by this rule should be `secondary` — **that file is tranche 1's (T1). Flag it,
do not edit it.**

**What pins what.** The class change is RTL-visible, but a class assertion
proves only that a string changed. The thing that matters — that fewer elements
render at `dim` in a real signed-in page — is a **Playwright** count, and it is
the one that catches a site the sweep missed.

### Steps

- [ ] **Step 1: Confirm T22 has landed, and record the baseline**

```bash
git log --oneline main -- components/ | grep "P17.T22"
```

Then, signed in on your own port at 1440px, on `/leagues/<scratch>`:

```js
({
  dim: document.querySelectorAll('[class*="text-text-dim"]').length,
  secondary: document.querySelectorAll('[class*="text-text-secondary"]').length,
  primary: document.querySelectorAll('[class*="text-text-primary"]').length,
})
```

Record the three numbers **and this method** — "elements carrying the class",
which is not the same measurement as "elements whose computed colour resolves to
the token". They go in the commit body and T26's D-row. If they disagree with
the review's 3,349 / 920, say so there too: your measurement is the one the test
in step 2 asserts against.

- [ ] **Step 2: Write the failing browser test**

Add to `e2e/signed-in.spec.ts`:

```ts
  test('🔴 the de-emphasis token does not outnumber the subject', async ({ page }) => {
    const leagueId = await scratchLeagueWithPicks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/leagues/${leagueId}`);

    const counts = await page.evaluate(() => ({
      dim: document.querySelectorAll('[class*="text-text-dim"]').length,
      primary: document.querySelectorAll('[class*="text-text-primary"]').length,
    }));

    // `dim` exists to de-emphasise. A page where it outnumbers the subject is
    // a page where the de-emphasis token carries the content — measured at
    // 3.6:1 across the signed-in surfaces before P17.T34.
    expect(counts.dim).toBeLessThanOrEqual(counts.primary);
  });

  test('a ledger line reads its award name as content, not as decoration', async ({
    page,
  }) => {
    const leagueId = await scratchLeagueWithPicks(page);
    await page.goto(`/leagues/${leagueId}`);

    // Column headers are how a table's cells are read; they are content.
    const header = page.getByRole('columnheader', { name: 'Member' });
    if ((await header.count()) > 0) {
      const colour = await header.first().evaluate((node) => getComputedStyle(node).color);
      const dim = await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--color-text-dim')
          .trim(),
      );
      expect(colour.replace(/\s/g, '')).not.toBe(dim.replace(/\s/g, ''));
    }
  });
```

- [ ] **Step 3: Run it and watch it fail**

```bash
npx playwright test e2e/signed-in.spec.ts -g "de-emphasis token|reads its award name"
```

- [ ] **Step 4: Move the four content sites to `secondary`**

`components/PointsLedger.tsx` lines 109 and 113 — `text-text-dim` →
`text-text-secondary`, and add above the `<li>`:

```tsx
                /* 🔴 `secondary`, not `dim` (P17.T34). The award's name and the
                   points it earned are the ledger's entire subject — this is the
                   panel a reader opens *to read them*. `dim` is for text nobody
                   needs to read; the disclosure marks above are that, and these
                   are not. */
```

`components/DraftBoard.tsx` lines 151 and 159 — the `Seat` and round `<th>`s,
same swap, with:

```tsx
                  /* A table's column headers are how its cells are read, so
                     they are content (P17.T34). Loop-multiplied: one class here
                     is `rounds + 1` elements per group. */
```

`components/StandingsPanel.tsx` lines 68, 72 and 77 — `Pos` / `Member` /
`Points`, same swap and the same reasoning.

`app/(app)/leagues/[id]/page.tsx` — the `Group N` heading (`:210`) and the seat
order number (`:224`): a heading and a running-order position are both content.

- [ ] **Step 5: Say why the remaining ones stay**

`components/PickCell.tsx` — leave both `dim` uses and add to the docstring:

```tsx
 * 🔴 The empty cell's round number and the initials placeholder stay `dim`
 * (P17.T34). Both are text a reader never needs to read: one says "nothing here
 * yet" without looking like a failed image, the other stands in for artwork that
 * has not arrived. That is what `dim` is for. The badge over a real poster is
 * the round this pick was taken in — information — and is `secondary`.
```

`components/PointsLedger.tsx` — beside the `▸`/`▾` spans:

```tsx
        {/* Decoration, `aria-hidden`, and correctly `dim`: the rule is that
            `dim` is for text a reader never needs to read (P17.T34). */}
```

- [ ] **Step 6: Run the tests and watch them pass**

```bash
npx playwright test e2e/signed-in.spec.ts -g "de-emphasis token|reads its award name"
npm run test
```

- [ ] **Step 7: Check the contrast suite is still the authority**

```bash
npx vitest run theme/contrast.test.ts
```

Expected: PASS, **unchanged**. This task moves no token value. If this file has
a diff, you have crossed into tranche 4's work.

- [ ] **Step 8: Flag what you did not touch**

```bash
grep -rn "text-text-dim" components app | grep -vE "PickCell|PointsLedger|DraftBoard|StandingsPanel|leagues/\[id\]"
```

For each remaining hit, write one word in the commit body: `keep` (decoration or
placeholder), `console`/`watchlist` (off limits), or `tranche-1`
(`SectionHead.tsx:74`, which by this rule should be `secondary` and is not
yours). **Do not edit anything on that list.**

- [ ] **Step 9: Verify by hand at all four widths, both schemes**

The league page and the draft board at 1440, 1280, 1024 and 390px, both schemes.
🔴 The thing to look for in **light**: `secondary` is `#5c5566` against `dim`'s
`#665e70`, a small step, and the point is legibility rather than a visible
change. If the page now looks *louder*, you have moved something to `primary`
that should be `secondary`.

- [ ] **Step 10: Commit**

```bash
git add components/PointsLedger.tsx components/DraftBoard.tsx \
  components/StandingsPanel.tsx components/PickCell.tsx \
  app/\(app\)/leagues/\[id\]/page.tsx e2e/signed-in.spec.ts
git commit -m "P17.T34: dim stops carrying the content it exists to de-emphasise

The rule: dim is for text a reader never needs to read — decoration,
disclosure marks, placeholders. Secondary is real content that is
subordinate — column headers, metadata, ledger lines. The test is whether
removing the text loses information.

Four loop-multiplied sites move: PointsLedger's award names and earned
points, DraftBoard's and StandingsPanel's column headers, the league page's
group headings and seat order. PickCell's two stay dim, with the reason
written down. dim/primary on /leagues/<scratch>: <before> -> <after>.

No token value changes; theme/contrast.test.ts is unchanged. Inherits
T22's rename rather than renaming anything.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 11 (P17.T26): Record the phase's decisions, D86 onwards

**Files:**
- Modify: `docs/DECISIONS.md`
- Test: none — this is the ledger. Step 2 is the check.

**Interfaces:**
- Consumes: the decisions **the other four tranches actually made**, read out of
  their commits and their plans. D85 is already in the file (T35).
- Produces: a ledger complete through D97 (or through whatever number the real
  count reaches), and a "Still open" entry for Newsreader.

### Context an implementer needs

🔴 **The next free number is D86, not D85.** `docs/DECISIONS.md` was complete
through **D84** when this phase began — D79–D83 and D84 all landed in `d96e5ec`
("P15.T0: plan phase 15, and record D79-D84"), and D84 is *"E2E runs in CI, with
Clerk absent rather than credentialled"*. An earlier draft of this phase claimed
the ledger was four entries behind; that was read off P15.T0's unticked checkbox
rather than off the ledger, and was wrong. The checkbox was stale, not the
ledger. **P17.T35 then took D85** for the brass decision, on purpose and early,
because tranche 4's T21 and P18.T6 were blocked on it.

So this task writes **D86 onwards**, and verifies D85 is where T35 left it.

🔴 **Record what the tranches decided, not what was predicted on 2026-09-12.**
The task text names thirteen answers. Some of them will have moved: a task may
have been argued down (T18 was explicitly told to "argue that 79%-of-text-at-14px
is past what D71's reasoning intended, **or stand down**"), a task may have
produced a different answer than the one sketched, and two tasks in this tranche
produced decisions nobody predicted — **T34's `dim`/`secondary` rule** and
**T27's "`/members` is not built"**. Read the commits before you write a row.

**The candidate list**, with where to find what actually happened:

| # | Subject | Source |
|---|---|---|
| D85 | What brass means | **already written** by P17.T35 — unless it reached outcome C, see step 2 |
| — | Body size 15/13 (amends D71) | tranche 4, T18 — read the commit |
| — | Poster captions get the serif at 15px (D70) | tranche 4, T19 |
| — | `beam` is spent on live and countdowns | tranche 4, T20 |
| — | Surfaces renamed to match reality (D72 unchanged) | tranche 4, T22 |
| — | 40px section step | tranche 4, T23 |
| — | The 4px grid is enforced in `scripts/layering.sh` | tranche 4, T24 |
| — | 6px is the default radius (upholds D73) | tranche 4, T25 |
| — | `SectionHead` is 28/20/17 keyed to `as` | tranche 1, T1 |
| — | Identity, search and sign-in fold into the tab bar row | tranche 1, T2 |
| — | `/browse` `replaceState`s the cursor (amends D80) | tranche 1, T6 |
| — | `dim` is for text a reader never needs to read | **this tranche, T34** |
| — | The active season confirms before it re-scopes the app | **this tranche, T28** |
| — | A 404 renders inside the shell; `/members` is not built | **this tranche, T27** |
| — | P18.T0's decision(s) | Phase 18's plan |

That is more than thirteen candidates, which is the point: **the count is an
output, not an input.** If it lands on D96 or D99 rather than D97, that is
correct and the PLAN's number was an estimate.

🔴 **Newsreader is a deferral, not a decision.** T19's text says so explicitly:
"Newsreader is deferred, not decided — it renders once on a public page today,
and Phase 18 is a prose page that will change the arithmetic. Re-judge the
payload after 18 ships; do not drop it now." It belongs under **"Still open"**,
not in the table, and giving it a D-number would record a judgement nobody made.

**A row's shape**, from the file's own convention: `| D<n> | **The decision, in
bold, as a sentence.** The evidence, the alternative that lost, and what it
supersedes or amends. |` Every row that changes a locked decision must say so
in its own text — "amends D71", "upholds D73" — or the ledger and the code
disagree and the next reader trusts the wrong one.

### Steps

- [ ] **Step 1: Read what actually landed**

```bash
git log --oneline main --grep="^P17\.T" | sort -k2
for id in T1 T2 T6 T18 T19 T20 T22 T23 T24 T25 T27 T28 T34; do
  echo "=== $id ==="
  git log --format="%h %s%n%b" -1 --grep="^P17\.$id:" main
done
```

For each, write one line: **what was decided**, **what evidence decided it**,
and **which locked decision it amends, upholds or leaves alone**. A task that
stood down (T18 was permitted to) gets no row — record that in the commit body
instead.

Then read Phase 18's plan for P18.T0's decisions:

```bash
ls docs/superpowers/plans/ | grep -i "phase-18"
```

- [ ] **Step 2: Confirm where the ledger actually is**

```bash
grep -c "^| D" docs/DECISIONS.md
grep -n "^| D8[4-9] \|^| D9" docs/DECISIONS.md
```

Expected: a `D84` row reading "E2E runs in CI, with Clerk absent rather than
credentialled", a `D85` row reading the brass decision, and nothing after it.

🔴 **If `D85` is missing, find out which of two things happened before you write
anything.** Either P17.T35 did not run — stop and report, because tranche 4's
T21 and P18.T6 were told they were blocked on it — or T35 ran and reached its
outcome C, where the brass measurements were irreconcilable and it deliberately
wrote **no** row rather than invent one. In that case D85 is free, this task
starts at D85 rather than D86, and **T21 and P18.T6 are still blocked**: say so
in your report rather than closing the phase over an open blocker.

- [ ] **Step 3: Write the rows, from D86**

Append each in the file's table format, immediately after D85, in the order the
tasks ran. Two worked examples — write the rest the same way, from step 1's
notes, in the tranches' own words rather than these:

```markdown
| D86 | **Body text is 15px, with 13px as the small step.** Amends D71, which kept Archivo partly for its x-height "at 11–13px, which is where a league app lives" — the face reasoning stands, the resulting density does not. Measured 2026-09-12 across 1,272 public text elements and 5,744 signed-in ones: 79% of public text rendered at 14px and 88% of signed-in text at 12px, which is past what D71's reasoning intended rather than a consequence of it. Archivo's x-height carries 15px at almost no density cost and puts real air between body text and the 11px `Eyebrow`. Every `text-sm` and `text-xs` is swept rather than a third size being added beside them |
| D87 | **`dim` is for text a reader never needs to read; `secondary` is real content that is subordinate.** `text-dim` outnumbered `text-primary` 3.6:1 in the rendered DOM (3,349 to 920) with 6,102 dim elements at ≤12px on one league page, so the token that exists to de-emphasise was carrying the content. It is not a contrast failure — `text.dim` measures 4.69:1 on `raised` and passes AA by 0.19 — which is why the fix is semantic rather than a value change: no token moves, and `theme/contrast.test.ts` is untouched. The test a reviewer applies is **whether removing the text would lose information**. Decoration, disclosure marks and placeholders standing in for absent content stay `dim`; column headers, metadata, ledger lines and status words are `secondary`. The multiplier was the loop — 92 source uses producing thousands of renders inside the draft board's per-pick iteration — so four call sites carried nearly all of it |
```

- [ ] **Step 4: Put Newsreader under "Still open"**

Append to the `## Still open` section:

```markdown
- **Whether Newsreader stays in the payload.** D71 added it for prose, and it
  renders exactly once on a public page today. Phase 18 is a prose page and will
  change that arithmetic, so P17.T19 deliberately **deferred** the judgement
  rather than dropping the face on a count taken before its one consumer
  shipped. Re-judge after Phase 18: if the prose page is its only home and the
  page reads as well in Archivo, the face is payload for one element; if 18
  makes it the voice of the product's explanatory writing, it has earned its
  place. Not a decision, and not to be recorded as one.
```

- [ ] **Step 5: Check the block you just wrote**

```bash
grep -n "^| D8[5-9] \|^| D9" docs/DECISIONS.md
grep -n "Newsreader" docs/DECISIONS.md
```

Expected: a contiguous run from D85 with no gaps and no duplicates, the last
number matching the count of decisions you actually found, and Newsreader
appearing **only** under "Still open". Then read every row you wrote once more
and check three things: it is a sentence, it names its evidence, and it says
what it amends or upholds.

- [ ] **Step 6: Cross-check against the code**

For each row that amends a locked decision, confirm the code agrees:

```bash
grep -rn "text-sm\|text-xs" components/SectionHead.tsx   # D86's sweep reached it
npm run layering                                          # T24's and T33's greps pass
npm run verify
```

A row the code contradicts is worse than no row: the whole reason
`DECISIONS.md` is locked is that the next reader trusts it.

- [ ] **Step 7: Commit**

```bash
git add docs/DECISIONS.md
git commit -m "P17.T26: record D86-D<n> for what phase 17 decided

D85 was taken by P17.T35 (brass) so the tranches blocked on it could
proceed. This records the rest, read out of the tranches' commits rather
than off the phase's 2026-09-12 predictions — <n> decisions, not the
thirteen estimated, because <what moved>.

Newsreader goes under 'Still open': P17.T19 deferred it until Phase 18
ships the prose page that changes the arithmetic. A deferral is not a
decision and does not get a number.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage.** Every task in `docs/PLAN.md` § Phase 17 → "Signed-in
surfaces" has a task here: T27 (Task 2), T28 (Task 3), T29 (Task 8), T30 (Task
6), T31 (Task 7), T32 (Task 4), T33 (Task 9), T34 (Task 10), T35 (Task 1), T36
(Task 5), and "Recording the decisions" → T26 (Task 11). The two off-limits
screens have their own section and are excluded by name in T34 and T33. The
gate's four widths and both schemes appear as a numbered step in every task that
changes a rendered surface.

**Placeholders.** One deliberate parameterisation remains and is not a
placeholder: T33 cannot name the final class for the small step, because tranche
4's T18 owns it. The task names the source of truth, the three invariants, and
the default to take unless T18 says otherwise. Two commit messages carry
`<numbers>` / `<n>` because the number is the measurement the step produces.

**Type consistency.** `InviteAction` is `{ url: string; className?: string }` in
its test, its implementation, its story and its call site. `SeasonControl` is
`{ seasons, memberCount, className? }` in its test, its implementation and the
page that renders it. `RosterFilm`'s six required fields are supplied in full at
both new call sites (T31, T29). `signInAs` returns the user id, which
`scratchLeague` uses for `leagues.owner` and the draft seat.

**The review's figures.** No task here treats a number from the 2026-09-12
review as a target. T35 re-measures brass three ways before deciding and may
conclude there is nothing to decide; T33 takes its own before-and-after
histogram with the method recorded; T34 asserts against its own count, not the
review's. Where a figure does reproduce — the 92 source uses of
`text-text-dim`, the three arbitrary font sizes — the plan says which grep
produced it.

**Known gaps, flagged rather than resolved.** T32's second half is implemented on
`app/(app)/admin/page.tsx` because `/leagues` has no admin section; T29's first
step is a diagnosis with two specified outcomes because the review's wording
admits two causes; T33's `layering.sh` check may belong folded into tranche 4's
T24; `SectionHead.tsx:74` is a T34 finding in a tranche 1 file and is flagged,
not edited.

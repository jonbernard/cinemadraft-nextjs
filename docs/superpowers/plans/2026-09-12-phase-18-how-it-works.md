# Phase 18 — How it works

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/rules-and-scoring` with a public `/how-it-works` that is the
product's front door — the page that explains why the game is interesting —
with every number on it computed from `lib/services/scoring.ts` or the `points`
table rather than typed.

**Architecture:** One new route assembled from the Phase 3.5 primitives, fed by
one new service (`lib/services/how-it-works.ts`) whose only job is to pick a
real season and hand back the ledger the scoring rule already produces. The
page renders those values; it never performs arithmetic of its own. The old
route becomes a permanent redirect in `next.config.ts`, which Next runs
**before** the proxy, so a stale link from a year of league chat resolves
without touching auth.

**Tech Stack:** Next 16 App Router, React 19, TypeScript strict, Prisma,
Tailwind 4 + MUI, Vitest + Testing Library, Playwright, Storybook 10.

**Spec:** `docs/PLAN.md` § Phase 18 (there is no separate design doc; the PLAN
section carries the task list, the content inventory and the gate). Decisions
already taken: `docs/PROGRESS.md` § Phase 18 — P18.T0, decided 2026-09-12.

---

## Global Constraints

- **Biome, not ESLint or Prettier.** `npm run lint` covers linting, formatting
  and import order; `npm run typecheck` is separate.
- **MUI for components, Tailwind for custom styling**, through cascade layers
  ordered `theme, base, mui, components, utilities`. Never `!important`.
- **All local databases run in Docker** — `npm run db:up` before anything that
  touches the database. The database on port 5433 is a **restored copy of
  production**; league 1 is sixty real people's history. Nothing in this phase
  writes to it.
- **Never regenerate `package-lock.json` on macOS.** This phase adds no
  dependency; if that changes, `npm install <pkg>` then `npm run lock`.
- **`fixtures/` is generated.** Never hand-edit it.
- **Built from the Phase 3.5 primitives** — `SectionHead`, `Panel`, `Shelf`,
  `Button`, `StatusChip`, `Eyebrow`, `CinemaFrame`, `PosterFrame` — each new
  component carrying a Storybook story. **None of the retired treatments
  (D69–D77):** no `LetterboxRule`, no `font-display`, no Archivo `wdth` axis,
  no all-caps heading outside `Eyebrow`, no four-sided hairline card border, no
  squared or pill button.
- 🔴 **This constraint has INVERTED since the plan was written — Phase 17 is
  complete.** It used to say "old token vocabulary only, never ground / panel /
  surface". That is now exactly backwards:
  - **`bg-bg-ground` / `bg-bg-panel` / `bg-bg-surface`** are the live names
    (P17.T22, D90). `bg-bg-base` and `bg-bg-raised` are **retired** and
    `scripts/layering.sh`'s `no retired surface token names` check **fails the
    build** on either. `Panel`'s `tone` prop is `'panel' | 'surface'` — there
    is no `'raised'`, so the T1 skeleton below is stale where it writes one.
  - 🔴 **`surface` exists in both vocabularies and means different things**
    (it used to be the middle tone, it is now the top one). The grep cannot
    catch that. Read a neighbouring file rather than the plan.
  - **Body type is 15px / 13px small** (P17.T18, D88), set through `@theme`, so
    `text-sm` and `text-xs` already are those sizes — write the classes, not
    literals. An arbitrary `text-[Npx]` fails `text sizes come from the scale`.
  - **Spacing is on a 4px grid** and **6px is the default radius** (D92, D93),
    both enforced by the same script.
- 🔴 **No emoji at the start of a test title.** `no 🔴 in test titles` in
  `scripts/layering.sh` fails the build; titles say what they guard in words.
  Comments keep their 🔴.
- 🔴 **T6 is unblocked.** The plan calls it blocked on P17.T35; that resolved —
  brass means an award outcome only, and D99 records that spending it on a
  public page is safe.
- **No raw hex outside the token system.** `scripts/layering.sh` greps
  `components/`, `app/` and `.storybook/`.
- **The repository layer is the only code allowed to touch Prisma**, and
  `components/` may not import from `lib/services/` (D33) — types that cross
  that line are re-declared in the component file.
- **`data-testid` is the only test handle** (D66), stripped from production
  output unless `KEEP_TEST_IDS=1`. Assertions still go through roles and
  accessible names.
- **Touch targets ≥44px**, focus rings never removed, colour never the only
  carrier of state, every animation with a `prefers-reduced-motion` path.
- **One commit per task**, message starting with the task ID (`P18.T3: ...`).
  Tick the `PROGRESS.md` box as the final step of each task.
- **`npm run verify` before pushing** — lint, typecheck, layering, both test
  suites, build.

### Browser verification protocol (applies to every task that claims a pixel)

- **Production build, always.** `KEEP_TEST_IDS=1 npm run build`, then
  `npm run start` on its own port. `next dev` answers **403 for every
  `_next/static` chunk on `127.0.0.1`** — a dev measurement taken there reads
  an unstyled page and every geometry, contrast and overflow number from it is
  void. Measure dev on `localhost` or, better, do not measure dev.
- **1440, 1280, 1024 and 390px, in both schemes.** Eight combinations.
- 🔴 **The 2026-09-12 design review has been wrong repeatedly** — a "detached
  avatar" that was Next's dev indicator, a 1024px overflow that does not exist
  in production, award marks called transparent that are opaque JPEGs, a dead
  column off by 700px. Four of its premises have already failed against the
  real code. **If a step here depends on behaviour you have not personally
  seen in a production build, the step says so rather than asserting it.**
  Where this plan asserts a measurement, it says where the number came from.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `app/(app)/how-it-works/page.tsx` | The route. Assembles sections; performs no arithmetic |
| `lib/services/how-it-works.ts` | Picks a season with data and returns its best and worst ledgers, plus the season's shape |
| `lib/services/how-it-works.test.ts` | Season-walk and selection rules, repositories mocked — runs on CI |
| `lib/services/how-it-works.production.test.ts` | The same service against the restored corpus — excluded from CI |
| `components/WorkedExample.tsx` + `.stories.tsx` + `.test.tsx` | One film's ledger rendered open, with the arithmetic visible and derived |
| `components/ScoringTable.tsx` + `.stories.tsx` + `.test.tsx` | The rulebook, grouped by show with tier meanings inline, readable at 390px |
| `components/SeasonShape.tsx` + `.stories.tsx` + `.test.tsx` | Nomination and ceremony dates as a timeline |
| `app/(app)/how-it-works/opengraph-image.tsx` | The share card |
| `e2e/how-it-works.spec.ts` | The gate, in a browser |

**Modified**

| File | Change |
|---|---|
| `next.config.ts` | `redirects()` — `/rules-and-scoring` → `/how-it-works`, permanent |
| `proxy.ts`, `proxy.test.ts` | `/rules-and-scoring` → `/how-it-works` in `isPublic` |
| `lib/nav/links.ts` | The `yours` entry's `href` and `label` |
| `components/MoreSheet.test.tsx`, `components/MoreSheet.stories.tsx` | The same href and label in their fixture arrays |
| `e2e/nav.spec.ts:393` | The More-sheet assertion |
| `app/sitemap.ts` | The static entry |
| `docs/PARITY.md:194-195` | Both rows point at the new file |
| `docs/PROGRESS.md` | Checkboxes and the phase notes |

**Deleted**

| File | Why |
|---|---|
| `app/(app)/rules-and-scoring/page.tsx` | Replaced. Its surviving content moves to the new route in T1 before anything is rewritten |

---

## Execution order, and why

| # | Task | Why here |
|---|---|---|
| 1 | **T1** — route, redirect, spine | Everything else edits into this file, and the redirect ships with it so `/rules-and-scoring` is never a 404 at any commit. **T1 is a move, not a rewrite** — the old page's content lands on the new route verbatim, so the product is never worse than what it replaced |
| 2 | **T2** — the worked example | The phase's reason to exist and its only new service. Riskiest, so it gets the freshest attention; T3 and T6 are shaped around what it renders |
| 3 | **T3** — the scoring table | P18.T0 fixed its position *relative to the worked example* ("below"), so it follows T2 |
| 4 | **T4** — the twelve shows | Independent; reuses `ShowLogo`, whose 64px treatment already shipped |
| 5 | **T5** — the season shape | Independent; same `SeasonPhase` data the dashboard already loads |
| 6 | **T6** — motion and colour | Verifies a *rendered* page, so every section must exist. Also the one task blocked on P17.T35 |
| 7 | **T7** — the way in | The action belongs at the end of a finished argument, not before one |
| 8 | **T8** — SEO | Canonical and OG card need the final route and the final copy |
| 9 | **T9** — E2E | The gate |

**Review budget.** T2 and T6 get a reviewer pass; the rest do not. T2 because
the phase's central claim lives in it, T6 because it is the task that can be
declared done without having looked at anything. T3/T4/T5 are the same shape
(a component, a story, a test, a section) and are reviewed together if at all.
No re-reviews.

---

## Task 1: The route exists, the old one redirects, and nothing is lost

**Files:**
- Create: `app/(app)/how-it-works/page.tsx`
- Delete: `app/(app)/rules-and-scoring/page.tsx`
- Modify: `next.config.ts`, `proxy.ts`, `proxy.test.ts`, `lib/nav/links.ts`,
  `components/MoreSheet.test.tsx`, `components/MoreSheet.stories.tsx`,
  `e2e/nav.spec.ts:393`, `app/sitemap.ts`, `docs/PARITY.md`

**Interfaces:**
- Consumes: `pointRepository.findAll()` and `groupPointsByLevel(points)` from
  `lib/services/scoring-table.ts` — `ScoringLevel[]`, i.e.
  `{ level: string; tiers: { tier: number; points: number }[] }[]`, unchanged.
- Produces: the route `/how-it-works`, and the `<section>` ids later tasks fill
  in: `what-it-is`, `season`, `points`, `shows`, `razzies`, `start`.

**Context an implementer needs.**

P18.T0 is already decided (`docs/PROGRESS.md` § Phase 18): the route is
`/how-it-works`, `/rules-and-scoring` redirects permanently, the scoring table
stays on the same page **below the worked example**, and the nav label changes
with the route.

🔴 **Where the redirect lives, and why it is not a page.** Next's routing order
is documented in
`node_modules/next/dist/docs/01-app/02-guides/redirecting.md:293` — "`redirects`
runs **before** Proxy" — and again at `:345`. A `redirects()` entry in
`next.config.ts` therefore answers a 308 before `clerkMiddleware` ever sees the
request, so the redirect cannot be bounced to a sign-in page no matter what
`isPublic` says, and it costs no function invocation. A `permanentRedirect()`
inside a surviving `page.tsx` would work too but keeps a route segment alive
forever and depends on the proxy letting the request through first. Use the
config.

Because the config redirect fires first, `/rules-and-scoring`'s entry in
`isPublic` is now dead weight — but `/how-it-works` needs one, and `proxy.test.ts`
pins the whole array as a literal, so the two move together as one edit.

🔴 **This task moves content; it does not improve it.** The old page's prose and
its table land on the new route as they are (modulo the section spine below).
T2–T7 rewrite them. If you rewrite here, T3's diff becomes unreviewable and the
"what already exists must survive" list in `docs/PLAN.md` loses its checkpoint.

**The section spine**, from `docs/PLAN.md` § Phase 18 T1, in this order:

1. `h1` **How it works** + a lede
2. `h2` **What the game is**
3. `h2` **How a season runs** (T5 fills)
4. `h2` **How points work** → the rule, then the worked example (T2), then the
   scoring table (T3)
5. `h2` **The shows** (T4)
6. `h2` **What it costs you** (T2 fills with the real casualty)
7. `h2` **Start** (T7)

🔴 **One deviation from the spine, deliberate, and it is the phase's own
complaint.** `docs/PLAN.md` says the Razzie twist being the eighth paragraph is
why this phase exists — and the spine then puts it sixth of seven. The
resolution is one clause in the lede ("…and a Razzie nomination takes points
off you") so the twist is above the fold at 390px, while the section stays
where the spine puts it. Do not promote the whole section; the spine is the
plan of record.

- [ ] **Step 1: Write the failing proxy test edit**

In `proxy.test.ts`, replace the line `'/rules-and-scoring',` inside the pinned
array with `'/how-it-works',`.

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run proxy.test.ts
```

Expected: FAIL — the received array still contains `'/rules-and-scoring'` and
not `'/how-it-works'`.

- [ ] **Step 3: Move the matcher entry**

In `proxy.ts`, replace the `/rules-and-scoring` entry and its comment with:

```ts
  // The page that explains the game, and the one a new reader is most likely
  // to be sent. It reads the `points` table and the season's nominations and
  // writes nothing, so there is nothing behind it to protect.
  //
  // 🔴 `/rules-and-scoring` is NOT listed any more, and does not need to be:
  // `next.config.ts` redirects it permanently, and `redirects` runs before
  // this file (next/dist/docs/01-app/02-guides/redirecting.md:293), so the
  // stale URL never reaches the proxy at all.
  '/how-it-works',
```

- [ ] **Step 4: Run it to verify it passes**

```bash
npx vitest run proxy.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add the redirect**

In `next.config.ts`, inside `nextConfig`, after `images`:

```ts
  /**
   * The old rules page, permanently (P18.T0).
   *
   * 🔴 `permanent: true` is a 308, and a 308 is cached by browsers and
   * intermediaries essentially forever — which is correct here and would be a
   * trap anywhere the destination might move again. A year of league chat
   * holds `/rules-and-scoring` links and they must keep opening.
   *
   * In `next.config.ts` rather than as a page or in `proxy.ts` because
   * `redirects` runs *before* Proxy (next/dist/docs/01-app/02-guides/
   * redirecting.md:293): the stale URL resolves without auth ever seeing it,
   * and without a function invocation.
   */
  async redirects() {
    return [
      { source: '/rules-and-scoring', destination: '/how-it-works', permanent: true },
    ];
  },
```

- [ ] **Step 6: Move the page**

```bash
git mv "app/(app)/rules-and-scoring/page.tsx" "app/(app)/how-it-works/page.tsx"
rmdir "app/(app)/rules-and-scoring"
```

- [ ] **Step 7: Rewrite the moved file's frame, keeping every word of content**

Replace the metadata block, the docstring and the outer JSX of
`app/(app)/how-it-works/page.tsx` with the following. **The two `<Panel>`
bodies from the old file — the rules prose and the scoring table — are pasted
in verbatim at the two marked points.**

```tsx
import type { Metadata } from 'next';

import { Panel } from '@/components/Panel';
import { SectionHead } from '@/components/SectionHead';
import { pointRepository } from '@/lib/repositories/points';
import { groupPointsByLevel } from '@/lib/services/scoring-table';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'Draft a team of films before awards season, and score every nomination and win they pick up.',
};

/**
 * How the game works — the product's front door (Phase 18).
 *
 * Replaces `/rules-and-scoring`, which was two panels of grey prose behind a
 * login wall. Public: `proxy.ts` lists the route, and `next.config.ts`
 * redirects the old URL here permanently (P18.T0).
 *
 * 🔴 **Every number on this page is computed, never typed.** The point values
 * come from the `points` table through `groupPointsByLevel`; the worked
 * example comes from `lib/services/scoring.ts`, which is the single definition
 * of the scoring rule (D19, D41). A hand-written figure here drifts the first
 * time the points table changes, and this is the page where being wrong is
 * most embarrassing — so there are none, and `e2e/how-it-works.spec.ts` holds
 * that line.
 *
 * No testimonials, no logos-of-companies-using-us, no invented metrics
 * (docs/PLAN.md § Phase 18). If a figure cannot be sourced it is not here.
 */
export default async function HowItWorksPage() {
  const points = await pointRepository.findAll();
  const levels = groupPointsByLevel(points);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      <section className="flex flex-col gap-4">
        <SectionHead as="h1">How it works</SectionHead>
        <p className="text-text-secondary max-w-prose text-sm leading-relaxed">
          Draft a team of films before awards season, then score every
          nomination and win they pick up &mdash; and lose points when one of
          them takes a Razzie nomination.
        </p>
      </section>

      <section id="what-it-is" className="flex flex-col gap-4">
        <SectionHead as="h2">What the game is</SectionHead>
        {/* PASTE: the first <Panel>'s children from the old file, unchanged,
            minus its "The rules" SectionHead — this section has its own. */}
      </section>

      <section id="season" className="flex flex-col gap-4">
        <SectionHead as="h2">How a season runs</SectionHead>
        {/* P18.T5 fills this. */}
      </section>

      <section id="points" className="flex flex-col gap-4">
        <SectionHead as="h2">How points work</SectionHead>
        {/* P18.T2 inserts the worked example here, ABOVE the table (P18.T0). */}
        <Panel tone="surface" as="div" className="flex flex-col gap-4 p-5">
          {/* PASTE: the old file's scoring-table <Panel> children, unchanged.
              P18.T3 replaces this wholesale. */}
        </Panel>
      </section>

      <section id="shows" className="flex flex-col gap-4">
        <SectionHead as="h2">The shows</SectionHead>
        {/* P18.T4 fills this. */}
      </section>

      <section id="razzies" className="flex flex-col gap-4">
        <SectionHead as="h2">What it costs you</SectionHead>
        {/* P18.T2 fills this with the season's real casualty. */}
      </section>

      <section id="start" className="flex flex-col gap-4">
        <SectionHead as="h2">Start</SectionHead>
        {/* P18.T7 fills this. */}
      </section>
    </div>
  );
}
```

🔴 If `levels` is unused after the paste (it should not be — the table body
maps over it), do not delete the query to satisfy the linter; find the paste
you missed.

- [ ] **Step 8: Update the five call sites that name the old route**

`lib/nav/links.ts`:

```ts
  {
    href: '/how-it-works',
    label: 'How it works',
    ready: true,
    path: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 8v5M12 16h.01',
    group: 'yours',
  },
```

The same two fields in `components/MoreSheet.test.tsx` and
`components/MoreSheet.stories.tsx`'s fixture arrays.

`e2e/nav.spec.ts` (around line 393):

```ts
    await expect(sheet.getByRole('link', { name: 'How it works' })).toHaveAttribute(
      'href',
      '/how-it-works',
    );
```

`app/sitemap.ts`:

```ts
    { url: canonical('/how-it-works'), changeFrequency: 'yearly', priority: 0.3 },
```

- [ ] **Step 9: Prove nothing still points at the old route**

```bash
grep -rn "rules-and-scoring" app components lib e2e proxy.ts proxy.test.ts next.config.ts
```

Expected: exactly one hit — the `source` in `next.config.ts`. Anything else is
a live reference to a URL that now 308s, which works but costs a round trip and
reads as an oversight. (`docs/` hits are history and stay, except the two
`PARITY.md` rows updated in step 10.)

- [ ] **Step 10: Update PARITY.md**

In `docs/PARITY.md`, both rows at :194 and :195: change
`app/(app)/rules-and-scoring/page.tsx` to `app/(app)/how-it-works/page.tsx` and
append to each row's notes: `Route renamed by P18.T0; the old URL 308s.`

- [ ] **Step 11: Verify in a browser, production build**

```bash
KEEP_TEST_IDS=1 npm run build && npm run start -- -H 127.0.0.1 -p 3100
```

Then, signed out:

1. `curl -sI http://127.0.0.1:3100/rules-and-scoring | head -3` — expect
   `HTTP/1.1 308 Permanent Redirect` and `location: /how-it-works`.
2. `curl -sI http://127.0.0.1:3100/how-it-works | head -1` — expect
   `HTTP/1.1 200 OK`. A 307 here means the proxy entry did not land.
3. In the browser at 390px, confirm `document.scrollingElement.scrollWidth`
   equals 390 and the console is empty.

- [ ] **Step 12: Run the suites**

```bash
npm run lint && npm run typecheck && npm run layering && npm run test
```

Expected: PASS. `MoreSheet.test.tsx` and `proxy.test.ts` both exercise the
renamed values.

- [ ] **Step 13: Commit**

```bash
# Explicit paths, never `git add -A` — other agents may have work in flight.
git add app components lib e2e proxy.ts proxy.test.ts next.config.ts app/sitemap.ts docs/PARITY.md
git commit -m "P18.T1: /how-it-works replaces /rules-and-scoring, content intact"
```

---

## Task 2: The worked example — computed, not transcribed

**Files:**
- Create: `lib/services/how-it-works.ts`
- Create: `lib/services/how-it-works.test.ts`
- Create: `lib/services/how-it-works.production.test.ts`
- Create: `components/WorkedExample.tsx`, `components/WorkedExample.stories.tsx`,
  `components/WorkedExample.test.tsx`
- Modify: `app/(app)/how-it-works/page.tsx`

**Interfaces:**
- Consumes: `getLeaderboard(year)` and `availableSeasons()` from
  `lib/services/leaderboard.ts`; `ledgerForMovies(movieIds, year)` and the
  `MovieLedger` / `LedgerLine` types from `lib/services/scoring.ts`;
  `getActiveYear()` from `lib/services/season.ts`;
  `movieRepository.findManyByIds` and `posterUrl` for the poster.
- Produces:

```ts
// lib/services/how-it-works.ts
export type ExampleLine = {
  nominationId: number;
  awardName: string;
  eventName: string;
  points: number;
  won: boolean;
  earned: number;
};

export type Example = {
  movieId: number;
  title: string;
  posterUrl: string | null;
  /** 🔴 Always MovieLedger.total — the sum of `lines`, never recomputed. */
  total: number;
  lines: ExampleLine[];
};

export type WorkedExample = {
  /** The season these numbers are from. May not be the active season. */
  year: number;
  /** Whether `year` is the season the app is currently showing. */
  isActiveSeason: boolean;
  best: Example;
  /** The season's biggest loser, present only when its total is negative. */
  worst: Example | null;
};

export async function getWorkedExample(): Promise<WorkedExample | null>;
```

```ts
// components/WorkedExample.tsx — LedgerRow re-declared locally (D33)
export type ExampleRow = {
  nominationId: number;
  awardName: string;
  eventName: string;
  points: number;
  won: boolean;
  earned: number;
};

export function WorkedExample(props: {
  title: string;
  posterUrl: string | null;
  total: number;
  lines: readonly ExampleRow[];
  className?: string;
}): JSX.Element;
```

**Context an implementer needs.**

🔴 **This is the task the phase exists for, and the failure mode has a name.**
A worked example whose arithmetic is hand-written drifts the first time the
points table changes, and nobody notices, because prose does not fail a test.
So the design rule is absolute: **the page contains no numeric literal that
describes the game.** Every figure is a value that arrived from
`lib/services/scoring.ts`, and every operator shown between two figures is
derived from those same values.

Three concrete consequences, each of which a reviewer can check by reading the
JSX:

1. **The total is `ledger.total`.** `MovieLedger.total` is by construction the
   sum of `lines` (`lib/services/scoring.ts` — "🔴 `total` is the sum of
   `lines`… Computing it separately would allow a ledger that does not add up
   to the number printed above it"). Never `lines.reduce(...)` in the
   component; that is a second definition that can disagree.
2. **The doubling factor is derived, not typed.** A winning line renders
   `15 × 2 = 30` where the `2` is `line.earned / line.points`. If the rule ever
   became ×3, the page would print ×3 without an edit. Guard the divide:
   render the factor only when `line.won && line.points !== 0`.
3. **The word "twice" in prose is pinned by a test** that asks `scoreMovies`
   what a win is actually worth (step 3 below). If the rule stops doubling,
   that test goes red and the copy has to be fixed. It is the cheapest way to
   couple a sentence to a function.

**Why `getLeaderboard` and not a fresh query.** `getLeaderboard(year)` already
returns one row per nominated film with a `total`, sorted descending, scored
through `ledgerForMovies` — the same rule, the same load. Reusing it makes the
worked example's total *structurally* the same number the home page prints at
the top of the leaderboard, which is a property T9 can assert. The cost is that
this page scores the season twice per request (once through the board, once
through `ledgerForMovies` for the two chosen films). That is accepted: the
second call is scoped to two movie ids, and the alternative is a second
implementation of "who scored most".

**The empty-season fallback**, which `docs/PLAN.md` requires. In October the
active season has nominations from nobody. The service walks seasons newest
first, **starting no later than the active year** (never show a future season
as if it were live), and takes the first with rows. If no season has rows —
only possible on a freshly migrated database — it returns `null` and the page
renders the section's prose without an example. It must not throw, and it must
not render a zero.

🔴 **The Razzie casualty is part of this task, deliberately.** `docs/PLAN.md`
names "the Razzie twist is buried" as the second reason for the phase, and the
board that gives us `best` gives us `worst` for free — it is already sorted.
Rendering the season's actual biggest loser, with its real negative lines,
turns the phase's stated complaint into computed data for about fifteen lines
and one extra movie id in an existing batched call. It is the same component,
rendered twice. Only render it when the total is genuinely negative; a
"casualty" on +5 points is a claim the data does not support.

**Test placement.** `lib/services/how-it-works.test.ts` mocks the repositories
and **runs on CI**; `lib/services/how-it-works.production.test.ts` reads the
restored corpus and is **excluded from CI** by `vitest.ci.config.mts`. That
split is the house pattern (`watchlist.test.ts` vs
`watchlist.production.test.ts`) and it is what the naming convention means —
adding the new production file to `vitest.ci.config.mts`'s exclude list is part
of this task, because the `.production.` suffix is a convention, not a rule the
config infers.

- [ ] **Step 1: Write the failing service test (CI-safe, repositories mocked)**

Create `lib/services/how-it-works.test.ts`:

```ts
// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getLeaderboard = vi.fn();
const ledgerForMovies = vi.fn();
const getActiveYear = vi.fn();
const availableSeasons = vi.fn();
const findManyByIds = vi.fn();

vi.mock('@/lib/services/leaderboard', () => ({ getLeaderboard, availableSeasons }));
vi.mock('@/lib/services/scoring', () => ({ ledgerForMovies }));
vi.mock('@/lib/services/season', () => ({ getActiveYear }));
vi.mock('@/lib/repositories/movies', () => ({
  movieRepository: { findManyByIds },
}));

const { getWorkedExample } = await import('./how-it-works');

/** A board row as `getLeaderboard` shapes one. */
function row(movieId: number, title: string, total: number) {
  return { movieId, title, events: {}, total };
}

/** A ledger as `ledgerForMovies` shapes one: total IS the sum of lines. */
function ledger(movieId: number, lines: { points: number; won: boolean }[]) {
  const full = lines.map((line, index) => ({
    nominationId: movieId * 100 + index,
    awardId: index,
    awardName: `Award ${index}`,
    eventAbbreviation: 'oscars',
    eventName: 'Academy Awards',
    points: line.points,
    won: line.won,
    earned: line.won ? line.points * 2 : line.points,
  }));
  return {
    movieId,
    lines: full,
    total: full.reduce((sum, line) => sum + line.earned, 0),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findManyByIds.mockResolvedValue([]);
});

describe('getWorkedExample', () => {
  it('takes the top-scoring film of the active season', async () => {
    getActiveYear.mockResolvedValue(2026);
    availableSeasons.mockResolvedValue([2026, 2025]);
    getLeaderboard.mockResolvedValue({
      year: 2026,
      events: [],
      rows: [row(7, 'Top', 90), row(8, 'Middle', 40)],
    });
    ledgerForMovies.mockResolvedValue(
      new Map([
        [7, ledger(7, [{ points: 20, won: true }, { points: 15, won: true }, { points: 20, won: false }])],
        [8, ledger(8, [{ points: 20, won: true }])],
      ]),
    );

    const example = await getWorkedExample();

    expect(example?.year).toBe(2026);
    expect(example?.isActiveSeason).toBe(true);
    expect(example?.best.title).toBe('Top');
    expect(example?.best.movieId).toBe(7);
  });

  it('🔴 reports the ledger’s own total, never a re-sum of the board row', async () => {
    // The board row says 999 and the ledger says 75. The ledger wins: it is
    // the object whose `total` is by construction the sum of its lines
    // (lib/services/scoring.ts). A service that trusted the row would print a
    // total its own line items do not add up to.
    getActiveYear.mockResolvedValue(2026);
    availableSeasons.mockResolvedValue([2026]);
    getLeaderboard.mockResolvedValue({ year: 2026, events: [], rows: [row(7, 'Top', 999)] });
    const only = ledger(7, [{ points: 20, won: true }, { points: 35, won: false }]);
    ledgerForMovies.mockResolvedValue(new Map([[7, only]]));

    const example = await getWorkedExample();

    expect(example?.best.total).toBe(75);
    expect(example?.best.lines.reduce((sum, line) => sum + line.earned, 0)).toBe(75);
  });

  it('falls back to the newest season that has data, and says so', async () => {
    getActiveYear.mockResolvedValue(2026);
    availableSeasons.mockResolvedValue([2027, 2026, 2025]);
    getLeaderboard.mockImplementation(async (year: number) =>
      year === 2025
        ? { year, events: [], rows: [row(7, 'Old', 30)] }
        : { year, events: [], rows: [] },
    );
    ledgerForMovies.mockResolvedValue(
      new Map([[7, ledger(7, [{ points: 15, won: true }])]]),
    );

    const example = await getWorkedExample();

    expect(example?.year).toBe(2025);
    expect(example?.isActiveSeason).toBe(false);
    // 2027 is newer than the active season and must never be reached for.
    expect(getLeaderboard).not.toHaveBeenCalledWith(2027);
  });

  it('returns null rather than a zero when no season has been scored at all', async () => {
    getActiveYear.mockResolvedValue(2026);
    availableSeasons.mockResolvedValue([2026, 2025]);
    getLeaderboard.mockResolvedValue({ year: 2026, events: [], rows: [] });

    expect(await getWorkedExample()).toBeNull();
  });

  it('names the season’s casualty only when its total is actually negative', async () => {
    getActiveYear.mockResolvedValue(2026);
    availableSeasons.mockResolvedValue([2026]);
    getLeaderboard.mockResolvedValue({
      year: 2026,
      events: [],
      rows: [row(7, 'Top', 40), row(9, 'Razzed', -30)],
    });
    ledgerForMovies.mockResolvedValue(
      new Map([
        [7, ledger(7, [{ points: 20, won: true }])],
        [9, ledger(9, [{ points: -20, won: true }, { points: 10, won: false }])],
      ]),
    );

    const example = await getWorkedExample();
    expect(example?.worst?.title).toBe('Razzed');
    expect(example?.worst?.total).toBeLessThan(0);
  });

  it('names no casualty when the lowest-scoring film still scored something', async () => {
    getActiveYear.mockResolvedValue(2026);
    availableSeasons.mockResolvedValue([2026]);
    getLeaderboard.mockResolvedValue({
      year: 2026,
      events: [],
      rows: [row(7, 'Top', 40), row(9, 'Modest', 5)],
    });
    ledgerForMovies.mockResolvedValue(
      new Map([
        [7, ledger(7, [{ points: 20, won: true }])],
        [9, ledger(9, [{ points: 5, won: false }])],
      ]),
    );

    expect((await getWorkedExample())?.worst).toBeNull();
  });
});

describe('the rule the page states in words', () => {
  it('🔴 a win is worth exactly twice a nomination, per the scoring rule itself', async () => {
    // The page says "a win earns it a second time — twice a nomination's value".
    // That sentence is the one number on the page that is a word, so it is
    // pinned here against the function rather than against a comment. If the
    // rule ever stops doubling, this fails and the copy must change with it.
    const { scoreMovies } = await vi.importActual<
      typeof import('./scoring')
    >('./scoring');

    const nominated = scoreMovies({
      nominations: [{ id: 1, movieId: 1, awardId: 9 }],
      pointsByAward: new Map([[9, 7]]),
      winnersByAward: new Map(),
    });
    const won = scoreMovies({
      nominations: [{ id: 1, movieId: 1, awardId: 9 }],
      pointsByAward: new Map([[9, 7]]),
      winnersByAward: new Map([[9, new Set([1])]]),
    });

    expect(nominated.get(1)).toBe(7);
    expect(won.get(1)).toBe(14);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run lib/services/how-it-works.test.ts
```

Expected: FAIL — `Cannot find module './how-it-works'`.

- [ ] **Step 3: Write the service**

Create `lib/services/how-it-works.ts`:

```ts
import { movieRepository } from '@/lib/repositories/movies';
import { posterUrl } from '@/lib/utils/poster';
import { availableSeasons, getLeaderboard } from './leaderboard';
import { ledgerForMovies, type MovieLedger } from './scoring';
import { getActiveYear } from './season';

export type ExampleLine = {
  nominationId: number;
  awardName: string;
  eventName: string;
  points: number;
  won: boolean;
  earned: number;
};

export type Example = {
  movieId: number;
  title: string;
  posterUrl: string | null;
  /**
   * 🔴 Always `MovieLedger.total`, which is by construction the sum of
   * `lines` (lib/services/scoring.ts). Never the leaderboard row's own
   * figure and never a re-sum here: a second computation of the same number
   * is a second thing that can be wrong, and this page's whole claim is that
   * it cannot be.
   */
  total: number;
  lines: ExampleLine[];
};

export type WorkedExample = {
  year: number;
  isActiveSeason: boolean;
  best: Example;
  /** Present only when the lowest-scoring film of the season is on a minus. */
  worst: Example | null;
};

/**
 * One real film, its real nominations and its real total — the thing
 * `/how-it-works` is built around (P18.T2).
 *
 * 🔴 **Nothing here computes a score.** The season is picked, two films are
 * chosen out of an already-sorted board, and their ledgers are handed back as
 * `lib/services/scoring.ts` produced them. That is the entire contract, and it
 * is what lets the page promise that every number on it traces to the scoring
 * rule.
 *
 * The board is reused rather than re-derived (`getLeaderboard` already scores
 * the season through `ledgerForMovies` and sorts by total) so the example's
 * total is *structurally* the same number the dashboard's leaderboard prints
 * for that film. The cost is scoring the season twice per request on this one
 * page; the benefit is that the two surfaces cannot disagree.
 *
 * Walks seasons newest-first from the active year down, because in October the
 * active season has no nominations yet and an empty front door is worse than
 * last season's. A future season is never reached for: showing 2027's empty
 * board as though it were live would be a lie the data does not tell.
 */
export async function getWorkedExample(): Promise<WorkedExample | null> {
  const [activeYear, seasons] = await Promise.all([getActiveYear(), availableSeasons()]);
  const candidates = seasons.filter((year) => year <= activeYear).sort((a, b) => b - a);

  for (const year of candidates) {
    const board = await getLeaderboard(year);
    if (board.rows.length === 0) continue;

    const top = board.rows[0];
    const bottom = board.rows[board.rows.length - 1];
    if (!top || !bottom) continue;

    const ids = [...new Set([top.movieId, bottom.movieId])];
    const [ledgers, movies] = await Promise.all([
      ledgerForMovies(ids, year),
      movieRepository.findManyByIds(ids),
    ]);

    const posterById = new Map(
      movies.map((movie) => [movie.id, posterUrl(movie.poster, 'w342')]),
    );

    const best = toExample(top.title, posterById, ledgers.get(top.movieId));
    if (!best) continue;

    const lowest = toExample(bottom.title, posterById, ledgers.get(bottom.movieId));

    return {
      year,
      isActiveSeason: year === activeYear,
      best,
      // A film on +5 is not a cautionary tale. Only a negative total earns the
      // Razzie section its example; otherwise the section keeps its prose and
      // the point table's own negative rows carry the claim.
      worst: lowest && lowest.total < 0 ? lowest : null,
    };
  }

  return null;
}

function toExample(
  title: string,
  posterById: ReadonlyMap<number, string | null>,
  ledger: MovieLedger | undefined,
): Example | null {
  if (!ledger || ledger.lines.length === 0) return null;

  return {
    movieId: ledger.movieId,
    title,
    posterUrl: posterById.get(ledger.movieId) ?? null,
    total: ledger.total,
    lines: ledger.lines.map((line) => ({
      nominationId: line.nominationId,
      awardName: line.awardName,
      eventName: line.eventName,
      points: line.points,
      won: line.won,
      earned: line.earned,
    })),
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

```bash
npx vitest run lib/services/how-it-works.test.ts
```

Expected: PASS, all seven.

- [ ] **Step 5: Write the component's failing test**

Create `components/WorkedExample.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type ExampleRow, WorkedExample } from './WorkedExample';

/**
 * 🔴 Deliberately not the real point values. 7 and 14 are numbers that appear
 * nowhere in the `points` table, so a component that printed a hardcoded "15"
 * or "20" — or a hardcoded "× 2" — would be caught by these assertions rather
 * than accidentally agreeing with them.
 */
const lines: ExampleRow[] = [
  {
    nominationId: 1,
    awardName: 'Best Picture',
    eventName: 'Academy Awards',
    points: 7,
    won: true,
    earned: 14,
  },
  {
    nominationId: 2,
    awardName: 'Best Director',
    eventName: 'Golden Globes',
    points: 3,
    won: false,
    earned: 3,
  },
];

describe('WorkedExample', () => {
  it('prints the total it was given, not a sum of its own', () => {
    // 99 is deliberately NOT 14 + 3. The service's total is authoritative
    // (MovieLedger.total is the sum of lines by construction), and a component
    // that re-added the lines would silently substitute its own opinion.
    render(
      <WorkedExample title="A Film" posterUrl={null} total={99} lines={lines} />,
    );
    expect(screen.getByTestId('worked-example-total')).toHaveTextContent('99');
  });

  it('🔴 derives the win multiplier from the data, never a literal', () => {
    const tripled: ExampleRow[] = [{ ...lines[0]!, points: 7, earned: 21 }];
    render(
      <WorkedExample title="A Film" posterUrl={null} total={21} lines={tripled} />,
    );
    // If the rule were ever to change, the page would say what the rule now is.
    expect(screen.getByText(/×\s*3/)).toBeInTheDocument();
    expect(screen.queryByText(/×\s*2/)).not.toBeInTheDocument();
  });

  it('shows no multiplier on a nomination that did not win', () => {
    render(
      <WorkedExample title="A Film" posterUrl={null} total={3} lines={[lines[1]!]} />,
    );
    expect(screen.queryByText(/×/)).not.toBeInTheDocument();
  });

  it('does not divide by zero on a zero-point line', () => {
    const zero: ExampleRow[] = [{ ...lines[0]!, points: 0, earned: 0, won: true }];
    render(<WorkedExample title="A Film" posterUrl={null} total={0} lines={zero} />);
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });

  it('handles a negative line without inventing a sign', () => {
    const razzie: ExampleRow[] = [
      {
        nominationId: 3,
        awardName: 'Worst Picture',
        eventName: 'Razzies',
        points: -7,
        won: true,
        earned: -14,
      },
    ];
    render(
      <WorkedExample title="A Film" posterUrl={null} total={-14} lines={razzie} />,
    );
    const row = screen.getByRole('row', { name: /Worst Picture/ });
    expect(within(row).getByText('-14')).toBeInTheDocument();
    expect(screen.getByTestId('worked-example-total')).toHaveTextContent('-14');
  });

  it('names the win in words, not only in colour', () => {
    render(
      <WorkedExample title="A Film" posterUrl={null} total={17} lines={lines} />,
    );
    expect(screen.getByText('Won')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

```bash
npx vitest run components/WorkedExample.test.tsx
```

Expected: FAIL — `Cannot find module './WorkedExample'`.

- [ ] **Step 7: Write the component**

Create `components/WorkedExample.tsx`:

```tsx
import { PosterFrame } from '@/components/PosterFrame';
import { StatusChip } from '@/components/StatusChip';
import { cn } from '@/lib/utils/cn';

/**
 * Structurally `LedgerLine` from `lib/services/scoring.ts`, re-declared here
 * because `components/` may not import a service (D33).
 */
export type ExampleRow = {
  nominationId: number;
  awardName: string;
  eventName: string;
  /** What a nomination in this category is worth. */
  points: number;
  won: boolean;
  /** What this line contributed: `points`, doubled when won. */
  earned: number;
};

/**
 * One film's season, with the arithmetic showing (P18.T2).
 *
 * 🔴 **Nothing here is typed.** `total` arrives from the scoring service and is
 * printed; the per-line multiplier is `earned / points`, so if the rule ever
 * stopped doubling a win this page would say what the rule now does rather
 * than what it used to. There is no numeric literal in this file that
 * describes the game.
 *
 * 🔴 **Flat, not grouped by show.** `PointsLedger` groups because a draft board
 * needs "it got 195 from the Oscars"; a reader learning the game needs a list
 * they can add up. Keeping it flat also means the grouping logic lives in
 * exactly one component rather than two that can drift.
 *
 * A `<table>` because it is one: three columns of aligned figures with a
 * summary row. `<caption>` names the film for a screen reader, and the total
 * is a `<tfoot>` so it is announced as the summary it is.
 *
 * **A win is stated, never only coloured** — the brass chip carries the fact
 * and the word "Won" names it, the same rule as `PointsLedger` and the winner
 * seal. Colour alone is invisible to a colour-blind reader and in print.
 */
export function WorkedExample({
  title,
  posterUrl,
  total,
  lines,
  className,
}: {
  title: string;
  posterUrl: string | null;
  total: number;
  lines: readonly ExampleRow[];
  className?: string;
}) {
  const won = lines.some((line) => line.won);

  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-start', className)}>
      <PosterFrame
        title={title}
        posterUrl={posterUrl}
        points={total}
        status={won ? 'won' : 'nominated'}
        className="w-32 shrink-0 sm:w-36"
      />

      <div className="min-w-0 flex-1 overflow-x-auto">
        <table className="tabular w-full text-left text-sm">
          <caption className="sr-only">
            How {title} scored, award by award.
          </caption>
          <thead>
            <tr className="text-text-dim font-sans text-xs uppercase tracking-[0.06em]">
              <th scope="col" className="py-2 pr-4 font-semibold">
                Nomination
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">
                Worth
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Earned
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.nominationId} className="border-border-rule border-t">
                <th scope="row" className="py-2 pr-4 font-normal">
                  <span className="text-text-primary block leading-tight">
                    {line.awardName}
                  </span>
                  <span className="text-text-dim block text-xs leading-tight">
                    {line.eventName}
                  </span>
                </th>
                <td className="text-text-secondary py-2 pr-4 text-right align-top font-mono">
                  {line.points}
                  {/* 🔴 The multiplier, derived. Guarded against a zero-point
                      line, which would otherwise print NaN. */}
                  {line.won && line.points !== 0 ? (
                    <span className="text-text-dim"> × {line.earned / line.points}</span>
                  ) : null}
                </td>
                <td className="text-text-primary py-2 text-right align-top font-mono">
                  <span className="flex flex-wrap items-center justify-end gap-2">
                    {line.won ? <StatusChip tone="brass">Won</StatusChip> : null}
                    {line.earned}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-border-rule border-t-2">
              <th scope="row" className="text-text-primary py-2 pr-4 font-semibold">
                Total
              </th>
              <td />
              <td
                data-testid="worked-example-total"
                className="text-text-primary py-2 text-right font-mono font-semibold"
              >
                {total}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run it to verify it passes**

```bash
npx vitest run components/WorkedExample.test.tsx
```

Expected: PASS, all six.

- [ ] **Step 9: Write the Storybook story**

Create `components/WorkedExample.stories.tsx` with three stories — `Winner`
(mixed won/nominated lines), `NominationsOnly`, and `RazzieCasualty` (all
negative) — using the same fixture shape as the test. Follow
`components/LeaderboardTable.stories.tsx` for the meta block's conventions.

- [ ] **Step 10: Write the production test**

Create `lib/services/how-it-works.production.test.ts`:

```ts
// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { getWorkedExample } from './how-it-works';
import { getLeaderboard } from './leaderboard';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * The worked example against the restored corpus — the evidence that the page
 * shows sixty real people's season and not a fixture.
 *
 * Excluded from CI (`vitest.ci.config.mts`): CI has the schema and no rows, so
 * `getWorkedExample` correctly returns null there and every assertion below
 * would be vacuous. The season-walk and selection *rules* are pinned in
 * `how-it-works.test.ts`, which needs no database and runs on every push.
 */
describe('getWorkedExample, against real data', () => {
  it('🔴 agrees with the leaderboard, film for film and number for number', async () => {
    const example = await getWorkedExample();
    expect(example).not.toBeNull();
    if (!example) return;

    const board = await getLeaderboard(example.year);
    expect(board.rows[0]?.movieId).toBe(example.best.movieId);
    expect(board.rows[0]?.total).toBe(example.best.total);
    expect(board.rows[0]?.title).toBe(example.best.title);
  });

  it('🔴 the lines add up to the total, exactly', async () => {
    const example = await getWorkedExample();
    if (!example) return;

    const summed = example.best.lines.reduce((sum, line) => sum + line.earned, 0);
    expect(summed).toBe(example.best.total);
    expect(example.best.lines.length).toBeGreaterThan(1);
  });

  it('🔴 every winning line earned exactly twice its nomination value', async () => {
    const example = await getWorkedExample();
    if (!example) return;

    for (const line of example.best.lines) {
      expect(line.earned).toBe(line.won ? line.points * 2 : line.points);
    }
  });

  it('names a casualty only on a negative total, if it names one', async () => {
    const example = await getWorkedExample();
    if (!example?.worst) return;
    expect(example.worst.total).toBeLessThan(0);
    expect(
      example.worst.lines.reduce((sum, line) => sum + line.earned, 0),
    ).toBe(example.worst.total);
  });
});
```

- [ ] **Step 11: Exclude it from CI**

In `vitest.ci.config.mts`, beside the other service entries:

```ts
  // The worked example on /how-it-works, read against the restored season —
  // it asserts agreement with the real leaderboard, which CI has no rows for.
  // The season-walk and selection rules are how-it-works.test.ts, which mocks
  // the repositories and runs on every push.
  'lib/services/how-it-works.production.test.ts',
```

- [ ] **Step 12: Run both, and prove the exclusion works**

```bash
npm run db:up
npx vitest run lib/services/how-it-works.production.test.ts
npm run test:ci -- lib/services/how-it-works
```

Expected: the first PASSES against the restored database; the second runs
`how-it-works.test.ts` **only** — if the production file appears in the second
run's file list, the exclude entry did not match.

- [ ] **Step 13: Render it on the page**

In `app/(app)/how-it-works/page.tsx`, add the service call to the page's
`Promise.all`, and insert into the `points` section **above** the scoring table
(P18.T0), plus the `razzies` section:

```tsx
{example ? (
  <Panel tone="raised" as="div" className="flex flex-col gap-4 p-5">
    <Eyebrow tone="brass">
      {example.isActiveSeason
        ? `${example.year} season, so far`
        : `${example.year} season`}
    </Eyebrow>
    <p className="text-text-secondary max-w-prose text-sm leading-relaxed">
      {example.best.title} is the highest-scoring film of the{' '}
      {example.isActiveSeason ? 'season so far' : `${example.year} season`}. This
      is every nomination it picked up, and what each one was worth.
    </p>
    <WorkedExample
      title={example.best.title}
      posterUrl={example.best.posterUrl}
      total={example.best.total}
      lines={example.best.lines}
    />
  </Panel>
) : null}
```

and, in `razzies`, after the prose:

```tsx
{example?.worst ? (
  <Panel tone="raised" as="div" className="flex flex-col gap-4 p-5">
    <p className="text-text-secondary max-w-prose text-sm leading-relaxed">
      It is not theoretical. {example.worst.title} ended the {example.worst.year ?? example.year}{' '}
      season on {example.worst.total}.
    </p>
    <WorkedExample
      title={example.worst.title}
      posterUrl={example.worst.posterUrl}
      total={example.worst.total}
      lines={example.worst.lines}
    />
  </Panel>
) : null}
```

🔴 `Example` carries no `year` of its own — use `example.year` and delete the
`??` in the snippet above. It is written here so you notice; leaving a
nullish-coalesce against a property that does not exist is a type error
`npm run typecheck` will catch either way.

- [ ] **Step 14: Verify in a browser, production build**

`KEEP_TEST_IDS=1 npm run build && npm run start`, then at 1440 and 390px in
both schemes:

1. The example renders and names a real film. **Cross-check by hand:** open
   `/` and confirm the top leaderboard row is the same film with the same
   total. If they differ, one of them is wrong and this task is not done.
2. Read every visible figure in the table and add the `Earned` column by hand.
   It must equal the Total row. (Yes, by hand, once. The test asserts it; this
   is the step that catches the table rendering a column it did not intend to.)
3. `document.scrollingElement.scrollWidth` equals the viewport at 390px. The
   table's own `overflow-x-auto` wrapper may scroll; the document may not.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "P18.T2: the worked example, computed from the scoring service"
```

---

## Task 3: The scoring table, rebuilt legibly

**Files:**
- Create: `components/ScoringTable.tsx`, `components/ScoringTable.stories.tsx`,
  `components/ScoringTable.test.tsx`
- Modify: `app/(app)/how-it-works/page.tsx` (the `points` section's table panel)

**Interfaces:**
- Consumes: `groupPointsByLevel(points)` → `ScoringLevel[]`, already loaded by
  the page in T1. Unchanged.
- Produces:

```tsx
export type ScoringGroup = {
  level: string;
  tiers: { tier: number; points: number }[];
};

export function ScoringTable(props: {
  levels: readonly ScoringGroup[];
  className?: string;
}): JSX.Element;
```

**Context an implementer needs.**

The existing table is four columns — show, Tier 1, Tier 2, Tier 3 — with the
tier *meanings* in a bullet list three paragraphs above it. A reader has to
hold "Tier 2 means acting, writing and directing" in their head while scanning
a grid of bare numbers, and at 390px the grid is inside `overflow-x-auto`, so
the show name scrolls away from its own figures.

`docs/PLAN.md` T3: "grouped by show with the tier meaning inline rather than as
a bare 3-column grid, and readable on a phone."

So: one block per award show, and within it one row per tier reading
**"Best Picture — 20"** rather than a cell under a column header. That is a
definition list, not a table: term and description. It reflows to a phone for
free because it was never a grid.

🔴 **The tier meanings are copy, and the tier numbers are data.** The mapping
is Tier 1 = Best Picture, Tier 2 = acting, writing and directing, Tier 3 =
every other televised category (`docs/PROGRESS.md` § Phase 18 notes, confirmed
against the `points` table 2026-09-12). The *label* is a constant in this
component keyed by tier number; the *value* beside it is `tiers[].points` from
the database. A tier the copy has no label for renders `Tier N` rather than
nothing — the `points` table is editable and a fourth tier must not vanish
silently.

🔴 **Alphabet Awards are flat and that must stay visible.** All three tiers are
worth 5 (`docs/PROGRESS.md` § Phase 18 notes). A component that collapsed
identical values into one row would read as "Alphabet: 5" and lose the fact
that the tier system does not apply there — which is one of the four things
`docs/PLAN.md` says must survive the rewrite. `groupPointsByLevel` already
refuses to collapse them (`scoring-table.test.ts` has a test named for exactly
this); this component must not undo that.

**A win is worth this twice** stays as the line under the heading, unchanged
from the old page. It is pinned by T2's `scoreMovies` test.

- [ ] **Step 1: Write the failing test**

Create `components/ScoringTable.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type ScoringGroup, ScoringTable } from './ScoringTable';

const levels: ScoringGroup[] = [
  {
    level: 'Oscars',
    tiers: [
      { tier: 1, points: 20 },
      { tier: 2, points: 15 },
      { tier: 3, points: 10 },
    ],
  },
  {
    level: 'Alphabet',
    tiers: [
      { tier: 1, points: 5 },
      { tier: 2, points: 5 },
      { tier: 3, points: 5 },
    ],
  },
  {
    level: 'Razzies',
    tiers: [
      { tier: 1, points: -20 },
      { tier: 2, points: -15 },
      { tier: 3, points: -10 },
    ],
  },
];

describe('ScoringTable', () => {
  it('gives every level its own group in the order it was handed', () => {
    render(<ScoringTable levels={levels} />);
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual([
      'Oscars',
      'Alphabet',
      'Razzies',
    ]);
  });

  it('🔴 names what each tier means beside its value, not in a separate legend', () => {
    render(<ScoringTable levels={levels} />);
    const oscars = screen.getByTestId('scoring-group-Oscars');
    expect(within(oscars).getByText('Best Picture')).toBeInTheDocument();
    expect(within(oscars).getByText('20')).toBeInTheDocument();
  });

  it('🔴 keeps all three rows on a flat level rather than collapsing them', () => {
    // Alphabet is 5/5/5 in the real data. Collapsing equal values would erase
    // the fact that the tier system does not apply to it.
    render(<ScoringTable levels={levels} />);
    const alphabet = screen.getByTestId('scoring-group-Alphabet');
    expect(within(alphabet).getAllByText('5')).toHaveLength(3);
  });

  it('prints a negative value with its sign', () => {
    render(<ScoringTable levels={levels} />);
    const razzies = screen.getByTestId('scoring-group-Razzies');
    expect(within(razzies).getByText('-20')).toBeInTheDocument();
  });

  it('🔴 falls back to "Tier N" for a tier the copy has no name for', () => {
    // The points table is editable; a fourth tier must appear, not vanish.
    render(
      <ScoringTable
        levels={[{ level: 'New', tiers: [{ tier: 4, points: 1 }] }]}
      />,
    );
    expect(screen.getByText('Tier 4')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders nothing rather than an empty shell when there are no levels', () => {
    const { container } = render(<ScoringTable levels={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run components/ScoringTable.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `components/ScoringTable.tsx`:

```tsx
import { cn } from '@/lib/utils/cn';

/**
 * Structurally `ScoringLevel` from `lib/services/scoring-table.ts`,
 * re-declared because `components/` may not import a service (D33).
 */
export type ScoringGroup = {
  level: string;
  /** Ascending by tier, as the service sorts them. */
  tiers: { tier: number; points: number }[];
};

/**
 * What each tier actually is (docs/PLAN.md § Phase 18, "the three tiers and
 * what each means" — content that must survive the rewrite).
 *
 * 🔴 The *label* is copy and lives here; the *value* beside it comes from the
 * `points` table. A tier with no label still renders, because the table is
 * editable and a category band that appeared in the database but not on this
 * page would be invisible to the only readers who need it.
 */
const TIER_MEANING: Record<number, string> = {
  1: 'Best Picture',
  2: 'Acting, writing and directing',
  3: 'Every other televised category',
};

/**
 * The scoring rulebook, grouped by show (P18.T3).
 *
 * 🔴 A definition list, not a grid. The old three-column table put the tier
 * meanings in a bullet list three paragraphs above the numbers, so a reader had
 * to hold "tier 2 means acting" in their head while scanning bare cells — and
 * at 390px the grid scrolled horizontally, taking the show's name away from its
 * own figures. Term and description reflow to one column for free.
 *
 * Level order is the service's (descending by the level's highest value) and is
 * carried through untouched: the most valuable show reads first, which is the
 * order a new reader wants.
 */
export function ScoringTable({
  levels,
  className,
}: {
  levels: readonly ScoringGroup[];
  className?: string;
}) {
  if (levels.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {levels.map((group) => (
        <div
          key={group.level}
          data-testid={`scoring-group-${group.level}`}
          className="flex flex-col gap-2"
        >
          <h3 className="text-text-primary font-sans text-[17px] font-semibold tracking-[-0.01em]">
            {group.level}
          </h3>
          <dl className="flex flex-col">
            {group.tiers.map((tier) => (
              <div
                key={tier.tier}
                className="border-border-rule flex items-baseline justify-between gap-4 border-t py-2"
              >
                <dt className="text-text-secondary text-sm leading-tight">
                  {TIER_MEANING[tier.tier] ?? `Tier ${tier.tier}`}
                </dt>
                <dd className="text-text-primary tabular shrink-0 font-mono text-sm">
                  {tier.points}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

```bash
npx vitest run components/ScoringTable.test.tsx
```

Expected: PASS, all six.

- [ ] **Step 5: Write the story**

Create `components/ScoringTable.stories.tsx` with two stories: `Default` (the
four real levels, values copied from `docs/PROGRESS.md` § Phase 18 notes —
Alphabet 5/5/5, Golden Globes 5/10/15, Oscars 10/15/20, Razzies −10/−15/−20)
and `UnknownTier` (a level with a tier 4). A story fixture is allowed to carry
real values; it is not shipped to a reader.

- [ ] **Step 6: Swap it into the page**

In `app/(app)/how-it-works/page.tsx`, replace the pasted table `<Panel>` in the
`points` section with:

```tsx
<Panel tone="raised" as="div" className="flex flex-col gap-4 p-5">
  <SectionHead as="h3" className="pb-0">
    What every nomination is worth
  </SectionHead>
  <p className="text-text-secondary max-w-prose text-sm leading-relaxed">
    A nomination earns a category&rsquo;s points. A win earns it a second time
    &mdash; twice a nomination&rsquo;s value in total &mdash; because winning a
    category means you were nominated for it too.
  </p>
  <ScoringTable levels={levels} />
</Panel>
```

🔴 `SectionHead as="h3"` here and `<h3>` inside `ScoringTable` would nest two
h3s. Pick one: either drop `SectionHead` here, or change the component's
heading to `h4`. **Decide by reading the rendered outline** — the `points`
section's heading is an `h2`, so the panel title is an `h3` and each show is an
`h4`. Change `ScoringTable`'s `<h3>` to `<h4>` and its test's
`getAllByRole('heading', { level: 3 })` to level 4.

- [ ] **Step 7: Verify in a browser**

Production build, 1440 / 1280 / 1024 / 390px, both schemes:

1. No horizontal scroll anywhere in the section. The old wrapper's
   `overflow-x-auto` is gone; if anything scrolls, a `dt` is not wrapping.
2. At 390px, every show's name and all three of its values are on screen
   together without scrolling. Screenshot one for the record.
3. The four real levels render with the values in `docs/PROGRESS.md` § Phase 18
   notes. If they differ, **the notes are stale, not the page** — the page
   reads the table. Record the new values in PROGRESS rather than editing the
   page.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "P18.T3: the scoring rulebook, grouped by show with the tiers named"
```

---

## Task 4: The twelve shows

**Files:**
- Modify: `app/(app)/how-it-works/page.tsx` (the `shows` section)

**Interfaces:**
- Consumes: `getAwardShows()` from `lib/services/award-show.ts` →
  `AwardShowSummary[]` (`{ eventId, abbreviation, name, categoryCount,
  needsNominations, needsWinners, imageUrl }`), and `ShowLogo` from
  `components/ShowLogo.tsx`.
- Produces: nothing other tasks consume.

**Context an implementer needs.**

🔴 **P17.T12 has already shipped**, commit `8430113` — `ShowLogo`'s `DIMENSIONS`
is `{ sm: 64, lg: 96 }` on a white plate with `object-contain` and padding, and
`/award-shows` already pluralises its category count. The `PROGRESS.md`
checkbox for T12 is unticked; the code is not. **Verify before building on it:**

```bash
grep -n "DIMENSIONS" components/ShowLogo.tsx
```

Expected: `const DIMENSIONS = { sm: 64, lg: 96 } as const;`. If it says 40,
this task is blocked on T12 and stops here rather than shipping 40px marks.

**This is the page that teaches the vocabulary the leaderboard assumes.** A
reader who has never seen "ACE" or "ASC" meets those abbreviations as column
headers on the dashboard. So this section prints the full name, and the
abbreviation as a subordinate label — the same lockup `/award-shows` uses, so
the two pages teach the same thing the same way. Reuse that page's card markup
rather than inventing a second one; link each card to the show.

🔴 **"Twelve" is a number and must not be typed.** The heading and any count in
the copy come from `shows.length`, pluralised. The database holds twelve today;
a thirteenth show would make a hardcoded "twelve" a lie on the page whose whole
promise is that it does not lie about numbers.

**Grouping.** `docs/PLAN.md`'s surviving-content list includes "the twelve
award shows and their grouping" — Alphabet Awards (nine guild and critics
bodies), Golden Globes, Academy Awards, Razzies. That grouping is the `level`
column on `points`, not a column on `events`, and there is no join between an
event and its points level that this page can make cheaply.

🔴 **Flagged as under-specified rather than guessed:** the existing prose lists
the grouping by name (the nine Alphabet bodies are enumerated as copy in the
old page and that copy survives into T1's `what-it-is` section). This task
renders the twelve marks as a flat grid and leaves the grouping where the prose
already puts it. If the owner wants the grid itself grouped, the join is
`awards.pointsId → points.level` aggregated per event, which is a new service
function and a new task — do not invent it inside this one.

- [ ] **Step 1: Load the shows**

Add `getAwardShows()` to the page's `Promise.all`.

- [ ] **Step 2: Render the section**

```tsx
<section id="shows" className="flex flex-col gap-4">
  <SectionHead
    as="h2"
    eyebrow={shows.length === 0 ? undefined : `${shows.length} shows`}
  >
    The shows that score
  </SectionHead>
  <p className="text-text-secondary max-w-prose text-sm leading-relaxed">
    These are the {shows.length} award {shows.length === 1 ? 'show' : 'shows'}{' '}
    a nomination can come from. Their abbreviations are the column headings on
    the leaderboard.
  </p>

  <ul className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4">
    {shows.map((show) => (
      <li key={show.eventId}>
        <Link
          href={`/award-shows/${show.abbreviation}`}
          className="bg-bg-surface hover:bg-bg-raised focus-visible:outline-accent-fill flex h-full flex-col gap-1 rounded-md p-4 focus-visible:outline-2"
        >
          <ShowLogo imageUrl={show.imageUrl} className="mb-2" />
          <Eyebrow>{show.abbreviation}</Eyebrow>
          <span className="text-text-primary font-serif text-base tracking-[-0.02em]">
            {show.name}
          </span>
        </Link>
      </li>
    ))}
  </ul>
</section>
```

🔴 No `?year=` on the href, unlike `/award-shows`'s cards: this page is not
scoped to a season and the show page defaults to the active one. A year
borrowed from the worked example's *fallback* season would send a reader to
last year's nominations.

🔴 The category count is omitted here deliberately — `/award-shows` shows it
because that page is a working index; this one is teaching names, and a count
of categories is noise at that job. This is a judgement call; if a reviewer
disagrees, the field is already on the DTO.

- [ ] **Step 3: Verify in a browser**

Production build, all four widths, both schemes:

1. Count the cards on screen. It must equal the row count:
   `npm run db:psql -c "select count(*) from events"` — record both numbers.
   **If a show has no `image`, its card renders the name with no mark** (that is
   `ShowLogo`'s documented behaviour, returning null) — note which, so it is not
   later reported as a broken image.
2. 🔴 The marks are **opaque JPEGs on a white plate**, not transparent PNGs —
   the 2026-09-12 review said otherwise and was wrong. Confirm in dark mode
   that each mark reads against its plate; if one does not, that is a source
   artwork problem, not a token problem.
3. At 390px the grid is one column and nothing overflows.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "P18.T4: the shows that score, with marks you can read"
```

---

## Task 5: The season shape

**Files:**
- Create: `components/SeasonShape.tsx`, `components/SeasonShape.stories.tsx`,
  `components/SeasonShape.test.tsx`
- Modify: `app/(app)/how-it-works/page.tsx` (the `season` section)

**Interfaces:**
- Consumes: `getDashboard(null).events` — `SeasonPhase[]`, already the
  dashboard's shape: `{ key, eventId, phase: 'nominations' | 'ceremony', name,
  abbreviation, date: number | null, complete }`, sorted with undated phases
  last.
- Produces:

```tsx
export type SeasonPhase = {
  key: string;
  eventId: number;
  phase: 'nominations' | 'ceremony';
  name: string | null;
  abbreviation: string | null;
  /** Epoch milliseconds, UTC. Null means unscheduled. */
  date: number | null;
  complete: boolean;
};

export function SeasonShape(props: {
  phases: readonly SeasonPhase[];
  className?: string;
}): JSX.Element | null;
```

**Context an implementer needs.**

`docs/PLAN.md`: "No sense of the season's shape. Nomination dates and ceremony
dates exist in the data; a reader has no idea whether this takes a weekend or
five months."

So the one thing this section must communicate is **the span**, and the span is
computed: last dated phase minus first dated phase, rendered as months. Not
typed. A hardcoded "five months" is exactly the class of figure the phase gate
exists to forbid.

🔴 **This is not `SeasonStepper`.** The stepper is a windowed, measured,
client-side control built for a reader who wants to know what is *next*; this
is a static list for a reader who wants to know how long the thing lasts.
Reusing the stepper would drag a `'use client'` component, a `ResizeObserver`
and a transform onto a prose page to answer a different question. Same data,
different component.

🔴 **Fix the formatter to UTC.** The dates arrive as epoch milliseconds. A
formatter that follows the ambient zone renders one day on a server in UTC and
the previous day in a browser west of it — a hydration mismatch, and React
discards the server HTML to fix it. `SeasonStepper.tsx` documents this trap at
its `showDate` constant; copy the approach, not the component.

🔴 **The span is whole months, and a season with fewer than two dated phases
has no span.** Say nothing rather than "0 months".

- [ ] **Step 1: Write the failing test**

Create `components/SeasonShape.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SeasonShape, type SeasonPhase } from './SeasonShape';

const DAY = 86_400_000;
/** 2026-01-05 and 2026-06-05 UTC — five months and a bit apart. */
const JAN = Date.UTC(2026, 0, 5);
const JUN = Date.UTC(2026, 5, 5);

function phase(over: Partial<SeasonPhase>): SeasonPhase {
  return {
    key: 'k',
    eventId: 1,
    phase: 'nominations',
    name: 'Academy Awards',
    abbreviation: 'oscars',
    date: JAN,
    complete: false,
    ...over,
  };
}

describe('SeasonShape', () => {
  it('🔴 computes the span from the dates rather than stating one', () => {
    render(
      <SeasonShape
        phases={[
          phase({ key: 'a', date: JAN }),
          phase({ key: 'b', date: JUN, phase: 'ceremony' }),
        ]}
      />,
    );
    expect(screen.getByTestId('season-span')).toHaveTextContent('5 months');
  });

  it('reports a short season in months too, not a fixed phrase', () => {
    render(
      <SeasonShape
        phases={[
          phase({ key: 'a', date: JAN }),
          phase({ key: 'b', date: JAN + 40 * DAY, phase: 'ceremony' }),
        ]}
      />,
    );
    expect(screen.getByTestId('season-span')).toHaveTextContent('1 month');
  });

  it('says nothing about a span it cannot compute', () => {
    render(<SeasonShape phases={[phase({ date: null })]} />);
    expect(screen.queryByTestId('season-span')).not.toBeInTheDocument();
  });

  it('distinguishes a nominations phase from a ceremony in words', () => {
    render(
      <SeasonShape
        phases={[
          phase({ key: 'a', date: JAN }),
          phase({ key: 'b', date: JUN, phase: 'ceremony' }),
        ]}
      />,
    );
    expect(screen.getByText(/nominations/i)).toBeInTheDocument();
    expect(screen.getByText(/ceremony/i)).toBeInTheDocument();
  });

  it('🔴 formats in UTC, so the server and the browser agree', () => {
    // A date at UTC midnight renders as the 5th, never the 4th, whatever the
    // ambient zone. A formatter following the local zone is a hydration
    // mismatch on this page's most prominent dates.
    render(<SeasonShape phases={[phase({ date: JAN })]} />);
    expect(screen.getByText(/Jan 5/)).toBeInTheDocument();
  });

  it('carries a machine-readable date for each phase', () => {
    const { container } = render(<SeasonShape phases={[phase({ date: JAN })]} />);
    expect(container.querySelector('time')).toHaveAttribute(
      'dateTime',
      '2026-01-05',
    );
  });

  it('renders nothing at all when the season has no phases', () => {
    const { container } = render(<SeasonShape phases={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run components/SeasonShape.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `components/SeasonShape.tsx`. Key decisions, in the file's own words:

```tsx
import { cn } from '@/lib/utils/cn';

/**
 * Structurally the `SeasonPhase` from `lib/services/dashboard.ts`, re-declared
 * because `components/` may not depend on a service (D33) — the same reason
 * `SeasonStepper` re-declares it.
 */
export type SeasonPhase = {
  key: string;
  eventId: number;
  phase: 'nominations' | 'ceremony';
  name: string | null;
  abbreviation: string | null;
  /** Epoch milliseconds, UTC midnight of the day. Null means unscheduled. */
  date: number | null;
  complete: boolean;
};

/**
 * 🔴 Fixed to UTC, for the reason `SeasonStepper` documents: the dates arrive
 * as epoch milliseconds, and a formatter following the ambient zone renders
 * one day on a UTC server and the previous day in a browser west of it. That
 * is a hydration mismatch on this page's most prominent dates, and React
 * discards the server HTML to fix it.
 */
const dayLabel = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const AVERAGE_MONTH_MS = 30.44 * 86_400_000;

/**
 * How long the season runs, in whole months, or null when it cannot be known.
 *
 * 🔴 Computed, never stated. `docs/PLAN.md` asks this section to answer
 * "a weekend or five months"; a typed "five months" would be wrong the first
 * time a ceremony moves, on the one page whose promise is that its numbers are
 * real. Fewer than two dated phases means there is no span to report, and
 * "0 months" would be worse than silence.
 */
function spanMonths(phases: readonly SeasonPhase[]): number | null {
  const dates = phases.flatMap((p) => (p.date == null ? [] : [p.date]));
  if (dates.length < 2) return null;
  const months = Math.round(
    (Math.max(...dates) - Math.min(...dates)) / AVERAGE_MONTH_MS,
  );
  return months < 1 ? null : months;
}

/**
 * The season's shape (P18.T5) — nominations and ceremonies in date order, and
 * how long the whole thing takes.
 *
 * 🔴 Not `SeasonStepper`, on purpose. The stepper is a measured, client-side
 * window built to answer "what is next" for someone mid-season. This answers
 * "how long does this last" for someone who has never played, which is a
 * static list. Dragging a `'use client'` component, a ResizeObserver and a
 * transform onto a prose page to answer a different question is the trade this
 * avoids.
 *
 * An ordered list in date order, with the phase named in words — a ceremony
 * and a nominations announcement are different events weeks apart (D81) and
 * "Academy Awards" twice in a list with no distinguishing label is the defect
 * that rail had.
 */
export function SeasonShape({
  phases,
  className,
}: {
  phases: readonly SeasonPhase[];
  className?: string;
}) {
  if (phases.length === 0) return null;
  const months = spanMonths(phases);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {months == null ? null : (
        <p
          data-testid="season-span"
          className="text-text-secondary max-w-prose text-sm leading-relaxed"
        >
          A season runs about {months} {months === 1 ? 'month' : 'months'}, from
          the first nominations to the last ceremony.
        </p>
      )}

      <ol className="flex flex-col">
        {phases.map((phase) => (
          <li
            key={phase.key}
            className="border-border-rule flex items-baseline justify-between gap-4 border-t py-2"
          >
            <span className="text-text-primary text-sm leading-tight">
              {phase.name ?? phase.abbreviation ?? `Show ${phase.eventId}`}{' '}
              <span className="text-text-dim">
                {phase.phase === 'nominations' ? 'nominations' : 'ceremony'}
              </span>
            </span>
            {phase.date == null ? (
              <span className="text-text-dim shrink-0 text-xs">Date to be announced</span>
            ) : (
              <time
                dateTime={new Date(phase.date).toISOString().slice(0, 10)}
                className="text-text-secondary tabular shrink-0 font-mono text-xs"
              >
                {dayLabel.format(phase.date)}
              </time>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

```bash
npx vitest run components/SeasonShape.test.tsx
```

Expected: PASS, all eight. If "5 months" comes out as 5 and "1 month" as 1,
the rounding is right; if the 40-day case rounds to 1 and the test expected 1,
good — if it produces 0 and the component returns null, the `months < 1` guard
fired and the test must be adjusted to a span that is genuinely a month. Fix
the *fixture*, not the guard.

- [ ] **Step 5: Story, then wire it up**

Create `components/SeasonShape.stories.tsx` with `FullSeason` (a dozen phases
spanning January to June), `Unscheduled` (every date null), and `Empty`.

In the page, add `getDashboard(null)` to the `Promise.all` and render
`<SeasonShape phases={view.events} />` inside the `season` section, under two
sentences of prose explaining that each show scores twice — once when
nominations land, once at the ceremony (D81).

🔴 `getDashboard(null)` is the signed-out call and queries no leagues by
construction — that is what makes it safe on a public page. Do not pass a user.

- [ ] **Step 6: Verify in a browser**

Production build, four widths, both schemes:

1. The span sentence states a number. Sanity-check it against the list: the
   first and last dates should be about that far apart. **If the list is
   empty in your database, say so in the commit message rather than claiming
   the section works.**
2. At 390px the show name wraps and the date stays on its own line without
   overlapping. No document-level horizontal scroll.
3. 🔴 `view.events` includes **undated** phases sorted last. Confirm one
   renders "Date to be announced" rather than an `Invalid Date`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "P18.T5: the season's shape, with a span computed from the dates"
```

---

## Task 6: Motion and colour — brass reaches a public page

**Files:**
- Modify: `app/(app)/how-it-works/page.tsx` (at most: one `tone` prop)
- Modify: `docs/PROGRESS.md` (the measurements, and P17.T21's status)

**Interfaces:**
- Consumes: `StatusChip` (`tone="brass"`), `Eyebrow` (`tone="brass"`). Nothing
  else.
- Produces: the measured evidence that closes **P17.T21**.

**Context an implementer needs.**

### 🔴 This task is blocked, and the block is real

**P17.T35 must be decided before this task runs.** T21 says brass finally
reaches a public page here; T35 says brass may already mean "drafted" on the
draft board, which would give one token two meanings — the exact fault D69 split
carmine and brass to fix. T35 is written as *restate the method → re-measure →
decide*, and **"no conflict, T21 proceeds" is a permitted outcome.**

What is known today, and what is not:

- **The review's claim does not reproduce.** A source grep for `brass` across
  `app components lib .storybook e2e` returns **38 lines**, not 320 (measured
  2026-09-12; reproduce with
  `grep -rn brass app components lib .storybook e2e | wc -l`). `DraftBoard.tsx`
  contains **no brass reference at all** — its only `StatusChip`s are
  `tone="neutral"` "Unclaimed" (`:116`, `:190`).
- **The leading hypothesis.** Every brass pixel on a draft board traces to one
  site: `PickCell.tsx:78` renders `PointsLedger`, and `PointsLedger.tsx:111`
  renders `<StatusChip tone="brass">Won</StatusChip>` per winning ledger line. A
  board of forty picks with several winning nominations each produces hundreds
  of *instances* of one *component* whose meaning is "won this award" — which
  is D69's meaning verbatim, not a second meaning.
- 🔴 **This is a hypothesis, not a finding.** Nobody has counted painted brass
  pixels on a rendered board. T35 owns that measurement. **Do not settle it
  inside this task.**

### How this task survives either outcome

**By not introducing any brass of its own.** The page reaches brass through
exactly two components, both of which T35's decision will have already settled:

| Site | Meaning | Component |
|---|---|---|
| The worked example's winning lines | "won this award" | `StatusChip tone="brass"` (T2) |
| The worked example panel's eyebrow | names the season the awards data is from | `Eyebrow tone="brass"` (T2) |

Nothing else on the page is brass. The Razzie section is **not** brass — a
Razzie is an award and the temptation is real, but the section's job is loss,
and D69 gives loss and urgency to carmine. Leave the Razzie example's chips as
whatever `WorkedExample` renders (brass, because a Razzie win *is* a win) and
add no section-level accent.

So:

- **If T35 decides "no conflict, brass stays awards" (the expected outcome):**
  this task changes no code. Its deliverable is the measurement below, which is
  what P17.T21 asked for ("brass reaches a public page; closes in P18.T6,
  verification only here").
- **If T35 decides brass's meaning changes, splits, or a new token appears:**
  the only edit here is which `tone` the two call sites pass, and that edit is
  made in `StatusChip`/`Eyebrow`'s own vocabulary by whoever executes T35 —
  this page follows automatically because it holds no colour of its own. Verify
  the two sites still render the token T35 landed on, then take the
  measurement.

**Either way, take the measurement.** It is the only thing that proves the
accent reaches a logged-out reader, and it is falsifiable: a computed colour
either equals the brass token's value or it does not.

### The motion half

🔴 **This page ships no bespoke animation, and that is the decision rather than
an omission.** `docs/PLAN.md` T6 says "Reduced-motion path required" — the
requirement attaches to whatever motion exists, and inventing motion for a
prose page to have something to attach it to is decoration with a compliance
justification. The page does inherit one animation: `PosterFrame`'s winner seal
carries `animate-stamp motion-reduce:animate-none`
(`components/PosterFrame.tsx:139`), which is already the reduced-motion path
and is already pinned by `PosterFrame.test.tsx:43`.

The verification below therefore asserts the honest, falsifiable form of the
requirement: **under `prefers-reduced-motion: reduce`, no element on the page
has a running animation.** That assertion fails if anyone adds an unguarded
animation later, which is the property worth having.

- [ ] **Step 1: Read T35's outcome before touching anything**

```bash
grep -n "P17.T35" docs/PROGRESS.md
```

Expected: the checkbox is ticked and the Phase 17 notes record what brass
means. **If it is not ticked, stop.** Report that T6 is blocked on T35, leave
the box unticked, and move to T7 — every other task in this phase is
independent of it.

- [ ] **Step 2: Confirm the page's brass surface is exactly two sites**

```bash
grep -n "brass" "app/(app)/how-it-works/page.tsx" components/WorkedExample.tsx
```

Expected: `Eyebrow tone="brass"` in the page, `StatusChip tone="brass"` in
`WorkedExample.tsx`. **Any third hit is a colour this page invented and must be
removed** — that is what makes the task outcome-independent.

- [ ] **Step 3: Apply T35's decision, if it changed anything**

If T35 renamed the token or split it, change only the `tone` values at those
two sites to whatever T35 landed on. If T35 concluded "no conflict", this step
is a no-op — say so in the commit message rather than skipping it silently.

- [ ] **Step 4: Measure, in a production build, signed out**

```bash
KEEP_TEST_IDS=1 npm run build && npm run start -- -H 127.0.0.1 -p 3100
```

In a browser at `http://127.0.0.1:3100/how-it-works`, **signed out**, at 1440
and 390px in **both schemes**, run in the console and record every number:

```js
// 1. Brass is actually painted, not merely referenced in a class name.
const chip = document.querySelector('[class*="bg-brass-fill"]');
const eyebrow = document.querySelector('[class*="text-brass-text"]');
({
  chipBg: chip && getComputedStyle(chip).backgroundColor,
  chipInk: chip && getComputedStyle(chip).color,
  eyebrowInk: eyebrow && getComputedStyle(eyebrow).color,
  tokenFill: getComputedStyle(document.documentElement).getPropertyValue('--color-brass-fill').trim(),
});
```

Expected dark: `--color-brass-fill` resolves to `#cfa93a` → `rgb(207, 169, 58)`
with ink `rgb(36, 28, 5)`. Expected light: `#7a5a12` →
`rgb(122, 90, 18)` with white ink. Both pairs are D69's, and `TokenTable.tsx`
already holds them to a contrast floor. 🔴 A `null` for `chip` means the season
has no winning nomination in the worked example — record that rather than
reporting brass absent; it is a data state, not a defect, and T21 is then not
closed by this run.

```js
// 2. No unguarded motion.
matchMedia('(prefers-reduced-motion: reduce)').matches; // set the OS/devtools flag first
[...document.querySelectorAll('*')].filter((el) => {
  const s = getComputedStyle(el);
  return s.animationName !== 'none' && s.animationPlayState === 'running';
}).map((el) => el.className);
```

Expected: `true`, then an **empty array**. A non-empty array names an
animation somebody added without a `motion-reduce:` guard.

- [ ] **Step 5: Record the measurements in PROGRESS.md**

Under `### Phase 18 notes`, a bullet carrying: the resolved brass values in both
schemes, which two elements carried them, whether the reader was signed out,
the widths measured, the reduced-motion result, and **which T35 outcome this
ran under**. A measurement without its T35 context is not evidence for T21.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "P18.T6: brass reaches a public page, measured (closes P17.T21)"
```

---

## Task 7: The way in

**Files:**
- Modify: `app/(app)/how-it-works/page.tsx` (the `start` section, and the lede)

**Interfaces:**
- Consumes: `getCurrentUser()` from `lib/auth`.
- Produces: nothing other tasks consume.

**Context an implementer needs.**

`docs/PLAN.md`: "The page explains a game and then offers nothing to do." T7:
"create a league, or see this season. One primary action, repeated at most
twice."

**Which action depends on the session**, and there are only two states worth
distinguishing:

- **Signed out** → `Register`, to `/auth/register`. Not "create a league": a
  stranger cannot, and an action that bounces to a sign-in is a worse first
  impression than one that names the step.
- **Signed in** → `Create a league`, to `/leagues/new` — **confirm this route
  exists before using it**: `ls app/\(app\)/leagues`. If the create flow lives
  elsewhere (`CreateLeagueForm.tsx` is a component, not a route), use whatever
  route renders it. Do not invent one.

**Reuse the existing lockup, do not build a button.** `EmptyState.tsx:57` and
`app/(app)/page.tsx`'s signed-out lede both render the same primary-action
`<Link>`: `bg-accent-fill … text-white … rounded-sm min-h-11 px-4`, carmine
fill with white on it at 6.58:1, `focus-visible:outline-accent-fill`. This is
the third copy of that lockup and it is the point at which extracting a
component becomes defensible — but extracting it touches `EmptyState` and the
dashboard, both outside this phase and one of them under active edit. **Copy
it, and leave a comment saying it is the third copy and where the other two
are.** The extraction is a tranche-4 sweep's job, not this task's.

🔴 **Carmine, not brass.** The action is not about an award (D69). A brass
"Register" is the exact bug D69's prop naming exists to make reviewable.

**"At most twice"**: once in the lede (which T1 already has no action in — this
task adds it) and once in the `start` section. Not three times.

🔴 **The dashboard's own closing-block problem, noted so it is not repeated.**
P17.T5 recorded that `/`'s `EmptyState` now ends on "Played before? Register
with the same email…" with nothing to click, because two identical Register
buttons 2,000px apart was worse. This page is shorter and the two placements
are the top and the bottom of an argument, which is the case where repetition
reads as an offer rather than a duplicate. If it reads as a duplicate when you
look at it, drop the lede's copy and keep the `start` one — say which you chose
and why in the commit message.

- [ ] **Step 1: Resolve the session and the create route**

```bash
ls "app/(app)/leagues"
grep -rn "CreateLeagueForm" app
```

Record the route the create form actually renders at. Add `getCurrentUser()` to
the page's `Promise.all`.

- [ ] **Step 2: Render the action, twice**

In the lede section, after the paragraph, and again in `start`:

```tsx
{/* 🔴 The third copy of this lockup — EmptyState.tsx:57 and
    app/(app)/page.tsx's signed-out lede are the other two. Carmine fill with
    white on it is 6.58:1; the same colour as text on the ground is 2.96:1 and
    fails, which is why accent.fill is fill-only. Extracting the three into one
    component is a tranche-4 sweep's job — it touches two files this phase does
    not own. */}
<Link
  href={user == null ? '/auth/register' : CREATE_LEAGUE_HREF}
  className="bg-accent-fill focus-visible:outline-accent-fill flex min-h-11 w-fit items-center rounded-sm px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2"
>
  {user == null ? 'Register' : 'Create a league'}
</Link>
```

The `start` section additionally gets one sentence of prose and a secondary
text link to `/` reading "See this season" — a plain `text-accent-text` link,
not a second filled button. One primary action means one filled thing.

- [ ] **Step 3: Verify in a browser**

Production build, four widths, both schemes, **signed out and signed in**
(`E2E_TEST_AUTH=1` for the signed-in pass — and note the two boot artefacts
`docs/PROGRESS.md` records for that flag: `/leagues` answers 500 signed out
under it, and a shared browser profile can carry another session's Clerk
warning into the console; check `curl` before recording either as a defect):

1. Both actions are ≥44px tall and have a visible focus ring on Tab.
2. Signed out, both say "Register" and point at `/auth/register`. Signed in,
   both say "Create a league" and point at the route you confirmed in step 1 —
   **open it and confirm it is a 200**, not a 404 you assumed.
3. At 390px neither action is full-bleed edge to edge (`w-fit`) and neither
   collides with the text above it.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "P18.T7: the way in, once at the top and once at the end"
```

---

## Task 8: SEO — metadata, canonical, share card

**Files:**
- Create: `app/(app)/how-it-works/opengraph-image.tsx`
- Modify: `app/(app)/how-it-works/page.tsx` (the `metadata` export)

**Interfaces:**
- Consumes: `canonical(path)`, `SITE_URL` from `lib/seo.ts`; `CARD`,
  `CARD_SIZE` from `lib/og.ts`; `OgMark` from `components/OgMark.tsx`.
- Produces: nothing other tasks consume.

**Context an implementer needs.**

`docs/PLAN.md` T8: "This is the page most likely to be found by search and
shared into a group chat."

`lib/seo.ts` already owns every decision here: `SITE_URL` is the apex and
deliberately **not** `VERCEL_URL` (a preview publishing its own canonical tells
a crawler the preview is the real page); `canonical()` strips the query string;
`TITLE_TEMPLATE` is `%s · Cinemadraft`. The sitemap entry landed in T1.

`app/(app)/award-shows/[abbr]/opengraph-image.tsx` is the model for the card:
`ImageResponse`, `CARD_SIZE`, the mark, a headline, the wordmark lockup at the
bottom, `fontFamily: 'sans-serif'` (Satori has no access to the app's fonts).

🔴 **The card carries no number.** A share card is a cached PNG; a point value
baked into one is a figure that cannot be re-derived when the table changes and
cannot be corrected in the chat window it was pasted into. Every other number
on this page is live and traceable; the one that would not be simply is not
there. Headline and mark only.

- [ ] **Step 1: Complete the metadata export**

Replace the `metadata` export in `app/(app)/how-it-works/page.tsx`:

```tsx
export const metadata: Metadata = {
  title: 'How it works',
  description:
    'Draft a team of films before awards season, score every nomination and win they pick up, and lose points when one of them takes a Razzie nomination.',
  alternates: { canonical: canonical('/how-it-works') },
  openGraph: {
    title: 'How Cinemadraft works',
    description:
      'Draft a team of films before awards season, score every nomination and win they pick up.',
    url: canonical('/how-it-works'),
    type: 'website',
  },
};
```

- [ ] **Step 2: Write the share card**

Create `app/(app)/how-it-works/opengraph-image.tsx`, modelled on the award-show
card:

```tsx
import { ImageResponse } from 'next/og';

import { OgMark } from '@/components/OgMark';
import { CARD, CARD_SIZE } from '@/lib/og';

/**
 * The share card for the page most likely to be pasted into a group chat
 * (P18.T8).
 *
 * 🔴 **No numbers on it.** A card is a cached PNG: a point value baked into one
 * cannot be re-derived when the `points` table changes and cannot be corrected
 * in the conversation it was pasted into. Every figure on the page itself is
 * live and traceable to the scoring service; the one that would not be is
 * absent rather than stale.
 */
export const alt = 'How Cinemadraft works';
export const size = CARD_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: CARD.bg,
        padding: 80,
        fontFamily: 'sans-serif',
      }}
    >
      <OgMark size={120} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span
          style={{ color: CARD.ink, fontSize: 72, lineHeight: 1.1, letterSpacing: '-0.02em' }}
        >
          How it works
        </span>
        <span style={{ color: CARD.brass, fontSize: 38 }}>
          Draft films. Score their nominations.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <OgMark size={44} />
        <span style={{ color: CARD.inkDim, fontSize: 30, letterSpacing: '-0.02em' }}>
          Cinemadraft
        </span>
      </div>
    </div>,
    CARD_SIZE,
  );
}
```

- [ ] **Step 3: Verify the served HTML and the image**

Production build, then:

```bash
curl -s http://127.0.0.1:3100/how-it-works | grep -o '<link rel="canonical"[^>]*>'
curl -s http://127.0.0.1:3100/how-it-works | grep -o '<meta property="og:[^>]*>'
curl -sI http://127.0.0.1:3100/how-it-works/opengraph-image | head -3
```

Expected: the canonical is `https://cinemadraft.com/how-it-works` (the apex,
**not** the localhost origin — if it is localhost, `NEXT_PUBLIC_SITE_URL` is set
in your `.env` and that is a local-only artefact, worth noting but not fixing
here); the og tags carry the title and an image URL; the image is a
`200` with `content-type: image/png`. Open the image and look at it — Satori
silently drops what it cannot lay out.

🔴 The proxy's `isPublic` list includes `/opengraph-image` (the root card) but
route-segment OG images sit under their own path. Confirm the curl above is a
200 and not a 307; if it redirects, the route needs a matcher entry the same
way the root card has one.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "P18.T8: metadata, canonical and a share card for /how-it-works"
```

---

## Task 9: E2E — the gate, in a browser

**Files:**
- Create: `e2e/how-it-works.spec.ts`
- Modify: `docs/PROGRESS.md` (the phase's measurements)

**Interfaces:**
- Consumes: `skipWithoutRestoredCorpus` from `e2e/support/corpus.ts`.
- Produces: the phase gate's evidence.

**Context an implementer needs.**

The gate (`docs/PLAN.md` § Phase 18): reachable signed out; **every number
traceable to the scoring service or the `points` table by a test**; readable at
390px; `npm run verify` green.

**Three things this spec must prove, and one it cannot.**

1. **Signed out, 200.** Trivial, and the one that would have caught P17.T0's
   original defect.
2. **The numbers match the scoring service.** The strongest available browser
   assertion: the worked example's total, read off the page, **equals the top
   row's total on `/`'s leaderboard for the same season**. Both come from
   `ledgerForMovies`, so agreement is structural — but it is structural only
   while nobody reintroduces a second computation, which is exactly what the
   test is guarding against. It fails loudly if anyone hardcodes a figure.
3. **The lines add up to the total.** Read every `Earned` cell off the rendered
   table, sum them in the test, compare to the Total row. This catches a table
   that renders a subset of the lines — the failure `PointsLedger`'s
   `nominationId` key comment records, found in a browser and not by a test.
4. 🔴 **What it cannot prove: the empty-season fallback.** Producing an empty
   season in a browser means either writing to a restored copy of sixty real
   people's history or seeding a whole parallel season, and neither is
   proportionate. `docs/PLAN.md` T9 asks for it as an E2E; **it is pinned as a
   unit test instead** (`lib/services/how-it-works.test.ts`, "falls back to the
   newest season that has data" and "returns null rather than a zero"), with
   the repositories mocked, which is both falsifiable and CI-safe. This
   substitution is deliberate and is recorded here so it is not later mistaken
   for an omission.

**CI.** This spec reads the restored corpus (assertions 2 and 3 need a scored
season), so it calls `skipWithoutRestoredCorpus` in `beforeEach` — the same
visible skip `scoring.spec.ts` uses. The signed-out-200 and 390px assertions
need no data and go in a separate `describe` with no skip, so CI still proves
the route is public and does not overflow.

- [ ] **Step 1: Write the spec**

Create `e2e/how-it-works.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import { skipWithoutRestoredCorpus } from './support/corpus';

/**
 * The Phase 18 gate, in a browser.
 *
 * 🔴 The page's central promise is that every number on it comes from
 * `lib/services/scoring.ts` or the `points` table. The two assertions that
 * matter here are the ones a hardcoded figure would break: the worked
 * example's total agrees with the leaderboard's own for the same film, and the
 * rendered lines add up to the total printed under them.
 *
 * The empty-season fallback is NOT tested here — producing an empty season
 * means writing to a restored copy of production. It is pinned in
 * `lib/services/how-it-works.test.ts` with the repositories mocked, which runs
 * on CI. See the plan's Task 9 for why.
 */
test.describe('how it works — no data needed', () => {
  test('🔴 opens signed out, with no redirect', async ({ page }) => {
    const response = await page.goto('/how-it-works');
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe('/how-it-works');
    await expect(page.getByRole('heading', { level: 1, name: 'How it works' })).toBeVisible();
  });

  test('the old URL still opens, permanently redirected', async ({ page }) => {
    // A year of league chat holds this link.
    await page.goto('/rules-and-scoring');
    expect(new URL(page.url()).pathname).toBe('/how-it-works');
  });

  test('does not overflow at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/how-it-works');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const width = await page.evaluate(
      () => document.scrollingElement?.scrollWidth ?? 0,
    );
    expect(width).toBe(390);
  });

  test('the scoring values on the page are the ones in the points table', async ({
    page,
  }) => {
    // Read the table straight out of the database and require every value to
    // be on the page. A page that printed a plausible-but-wrong number — the
    // exact failure `awards.points` being a foreign key already caused once —
    // fails here.
    const { Client } = await import('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    let values: number[] = [];
    try {
      const { rows } = await client.query<{ points: number }>(
        'select distinct points from points where points is not null',
      );
      values = rows.map((row) => row.points);
    } finally {
      await client.end();
    }
    test.skip(values.length === 0, 'no points rows in this database');

    await page.goto('/how-it-works');
    const body = await page.locator('body').innerText();
    for (const value of values) {
      expect(body, `points value ${value} is missing from the page`).toContain(
        String(value),
      );
    }
  });
});

test.describe('how it works — the worked example', () => {
  test.beforeEach(skipWithoutRestoredCorpus);

  test('🔴 the worked example agrees with the leaderboard', async ({ page }) => {
    await page.goto('/how-it-works');
    const total = Number(
      (await page.getByTestId('worked-example-total').innerText()).replace(/[^\d-]/g, ''),
    );
    expect(Number.isNaN(total)).toBe(false);

    // The same film's total, from the dashboard's own leaderboard. Both come
    // from `ledgerForMovies`; a hardcoded figure on either page breaks this.
    await page.goto('/');
    const topRow = page.getByRole('row').nth(1);
    const cells = await topRow.getByRole('cell').allInnerTexts();
    const boardTotal = Number(
      (cells[cells.length - 1] ?? '').replace(/[^\d-]/g, ''),
    );

    expect(boardTotal).toBe(total);
  });

  test('🔴 the lines add up to the total', async ({ page }) => {
    await page.goto('/how-it-works');

    const earned = await page
      .getByRole('table', { name: /How .* scored/i })
      .first()
      .locator('tbody tr td:last-child')
      .allInnerTexts();

    expect(earned.length).toBeGreaterThan(1);
    const summed = earned.reduce(
      (sum, text) => sum + Number(text.replace(/[^\d-]/g, '')),
      0,
    );
    const total = Number(
      (await page.getByTestId('worked-example-total').innerText()).replace(/[^\d-]/g, ''),
    );

    expect(summed).toBe(total);
  });

  test('a win is named in words, not only in colour', async ({ page }) => {
    await page.goto('/how-it-works');
    const wins = page.getByText('Won', { exact: true });
    test.skip((await wins.count()) === 0, 'no winning nomination in this season yet');
    await expect(wins.first()).toBeVisible();
  });
});
```

🔴 The leaderboard's last cell is the Total column **at `lg` and up**; below
`lg` D79 hides the per-show columns and Total is the second cell. The default
Playwright viewport is 1280×720, so the last cell is Total — but if that
assertion comes back wrong, check the viewport before changing the selector.
The `.replace(/[^\d-]/g, '')` strips the "Won" chip text if a cell carries one.

- [ ] **Step 2: Run it**

```bash
npm run db:up && npx playwright test e2e/how-it-works.spec.ts
```

Expected: seven PASS locally. 🔴 **Before accepting a green run, break each of
the two arithmetic tests on purpose** — change `worked-example-total` in the
component to render `total + 1`, re-run, confirm both go red, then revert. A
test that cannot fail is worse than no test, and two of these compare numbers
that are *supposed* to be equal by construction, which is exactly the shape
that passes vacuously when a selector resolves to nothing.

- [ ] **Step 3: Run the whole gate**

```bash
npm run verify
npx playwright test
```

Expected: green. `npm run build-storybook` too, since three stories are new:

```bash
npm run build-storybook
```

- [ ] **Step 4: The final browser pass — 1440, 1280, 1024, 390, both schemes**

Production build, signed out. For each of the eight combinations record:

- `document.scrollingElement.scrollWidth` vs the viewport — must be equal.
- The console — must be empty. (🔴 A shared browser profile can carry another
  session's `Clerk has been loaded with development keys` warning into the run;
  `curl` the served HTML and confirm it contains no Clerk reference before
  recording that as a defect.)
- Whether any section's content is cut off or requires horizontal scrolling
  other than the worked example's own table wrapper.

- [ ] **Step 5: Record the measurements in PROGRESS.md**

Under `### Phase 18 notes`, a bullet per finding, with numbers rather than
impressions: the film the worked example chose and its total, the season it
came from and whether that was the active one, the eight `scrollWidth` results,
the point values found on the page, and anything that did not reproduce.

- [ ] **Step 6: Tick every box and commit**

```bash
git add -A
git commit -m "P18.T9: e2e — signed out, numbers from the scoring service, 390px"
```

---

## Open questions, flagged rather than resolved

These are places the sources do not say enough to plan against. Each is written
into the task that meets it; they are gathered here so the executor sees them
before starting.

1. **P17.T35 blocks T6.** Covered at length in Task 6. The plan is written for
   both outcomes, but the decision is not this phase's to make.

2. **Newsreader — the recommendation, and what would settle it.**
   `docs/PROGRESS.md` § Phase 17 T19 defers the question to after Phase 18, on
   the grounds that this phase is a prose page and changes the arithmetic.
   **Recommendation: do not set this page in Newsreader, and take the deferral's
   own measurement afterwards.** Reasoning: the face is already loaded
   unconditionally by `theme/fonts.ts` and already renders on `/films/[tmdbId]`
   (`font-prose` on the overview, plus `FeedPost`, `ReviewCard` and two
   textareas), so the payload is spent whether this page uses it or not — using
   it here does not *add* cost, and not using it does not *save* any. The
   baseline counted **one** Newsreader element across four pages against 1,088
   Archivo; a face with two placements is a face nobody can perceive as a
   system. **What would settle it:** after this page ships, count rendered
   `font-prose` elements across `/`, `/browse`, `/award-shows`,
   `/films/[tmdbId]` and `/how-it-works` in a production build, and measure the
   Newsreader file bytes actually transferred on a cold load of each. Two
   numbers, both falsifiable. Keep the face if prose placements are a coherent
   set a reader would notice; drop it from `theme/fonts.ts` and let `font-prose`
   fall back to the serif if the count stays in single figures. 🔴 Either way
   that is **P17.T19's decision to record, not this phase's** — this plan sets
   the page in the app's existing body face so the tranche-4 sweep finds one
   vocabulary, not two.

3. **The Razzie section's position.** The PLAN's spine puts it sixth of seven
   while the PLAN's own complaint is that it is buried eighth. T1 resolves this
   with one clause in the lede and leaves the section where the spine puts it.
   If the owner wants it promoted, that is a spine change and belongs in the
   PLAN, not in a task.

4. **Whether the shows grid should be grouped by scoring level.** The surviving
   content list says "the twelve award shows and their grouping", and the
   grouping is a `points.level` value reached through `awards.pointsId` — there
   is no cheap event→level join today. T4 renders a flat grid and leaves the
   grouping in the prose that already carries it. A grouped grid is a new
   service function and a new task.

5. **The create-league route.** T7 assumes `/leagues/new` and instructs the
   implementer to confirm it before using it. `CreateLeagueForm.tsx` is a
   component; nothing in the sources names the route it renders at.

6. **`docs/PLAN.md` T9's "survives an empty season" as an E2E.** Relocated to a
   unit test, with the reason in Task 9. Flagged because it is a deliberate
   deviation from the PLAN's wording, not an oversight.

7. **P17.T12's checkbox is stale.** `components/ShowLogo.tsx` already carries
   the 64px treatment (commit `8430113`) while `docs/PROGRESS.md` shows the box
   unticked. T4 verifies the code rather than trusting either record. Somebody
   should tick the box; it is not this phase's commit to make.

---

## Self-review

**Spec coverage.** T0 (decided, recorded in PROGRESS — no work), T1 shell and
spine, T2 worked example with fallback, T3 scoring table, T4 the shows with the
T12 treatment, T5 season shape, T6 motion and colour, T7 the way in, T8 SEO, T9
E2E. The four surviving-content items — the twelve shows and their grouping
(T1 prose + T4), the three tiers and what each means (T3), the full point table
(T3), nomination = P / win = 2P (T1 prose, pinned by T2's `scoreMovies` test),
pick any film (T1 prose), Razzies cost points (T1 prose + T2's casualty) — each
have a task. The gate's four clauses map to T1 step 11, T2/T9, T9 step 3, and
every task's final verify.

**Placeholders.** None. Every code step carries the code. The two places that
say "modelled on X" — `WorkedExample.stories.tsx`, `ScoringTable.stories.tsx`,
`SeasonShape.stories.tsx` — name the file to model and the exact stories to
write; a story file is fixture arrangement over an interface defined in the
same task.

**Type consistency.** `ExampleLine` (service) and `ExampleRow` (component) are
deliberately separate names for the same shape, because D33 forbids the
component importing the service type — the same pattern as `LedgerLine` /
`LedgerRow` and `SeasonPhase` / `SeasonPhase`. `ScoringLevel` (service, exists)
→ `ScoringGroup` (component, new), same rule. `WorkedExample` is both the
service's return type and the component's name; they are in different modules
and the page imports both — **if that reads badly at the call site, rename the
service type to `SeasonExample` in T2 step 3 and nowhere else**, since nothing
outside that file and its two tests refers to it.

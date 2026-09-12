# Phase 19 — Journey suites

Five long, ordered, watchable runs through the product, so that "show me the app
working" has an answer that is not fourteen files of slices.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a journey layer to the e2e suite — five specs that walk the
product end to end the way a member does, fast enough for CI and watchable on a
laptop — and give the draft the end state it has never had.

**Architecture:** One harness (`e2e/journeys/support/`) carrying three things
every journey inherits: a pacing helper whose only knob is `DEMO_PACE`, an
on-screen caption naming the current beat, and the scratch-data discipline. Then
one product change (a control that calls the orphaned `completeDraft`), then five
journey specs. The two P15 lifecycle specs are folded into journeys 1 and 3 and
deleted rather than left as shorter second versions.

**Tech Stack:** Playwright (Chromium, production build), raw `pg` for fixtures,
Next 16 App Router, React 19, TypeScript strict, MUI + Tailwind, Storybook 10.

**Spec:** `docs/PLAN.md` § Phase 19 (the task list and the gate) and
`docs/PROGRESS.md` § Phase 19 (the notes). There is no separate design doc for
this phase; the owner's brief is recorded in those two sections.

---

## Global Constraints

- **Biome, not ESLint or Prettier.** `npm run lint` covers linting, formatting
  and import order; `npm run typecheck` is separate.
- **MUI for components, Tailwind for custom styling**, coexisting through CSS
  cascade layers ordered `theme, base, mui, components, utilities`. Never
  `!important`. The three `e2e/smoke.spec.ts` tests that pin this do not relax.
- **All local databases run in Docker** — `npm run db:up` before anything that
  touches the database. The local Postgres binaries are clients only.
- **Never regenerate `package-lock.json` on macOS.** `npm install <pkg>` to
  update `package.json`, then `npm run lock` before committing. No task in this
  phase adds a dependency; if one seems to, stop and say so.
- **`fixtures/` is generated.** Never hand-edit it, never let a formatter touch
  it.
- 🔴 **The database on `localhost:5433` is a restored copy of production.**
  League 1 is sixty real people's history. `lib/db.test.ts` asserts exact counts
  excluding test debris: **1355** movies not matching `e2e-`, **60** users
  outside `+clerk_test` and `@example.test`, **4559** nominations, **10**
  `available_years` rows, **125** profile-feed rows. Every journey works on a
  scratch league under its own tag, and removes everything it wrote.
- **Every new surface is built from the Phase 3.5 primitives** — `SectionHead`,
  `Panel`, `Shelf`, `Button`, `StatusChip`, `Eyebrow`, `CinemaFrame`,
  `PosterFrame` — and carries a Storybook story. No hairline card border, no
  all-caps heading outside `Eyebrow`, no squared or pill button, no
  machine-formatted date. `LetterboxRule`, `font-display`, the Archivo `wdth`
  axis do not exist (D69–D77). `/tokens` is the cascade-layer probe only.
- **No raw hex outside the token system.** `scripts/layering.sh` greps for it.
- **The repository layer is the only code allowed to touch Prisma**, and
  `components/` may not import from `lib/services/` (D33).
- **`data-testid` is the only test handle** (D66), stripped from production
  output unless `KEEP_TEST_IDS=1`. Assertions still go through roles and
  accessible names.
- **Every Server Action returns `ActionResult`** (`actions/result.ts`) and
  every league write goes through `authorizeLeague` (`actions/leagues/guard.ts`).
- **One commit per task**, message starting with the task ID (`P19.T3: ...`).
  Tick the `PROGRESS.md` box as the final step of each task.
- **`npm run verify` before pushing** — lint, typecheck, layering, both unit
  suites, build. E2E is `npm run test:e2e`, separately.
- 🔴 **If a step depends on behaviour you have not seen in a browser, say so in
  the step rather than asserting it.** Four groups of the 2026-09-12 review's
  premises turned out to be dev-server artefacts or plain wrong. Steps below
  that are inferred rather than observed are marked **UNVERIFIED** and carry the
  command that settles them.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `e2e/journeys/support/pace.ts` | `DEMO_PACE`, the caption overlay, and `beat()` — the **only** place a journey may wait on a clock |
| `e2e/journeys/support/scratch.ts` | `withDb`, the per-tag cleanups, `forgetFilm`, and `assertNoResidue` |
| `e2e/journeys/01-draft-a-season.spec.ts` | Journey 1 — create → invite → seat → four groups → draft → finish |
| `e2e/journeys/02-read-the-league-back.spec.ts` | Journey 2 — board, teams, standings, ledger, scores that move |
| `e2e/journeys/03-a-ceremony-night.spec.ts` | Journey 3 — edit a show, nominate, crown, correct, watch points land |
| `e2e/journeys/04-a-reader-browses.spec.ts` | Journey 4 — browse → film detail → the search panel |
| `e2e/journeys/05-the-members-own-lists.spec.ts` | Journey 5 — the draft list and the watchlist |
| `components/SeasonSetup.stories.tsx` | The story the Phase 3.5 gate requires for T1's control |

**Modified**

| File | Change |
|---|---|
| `playwright.config.mts` | `use.video`, and the `DEMO_PACE` note |
| `package.json` | `e2e:journeys` script |
| `scripts/layering.sh` | One check: no `waitForTimeout` in `e2e/` outside `pace.ts` |
| `components/SeasonSetup.tsx` | A `FinishDraftButton` calling `completeDraft` |
| `components/SeasonSetup.test.tsx` | Two tests for the new control |
| `e2e/support/corpus.ts` | Its doc comment names `awards-lifecycle.spec.ts`, which T4 deletes |
| `docs/PROGRESS.md` | Plan pointer, task boxes, phase notes |
| `docs/DECISIONS.md` | D85 (pacing is a knob), D86 (the draft's end state) |

**Deleted**

| File | Why |
|---|---|
| `e2e/league-lifecycle.spec.ts` | Folded into journey 1 (T2) — see that task for the assertion-by-assertion inheritance |
| `e2e/awards-lifecycle.spec.ts` | Folded into journey 3 (T4) — same |

---

## Task 0: The journey harness

**Files:**
- Create: `e2e/journeys/support/pace.ts`
- Create: `e2e/journeys/support/scratch.ts`
- Create: `e2e/journeys/00-harness.spec.ts` (the harness's own test; deleted at the end of this task — see Step 8)
- Modify: `playwright.config.mts:35-40` (the `use` block)
- Modify: `package.json` (scripts)
- Modify: `scripts/layering.sh` (append one check)

**Interfaces:**
- Produces, from `pace.ts`:
  - `export const DEMO_PACE: number` — seconds per beat, `0` unless `DEMO_PACE`
    is set to a positive number.
  - `export async function startJourney(page: Page): Promise<void>` — installs
    the caption's init script. Called once per journey, **before the first
    navigation**.
  - `export async function beat<T>(page: Page, caption: string, work: () => Promise<T>): Promise<T>`
    — captions the page, runs `work` inside a `test.step` named `caption`,
    pauses `DEMO_PACE` seconds, returns whatever `work` returned.
- Produces, from `scratch.ts`:
  - `export type Query = (sql: string, params?: unknown[]) => Promise<unknown[]>`
  - `export async function withDb<T>(fn: (query: Query) => Promise<T>): Promise<T>`
  - `export async function activeYear(): Promise<number>`
  - `export async function cleanupLeague(tag: string): Promise<void>`
  - `export async function cleanupShow(tag: string): Promise<void>`
  - `export async function cleanupUsers(tag: string): Promise<void>`
  - `export async function forgetFilm(tmdbId: string): Promise<void>`
  - `export async function assertNoResidue(tag: string, years?: readonly number[]): Promise<void>`

**Context an implementer needs.**

The suite already has a rule about waiting: nothing in `e2e/` calls
`page.waitForTimeout`, because a hardcoded sleep is a flake with a delay on it.
This phase creates the single exception, and the exception only earns its place
if it is genuinely single — hence the `layering.sh` check in Step 7. If a
journey can only be watched by editing it, this task failed.

`DEMO_PACE` is read in the **test** process (Playwright's config and specs run
there), not in the webServer's, so no change to `playwright.config.mts`'s
`webServer.env` is needed or wanted.

The caption has to survive navigation, and a journey navigates constantly. Two
mechanisms together: `page.addInitScript` repaints the caption on every document
load from `sessionStorage` (same origin throughout — everything is
`http://localhost:3000`), and `beat` writes the new text before running the
work. `sessionStorage` throws on `about:blank`, so both halves are wrapped in
`try {} catch {}`; a journey whose captions silently do not paint must still
pass.

Video: the committed config records none. A trial run on 2026-09-12 with a
temporary override produced 80 `.webm` files totalling 9.1MB, so the cost of
recording is not the objection — the objection is only that a green CI run does
not need eighty videos. `retain-on-failure` keeps the debugging value at no cost
on a green run, and a paced run records everything.

`withDb` is copied from the six specs that already carry it verbatim (`draft`,
`leagues`, `season-setup`, `browse`, `award-shows`, `nav`). **Those six are not
refactored onto the shared copy in this phase** — each carries a comment
explaining why it opens its own client, the change would touch six files that
are not otherwise in this phase's diff, and nothing about it is load-bearing for
a journey. Only the journeys import the shared one.

`assertNoResidue` asks "did this tag leave anything", not "is the restored count
still 1355". That is deliberate: the gate requires the journeys to pass against a
seeded-empty database too, where 1355 is not true and never will be. Counting a
tag is the same assertion in both worlds.

- [ ] **Step 1: Write the pacing helper**

Create `e2e/journeys/support/pace.ts`:

```ts
import { test, type Page } from '@playwright/test';

/**
 * 🔴 Seconds of deliberate pause per beat. Zero unless asked.
 *
 * A permanently slow suite is a suite nobody runs, and a hardcoded
 * `waitForTimeout` is a defect everywhere else in this repository — so the
 * pacing is a knob rather than a property of the specs. `DEMO_PACE=1` turns
 * the same file into something a person can sit and watch; unset, CI pays
 * nothing and the journeys are ordinary assertions.
 *
 * Read from the TEST process. Playwright's config and specs run here; the app
 * under test knows nothing about pacing and must not.
 */
export const DEMO_PACE = Math.max(0, Number(process.env.DEMO_PACE ?? 0) || 0);

/** The key the caption is stashed under, so a navigation can repaint it. */
const CAPTION_KEY = 'journey-caption';

/**
 * Paint the caption on every document load.
 *
 * 🔴 An init script rather than a per-beat `evaluate`, because a beat that
 * navigates would otherwise lose its own caption halfway through — which is
 * exactly the beat a viewer most needs labelled. `sessionStorage` is per-tab
 * and per-origin, and every journey stays on http://localhost:3000, so the
 * text survives the trip.
 *
 * Wrapped in try/catch at both ends: `about:blank` has no accessible
 * storage, and a journey whose captions fail to paint must still pass. The
 * caption is for the viewer, never for an assertion.
 */
function paintCaption(key: string): void {
  try {
    const text = sessionStorage.getItem(key);
    if (!text) return;
    const render = () => {
      let node = document.getElementById('journey-caption');
      if (!node) {
        node = document.createElement('div');
        node.id = 'journey-caption';
        node.setAttribute('data-testid', 'journey-caption');
        node.setAttribute('aria-hidden', 'true');
        node.style.cssText = [
          'position:fixed',
          'left:0',
          'bottom:0',
          'width:100%',
          'z-index:2147483647',
          'pointer-events:none',
          'padding:10px 16px',
          'background:rgba(10,9,16,0.86)',
          'color:#F2EFE9',
          'font:500 15px/1.4 system-ui,sans-serif',
          'letter-spacing:0.01em',
        ].join(';');
        document.body.appendChild(node);
      }
      node.textContent = text;
    };
    if (document.body) render();
    else document.addEventListener('DOMContentLoaded', render, { once: true });
  } catch {
    // No storage on this document. Nothing to paint, nothing to report.
  }
}

/**
 * Install the caption on this page. Call once, before the first navigation.
 *
 * Cheap when `DEMO_PACE` is 0 — the init script still runs, but with no
 * caption ever written it does nothing and appends no node, so a CI run's DOM
 * is byte-identical to one without the harness. That matters: an overlay
 * present only in paced runs cannot be what makes a paced run pass.
 */
export async function startJourney(page: Page): Promise<void> {
  if (DEMO_PACE === 0) return;
  await page.addInitScript(paintCaption, CAPTION_KEY);
}

/**
 * One beat of the journey: a caption, some work, and a pause.
 *
 * 🔴 **The only place in `e2e/` allowed to wait on a clock.** Every deliberate
 * pause in every journey goes through here — `scripts/layering.sh` enforces it
 * — so the whole suite's pacing is one number and no journey can quietly
 * acquire a sleep of its own.
 *
 * Wrapped in `test.step` so the caption is also the label in the HTML report
 * and the trace viewer: the same sentence names the beat on screen, in the
 * report, and in the source.
 */
export async function beat<T>(
  page: Page,
  caption: string,
  work: () => Promise<T>,
): Promise<T> {
  if (DEMO_PACE > 0) {
    await page
      .evaluate(
        ([key, text]) => {
          try {
            sessionStorage.setItem(key as string, text as string);
            const node = document.getElementById('journey-caption');
            if (node) node.textContent = text as string;
          } catch {
            // Not a document that can hold a caption. Carry on.
          }
        },
        [CAPTION_KEY, caption],
      )
      .catch(() => {
        // Navigating, or not on a page yet. The init script repaints on load.
      });
  }

  const result = await test.step(caption, work);

  if (DEMO_PACE > 0) await page.waitForTimeout(DEMO_PACE * 1000);
  return result;
}
```

- [ ] **Step 2: Write the scratch-data helper**

Create `e2e/journeys/support/scratch.ts`:

```ts
import { expect } from '@playwright/test';

/**
 * The scratch-data discipline every journey inherits.
 *
 * 🔴 The database this runs against locally is a **restored copy of
 * production**: league 1 is sixty real people's draft history, and
 * `lib/db.test.ts` asserts exact counts for the restored tables (1355 films, 60
 * users, 4559 nominations, 10 seasons). A journey that leaves one row behind
 * turns an unrelated contract test red, and trains the eye to ignore a red
 * suite.
 *
 * So: everything a journey writes carries its tag, and everything carrying its
 * tag is deleted afterwards — including on failure, which is why the cleanups
 * live in `afterAll` and not at the end of the test body.
 *
 * Raw `pg` rather than the Prisma client: Playwright does not resolve the `@/`
 * alias into `generated/prisma`, so importing `lib/db` here fails at require
 * time and takes the whole spec with it. Same reasoning as every spec in
 * `e2e/`. Those specs keep their own private copies of `withDb` — they are not
 * in this phase's diff and each documents why it opens its own client.
 */
export type Query = (sql: string, params?: unknown[]) => Promise<unknown[]>;

export async function withDb<T>(fn: (query: Query) => Promise<T>): Promise<T> {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(async (sql, params) => (await client.query(sql, params)).rows);
  } finally {
    await client.end();
  }
}

/**
 * The season every page defaults to.
 *
 * Read rather than hardcoded: a restored database and CI's seeded-empty one
 * both hold exactly one active row, and `scripts/seed-e2e.mjs` happens to make
 * it 2026 — but a journey that types 2026 breaks the day the owner moves the
 * season, and it would break as "the draft console is empty" rather than as a
 * stale literal.
 */
export async function activeYear(): Promise<number> {
  return withDb(async (query) => {
    const rows = (await query(
      'select year from available_years where is_active limit 1',
    )) as { year: number }[];
    const year = rows[0]?.year;
    if (year == null) throw new Error('no active season in this database');
    return year;
  });
}

/**
 * Remove a journey's league, its seats, its picks and its films.
 *
 * 🔴 **Picks first.** `draft_picks` has no foreign key, so rows deleted in the
 * other order are orphaned rather than removed — and an orphan is invisible to
 * every league-scoped query while still counting in `db.test.ts`.
 */
export async function cleanupLeague(tag: string): Promise<void> {
  await withDb(async (query) => {
    await query(
      `delete from draft_picks where draft_id in
         (select d.id from drafts d join leagues l on l.id = d.league_id
           where l.name like $1)`,
      [`${tag}%`],
    );
    await query(
      'delete from drafts where league_id in (select id from leagues where name like $1)',
      [`${tag}%`],
    );
    await query('delete from leagues where name like $1', [`${tag}%`]);
    await query('delete from movies where title like $1', [`${tag}%`]);
  });
}

/** Remove a journey's award show, its categories, nominations, wins and tier. */
export async function cleanupShow(tag: string): Promise<void> {
  await withDb(async (query) => {
    await query(
      `delete from winners where award_id in
         (select a.id from awards a join events e on e.id = a.event_id
           where e.abbreviation like $1)`,
      [`${tag}%`],
    );
    await query(
      `delete from nominations where award_id in
         (select a.id from awards a join events e on e.id = a.event_id
           where e.abbreviation like $1)`,
      [`${tag}%`],
    );
    await query(
      'delete from awards where event_id in (select id from events where abbreviation like $1)',
      [`${tag}%`],
    );
    await query('delete from events where abbreviation like $1', [`${tag}%`]);
    await query('delete from points where level like $1', [`${tag}%`]);
  });
}

/**
 * Remove a journey's throwaway identities and everything hanging off them.
 *
 * Scoped to the journey's own prefix, never to `@example.test` at large — the
 * specs run side by side and a blanket delete takes another one's signed-in
 * identity mid-journey.
 */
export async function cleanupUsers(tag: string): Promise<void> {
  await withDb(async (query) => {
    await query(
      `delete from watchlists where user_id in
         (select id from users where email like $1)`,
      [`${tag}-%@example.test`],
    );
    await query(
      `delete from lists where user_id in
         (select id from users where email like $1)`,
      [`${tag}-%@example.test`],
    );
    await query('delete from users where email like $1', [`${tag}-%@example.test`]);
  });
}

/**
 * Remove the `movies` row a journey caused to be ingested.
 *
 * 🔴 Marking a film watched, drafting it or nominating it **ingests it** (D63
 * draws the line: a person acting deliberately writes, a page render does not),
 * so a journey that touches a real film adds a row to `movies`.
 * `lib/db.test.ts` asserts the restored table still holds exactly 1355 films.
 * This is `e2e/browse.spec.ts`'s `forgetFilm`, verbatim — the existing pattern
 * for putting it back.
 *
 * Only ever deletes a film nothing references. The caller decides whether the
 * film was cached before the journey ran; this decides whether it is safe now.
 */
export async function forgetFilm(tmdbId: string): Promise<void> {
  await withDb(async (query) => {
    const rows = (await query(
      `select m.id from movies m
        where m.tmdb_id = $1
          and not exists (select 1 from watchlists w where w.movie_id = m.id)
          and not exists (select 1 from draft_picks d where d.movie_id = m.id)
          and not exists (select 1 from nominations n where n.movie_id = m.id)
          and not exists (select 1 from lists l where l.movie_id = m.id)`,
      [tmdbId],
    )) as { id: number }[];
    const id = rows[0]?.id;
    if (id) await query('delete from movies where id = $1', [id]);
  });
}

/**
 * The gate's "verified by count": nothing carrying this tag survives.
 *
 * 🔴 A tag count, not a table count. The gate requires these journeys to pass
 * against a **seeded-empty** database as well as the restored one, and "1355
 * films" is not true there and never will be. "Zero rows matching `e2e-j1%`"
 * is the same assertion in both worlds, and it is the assertion that actually
 * says the journey put the database back.
 *
 * Fails loudly with the table that leaked rather than a bare count mismatch,
 * because the interesting information is which delete was in the wrong order.
 */
export async function assertNoResidue(
  tag: string,
  years: readonly number[] = [],
): Promise<void> {
  const leftovers = await withDb(async (query) => {
    const count = async (sql: string, params: unknown[]) =>
      Number(((await query(sql, params)) as { count: string }[])[0]?.count ?? 0);

    return {
      leagues: await count('select count(*) from leagues where name like $1', [
        `${tag}%`,
      ]),
      movies: await count('select count(*) from movies where title like $1', [
        `${tag}%`,
      ]),
      users: await count('select count(*) from users where email like $1', [
        `${tag}-%@example.test`,
      ]),
      events: await count('select count(*) from events where abbreviation like $1', [
        `${tag}%`,
      ]),
      points: await count('select count(*) from points where level like $1', [
        `${tag}%`,
      ]),
      // Orphans count too: `draft_picks` has no foreign key, so a pick whose
      // draft row is gone is still a row.
      orphanPicks: await count(
        `select count(*) from draft_picks dp
          where not exists (select 1 from drafts d where d.id = dp.draft_id)`,
        [],
      ),
      seasons:
        years.length === 0
          ? 0
          : await count('select count(*) from available_years where year = any($1)', [
              [...years],
            ]),
    };
  });

  expect(leftovers).toEqual({
    leagues: 0,
    movies: 0,
    users: 0,
    events: 0,
    points: 0,
    orphanPicks: 0,
    seasons: 0,
  });
}
```

- [ ] **Step 3: Write the harness's own test**

The harness is the one part of this phase with no journey to prove it, so it
gets a temporary spec of its own. Create `e2e/journeys/00-harness.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import { beat, DEMO_PACE, startJourney } from './support/pace';
import { assertNoResidue, withDb } from './support/scratch';

/**
 * The harness, proving itself. Deleted at the end of P19.T0 — see the plan.
 */
test('the caption paints, survives a navigation, and costs nothing at pace 0', async ({
  page,
}) => {
  await startJourney(page);
  await page.goto('/tokens');

  await beat(page, 'The first beat', async () => {
    await expect(page.getByText('Cinemadraft')).toBeVisible();
  });

  const caption = page.getByTestId('journey-caption');
  if (DEMO_PACE > 0) {
    await expect(caption).toHaveText('The first beat');
    await beat(page, 'And a second, after a navigation', async () => {
      await page.goto('/award-shows');
    });
    // The init script repainted it on the new document, unprompted.
    await expect(caption).toHaveText('And a second, after a navigation');
  } else {
    // 🔴 At pace 0 the overlay is not merely invisible, it is absent: an
    // element that exists only in paced runs could be what makes a paced run
    // pass, and then CI would be testing a different DOM.
    await expect(caption).toHaveCount(0);
  }
});

test('the scratch helpers reach the database and report a clean tag', async () => {
  const rows = await withDb(async (query) => query('select 1 as ok'));
  expect(rows).toHaveLength(1);
  await assertNoResidue('e2e-j0');
});
```

- [ ] **Step 4: Run the harness test both ways**

```bash
npm run db:up
npx playwright test e2e/journeys/00-harness.spec.ts
DEMO_PACE=1 npx playwright test e2e/journeys/00-harness.spec.ts
```

Expected: both PASS. The second takes roughly two seconds longer per test (one
beat each in the first, two in the paced branch). If the caption assertion
fails in the paced run, the init script is not reaching the document — check
that `startJourney` is called **before** `page.goto`.

- [ ] **Step 5: Turn on video**

In `playwright.config.mts`, replace the `use` block:

```ts
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    /**
     * 🔴 The recording is the artefact the owner reviews (P19.T7), so a paced
     * run records everything and an ordinary run records only what failed.
     *
     * Cost is not the objection — a full 80-spec run recorded 9.1MB of webm on
     * 2026-09-12 — the objection is that eighty videos of a green run are
     * eighty files nobody opens. `retain-on-failure` keeps the debugging value
     * at no cost on green.
     *
     * `DEMO_PACE` is read here, in the test process. The app under test knows
     * nothing about pacing and must not: `webServer.env` is unchanged.
     */
    video: Number(process.env.DEMO_PACE ?? 0) > 0 ? 'on' : 'retain-on-failure',
  },
```

- [ ] **Step 6: Add the script**

In `package.json`, after `"test:e2e"`:

```json
    "e2e:journeys": "DEMO_PACE=1 playwright test e2e/journeys --workers=1",
```

`--workers=1` rather than a second Playwright project: the config is
`fullyParallel: true` and one worker is all that "one ordered film" needs.
Playwright runs files in path order within a worker, which is why the journeys
are numbered `01`–`05`. A second project would need a `testIgnore` on the
existing one to stop every journey running twice in CI, for no gain.

- [ ] **Step 7: Make the one-helper rule enforceable**

Append to `scripts/layering.sh`, before `exit $fail`:

```bash
# 🔴 Pacing is a knob, and a knob has exactly one place it is turned.
# `e2e/journeys/support/pace.ts` owns the only `waitForTimeout` in the suite: a
# journey that grows a sleep of its own is a journey CI pays for forever, and a
# slice spec with one is the plain defect it has always been. This is the check
# that keeps P19's deliberate exception from becoming a habit.
check "only the journey pacing helper waits on a clock" \
  "$(grep -rn 'waitForTimeout' e2e 2>/dev/null \
     | grep -v '^e2e/journeys/support/pace\.ts:' || true)"
```

Mirror it into `.github/workflows/ci.yml` alongside the other layering steps —
the workflow owns the canonical copy and the script mirrors it (see the script's
own header). Add after the existing `Only repositories import the db client`
step:

```yaml
      - name: Only the journey pacing helper waits on a clock
        run: |
          if grep -rn 'waitForTimeout' e2e | grep -v '^e2e/journeys/support/pace\.ts:'; then
            echo "a deliberate wait belongs in e2e/journeys/support/pace.ts"
            exit 1
          fi
```

- [ ] **Step 8: Delete the harness test and verify**

```bash
rm e2e/journeys/00-harness.spec.ts
npm run lint && npm run typecheck && npm run layering
```

Expected: all three pass, and `layering` prints the new check as `✓`. The
harness test has done its job — from here the journeys exercise the helper on
every beat, and a file that only proves the helper compiles is a file that will
rot.

- [ ] **Step 9: Record the decision**

Append to `docs/DECISIONS.md`, after D84:

```markdown
| D85 | **Journey pacing is an environment knob, never an inline wait.** `DEMO_PACE` (seconds per beat, default 0) is read by `e2e/journeys/support/pace.ts`, and `beat()` is the only place in `e2e/` permitted to call `waitForTimeout` — enforced by a grep in `scripts/layering.sh` and in CI. The same spec is therefore a fast assertion on CI and a watchable film on a laptop, and a journey that could only be watched by editing it would not have met the requirement. Video follows the same switch: `on` when paced, `retain-on-failure` otherwise. The caption overlay is likewise absent at pace 0, so a paced run cannot pass on a DOM that CI never sees |
```

- [ ] **Step 10: Commit**

```bash
git add e2e/journeys playwright.config.mts package.json scripts/layering.sh \
        .github/workflows/ci.yml docs/DECISIONS.md docs/PROGRESS.md
git commit -m "P19.T0: the journey harness — DEMO_PACE, captions, video, scratch discipline"
```

---

## Task 1: The draft gets an end

**Decision, stated plainly: build the control.**

`completeDraft` is not a service-layer function with no action wrapper — it is
**already a Server Action** at `actions/leagues/manage-league.ts:102`, already
gated by `authorizeLeague` (the same gate `startDraft` and `updateLeagueSettings`
use), already returning `ActionResult`, already revalidating the league layout,
and already under test at `actions/leagues/season-actions.test.ts:430`. What is
missing is one button. So the choice the phase note framed as "build it or record
why the draft has no end" is not a product decision of any size: the product
decision was made when the action was written, and the UI simply never caught up.
Recording "the draft has no end" would be recording a bug as a design.

The two things that make it genuinely low-risk, both verified by reading:
`getDraftConsole` never reads `draftingStatus`, so finishing does **not** lock the
console or the board; and `startDraft` sets `active` from any status, so a
mis-click is reversible. Nothing else in the app branches on `complete` beyond
`isPending` checks that already handle it.

**Not built, deliberately:** `stageNextSeason` in the same file **also has no UI
caller** — a second orphan, found while reading for this task. It is a bigger
question than a button (it decides what "next season" means for a league), it is
not named by the phase, and journey 1 does not need it. Flagged in `PROGRESS.md`
Step 7 rather than built.

**Files:**
- Modify: `components/SeasonSetup.tsx:1-4` (imports), `:400-430` (`StartDraftButton`'s neighbourhood), `:225-240` (the "The draft" section)
- Create: `components/SeasonSetup.stories.tsx`
- Test: `components/SeasonSetup.test.tsx`

**Interfaces:**
- Consumes: `completeDraft` from `@/actions/leagues/manage-league` —
  `(input: { leagueId: number; year: number }) => Promise<ActionResult>`,
  unchanged by this task.
- Produces: `SeasonSetup`'s props are **unchanged**. The new control is internal
  and keyed off the `status` prop it already receives.

**Context an implementer needs.**

`SeasonSetup` renders a section headed "The draft" whose body is
`isPending ? <StartDraftButton/> : <p>This draft is {status}. Groups are fixed
once it starts.</p>`. For a league mid-draft that paragraph is a dead end: the
owner is looking at the one page that manages the season and there is nothing
there to end it. The new control goes in the same section, for `status ===
'active'` only — `complete` keeps the paragraph, because a finished draft has
nothing further to offer here.

The Phase 3.5 gate applies: the control uses the `Button` primitive with the
default `carmine` accent (D69 — carmine is *submit and destructive*; brass is
awards, and finishing a draft is not an award), and the component gains a
Storybook story, which it does not currently have. The neighbouring
`StartDraftButton` is a raw `<button>` predating the primitive; **it is not
converted here** — that is a one-line-of-value change in a file this task is
already editing for a different reason, and mixing it in makes the diff about
two things.

`window.confirm` is the file's established pattern for an act that is hard to
undo (`RemoveSeatButton`, `StartDraftButton`), and `season-setup.spec.ts` and
`league-lifecycle.spec.ts` both drive it with `page.once('dialog', …)`. Journey
1 does the same, so keep it.

- [ ] **Step 1: Write the failing tests**

Add to `components/SeasonSetup.test.tsx`. First extend the mock at line 38 —
it currently exports only `startDraft`:

```tsx
const completeDraft = vi.hoisted(() => vi.fn(async () => ({ ok: true, data: null })));

vi.mock('@/actions/leagues/manage-league', () => ({ startDraft, completeDraft }));
```

Then add three tests, next to the existing `says what state the draft is in`:

```tsx
  it('🔴 offers a way to end the draft once it is running', async () => {
    // The defect this closes: `completeDraft` has existed since P10.T17 and
    // nothing called it, so an owner on the one page that manages the season
    // had no way to say the draft was over. A draft with no end state is why
    // journey 1 could not finish.
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = setup({ status: 'active' });

    await user.click(screen.getByRole('button', { name: 'Finish the draft' }));

    expect(completeDraft).toHaveBeenCalledWith({ leagueId: 1, year: 2026 });
    await waitFor(() =>
      expect(screen.getByText('The draft is finished')).toBeInTheDocument(),
    );
    confirm.mockRestore();
  });

  it('🔴 confirms before finishing, and a refusal writes nothing', async () => {
    // Same reasoning as starting: the league is told the draft is over, and
    // people stop watching. A mis-click must not be the thing that says so.
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = setup({ status: 'active' });

    await user.click(screen.getByRole('button', { name: 'Finish the draft' }));

    expect(confirm).toHaveBeenCalled();
    expect(completeDraft).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('offers nothing to finish before it has started, or after it has ended', () => {
    setup({ status: 'pending' });
    expect(screen.queryByRole('button', { name: 'Finish the draft' })).toBeNull();

    cleanup();
    setup({ status: 'complete' });
    expect(screen.queryByRole('button', { name: 'Finish the draft' })).toBeNull();
  });
```

`cleanup` comes from `@testing-library/react`; add it to that import if the file
does not already pull it in. **UNVERIFIED:** the exact `leagueId`/`year` the
file's `setup()` helper renders with — read the helper at the top of the test
file and use its values rather than `1`/`2026` if they differ.

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run components/SeasonSetup.test.tsx
```

Expected: FAIL — three failures, all "Unable to find role button with name
Finish the draft" (and the mock factory now exporting a `completeDraft` nothing
imports).

- [ ] **Step 3: Add the control**

In `components/SeasonSetup.tsx`, extend the import at line 4:

```tsx
import { completeDraft, startDraft } from '@/actions/leagues/manage-league';
```

and add `Button` to the component imports:

```tsx
import { Button } from './Button';
```

Add the control next to `StartDraftButton`:

```tsx
/**
 * 🔴 The draft's end state, which the app has never had.
 *
 * `completeDraft` shipped in P10.T17 and no UI called it, so an owner could
 * open a draft and never close one: the league board said `active` forever and
 * the one page that manages a season offered nothing but a sentence. Found by
 * the tranche-3 planner; built here because the missing half was always the
 * button, never the rule — the action is gated, validated and revalidating
 * already.
 *
 * Confirms, like starting does. The league stops watching when this is
 * pressed, which is not something a mis-click should be able to say. It is
 * reversible — `startDraft` sets `active` from any status — but "reversible"
 * is not the same as "harmless in front of twelve people on a call".
 */
function FinishDraftButton({
  leagueId,
  year,
  disabled,
  onDone,
}: {
  leagueId: number;
  year: number;
  disabled: boolean;
  onDone: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();

  const finish = useCallback(() => {
    if (!window.confirm('Finish the draft? The league will be told it is over.')) return;
    startTransition(async () => {
      const result = await completeDraft({ leagueId, year });
      onDone(result.ok ? 'The draft is finished' : result.message);
    });
  }, [leagueId, year, onDone]);

  return (
    <Button
      type="button"
      disabled={disabled || pending}
      onClick={finish}
      sx={{ width: 'fit-content', minHeight: 44 }}
    >
      Finish the draft
    </Button>
  );
}
```

and replace the "The draft" section's body:

```tsx
      <section className="flex flex-col gap-3">
        <h2 className="text-text-dim text-xs font-normal">The draft</h2>

        {isPending ? (
          <StartDraftButton
            leagueId={leagueId}
            year={year}
            disabled={pending}
            onDone={setMessage}
          />
        ) : (
          <>
            <p className="text-text-secondary text-sm">
              This draft is {status}. Groups are fixed once it starts.
            </p>
            {/* Only while it is running: a finished draft has nothing more to
                offer here, and a pending one has not begun. */}
            {status === 'active' ? (
              <FinishDraftButton
                leagueId={leagueId}
                year={year}
                disabled={pending}
                onDone={setMessage}
              />
            ) : null}
          </>
        )}
      </section>
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
npx vitest run components/SeasonSetup.test.tsx
```

Expected: PASS, including the existing `says what state the draft is in when it
is not pending` — that test renders `status: 'complete'`, which still gets the
paragraph and no button.

- [ ] **Step 5: Add the Storybook story the gate requires**

Create `components/SeasonSetup.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SeasonSetup, type SetupSeatView } from './SeasonSetup';

/**
 * The owner's season console, in its three states.
 *
 * The reason it has a story at all is P19.T1: the draft gained an end, and the
 * Phase 3.5 gate says a new control is reviewed in Storybook rather than by
 * being described. `Running` is the state that was a dead end until this phase.
 */
const seats: SetupSeatView[] = [
  { draftId: 1, name: 'Ada Lovelace', isDummy: false, group: 1, order: 1, hasPicks: true },
  { draftId: 2, name: 'Grace Hopper', isDummy: false, group: 1, order: 2, hasPicks: true },
  { draftId: 3, name: 'Katherine Johnson', isDummy: true, group: 2, order: 1, hasPicks: false },
  { draftId: 4, name: 'Mary Jackson', isDummy: false, group: 2, order: 2, hasPicks: false },
];

const meta = {
  title: 'Phase 10/SeasonSetup',
  component: SeasonSetup,
  parameters: { layout: 'padded' },
  args: {
    leagueId: 1,
    year: 2026,
    seats,
    groups: [1, 2],
    suggestedGroupCount: 2,
  },
} satisfies Meta<typeof SeasonSetup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Before the draft: seats, groups and the way in. */
export const Arranging: Story = { args: { status: 'pending' } };

/** 🔴 Mid-draft. Until P19.T1 this state offered a sentence and nothing else. */
export const Running: Story = { args: { status: 'active' } };

/** After: no controls, because there is nothing left to arrange or to end. */
export const Finished: Story = { args: { status: 'complete' } };
```

- [ ] **Step 6: Prove the story compiles and nothing regressed**

```bash
npm run build-storybook
npm run lint && npm run typecheck && npm run layering && npm run test
```

Expected: all pass. `build-storybook` is the gate that every story compiles
(D78) — Storybook is not deployed, so this is the only place a broken story
surfaces.

- [ ] **Step 7: Record the decision and the second orphan**

Append to `docs/DECISIONS.md`:

```markdown
| D86 | **The draft has an end, and it is a button on the season console.** `completeDraft` shipped in P10.T17 as a fully-formed Server Action — `authorizeLeague`-gated, Zod-validated, `ActionResult`-returning, revalidating the league layout, covered by `actions/leagues/season-actions.test.ts` — and no UI ever called it, so a league board read `active` forever and journey 1 had nothing to finish. P19.T1 adds a confirming `Finish the draft` control to `SeasonSetup`'s "The draft" section, shown only while the status is `active`. Deliberately nothing more: finishing does **not** lock the console (`getDraftConsole` never reads the status) and is reversible (`startDraft` sets `active` from any status), so this is the smallest change that gives the draft an end rather than a redesign of what "finished" means. 🔴 `stageNextSeason`, in the same file, is **also uncalled** — a second orphan, left alone on purpose: what "open next season" should do for a league is a question, not a missing button |
```

Add to `docs/PROGRESS.md` under Phase 19's notes:

```markdown
- 🔴 **`stageNextSeason` has no caller either.** Found while building P19.T1.
  Unlike `completeDraft` it is not merely a missing button — it copies a
  league's people into a new season and moves `activeYear`, and nobody has
  decided where an owner should be offered that or what it should say. Left
  uncalled; it belongs to whoever owns the turn of the season.
```

- [ ] **Step 8: Commit**

```bash
git add components/SeasonSetup.tsx components/SeasonSetup.test.tsx \
        components/SeasonSetup.stories.tsx docs/DECISIONS.md docs/PROGRESS.md
git commit -m "P19.T1: the draft can be finished"
```

---

## Task 2: Journey 1 — a season, from nothing to a finished draft

**Files:**
- Create: `e2e/journeys/01-draft-a-season.spec.ts`
- Delete: `e2e/league-lifecycle.spec.ts`

**Interfaces:**
- Consumes: `beat`, `startJourney` (T0), `withDb`, `activeYear`,
  `cleanupLeague`, `cleanupUsers`, `assertNoResidue` (T0), `signInAs` from
  `../support/session`.
- Produces: nothing other specs import. The journeys are leaves.

**Context an implementer needs.**

**What is being folded, and why nothing is lost.**
`e2e/league-lifecycle.spec.ts` (P15.T11) walks create → seat → deal **one**
group → open → four picks → snake assertion → board readback → row assertion.
Journey 1 is the same walk with four groups, an invite, and an ending, so the
old file becomes a shorter second version of it — which `docs/PLAN.md` names
explicitly as the thing to fold rather than leave to rot. Every assertion it
carries is inherited below:

| `league-lifecycle.spec.ts` asserted | Journey 1 step |
|---|---|
| Creating lands on `/leagues/{id}` with the name as `h1` | 3 |
| The creator is seated (one seat before anyone is added) | 3 |
| Placeholders seat, one message per seat | 5 |
| Dealing runs the ceremony and confirms | 6 |
| Starting confirms, and says "The draft is open" | 7 |
| A fragment of a title is enough to pick | 8 |
| Round 1 gives every seat exactly one turn | 9 |
| 🔴 Round 2 starts where round 1 ended (the snake, not a repeat) | 9 |
| Round 2 keeps running back down the order | 9 |
| The public board carries every pick | 11 |
| `draft_picks` rows have the right seats and rounds | 11 |

The one thing that changes is the arithmetic: the old file used a **single**
group of four deliberately, because four people across two groups leaves two
seats apiece and a reversal is indistinguishable from a repeat. Journey 1 deals
**four groups of three**, and three is enough — `A B C` then `C B A` separates a
snake from `A B C A` exactly as well as four does. The assertion is kept in the
same shape (read the seat off the console's own heading, never off the order the
spec typed) so that it still cannot pass by counting.

**Why twelve seats.** Four groups is the owner's brief and `docs/PLAN.md` T2's
"at least four". `dealIntoGroups` is round-robin, so twelve seats into four
groups is 3/3/3/3 by construction, never 4/4/3/1. Eleven placeholders plus the
owner is twelve.

**Search terms are invented words.** The restored database holds 1355 films and
TMDB is asked on every query, so a four-letter fragment like `Alph` competes with
real titles for a place in the ranked list. Invented words (`Zephyrine`,
`Quillon`, …) cannot collide, cannot be returned by TMDB, and are still searched
as the ordinary "part of the title is enough" path the owner uses on a call.
`movieRepository.searchFuzzy` is handed a plain word with no punctuation, so the
hyphen in the tag never reaches the query.

**The year is the active one, read from the database.** `createLeague` seats the
creator for `getActiveYear()`, and the setup page and console default to it, so
journey 1 creates **no** `available_years` row and has none to clean up. Both a
restored database (2026) and CI's seeded one (2026, from `scripts/seed-e2e.mjs`)
have exactly one active row.

**No TMDB needed.** Every film journey 1 drafts is a local scratch row, and
`lib/services/search.ts` absorbs a TMDB failure rather than propagating it —
`const fetched = await remote(trimmed).catch(() => [])`. `searchTmdb` returns
`[]` with no key. So this journey runs identically with and without
`TMDB_API_KEY`, which is what lets it be the CI-side proof.

- [ ] **Step 1: Write the journey**

Create `e2e/journeys/01-draft-a-season.spec.ts`:

```ts
import { expect, type Page, test } from '@playwright/test';

import { signInAs } from '../support/session';
import { beat, startJourney } from './support/pace';
import {
  activeYear,
  assertNoResidue,
  cleanupLeague,
  cleanupUsers,
  withDb,
} from './support/scratch';

/**
 * 🔴 Journey 1: one person takes a league from nothing to a finished draft.
 *
 * Folds in `e2e/league-lifecycle.spec.ts` (P15.T11), which walked the same
 * path with one group and no ending — see the plan for the assertion-by-
 * assertion inheritance. Two specs walking the same path diverge the first
 * time either is touched, so there is one.
 *
 * What a journey adds over the slices it overlaps: `leagues.spec.ts` proves an
 * invite works, `season-setup.spec.ts` proves seats and groups save,
 * `draft.spec.ts` proves a pick lands. None of them proves the acts *compose*
 * — that the league a person creates is the one the setup page arranges, that
 * the seats it deals are the running order the console reads, that the picks
 * the console takes are the ones the league sees on the public board, and that
 * the whole thing can be brought to an end. A seam between two individually
 * green features is what only this shape catches.
 *
 * 🔴 Scratch everything. League 1 is sixty real people's history and
 * `lib/db.test.ts` counts the restored tables exactly, so the league, its
 * seats, its picks, its films and its owner are all created here and removed
 * afterwards — on failure too, which is why the cleanup is in `afterAll`.
 */
const TAG = 'e2e-j1';
const OWNER = `${TAG}-owner@example.test`;

/**
 * Eight films, as invented words.
 *
 * 🔴 Not `Alpha`/`Bravo`. The restored database holds 1355 films and
 * `findFilms` asks TMDB on every query, so a common fragment competes with
 * real titles for a place in the ranked list and the scratch film can fall off
 * the end. These cannot collide with anything, and searching the whole word is
 * still the "part of the title is enough" path the owner actually uses.
 */
const WORDS = [
  'Zephyrine',
  'Quillon',
  'Bastable',
  'Narrowdale',
  'Pellucid',
  'Thrimble',
  'Vantry',
  'Okenshaw',
];
const FILMS = WORDS.map((word) => `${TAG} ${word}`);

/** Eleven placeholders, so four groups hold three seats each with the owner. */
const PLACEHOLDERS = [
  'Ada',
  'Grace',
  'Katherine',
  'Dorothy',
  'Mary',
  'Annie',
  'Evelyn',
  'Frances',
  'Jean',
  'Kathleen',
  'Marlyn',
];

async function cleanup(): Promise<void> {
  await cleanupLeague(TAG);
  await cleanupUsers(TAG);
  await withDb(async (query) => {
    await query('delete from users where email = $1', [OWNER]);
  });
}

/** The films the owner drafts from, cached the way a real one would be. */
async function seedFilms(): Promise<void> {
  await withDb(async (query) => {
    for (const title of FILMS) {
      await query(
        `insert into movies (title, sort_title, created_at, updated_at)
           values ($1, $1, now(), now())`,
        [title],
      );
    }
  });
}

/** The seat the board says is up, read from the console's own heading. */
async function onTheClock(page: Page): Promise<string> {
  const heading = page.getByRole('heading', { name: /^Pick for / });
  await expect(heading).toBeVisible();
  return (await heading.innerText()).replace(/^Pick for /, '').trim();
}

/**
 * Take a film for whoever is up, and return the seat it went to.
 *
 * Waits on the console's own status line rather than on a seat name the spec
 * chose: the message is written after the action resolves, so by the time it
 * reads back, the refreshed seats and the next suggestion have arrived as
 * props.
 */
async function pick(page: Page, title: string): Promise<string> {
  const seat = await onTheClock(page);

  await page.getByRole('searchbox').fill(title.replace(`${TAG} `, ''));
  await page.getByRole('button', { name: new RegExp(title) }).click();
  await expect(page.getByText(`${title} → ${seat}`)).toBeVisible();

  return seat;
}

/** Every pick in the league, by seat and round, as the database has it. */
async function picksInLeague(leagueId: number) {
  return withDb(async (query) =>
    query(
      `select coalesce(d.dummy_name, u.first_name) as seat,
              d."group" as "group", dp."order" as round, m.title
         from draft_picks dp
         join drafts d on d.id = dp.draft_id
         left join users u on u.id = d.user_id
         join movies m on m.id = dp.movie_id
        where d.league_id = $1
        order by d."group", dp."order", dp.id`,
      [leagueId],
    ),
  ) as Promise<{ seat: string; group: number; round: number; title: string }[]>;
}

test.describe('journey 1 — a season, from nothing to a finished draft', () => {
  // One long test, not eight. A journey's value is that the acts compose; split
  // into tests they would each need the previous one's state seeded, which is
  // the composition being asserted away.
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(async () => {
    await cleanup();
    await seedFilms();
  });

  test.afterAll(async () => {
    await cleanup();
    await assertNoResidue(TAG);
  });

  test('🔴 an owner creates, invites, seats, deals, drafts and finishes', async ({
    page,
    browser,
  }) => {
    const year = await activeYear();
    await startJourney(page);

    await beat(page, 'The owner signs in', async () => {
      await signInAs(page, { email: OWNER, firstName: 'Owner' });
      await page.goto('/leagues');
    });

    const leagueId = await beat(page, 'A new league is created', async () => {
      await page.goto('/leagues/new');
      await page.getByLabel('League name').fill(`${TAG} the picture show`);
      await page.getByRole('button', { name: 'Create league' }).click();
      await expect(page).toHaveURL(/\/leagues\/\d+/);
      await expect(
        page.getByRole('heading', { name: `${TAG} the picture show` }),
      ).toBeVisible();
      return Number(new URL(page.url()).pathname.split('/')[2]);
    });

    // 🔴 The creator is seated in the same breath, or the league is
    // half-created — `leagues.spec.ts`'s first assertion, kept.
    const invite = await beat(page, 'The invite link is on the page', async () => {
      const code = page.locator('code', { hasText: '/join/' });
      await expect(code).toBeVisible();
      const url = (await code.innerText()).trim();
      expect(url).toMatch(/\/join\/[0-9a-f-]{36}$/i);
      return url;
    });

    await beat(page, 'A second person follows the link and joins', async () => {
      const other = await browser.newContext();
      try {
        const otherPage = await other.newPage();
        await signInAs(otherPage, {
          email: `${TAG}-member@example.test`,
          firstName: 'Member',
        });
        await otherPage.goto(new URL(invite).pathname);
        await otherPage.getByRole('button', { name: 'Join this league' }).click();
        await expect(otherPage).toHaveURL(/\/leagues\/\d+/);
      } finally {
        await other.close();
      }
      await expect
        .poll(async () => (await seatCount(leagueId)))
        .toBe(2);
    });

    await beat(page, 'The owner opens the season setup', async () => {
      await page.goto(`/leagues/${leagueId}`);
      // Followed from the league's own page rather than typed as a URL — the
      // link being there for an owner is part of the journey.
      await page.getByRole('link', { name: 'Set up the season' }).click();
      await expect(page).toHaveURL(/\/leagues\/\d+\/setup/);
    });

    // Ten placeholders, one beat each, so the reel shows the league filling up.
    for (const name of PLACEHOLDERS) {
      await beat(page, `${name} is given a seat`, async () => {
        await page.getByLabel(/without an account/i).fill(name);
        await page.getByRole('button', { name: 'Add seat' }).click();
        await expect(page.getByText(`${name} seated`)).toBeVisible();
      });
    }

    await beat(page, 'Twelve seats are dealt into four groups', async () => {
      await expect.poll(async () => seatCount(leagueId)).toBe(13);
      await page.getByLabel('How many groups').fill('4');
      await page.getByRole('button', { name: 'Deal at random' }).click();
      // 🔴 P15.T12 put a ceremony between the deal and its confirmation. 'Done'
      // rather than 'Skip' is the label once the reel has settled, so waiting
      // for it also waits for the animation.
      await page.getByRole('button', { name: 'Done' }).click();
      await expect(page.getByText(/dealt into groups/i)).toBeVisible();
      // Round-robin dealing, so thirteen seats into four groups is 4/3/3/3.
      expect(await groupSizes(leagueId)).toEqual([4, 3, 3, 3]);
    });

    await beat(page, 'The draft is opened — groups are fixed from here', async () => {
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: 'Start the draft' }).click();
      await expect(page.getByText('The draft is open')).toBeVisible();
    });

    await beat(page, 'The owner opens the draft console', async () => {
      await page.goto(`/leagues/${leagueId}`);
      await page.getByRole('link', { name: 'Run the draft' }).click();
      await expect(page).toHaveURL(/\/leagues\/\d+\/draft/);
      // Four groups, so the console offers a way between them.
      await expect(page.getByRole('navigation', { name: 'Groups' })).toBeVisible();
    });

    // Group 1 holds four seats. Round one gives each of them exactly one turn.
    const roundOne: string[] = [];
    for (const [index, title] of FILMS.slice(0, 4).entries()) {
      roundOne.push(
        await beat(page, `Round 1, pick ${index + 1}: searching for ${title}`, () =>
          pick(page, title),
        ),
      );
    }

    await beat(page, 'Round 1 gave everybody one turn', async () => {
      expect(new Set(roundOne).size).toBe(4);
    });

    await beat(page, 'And round 2 turns back, rather than starting again', async () => {
      // 🔴 THE assertion. A draft that ran 1-2-3-4-1 would pass every other
      // check in this file. Read off the console's own answer, never off the
      // order the spec typed the picks in — that would prove only that the
      // spec can count.
      expect(await onTheClock(page)).toBe(roundOne.at(-1));
    });

    for (const [index, title] of FILMS.slice(4, 7).entries()) {
      await beat(page, `Round 2, pick ${index + 1}: ${title}`, async () => {
        const seat = await pick(page, title);
        // Running back down the order, one seat at a time.
        expect(seat).toBe(roundOne.at(-(index + 1)));
      });
    }

    await beat(page, 'Group 2 drafts too', async () => {
      await page.getByRole('link', { name: 'Group 2' }).click();
      await expect(page).toHaveURL(/group=2/);
      await pick(page, FILMS[7] as string);
    });

    await beat(page, 'The league watches the board fill up', async () => {
      await page.goto(`/leagues/${leagueId}`);
      const board = page.getByRole('table', { name: /Draft board/i }).first();
      await expect(board).toBeVisible();
      for (const title of FILMS.slice(0, 7)) {
        await expect(board.getByText(title, { exact: true })).toBeVisible();
      }
    });

    await beat(page, 'And the rows say the same thing the board does', async () => {
      const picks = await picksInLeague(leagueId);
      expect(picks).toHaveLength(8);
      const groupOne = picks.filter((row) => row.group === 1);
      expect(groupOne.map((row) => row.round)).toEqual([1, 1, 1, 1, 2, 2, 2]);
      expect(groupOne.at(4)?.seat).toBe(roundOne.at(-1));
    });

    await beat(page, 'The owner finishes the draft', async () => {
      // 🔴 P19.T1. Until this phase there was no way to reach this state at
      // all: `completeDraft` existed and nothing called it.
      await page.goto(`/leagues/${leagueId}/setup`);
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: 'Finish the draft' }).click();
      await expect(page.getByText('The draft is finished')).toBeVisible();
    });

    await beat(page, 'And the league board says so', async () => {
      await page.goto(`/leagues/${leagueId}`);
      await expect(page.getByText('complete', { exact: true })).toBeVisible();
      expect(await statusOf(leagueId)).toBe('complete');
    });
  });
});

/** How many seats this league holds, whatever season they are for. */
async function seatCount(leagueId: number): Promise<number> {
  return withDb(async (query) => {
    const rows = (await query(
      'select count(*)::int as count from drafts where league_id = $1',
      [leagueId],
    )) as { count: number }[];
    return rows[0]?.count ?? 0;
  });
}

/** The size of each group, largest first — the dealing rule, checked. */
async function groupSizes(leagueId: number): Promise<number[]> {
  return withDb(async (query) => {
    const rows = (await query(
      `select count(*)::int as count from drafts
        where league_id = $1 and "group" is not null
        group by "group" order by count desc`,
      [leagueId],
    )) as { count: number }[];
    return rows.map((row) => row.count);
  });
}

async function statusOf(leagueId: number): Promise<string | null> {
  return withDb(async (query) => {
    const rows = (await query('select drafting_status from leagues where id = $1', [
      leagueId,
    ])) as { drafting_status: string | null }[];
    return rows[0]?.drafting_status ?? null;
  });
}
```

**UNVERIFIED, and the step that settles each:**
- *That the league page's status renders as the bare word `complete`.*
  `app/(app)/leagues/[id]/page.tsx:142` renders `{board.status}` in a plain
  `<span>`, so it should. Confirm with
  `npx playwright test e2e/journeys/01 --debug` at that beat, and if the copy
  differs, assert `statusOf(leagueId)` alone and drop the on-screen assertion
  rather than inventing the string.
- *That thirteen seats deal 4/3/3/3.* `dealIntoGroups` is round-robin over a
  shuffled list, so the sizes are determined even though the membership is not.
  The assertion is on sizes, never on who landed where.
- *That the group-2 seat has films left to take.* Group 2 has three seats and
  one film is taken there; `add-pick` refuses only a film already taken **in
  that group**, so `FILMS[7]` is free. Confirm on the first run.

- [ ] **Step 2: Run it, fast**

```bash
npm run db:up
npx playwright test e2e/journeys/01-draft-a-season.spec.ts
```

Expected: PASS. Fix whatever the three UNVERIFIED notes turn up **by weakening
the assertion to what is true**, never by adding a wait — `waitForTimeout` is
now a layering failure outside `pace.ts`.

- [ ] **Step 3: Watch it**

```bash
DEMO_PACE=1 npx playwright test e2e/journeys/01-draft-a-season.spec.ts
open test-results/*/video.webm
```

Expected: a film with a caption on every beat, readable without the source open.
If a beat's caption is too terse to follow — "Round 2, pick 1" without the seat
name, say — rewrite the caption. The captions are the deliverable, not decoration.

- [ ] **Step 4: Prove the old file is redundant, then delete it**

```bash
npx playwright test e2e/league-lifecycle.spec.ts
git rm e2e/league-lifecycle.spec.ts
npx playwright test e2e/journeys e2e/leagues.spec.ts e2e/season-setup.spec.ts e2e/draft.spec.ts
```

Expected: the first run passes (so it was green before it was removed, and the
deletion is not hiding a failure); the last run passes with the slice specs
untouched. The slices stay — they are the diagnostic layer, and a journey that
fails says "the league lifecycle is broken" without saying which of forty
assertions moved.

- [ ] **Step 5: Commit**

```bash
git add e2e/journeys/01-draft-a-season.spec.ts docs/PROGRESS.md
git rm --cached e2e/league-lifecycle.spec.ts 2>/dev/null; true
git commit -m "P19.T2: journey 1 — a season from nothing to a finished draft; folds in league-lifecycle"
```

---

## Task 3: Journey 2 — reading the league back

**Files:**
- Create: `e2e/journeys/02-read-the-league-back.spec.ts`

**Interfaces:**
- Consumes: the T0 harness and `signInAs`. Nothing from journey 1.

**Context an implementer needs.**

🔴 **This journey does not depend on journey 1's rows, and that is deliberate.**
`docs/PLAN.md` T3 says "scores that moved because of what journey 1 did", and
read literally that is cross-file state. Three reasons not to build it that way:
`playwright.config.mts` is `fullyParallel: true`, so file order is not
guaranteed in the ordinary run; a journey that cannot be run alone cannot be
used to diagnose anything; and journey 1's cleanup runs in its own `afterAll`,
so its rows are gone before journey 2 starts under any scheduling. Journey 2
therefore **seeds the shape journey 1 produces** — a drafted, finished league
with picks and nominated films — and then makes a score move *within itself*, by
crowning a winner and re-reading every surface. "Scores that moved because of
what journey 1 did" is honoured by shape, not by shared rows. Say so in the
file, so the next reader does not think the dependency was forgotten.

**What it reads, and why each one.** Four services report the same numbers over
one scoring rule (D41), and the defect a journey catches is exactly one of them
disagreeing: the **league board** (`getLeagueBoard`), the **standings panel**
(ranked in the page from the same seats), the **dashboard** signed in
(`getDashboard` — the member's own roster and total), and the **points ledger**
inside a board cell (the explanation that has to add up to the number above it).
`scoring.spec.ts` proves the ledger arithmetic on league 1's real 2025 board but
**skips on CI**, so journey 2 is the CI-side proof of the same property on
scratch rows.

**A scratch season of its own.** The dashboard leaderboard falls back to the
newest *known* season for an unrecognised `?year=` (D65), so an unregistered
year would quietly report the real season's standings and the assertions would
be about the wrong table. Register `available_years` for `YEAR` and delete it —
`lib/db.test.ts` asserts exactly ten rows.

**Signed in as the seat's own member**, not as a stranger: the dashboard shows a
roster only to somebody who holds a seat, and "You" is the marker the page uses
to say which row is yours. That is half of "inspecting teams".

**No TMDB needed** — every film is a local scratch row and nothing navigates to
`/films/{tmdbId}`.

- [ ] **Step 1: Write the journey**

Create `e2e/journeys/02-read-the-league-back.spec.ts` with this shape (the
seeding is the bulk; the walk is short):

```ts
import { expect, type Page, test } from '@playwright/test';

import { signInAs } from '../support/session';
import { beat, startJourney } from './support/pace';
import {
  assertNoResidue,
  cleanupLeague,
  cleanupShow,
  cleanupUsers,
  withDb,
} from './support/scratch';

/**
 * 🔴 Journey 2: a member reads their league back — teams, rosters, standings,
 * the ledger, and a score that moves while they watch.
 *
 * 🔴 **It does not read journey 1's rows, on purpose.** `docs/PLAN.md` T3 says
 * "scores that moved because of what journey 1 did", and taken literally that
 * is cross-file state: `playwright.config.mts` is `fullyParallel: true` so file
 * order is not guaranteed, journey 1 deletes everything it made in its own
 * `afterAll`, and a journey that cannot be run alone cannot be used to
 * diagnose anything. So this seeds the *shape* journey 1 leaves — a finished
 * draft with picks and nominations — and then moves a score itself. The
 * property under test is that four services agree about one number, and that
 * is unchanged by who wrote the rows.
 *
 * `scoring.spec.ts` proves the same ledger property on league 1's real 2025
 * board and **skips on CI** (see `e2e/support/corpus.ts`). This is the CI-side
 * proof, on scratch rows.
 */
const TAG = 'e2e-j2';
const YEAR = 2992;
const MEMBER = `${TAG}-member@example.test`;
const FILMS = ['Zephyrine', 'Quillon', 'Bastable'].map((word) => `${TAG} ${word}`);

async function cleanup(): Promise<void> {
  await cleanupShow(TAG);
  await cleanupLeague(TAG);
  await cleanupUsers(TAG);
  await withDb(async (query) => {
    // 🔴 The scratch season goes too — `lib/db.test.ts` asserts
    // `available_years` still holds exactly ten rows.
    await query('delete from available_years where year = $1', [YEAR]);
  });
}
```

Then a `seed(memberId)` that creates, in this order: the `available_years` row
(`is_active = false`); an `events` row (`${TAG}-show`) with a `points` tier and
one `awards` category; three `movies`; a `leagues` row owned by the member with
`drafting_status = 'complete'`; three `drafts` seats in group 1 (the member's
own plus two placeholders); one `draft_picks` row per seat; and **one
`nominations` row** against the member's film, so there is a non-zero score to
read before anything moves. Copy the SQL shapes verbatim from
`e2e/awards-lifecycle.spec.ts`'s `seed()` — `leagues.owner` is TEXT holding a
JSON array, and `awards.points` is a foreign key into `points.id` (D41), not a
value.

Then the walk:

```ts
test.describe('journey 2 — reading the league back', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(cleanup);
  test.afterAll(async () => {
    await cleanup();
    await assertNoResidue(TAG, [YEAR]);
  });

  test('🔴 four surfaces report one number, and all four move together', async ({
    page,
  }) => {
    await startJourney(page);
    const memberId = await signInAs(page, { email: MEMBER, firstName: 'Member' });
    const { leagueId, awardId, movieId } = await seed(memberId);

    await beat(page, 'The member opens their leagues', async () => {
      await page.goto('/leagues');
      await expect(
        page.getByRole('link', { name: new RegExp(`${TAG} league`) }),
      ).toBeVisible();
      await expect(page.getByText('You run this one')).toBeVisible();
    });

    await beat(page, 'And the board for the season', async () => {
      await page.goto(`/leagues/${leagueId}?year=${YEAR}`);
      await expect(page.getByRole('heading', { name: `${TAG} league` })).toBeVisible();
      // The draft is over, so the board is a board rather than a running order.
      await expect(
        page.getByRole('table', { name: /Draft board/i }).first(),
      ).toBeVisible();
    });

    await beat(page, 'Every team is on it, and the viewer can find their own', async () => {
      const board = page.getByRole('table', { name: /Draft board/i }).first();
      for (const title of FILMS) {
        await expect(board.getByText(title, { exact: true })).toBeVisible();
      }
      // Not by colour alone — the seat is named as the viewer's.
      await expect(page.getByText('You', { exact: true }).first()).toBeVisible();
    });

    await beat(page, 'Standings rank the seats', async () => {
      const standings = page.getByRole('table', { name: /League standings/i });
      await expect(standings).toBeVisible();
      await expect(standings.getByRole('row')).toHaveCount(4); // three seats + header
    });

    const before = await beat(page, 'A pick explains its own score', async () => {
      const cell = page
        .getByRole('table', { name: /Draft board/i })
        .first()
        .locator('figure')
        .filter({ hasText: FILMS[0] as string });
      const summary = cell.locator('summary');
      const total = Number((await summary.innerText()).match(/\d+/)?.[0] ?? '0');
      expect(total).toBeGreaterThan(0);

      await summary.click();
      await expect(cell.locator('details')).toHaveAttribute('open', '');
      // 🔴 The lines add up to the number above them — the property
      // `scoring.spec.ts` proves on the real board and cannot prove on CI.
      const values = await cell
        .locator('li ul li')
        .evaluateAll((nodes) =>
          nodes.map((node) => Number(node.textContent?.match(/(\d+)\s*$/)?.[1] ?? 0)),
        );
      expect(values.length).toBeGreaterThan(0);
      expect(values.reduce((sum, value) => sum + value, 0)).toBe(total);
      return total;
    });

    const dashboardBefore = await beat(page, 'The dashboard agrees', async () => {
      await page.goto(`/?year=${YEAR}`);
      await expect(page.getByRole('list', { name: /drafted films/i })).toBeVisible();
      const row = page.getByRole('row').filter({ hasText: FILMS[0] as string });
      return Number((await row.getByRole('cell').last().innerText()).trim());
    });
    expect(dashboardBefore).toBe(before);

    await beat(page, 'The film wins its category, and the score moves', async () => {
      await crownWinner(awardId, movieId);
    });

    await beat(page, 'All four surfaces moved together', async () => {
      await page.goto(`/leagues/${leagueId}?year=${YEAR}`);
      const after = await totalOnBoard(page, FILMS[0] as string);
      // 🔴 The relationship, never a number: a nomination earns the category's
      // points and a win earns them a second time (DECISIONS.md), so a win is
      // worth twice a nomination. Asserted this way, re-tiering a category is a
      // decision rather than a red test.
      expect(after).toBe(before * 2);

      await page.goto(`/?year=${YEAR}`);
      const row = page.getByRole('row').filter({ hasText: FILMS[0] as string });
      expect(Number((await row.getByRole('cell').last().innerText()).trim())).toBe(after);
    });

    await beat(page, 'And the ledger names the win rather than only doubling', async () => {
      await page.goto(`/leagues/${leagueId}?year=${YEAR}`);
      const cell = page
        .getByRole('table', { name: /Draft board/i })
        .first()
        .locator('figure')
        .filter({ hasText: FILMS[0] as string });
      await cell.locator('summary').click();
      await expect(cell.getByText('Won')).toBeVisible();
    });
  });
});
```

with `crownWinner(awardId, movieId)` inserting one `winners` row directly and
`totalOnBoard(page, title)` reading the `<summary>` the way
`awards-lifecycle.spec.ts` does. The win is written in SQL rather than clicked
because **journey 3 is the journey about clicking it**; here it is the input
that makes a number move.

**UNVERIFIED:**
- *That the standings table has exactly four rows.* `StandingsPanel` renders a
  `<caption>` and one row per seat; whether a header row is counted by
  `getByRole('row')` depends on the markup. Run it; if the count is 3, assert 3
  and note why in the file rather than adding a `+1`.
- *That the dashboard's leaderboard renders a row for a scratch film in a
  scratch season.* `getLeaderboard` is season-scoped and the season is
  registered, so it should. If the row is absent, the beat drops to asserting
  the board and the ledger only, and the gap is recorded in `PROGRESS.md` as an
  open question — **not** papered over with a different locator.

- [ ] **Step 2: Run it, both ways**

```bash
npx playwright test e2e/journeys/02-read-the-league-back.spec.ts
DEMO_PACE=1 npx playwright test e2e/journeys/02-read-the-league-back.spec.ts
```

Expected: PASS both times; the second records a video.

- [ ] **Step 3: Prove it leaves nothing behind**

```bash
npx playwright test e2e/journeys/02-read-the-league-back.spec.ts
npx vitest run lib/db.test.ts
```

Expected: `db.test.ts` green — 1355 films, 60 users, 4559 nominations, 10
seasons. This is the gate's "verified by count" checked against the restored
database, in addition to `assertNoResidue`'s tag check which works on both.

- [ ] **Step 4: Commit**

```bash
git add e2e/journeys/02-read-the-league-back.spec.ts docs/PROGRESS.md
git commit -m "P19.T3: journey 2 — the league read back, and a score that moves"
```

---

## Task 4: Journey 3 — a ceremony night

**Files:**
- Create: `e2e/journeys/03-a-ceremony-night.spec.ts`
- Delete: `e2e/awards-lifecycle.spec.ts`
- Modify: `e2e/support/corpus.ts` (the doc comment names the deleted file)

**Interfaces:**
- Consumes: the T0 harness, `signInAs`.

**Context an implementer needs.**

**What is being folded.** `e2e/awards-lifecycle.spec.ts` (P15.T11) seeds a
scratch show, nominates one film through the admin search, crowns it, and
asserts that the film page, the league board and the season leaderboard all
report the same number and that a win is worth twice a nomination. Journey 3 is
that plus the show being **edited** first and the winner being **corrected**
afterwards, so the old file is a strict subset. Every assertion is inherited:
the three-surface agreement, the `won === 2 × nominated` relationship on each
surface, the TMDB-conditional film page, and the "Won" chip in the ledger.

🔴 **`e2e/support/corpus.ts`'s doc comment names `awards-lifecycle.spec.ts` twice**
as the CI-side proof that keeps `scoring.spec.ts`'s skip honest. Deleting the
file without updating that comment leaves the suite's most carefully argued
skip justified by a file that does not exist. Step 4 fixes it.

🔴 **What could not be planned as the brief asked.** The owner's journey 3 is
"**Adding**/editing award show events and awards". There is **no UI for adding
either**. `components/EventAdmin.tsx` edits an existing show's name,
abbreviation, image URL and the two schedule/live blocks — `actions/admin/update-event.ts`
is an update and nothing else — and there is no control anywhere for creating a
show or for adding a category to one. `docs/PLAN.md` T4's "create and edit a
show and its categories" describes a surface that does not exist. Building it is
a new admin page with its own actions, gates, stories and tests; it is not a
journey task and it is not in this phase's task list. **Journey 3 therefore
seeds the show and its category and walks editing, nominating, crowning and
correcting**, and Step 5 records the gap as an open question for the owner
rather than letting a journey imply a capability the product does not have.

**Runs on CI.** Every film is a local scratch row, so the nomination search
needs no TMDB. The one TMDB-dependent read — the film's own page, keyed by TMDB
id and rendered from TMDB — stays behind the `hasTmdb ? … : null` pattern the
old file used, and the surfaces that do not need it are asserted
unconditionally. So a run with no key proves two of the three services agree and
says so; it never silently drops to proving nothing.

- [ ] **Step 1: Write the journey**

Create `e2e/journeys/03-a-ceremony-night.spec.ts`. Start from
`e2e/awards-lifecycle.spec.ts` verbatim — its `seed()`, its three
`pointsOn…` readers, its cleanup and its comments are all still right — and make
these changes:

1. `const TAG = 'e2e-j3'` and `const YEAR = 2993`, with `SHOW = `${TAG}-show``.
2. Replace `withDb`/`cleanup` with `withDb`, `cleanupShow`, `cleanupLeague`,
   `cleanupUsers` from `./support/scratch`, plus the `available_years` delete.
3. `afterAll` also calls `assertNoResidue(TAG, [YEAR])`.
4. `startJourney(page)` first, and every act wrapped in a `beat`.
5. Insert three new acts, in this order:

```ts
    await beat(page, 'The admin finds the show on the index', async () => {
      await page.goto('/award-shows');
      await page.getByRole('link', { name: new RegExp(`${TAG} Show`) }).first().click();
      await expect(page).toHaveURL(new RegExp(`/award-shows/${SHOW}`));
    });

    await beat(page, 'And edits it — a new name and a ceremony date', async () => {
      // The one editing surface that exists: `components/EventAdmin.tsx`.
      // 🔴 There is NO UI for *adding* a show or a category — see the plan,
      // and the open question in PROGRESS.md. This journey edits what it
      // seeded rather than implying a capability the product lacks.
      await page.goto(`/award-shows/${SHOW}?year=${YEAR}`);
      await page.getByLabel('Name').fill(`${TAG} Show of Shows`);
      await page.getByLabel('Announced').fill('2993-01-14T09:00');
      await page.getByRole('button', { name: 'Save show' }).click();
      await expect(page.getByText('Saved')).toBeVisible();

      await page.reload();
      await expect(
        page.getByRole('heading', { name: `${TAG} Show of Shows` }),
      ).toBeVisible();
    });
```

and, after the winner is crowned and the three surfaces are read:

```ts
    await beat(page, 'The wrong name was read out — the winner is corrected', async () => {
      // 🔴 The ordinary case during a live ceremony (§12): the old winner is
      // replaced, not joined by a second one.
      await page.goto(`/award-shows/${SHOW}?year=${YEAR}`);
      await page
        .getByRole('listitem')
        .filter({ hasText: SECOND_FILM })
        .getByRole('button', { name: 'Mark winner' })
        .click();

      await expect
        .poll(async () => (await winners()).map((row) => row.title))
        .toEqual([SECOND_FILM]);
    });

    await beat(page, 'And the points followed the correction', async () => {
      // The first film is back to a nomination's worth; the second carries the
      // win. Both stated as the relationship, never as 7 and 14.
      expect(await pointsOnLeagueBoard(page, leagueId, FIRST_FILM)).toBe(nominated.board);
      expect(await pointsOnLeagueBoard(page, leagueId, SECOND_FILM)).toBe(
        nominated.board * 2,
      );
    });
```

which requires `seed()` to create **two** films and the nomination act to
nominate both (the old file nominated one; `award-shows.spec.ts` nominates two,
so copy that loop), and `pointsOnLeagueBoard` to take the title as a parameter.

**UNVERIFIED:**
- *That `getByLabel('Name')` resolves.* `EventAdmin`'s fields are
  `<label><span>Name</span><input/></label>` with no `htmlFor`, which Testing
  Library resolves by wrapping but Playwright's `getByLabel` also handles.
  Confirm on the first run; if it does not resolve, use
  `page.getByRole('textbox').first()` scoped to the form and say why in a
  comment.
- *That `datetime-local` accepts `2993-01-14T09:00`.* A year past 9999 would
  not; 2993 is in range. Confirm the `Saved` message rather than assuming.
- *That `EventAdmin` renders at all for this scratch show.* It is rendered from
  `app/(app)/award-shows/[abbr]/page.tsx:149` — check the condition around that
  line (admin-only, almost certainly) before writing the beat.

- [ ] **Step 2: Run it, with and without a key**

```bash
npx playwright test e2e/journeys/03-a-ceremony-night.spec.ts
TMDB_API_KEY= npx playwright test e2e/journeys/03-a-ceremony-night.spec.ts
```

Expected: PASS both times. The second is the CI shape: the film-page assertion
is skipped by the `hasTmdb` branch and the board and leaderboard assertions still
run. If the second fails, the journey is leaning on TMDB somewhere it should not
— find it rather than gating more of the journey.

- [ ] **Step 3: Prove the old file is redundant, then delete it**

```bash
npx playwright test e2e/awards-lifecycle.spec.ts
git rm e2e/awards-lifecycle.spec.ts
npx playwright test e2e/journeys e2e/award-shows.spec.ts e2e/scoring.spec.ts
```

- [ ] **Step 4: Repoint the corpus gate's reasoning**

In `e2e/support/corpus.ts`, the doc comment names `awards-lifecycle.spec.ts` in
two places as the CI-runnable proof of the same arithmetic. Replace both with
`e2e/journeys/03-a-ceremony-night.spec.ts`:

```
 *   - scoring's value is that the numbers on screen are the numbers sixty
 *     people actually played for. A scratch league proves the same arithmetic,
 *     and `journeys/03-a-ceremony-night.spec.ts` already does exactly that on
 *     scratch rows, end to end, and passes on CI. Seeding one here would delete
 *     the only difference between the two files.
```

and further down:

```
 * scratch league to read — see `support/corpus.ts`. The same arithmetic on
 * scratch rows is already proven by `journeys/03-a-ceremony-night.spec.ts`,
 * which does run on CI; what this file adds is the real board, and there is no
 * CI version of that worth having.
```

(the second of those lives in `e2e/scoring.spec.ts`'s header — grep for
`awards-lifecycle` across `e2e/` and fix every hit).

```bash
grep -rn "awards-lifecycle\|league-lifecycle" e2e docs
```

Expected after the edits: no hits in `e2e/`. Hits in `docs/PLAN.md` and
`docs/DECISIONS.md` are history and stay.

- [ ] **Step 5: Record what the product cannot do**

Add to `docs/PROGRESS.md` under Phase 19's notes:

```markdown
- 🔴 **There is no UI for creating an award show, or for adding a category to
  one.** The owner's journey 3 asks for "adding/editing award show events and
  awards" and `docs/PLAN.md` T4 says "create and edit a show and its
  categories". Only *editing* exists: `components/EventAdmin.tsx` over
  `actions/admin/update-event.ts`, which is an update and deliberately a
  whitelist. The twelve real shows and their categories came from the migrated
  data; nothing in the app has ever created one. Journey 3 seeds its show and
  its category and walks editing, nominating, crowning and correcting — it does
  not pretend the creation path exists. Building it is a new admin surface with
  its own actions, gates, stories and tests, and it is a question for the owner
  first: shows are created roughly never, and a SQL insert may genuinely be the
  right answer.
```

- [ ] **Step 6: Commit**

```bash
git add e2e/journeys/03-a-ceremony-night.spec.ts e2e/support/corpus.ts \
        e2e/scoring.spec.ts docs/PROGRESS.md
git rm --cached e2e/awards-lifecycle.spec.ts 2>/dev/null; true
git commit -m "P19.T4: journey 3 — a ceremony night; folds in awards-lifecycle"
```

---

## Task 5: Journey 4 — a reader browses

**Files:**
- Create: `e2e/journeys/04-a-reader-browses.spec.ts`

**Interfaces:**
- Consumes: `beat`, `startJourney`. No database, no session.

**Context an implementer needs.**

**This journey needs TMDB and skips as a whole without it.** `/browse` is
TMDB's discover feed and `/films/{tmdbId}` renders from TMDB, so there is no
version of this journey that runs on CI. The rule the phase adopts — *a journey
either runs or it does not; it never silently skips half itself* — is
implemented here as a single `test.skip(!hasTmdb, …)` at the describe level, the
same visible skip `browse.spec.ts` and `films.spec.ts` already use. The report
then says "journey 4 skipped: TMDB_API_KEY not configured", which is a fact the
owner can act on, rather than a green tick over three beats that ran and five
that did not.

**Read-only, signed out.** The pages are public (D44) and nothing here marks a
film watched, so no `movies` row is ingested (D63: a page render does not write)
and there is nothing to clean up. No `assertNoResidue` — say so in the file, so
the omission reads as a decision.

**What it walks that the slices do not.** `browse.spec.ts` has eleven tests each
proving one property of the shelf; `films.spec.ts` has eight proving one
property of the film page; `nav.spec.ts` proves the search panel opens and
closes. None of them goes *from* the shelf *to* a film *to* the search panel
*to* another film — the trip a reader actually makes, and the one where a
regression in the `href` shape or the panel's `router.push` hides.

- [ ] **Step 1: Write the journey**

Create `e2e/journeys/04-a-reader-browses.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import { beat, startJourney } from './support/pace';

/**
 * 🔴 Journey 4: a reader with no account browses the release calendar, opens a
 * film, and finds another by name.
 *
 * 🔴 **Skipped whole without `TMDB_API_KEY`, never half-run.** `/browse` is
 * TMDB's discover feed and `/films/[tmdbId]` renders from TMDB, so there is no
 * CI version of this journey — and a journey that quietly ran three of its
 * eight beats would be worse than one that did not run, because the report
 * would say it passed. The skip is visible in the report, with its reason,
 * exactly like `browse.spec.ts`'s.
 *
 * Read-only and signed out throughout: these pages are public (D44), nothing
 * here marks a film watched, and a page render does not ingest (D63). So there
 * is deliberately no cleanup and no `assertNoResidue` — this journey writes
 * nothing.
 */
const hasTmdb = Boolean(process.env.TMDB_API_KEY);

test.describe('journey 4 — a reader browses', () => {
  test.skip(!hasTmdb, 'TMDB_API_KEY not configured — this journey is TMDB end to end');
  test.describe.configure({ timeout: 120_000 });

  test('🔴 the calendar, a film, and the search bar', async ({ page }) => {
    await startJourney(page);
    // Desktop: the search panel's trigger is on the strip above `xl`, and this
    // journey is watched on a laptop.
    await page.setViewportSize({ width: 1440, height: 900 });

    await beat(page, 'A reader opens the release calendar', async () => {
      await page.goto('/browse');
      await expect(page.getByRole('link', { name: 'The past' })).toHaveAttribute(
        'aria-current',
        'true',
      );
      await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText(
        /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/,
      );
    });

    await beat(page, 'And looks forward instead — the choice is in the URL', async () => {
      await page.getByRole('link', { name: 'The future' }).click();
      await expect(page).toHaveURL(/when=future/);
      await page.goBack();
      await expect(page.getByRole('link', { name: 'The past' })).toHaveAttribute(
        'aria-current',
        'true',
      );
    });

    await beat(page, 'Scrolling brings the next page in', async () => {
      const films = page.locator('section ul > li');
      const before = await films.count();
      await page.getByTestId('browse-sentinel').scrollIntoViewIfNeeded();
      await expect
        .poll(() => films.count(), { timeout: 15_000 })
        .toBeGreaterThan(before);
      // The cursor followed the reader, so this view can be shared.
      await expect(page).toHaveURL(/[?&]page=2/);
    });

    const title = await beat(page, 'A poster opens the film', async () => {
      await page.locator('a[href^="/films/"]').first().click();
      await page.waitForURL(/\/films\/\d+/);
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
      return (await heading.innerText()).trim();
    });

    await beat(page, `The title is legible over the backdrop — ${title}`, async () => {
      // The bug this inherits from `films.spec.ts`: the title block is pulled
      // over a positioned banner, so it painted *behind* the image and every
      // unit test passed. "Visible" is not enough; this asks what is actually
      // painted at the title's own centre.
      const heading = page.getByRole('heading', { level: 1 });
      const box = await heading.boundingBox();
      expect(box).not.toBeNull();
      const topmost = await page.evaluate(
        ([x, y]) => document.elementFromPoint(x as number, y as number)?.textContent ?? '',
        [(box?.x ?? 0) + 10, (box?.y ?? 0) + (box?.height ?? 0) / 2],
      );
      expect(topmost).toContain(title);
    });

    await beat(page, 'The credits open, and the posters scroll', async () => {
      const summary = page
        .locator('summary')
        .filter({ hasText: /Show \d+ more in/ })
        .first();
      await summary.scrollIntoViewIfNeeded();
      const details = page.locator('details').filter({ has: summary }).first();
      await summary.press('Enter');
      await expect(details).toHaveAttribute('open', '');
    });

    await beat(page, 'The reader searches for a film by name', async () => {
      // The panel's trigger: the strip's above `xl`, the bar's from `sm` up.
      // `.first()` because both are in the DOM at every width and exactly one
      // is clickable — the same reasoning as `nav.spec.ts`'s helper.
      await page.getByRole('button', { name: 'Search' }).first().click();
      const panel = page.getByRole('dialog', { name: 'Search films' });
      await expect(panel).toBeVisible();
      await expect(page.getByRole('searchbox', { name: 'Find a film' })).toBeFocused();

      await page.getByRole('searchbox', { name: 'Find a film' }).fill('La La Land');
      const result = panel.getByRole('button', { name: /La La Land/ }).first();
      await expect(result).toBeVisible();
      await result.click();
    });

    await beat(page, 'And lands on it', async () => {
      await page.waitForURL(/\/films\/313369/);
      await expect(
        page.getByRole('heading', { name: 'La La Land', level: 1 }),
      ).toBeVisible();
      // The panel closed itself on the way — two modals would trap the reader.
      await expect(page.getByRole('dialog', { name: 'Search films' })).toBeHidden();
    });

    await beat(page, 'One Escape puts the panel away again', async () => {
      const trigger = page.getByRole('button', { name: 'Search' }).first();
      await trigger.click();
      await page.getByRole('searchbox', { name: 'Find a film' }).fill('sinners');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Search films' })).toBeHidden();
      await expect(trigger).toBeFocused();
    });
  });
});
```

**UNVERIFIED:**
- *That `La La Land` is returned by the panel's search.* It is one of the 1355
  cached films (`lib/db.test.ts` reads `tmdb_id = '313369'` and asserts the
  title), so the local half of `findFilms` answers it on a restored database.
  On a database without the corpus this journey is already skipped (no TMDB on
  CI), so the case does not arise — but if a developer runs with a key against
  an empty database, TMDB answers instead and the tmdbId is the same. Confirm
  on the first run.
- *That the film opened from the shelf has a credits disclosure.* Not every
  film has more than the shown cast. If the first poster's film has none, the
  beat fails — change it to open La La Land from browse by URL, or make the
  disclosure beat conditional on the summary existing and say so.

- [ ] **Step 2: Run it, both ways, plus the no-key case**

```bash
npx playwright test e2e/journeys/04-a-reader-browses.spec.ts
DEMO_PACE=1 npx playwright test e2e/journeys/04-a-reader-browses.spec.ts
TMDB_API_KEY= npx playwright test e2e/journeys/04-a-reader-browses.spec.ts
```

Expected: pass, pass with video, then **one skipped test with the reason
printed**. The third is the point: confirm the report says why.

- [ ] **Step 3: Commit**

```bash
git add e2e/journeys/04-a-reader-browses.spec.ts docs/PROGRESS.md
git commit -m "P19.T5: journey 4 — browse, a film, and the search bar"
```

---

## Task 6: Journey 5 — the member's own lists

**Files:**
- Create: `e2e/journeys/05-the-members-own-lists.spec.ts`

**Interfaces:**
- Consumes: the T0 harness, `signInAs`.

**Context an implementer needs.**

Neither `/list` nor `/watchlist` has **any** e2e coverage today — grep `e2e/` and
the only hits are `nav.spec.ts` asserting the More sheet's links point at them.
So this journey is not folding anything in; it is the first browser coverage of
two pages.

**It needs no TMDB, and that is worth engineering for.** Both pages are keyed on
local `movies` rows: `getDraftList` and `loadWatchedFilms` read the database, and
the draft list's search is `findFilmsAction` which answers from local rows with
no key (`lib/services/search.ts` absorbs a TMDB failure). The one path that
genuinely needs TMDB — marking a film watched **from `/browse`** — is already
covered by `browse.spec.ts` and by journey 4's territory, so this journey marks
from the watchlist page instead and runs everywhere, CI included.

**Both pages are scoped to `getActiveYear()`** with no `?year=` override
(`app/(app)/list/page.tsx` and `app/(app)/watchlist/page.tsx` both call it and
neither reads a year param), so this journey uses the active season and creates
no `available_years` row.

**Both pages require a session** (`requireUser()`), so `signInAs` first. Rows
land in `lists` and `watchlists` keyed to the throwaway identity, and
`cleanupUsers` removes all three.

- [ ] **Step 1: Write the journey**

Create `e2e/journeys/05-the-members-own-lists.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import { signInAs } from '../support/session';
import { beat, startJourney } from './support/pace';
import { activeYear, assertNoResidue, cleanupUsers, withDb } from './support/scratch';

/**
 * 🔴 Journey 5: the two pages that belong to one member and nobody else — the
 * draft list they prepare before a draft, and the watchlist of what they have
 * actually seen.
 *
 * **First browser coverage of either.** Grep `e2e/`: the only existing mention
 * is `nav.spec.ts` asserting the More sheet links point at `/list` and
 * `/watchlist`. Nothing has ever opened them.
 *
 * 🔴 **No TMDB needed, deliberately.** Both pages read local `movies` rows, and
 * the draft list's typeahead is `findFilmsAction`, which answers from the local
 * table and absorbs a TMDB failure rather than propagating it. The one path
 * that genuinely needs a key — marking a film watched from `/browse` — is
 * `browse.spec.ts`'s and journey 4's; this journey marks from the watchlist
 * itself, and therefore runs on CI like journeys 1, 2 and 3.
 *
 * Both pages are scoped to the **active** season with no `?year=` override, so
 * this journey registers no season of its own.
 */
const TAG = 'e2e-j5';
const MEMBER = `${TAG}-member@example.test`;
const WORDS = ['Zephyrine', 'Quillon', 'Bastable', 'Narrowdale'];
const FILMS = WORDS.map((word) => `${TAG} ${word}`);

async function seedFilms(): Promise<void> {
  await withDb(async (query) => {
    for (const title of FILMS) {
      await query(
        `insert into movies (title, sort_title, created_at, updated_at)
           values ($1, $1, now(), now())`,
        [title],
      );
    }
  });
}

async function cleanup(): Promise<void> {
  await cleanupUsers(TAG);
  await withDb(async (query) => {
    await query('delete from movies where title like $1', [`${TAG}%`]);
  });
}

async function listRows(email: string): Promise<{ title: string; status: string }[]> {
  return withDb(async (query) =>
    query(
      `select m.title, l.status from lists l
         join users u on u.id = l.user_id
         join movies m on m.id = l.movie_id
        where u.email = $1
        order by l."order"`,
      [email],
    ),
  ) as Promise<{ title: string; status: string }[]>;
}

test.describe('journey 5 — the member’s own lists', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    await cleanup();
    await seedFilms();
  });

  test.afterAll(async () => {
    await cleanup();
    await assertNoResidue(TAG);
  });

  test('🔴 a member prepares a draft list and keeps a watchlist', async ({ page }) => {
    await startJourney(page);
    const year = await activeYear();
    const memberId = await signInAs(page, { email: MEMBER, firstName: 'Member' });

    await beat(page, 'The draft list starts empty', async () => {
      await page.goto('/list');
      await expect(page.getByRole('heading', { level: 1, name: 'Draft list' })).toBeVisible();
      await expect(page.getByText('Nothing on your list yet')).toBeVisible();
      // 🔴 Only you ever see this — the eyebrow says so, because a shortlist
      // somebody else can read is not a shortlist.
      await expect(page.getByText(/only you can see this/i)).toBeVisible();
    });

    for (const [index, title] of FILMS.entries()) {
      await beat(page, `${title} goes on the list`, async () => {
        await page.getByRole('searchbox').fill(WORDS[index] as string);
        await page.getByRole('button', { name: new RegExp(title) }).first().click();
        await expect(page.getByText(title, { exact: true })).toBeVisible();
      });
    }

    await beat(page, 'Four films, in the order they were added', async () => {
      expect((await listRows(MEMBER)).map((row) => row.title)).toEqual(FILMS);
    });

    await beat(page, 'One is dragged above another', async () => {
      // A real pointer drag in a real browser — the thing jsdom cannot do:
      // every element box measures zero there and `@hello-pangea/dnd` will not
      // start a drag at all.
      const items = page.getByRole('list').getByRole('listitem');
      const first = items.first();
      const second = items.nth(1);
      const target = await second.boundingBox();
      if (!target) throw new Error('the second entry has no box');
      await first.hover();
      await page.mouse.down();
      await page.mouse.move(target.x + target.width / 2, target.y + target.height, {
        steps: 12,
      });
      await page.mouse.up();

      await expect(items.first()).toContainText(FILMS[1] as string);
    });

    await beat(page, 'And the new order came back from the server', async () => {
      await page.reload();
      expect((await listRows(MEMBER)).map((row) => row.title)[0]).toBe(FILMS[1]);
    });

    await beat(page, 'A film is marked as gone to somebody else', async () => {
      const row = page.getByRole('listitem').filter({ hasText: FILMS[2] as string });
      await row.getByRole('combobox').selectOption('unavailable');
      await expect
        .poll(async () =>
          (await listRows(MEMBER)).find((entry) => entry.title === FILMS[2])?.status,
        )
        .toBe('unavailable');
      // The page now says how much of the list is still live.
      await expect(page.getByText(/still on the board/i)).toBeVisible();
    });

    await beat(page, 'And one is taken off the list entirely', async () => {
      await page
        .getByRole('button', { name: `Remove ${FILMS[3]} from your list` })
        .click();
      await expect.poll(async () => (await listRows(MEMBER)).length).toBe(3);
    });

    await beat(page, 'The watchlist is empty until something is marked', async () => {
      await page.goto('/watchlist');
      await expect(page.getByRole('heading', { level: 1, name: 'Watchlist' })).toBeVisible();
      await expect(page.getByText('You have not marked anything yet')).toBeVisible();
    });

    await beat(page, 'A film is marked watched', async () => {
      await markWatched(memberId, FILMS[0] as string);
      await page.reload();
      await expect(page.getByText(FILMS[0] as string)).toBeVisible();
    });

    await beat(page, 'The badge can be undone, and it sticks', async () => {
      const badge = page.getByRole('button', { name: /Mark as not watched/ }).first();
      await badge.click();
      await expect.poll(() => watchedCount(MEMBER)).toBe(0);
      await page.reload();
      await expect(page.getByText('You have not marked anything yet')).toBeVisible();
    });

    await beat(page, 'And the season can be read three other ways', async () => {
      for (const [view, heading] of [
        ['awards', /By show/],
        ['nominations', /Most nominated/],
        ['drafted', /Drafted/],
      ] as const) {
        await page.goto(`/watchlist?view=${view}`);
        await expect(
          page.getByRole('navigation', { name: 'Watchlist views' }).getByText(heading),
        ).toBeVisible();
      }
    });
  });
});
```

with `markWatched(userId, title)` inserting a `watchlists` row (`movie_id` is
**bigint** — `lib/db.test.ts` records that inconsistency explicitly) and
`watchedCount(email)` copied from `browse.spec.ts`'s `watchlistCountFor`.

**UNVERIFIED — this journey has the most of them, because neither page has ever
been opened in a browser by a test:**
- *That the watchlist renders a film with no poster and no `tmdb_id`.* If the
  row needs a `tmdb_id` to render, seed one that no restored row owns (the
  `awards-lifecycle` pattern: `389` is *12 Angry Men*, never cached) and call
  `forgetFilm` in the cleanup. Settle it with
  `DEMO_PACE=1 npx playwright test e2e/journeys/05 --debug`.
- *That the watched toggle's accessible name on `/watchlist` is
  `Mark as not watched`.* That is the name on `/browse` after a mark; the
  watchlist may word it differently. Read `components/WatchedToggle.tsx` and use
  what it says. **D66 applies:** if a name-based locator is ambiguous, take the
  handle from a `data-testid` and keep the name as the assertion.
- *That the three non-`films` views render for a member with no league.* They
  may render an empty state rather than a heading. Assert the tab is current
  (`aria-current="page"`) rather than a body heading if so.
- *That the draft-list `<select>` takes `'unavailable'` as an option value.*
  `STATUSES` and `STATUS_LABEL` are in `components/DraftListEditor.tsx`; read
  the values rather than guessing the labels.

- [ ] **Step 2: Settle the unverified points in a browser, then run**

```bash
npm run db:up
DEMO_PACE=1 npx playwright test e2e/journeys/05-the-members-own-lists.spec.ts --debug
npx playwright test e2e/journeys/05-the-members-own-lists.spec.ts
TMDB_API_KEY= npx playwright test e2e/journeys/05-the-members-own-lists.spec.ts
```

Expected: the third run passes too — this journey has no TMDB dependency and a
failure there means one crept in.

- [ ] **Step 3: Commit**

```bash
git add e2e/journeys/05-the-members-own-lists.spec.ts docs/PROGRESS.md
git commit -m "P19.T6: journey 5 — the draft list and the watchlist"
```

---

## Task 7: The five run as one film

**Files:**
- Modify: `docs/PROGRESS.md` (the phase's record: the running order, the timings, where the recording lives)
- Modify: `e2e/journeys/support/pace.ts` (only if Step 3 finds the pacing wrong)

**Interfaces:** none. This task adds no code; it proves the phase's gate.

**Context an implementer needs.**

The gate has four clauses and this task checks each one, in order, with a
command whose output is the evidence:

1. all five journeys green against a **restored** database;
2. all five green against a **seeded-empty** one (CI's shape) — journeys 1, 2, 3
   and 5 pass there and journey 4 skips visibly, which is the honest answer for
   a journey that is TMDB end to end;
3. every journey cleans up after itself, **verified by count**;
4. `DEMO_PACE=0` adds no measurable time to CI, and the owner can watch the
   recording end to end.

An empty database can be produced locally without touching the restored one:
`docker-compose.local.yml` is the only Postgres on this machine, so spin a
second container on a second port rather than resetting 5433. Check the compose
file for the service name before writing the command — **UNVERIFIED** whether a
second service already exists for this.

- [ ] **Step 1: The whole suite, against the restored database**

```bash
npm run db:up
npx playwright test 2>&1 | tail -30
```

Expected: everything green, including the five journeys and the slices they no
longer overlap. Two files fewer than before this phase.

- [ ] **Step 2: The journeys, in order, as one film**

```bash
npm run e2e:journeys
```

Expected: five files, one worker, in `01`…`05` order, with a video per journey
under `test-results/`. Watch all five end to end. The questions to answer while
watching, and to answer in `PROGRESS.md` afterwards:
- Can a person who has never read the source tell what is happening, from the
  captions alone?
- Is any beat too fast to follow, or so slow it is tedious?
- Does journey 4 skip, or run? (It runs locally — the key is in `.env.local`.)

If a beat needs different pacing, that is a **caption** problem or a
**beat-boundary** problem, not a reason for a second knob. Split a long beat in
two rather than adding a per-beat multiplier.

- [ ] **Step 3: Measure the cost of the knob being off**

```bash
for run in 1 2; do
  /usr/bin/time -p npx playwright test e2e/journeys 2>&1 | tail -3
done
DEMO_PACE=0 npx playwright test e2e/journeys 2>&1 | tail -3
```

Expected: `DEMO_PACE=0` and unset are indistinguishable — the helper's only
cost when off is one `Math.max` and a branch per beat, and `startJourney`
returns before installing anything. If they differ by more than run-to-run
noise, something in `pace.ts` is running when it should not; find it.

- [ ] **Step 4: Against an empty database**

Start a second Postgres, migrate it, seed the one row, and point the suite at it:

```bash
docker run --rm -d --name cinemadraft-empty -p 5434:5432 \
  -e POSTGRES_USER=cinemadraft -e POSTGRES_PASSWORD=local -e POSTGRES_DB=cinemadraft \
  postgres:17
export DATABASE_URL=postgresql://cinemadraft:local@localhost:5434/cinemadraft
npx prisma migrate deploy
node scripts/seed-e2e.mjs
npx playwright test e2e/journeys 2>&1 | tail -20
docker rm -f cinemadraft-empty
```

**UNVERIFIED:** the Postgres image tag the project uses — read
`docker-compose.local.yml` and match it, because a version mismatch against the
migrations is a confusing failure. Also note `playwright.config.mts`'s
`reuseExistingServer` — kill whatever is on 3000 first, or the run will talk to
a server still pointed at 5433 and the whole exercise proves nothing. That last
point is the one most likely to waste an hour.

Expected: journeys 1, 2, 3 and 5 pass; journey 4 skips with its reason. If a
journey fails here, it is leaning on the restored corpus — find the row it
assumed and seed it, or gate it behind `skipWithoutRestoredCorpus` with the
reason written out the way `e2e/support/corpus.ts` demands.

- [ ] **Step 5: Verify the counts, one more time**

```bash
export DATABASE_URL=postgresql://cinemadraft:local@localhost:5433/cinemadraft
npx playwright test
npx vitest run lib/db.test.ts
```

Expected: `db.test.ts` green immediately after a full browser run — 1355 films,
60 users, 4559 nominations, 10 seasons, 125 feed rows. This is the clause of the
gate that a journey is most likely to have broken, and the one that shows up as
somebody else's red test a week later.

- [ ] **Step 6: Record the phase**

Fill in `docs/PROGRESS.md`'s Phase 19 notes with what the runs actually said —
the wall-clock time of `npx playwright test e2e/journeys` unpaced, the same
paced, where the recordings land, and the answers to Step 2's three questions.
Numbers measured, not estimated; this is the record the owner reads.

- [ ] **Step 7: Full verification and commit**

```bash
npm run verify
npx playwright test
git add docs/PROGRESS.md
git commit -m "P19.T7: the five journeys run as one film"
```

---

## Self-review

**Spec coverage.** `docs/PLAN.md` § Phase 19's eight tasks map one-to-one onto
T0–T7. The gate's four clauses are each a numbered step in T7. The owner's five
journeys map to T2–T6. Phase 3.5's primitives-and-story clause binds exactly one
task, T1, and is discharged by `SeasonSetup.stories.tsx`.

**Two things the brief asked for that this plan does not deliver, both flagged
rather than dropped:**

1. **"Adding award show events and awards"** (journey 3) — no UI exists for
   creating a show or a category, only for editing a show. T4 Step 5 records it
   as an open question; journey 3 seeds and edits. Building the creation surface
   is a new admin page and is not a journey task.
2. **"Scores that moved because of what journey 1 did"** (`PLAN.md` T3) —
   journey 2 does not read journey 1's rows, because `fullyParallel: true`, because
   journey 1 deletes its own rows in `afterAll`, and because a journey that cannot
   be run alone cannot diagnose anything. It seeds the same shape and moves a
   score within itself. Argued in the file's own header, not silently.

**Type consistency.** `beat`, `startJourney`, `DEMO_PACE` from `pace.ts`;
`withDb`, `Query`, `activeYear`, `cleanupLeague`, `cleanupShow`, `cleanupUsers`,
`forgetFilm`, `assertNoResidue` from `scratch.ts` — same names in every task that
uses them. `completeDraft({ leagueId, year })` matches
`actions/leagues/manage-league.ts`'s `Status` schema. `FinishDraftButton`'s
message string `'The draft is finished'` is asserted identically in T1's unit
test and T2's journey.

**Unverified premises are marked, not asserted.** Eleven of them, each with the
command that settles it. Four groups of the 2026-09-12 review's premises turned
out to be dev-server artefacts; the rule here is that a step which has not been
watched in a browser says so.

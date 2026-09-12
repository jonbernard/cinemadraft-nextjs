# Phase 17 — Tranche 4: Type and colour system

Covers **P17.T18 – P17.T25**: body size, poster captions, `beam`, brass,
surface names, the 40px section step, the 4px grid, and radius.

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the product's type, spacing, radius and surface tokens say what
the app actually does, and leave behind a grep or a number that keeps each one
true — so the next drift is a red build rather than an inventory six months
later.

**Architecture:** Six of the eight tasks are repo-wide sweeps and two are
verification-only. Every sweep is landed as *one mechanical change plus one
enforced guard*, because a diff across 58 files will not be read line by line
and a promise to remember is what produced the drift being fixed. Two sweeps
collapse to a single file because Tailwind 4's theme is CSS: the body-size
change (T18) is four custom properties, not 261 class edits. The measurement
harness that proves any of this is itself a deliverable and lands first.

**Tech Stack:** Next 16 App Router, React 19, TypeScript strict, Tailwind 4 +
MUI 9 over CSS cascade layers, Vitest + Testing Library, Playwright, Storybook
10.

**Spec:** `docs/PLAN.md` § Phase 17 → "Type and colour system"; the measured
detail and the 2026-09-12 baseline are in `docs/PROGRESS.md` § Phase 17.
`docs/DECISIONS.md` D69–D84 is the locked ledger three of these tasks amend.

---

## Global Constraints

- **Biome, not ESLint or Prettier.** `npm run lint` covers linting, formatting
  and import order; `npm run typecheck` is separate.
- **MUI for components, Tailwind for custom styling**, coexisting through CSS
  cascade layers ordered `theme, base, mui, components, utilities`. Never
  `!important`.
- **All local databases run in Docker** — `npm run db:up` before anything that
  touches the database. 🔴 **Port 5433 is a restored copy of production.**
  League 1 is sixty real people's history. Everything in this tranche is
  read-only against it; no task here writes a row, and the screenshot harness
  must not either.
- **Never regenerate `package-lock.json` on macOS.** Nothing in this tranche
  adds a dependency; if that changes, `npm install <pkg>` then `npm run lock`.
- **`fixtures/` is generated.** Never hand-edit it.
- **No raw hex outside the token system.** `scripts/layering.sh` greps for it.
  This tranche adds four more checks to that script **and to
  `.github/workflows/ci.yml`** — the workflow owns the canonical copy and the
  script mirrors it (see the header comment in `scripts/layering.sh`). A check
  added to only one of the two is not added.
- 🔴 **macOS bash 3.2 brace expansion.** `scripts/layering.sh` runs `set +B`
  for a reason: a `{3,8}`-style interval inside a quoted command substitution
  passed as a function argument gets brace-expanded into two greps that match
  nothing, and the check silently always passes. **Write new greps without
  `{n,m}` intervals.** Use `+`, `*` and explicit alternation instead.
- **Every new surface is built from the Phase 3.5 primitives** and carries a
  Storybook story. No hairline card border, no all-caps heading outside
  `Eyebrow`, no squared or pill button, no machine-formatted date.
  `LetterboxRule`, `font-display`, the Archivo `wdth` axis no longer exist
  (D69–D78). `/tokens` is the cascade-layer probe only and must not grow.
- **`data-testid` is the only test handle** (D66), stripped from production
  output unless `KEEP_TEST_IDS=1`.
- **One commit per task**, message starting with the task ID (`P17.T22: ...`).
- **`npm run verify` before pushing** — lint, typecheck, layering, both test
  suites, build.
- **Verification widths: 1440 / 1280 / 1024 / 390px, in both schemes.** Every
  task in this tranche states which of its claims are browser-only. jsdom has
  no layout and no paint; a class-name assertion is a real test, a geometry
  assertion in jsdom is not.

---

## What this tranche does not own

Phase 17 is being executed as five tranches that may run at the same time.
This one is the only one whose work crosses every other one's files. Read this
section before opening any file.

**1. The boundary — inverted for you.** You own no *screens*. You own four
values and their guards: the type scale (T18/T19), the surface token names
(T22), the spacing step (T23/T24) and the radius default (T25). In a file
another tranche owns you may change **only** the class name, token name or
numeric value your task names. You may not change structure, markup, props,
copy, behaviour, imports or component boundaries in that file — not even
obviously-correct fixes. Who owns what:

| Tranche | Tasks | Files it owns |
|---|---|---|
| 1 — Product and structure | T0–T7 | `proxy.ts`, `components/SectionHead.tsx`, `components/AppShell.tsx`, `components/SeasonStepper.tsx`, `components/LeaderboardTable.tsx`, `app/(app)/page.tsx`, `app/(app)/browse/page.tsx` + `components/BrowseList.tsx`, `components/DraftConsole.tsx` + the `assign` action |
| 2 — Accessibility and correctness | T8–T10 | `components/AppShell.tsx` (skip link), `components/NavRail.tsx` (focus rings), `components/ThemeToggle.tsx`, `components/BrowseMonth.tsx` (poster links), the Clerk appearance map + `theme/contrast.test.ts`, `app/(app)/films/[tmdbId]/page.tsx` |
| 3 — Visual | T11–T17 | `app/(app)/page.tsx` (roster posters, LCP), `components/ShowLogo.tsx` + `app/(app)/award-shows/*`, `app/(app)/films/[tmdbId]/page.tsx` (lockup), `components/NavRail.tsx`, the winner seal, the new `app/(app)/live/[abbr]/` route (T16a/T16b, now public — D40 amended) |
| 4 — this one | T18–T25 | `app/globals.css`, `theme/tokens.ts`, `theme/tokens.test.ts`, `scripts/layering.sh`, `.github/workflows/ci.yml` (layering job), `components/PosterFrame.tsx` + `components/StatusChip.tsx` + `components/Panel.tsx` (as primitives), and one class-level sweep across everything else |
| 5 — Signed-in surfaces | T26–T36 | `app/not-found.tsx`, `app/(app)/admin/season/page.tsx`, `app/(app)/page.tsx` signed-in, `app/(app)/leagues/**`, `app/(app)/list/page.tsx`, the `text-dim` audit, what brass means, and `docs/DECISIONS.md` D85+ |

**2. The shared files.** The T18 change reaches 75 of 181 `.tsx` files and the
T22 rename edits 58 of them. `app/(app)/page.tsx` is edited by tranches 1
(T1/T4/T5), 3 (T11/T17) and 5 (T29/T31). `components/AppShell.tsx` is edited by
tranches 1 (T2) and 2 (T8). Before sweeping a file:

- `git log --oneline -5 -- <file>` — if the last commit is another tranche's
  task ID and is younger than your branch point, rebase onto it before
  sweeping. A mechanical sed rebases cleanly; a sed that has to be re-derived
  after a structural rewrite does not.
- If another tranche's task for that file is still open, sweep it anyway and
  **say so in the commit body** (`touches AppShell.tsx, T2/T8 open`). The
  guards added by T18/T22/T24/T25 will catch anything that tranche
  re-introduces afterwards — that is what the guards are for. Do not wait.
- Never resolve a conflict by reverting the other tranche's change. Stop and
  report it.

**3. The rule, both directions.** The other four tranches have been told not to
opportunistically fix a stray `text-sm`, surface class, radius or spacing value
they notice, because you will sweep them deliberately and an early partial fix
makes the T22 zero-pixel verification unreadable. **The same rule binds you in
the other direction:** while sweeping, do not fix layout, copy, a11y, an
obvious bug or anything else you notice in a file you do not own. Write it down
in your report to the coordinator and move on.

**4. Ordering.** Tranche 4 runs **by itself, after tranches 1, 2 and 3 have
settled**, and the T20/T21 verification tasks run after tranche 5. Within it:

| Order | Task | Runs alone? |
|---|---|---|
| 1 | T18 — size + the measurement harness | 🔴 Yes |
| 2 | T19 — poster captions serif | Yes (its own serif count) |
| 3 | T24 — the 4px grid guard | May share with T23 |
| 4 | T23 — the 40px section step | May share with T24/T25 |
| 5 | T25 — radius default | May share with T23 |
| 6 | T22 — surface rename | 🔴 Yes. Nothing else in the working tree |
| 7 | T20 — `beam` | Blocked on tranche 1 T3 / tranche 3 T16a |
| 8 | T21 — brass | Blocked on tranche 5 T35, closes in P18.T6 |

Why that order is in the task headers. The short version: T18 first because
every other task's before/after number comes from the harness it builds; T24
before T23 because the grid guard should be live before new spacing is written;
T22 last of the sweeps because its verification is a claim of *pixel identity*
and that claim is only cheap on a tree the tranche has finished moving.

**5. The known entanglements.**

- **T20 (`beam`)** cannot complete in this tranche. Its two consumers are
  tranche 1's `Next · date TBA` chip (T3) and tranche 3's `/live/[abbr]` — and
  T16 has been split into **T16a/T16b** behind a reviewer gate, so T20 closes
  against **T16a**, the half that renders `beam`, not against the whole of T16.
  T20 here ships the *affordance* — a `beam` tone on `StatusChip` — and stays
  open until one of them renders it. Tell tranche 1 and tranche 3 that
  `<StatusChip tone="beam">` exists and is what they should use.
- **T21 (brass)** is blocked by tranche 5's **T35**, which found 320 brass
  instances on the draft board where brass already means "drafted". D69 split
  carmine and brass precisely so one token would not carry two meanings.
  T21 verifies; it does not decide, and it does not implement — P18.T6 does
  that. 🔴 See the note in T21: the 320 figure is not reproducible from source.
- **T33 and T34 (tranche 5) inherit from here, they do not fork a second
  pass.** T33 inherits the 15/13 scale from T18 — signed-in routes get it for
  free the moment `app/globals.css` lands, and the only work T33 has left is
  the `text-[0.65rem]` arbitrary value, which the T18 guard grep will fail the
  build on. T34 inherits the surface names from T22 — `text-dim` on
  `bg-bg-raised` becomes `text-dim` on whatever T22 renames `raised` to, and
  the 4.69:1 measurement in `theme/contrast.test.ts` is unchanged because only
  names move. Both facts are written down in the `@theme` block comment in
  `app/globals.css` and in the docstring at the top of `theme/tokens.ts`, so a
  tranche-5 executor who never reads this file still finds them.

**6. If tranches run concurrently.** Take your own `git worktree` (see
`superpowers:using-git-worktrees`), a distinct port, and never reuse a dev or
Playwright server you did not start — `reuseExistingServer` will hand you
another tranche's build with another tranche's signing secret and every spec
fails as "not signed in". The DB-backed vitest project is **serial by design**:
one Postgres on 5433, and `available_years_one_active` is a global partial
unique index with no per-worker copy. Two suites racing it fail about one run
in three. Coordinate before running `npm run test:ci` or `npm run test:e2e`.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `e2e/inventory.spec.ts` | The measurement harness. Prints the font / gap / radius histograms in the exact shape `PROGRESS.md` records. Opt-in via `INVENTORY=1`; never runs in `npm run verify` or CI |
| `e2e/visual.spec.ts` | The before/after screenshot pair that proves T22 moved no pixels. Opt-in via `VISUAL=1`; baselines land in gitignored `.local/` |

**Modified**

| File | Change |
|---|---|
| `docs/PROGRESS.md` | The re-run T18–T25 measurements, and the D77 amendment awaiting a number (append only; the Phase 17 checklist is indexed centrally) |
| `app/globals.css` | `--text-sm`/`--text-xs` to 15/13px (T18); surface custom properties renamed (T22); `--radius-*` comment (T25) |
| `theme/tokens.ts` | `Palette.bg` keys renamed (T22); the inheritance note T33/T34 read |
| `theme/tokens.test.ts` | Asserts the type scale (T18) and the renamed surface keys (T22) |
| `theme/index.ts` | MUI `background.default`/`paper` follow the rename (T22) |
| `.storybook/TokenTable.tsx` | Renamed surface rows (T22) |
| `scripts/layering.sh` | Four new checks: type scale, 4px grid, retired surface names, radius scale |
| `.github/workflows/ci.yml` | The same four checks, in the `layering` job |
| `components/PosterFrame.tsx` | Caption gets `font-serif` (T19) |
| `components/BrowseMonth.tsx` | Title link gets `font-serif` (T19) |
| `components/StatusChip.tsx` | `beam` tone (T20); grid-legal padding (T24) |
| `components/Panel.tsx` | `rounded-md` → `rounded-sm` (T25) |
| ~11 `.tsx` files | Off-grid fractional spacing utilities (T24) |
| ~22 page files | Section stacks to the 40px step (T23) |
| ~13 `.tsx` files | `rounded-md` → `rounded-sm` (T25) |
| ~58 `.tsx` files | Surface class rename (T22) |

---

## Task 18: Body size — 15px, small 13px, and the harness that proves it

🔴 **Amends D71.** D71 kept Archivo partly for its x-height "at 11–13px, which
is where a league app lives". The *face* reasoning stands and is not being
re-litigated — Archivo stays. What is amended is the density conclusion:
79% of the product's text renders at 14px, which is past what that sentence
intended, and Archivo's x-height carries 15px at almost no width cost. The new
scale also puts real air between body text (15px) and the 11px `Eyebrow`, which
at 14px/11px were three pixels apart. Record this as a D-number via tranche 5's
T26; **do not edit `docs/DECISIONS.md` from here** — that file is being written
centrally.

**Files:**
- Create: `e2e/inventory.spec.ts`
- Create: `e2e/visual.spec.ts`
- Modify: `app/globals.css` (the `@theme` block)
- Modify: `theme/tokens.test.ts`
- Modify: `scripts/layering.sh`
- Modify: `.github/workflows/ci.yml` (the `layering` job)
- Modify: `docs/PROGRESS.md` § "Phase 17 notes" (append only — see step 10)

**Interfaces:**
- Produces: `e2e/inventory.spec.ts` and `e2e/visual.spec.ts`, which T19, T22,
  T23 and T25 all consume. Their run commands are
  `INVENTORY=1 npx playwright test e2e/inventory.spec.ts --reporter=list` and
  `VISUAL=1 npx playwright test e2e/visual.spec.ts`.
- Produces: `text-sm` now means **15px/21px** and `text-xs` means
  **13px/18px**, everywhere, with no class-site edits. Later tasks and later
  tranches write `text-sm` for body and `text-xs` for the small step exactly as
  they do today.
- Consumes: nothing.

**Context an implementer needs.**

🔴 **The mechanism is four custom properties, not a 75-file sweep.** Tailwind 4
reads its type scale from CSS custom properties in `@theme`. Redefining
`--text-sm` and `--text-xs` changes what every existing `text-sm`/`text-xs`
class resolves to, in `app/`, `components/`, `.storybook/` and every story, in
one diff that a reviewer can read in full. The task's instruction — "sweep every
`text-sm` and `text-xs` rather than adding a third size beside them" — is about
*not introducing a third scale step*; this satisfies it exactly and satisfies it
better than 261 hand edits, none of which any test could prove complete. That
last point is D77's own argument, made about these same files.

The cost is that `text-sm` no longer names its value. That is why this task
also lands a guard and a comment: `theme/tokens.test.ts` pins the two values, so
a future reader who assumes 14px gets a red test rather than a surprise, and the
`@theme` block says in prose what the names now mean.

`text-base` (16px) is **not** in scope. It is used for serif *names*
(`app/(app)/award-shows/page.tsx:74`, `:101`,
`app/(app)/watchlist/page.tsx:441`, `components/SeasonStepper.tsx:241`), which
is D70's axis, not the body axis. 15px body against 16px serif names is a one
pixel gap and looks wrong on paper; in practice the faces differ, so it reads
as a face change rather than a size change. Leave it. If it reads badly in the
browser at step 8, report it rather than fixing it here — it is a D70 question.

🔴 **`theme/tokens.test.ts` parses `app/globals.css` with
`/@theme\s*\{([^}]*)\}/`**, which stops at the first `}`. Nothing you add to
`@theme` may contain a `{` — `calc(21 / 15)` is fine, a nested block is not, and
a nested block would silently truncate the block the colour assertions read
rather than failing loudly.

**Why this task runs first.** Every other task in the tranche reports a number
or a screenshot, and both harnesses live here. It also has the largest visual
reach of anything in the tranche, so settling it first means T22's later
pixel-identity claim is made against a tree whose type has stopped moving.

**Browser-only claims.** All of them. Whether 15px reads as air rather than
bloat at 390px, whether any fixed-width component now wraps, and whether the
`Eyebrow`-to-body step reads — none of that can be asserted in jsdom, which has
no layout. The jsdom half of this task is exactly one thing: that the two custom
properties hold the two values.

- [ ] **Step 1: Write the measurement harness**

Create `e2e/inventory.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

/**
 * The Phase 17 type/colour inventory (P17.T18–T25).
 *
 * 🔴 This is a measurement, not an assertion. It is opt-in via `INVENTORY=1`
 * and deliberately absent from `npm run verify` and from CI: it needs the
 * restored database and a TMDB key, it reports numbers rather than passing or
 * failing, and a measurement wired into a gate becomes a number people tune
 * until it is green.
 *
 * 🔴 Read-only. Port 5433 holds a restored copy of production and league 1 is
 * sixty real people's history. Nothing here signs in, posts, or writes.
 *
 * 🔴 The 2026-09-12 baseline in `docs/PROGRESS.md` was measured by hand with an
 * unrecorded method, and its element total (1,272) does not reconcile with its
 * own font histogram (1,312). So the FIRST thing you do with this file is run
 * it on the pre-sweep tree and record *that* as the before-number. The recorded
 * before must come from the same code as the recorded after, or the comparison
 * is an impression wearing a number's clothes.
 */
const ROUTES = ['/', '/browse', '/award-shows', '/films/313369'] as const;
const SCHEMES = ['dark', 'light'] as const;

test.skip(!process.env.INVENTORY, 'set INVENTORY=1 to measure');
test.skip(!process.env.TMDB_API_KEY, 'TMDB_API_KEY not configured');

type Inventory = {
  fonts: Record<string, number>;
  sizes: Record<string, number>;
  gaps: Record<string, number>;
  radii: Record<string, number>;
};

test('inventory', async ({ page }) => {
  const total: Inventory = { fonts: {}, sizes: {}, gaps: {}, radii: {} };

  for (const route of ROUTES) {
    for (const scheme of SCHEMES) {
      await page.setViewportSize({ width: 1440, height: 1200 });
      await page.goto(route);
      // Tailwind's `dark:`/`light:` variants and MUI's palette are both bound
      // to this one attribute (globals.css), so setting it directly is the
      // whole scheme switch — no toggle click, no storage round trip.
      await page.evaluate(
        (value) => document.documentElement.setAttribute('data-mui-color-scheme', value),
        scheme,
      );
      await page.waitForTimeout(250);

      const found: Inventory = await page.evaluate(() => {
        const out = {
          fonts: {} as Record<string, number>,
          sizes: {} as Record<string, number>,
          gaps: {} as Record<string, number>,
          radii: {} as Record<string, number>,
        };
        const bump = (bag: Record<string, number>, key: string) => {
          bag[key] = (bag[key] ?? 0) + 1;
        };

        for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
          const box = el.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) continue;
          const style = getComputedStyle(el);
          if (style.visibility === 'hidden' || style.display === 'none') continue;

          // "Visible text element" = it owns text, rather than inheriting a
          // font from a child's. Counting every element would count every
          // wrapper's inherited family and inflate Archivo enormously.
          const owns = [...el.childNodes].some(
            (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
          );
          if (owns) {
            bump(out.fonts, style.fontFamily.split(',')[0].replace(/["']/g, '').trim());
            bump(out.sizes, style.fontSize);
          }

          for (const gap of [style.rowGap, style.columnGap]) {
            if (gap && gap !== 'normal' && gap !== '0px') bump(out.gaps, gap);
          }

          const radius = style.borderTopLeftRadius;
          if (radius && radius !== '0px') {
            const px = Number.parseFloat(radius);
            // The poster clamp resolves against the element's own box (D73), so
            // it lands on a non-integer between 4 and 12 and must not be
            // bucketed as drift. Identified by class, not by value.
            const clamped =
              el.classList.contains('poster-radius') ||
              (px > 4 && px < 12 && !Number.isInteger(px));
            bump(out.radii, clamped ? 'poster-clamp' : radius);
          }
        }
        return out;
      });

      for (const key of ['fonts', 'sizes', 'gaps', 'radii'] as const) {
        for (const [name, count] of Object.entries(found[key])) {
          total[key][name] = (total[key][name] ?? 0) + count;
        }
      }
    }
  }

  const line = (bag: Record<string, number>) =>
    Object.entries(bag)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `${name} ×${count}`)
      .join(', ');

  // Printed rather than snapshotted: the output is pasted into PROGRESS.md by
  // a human who is comparing it to a previous run.
  console.log(`\n### Inventory — ${ROUTES.join(', ')} @1440, both schemes`);
  console.log(`Fonts:  ${line(total.fonts)}`);
  console.log(`Sizes:  ${line(total.sizes)}`);
  console.log(`Gaps:   ${line(total.gaps)}`);
  console.log(`Radii:  ${line(total.radii)}`);

  // The only assertion: that it measured something. A harness that silently
  // measures an empty page reports "all zero" as if it were progress.
  expect(Object.keys(total.fonts).length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run it on the untouched tree and keep the output**

```bash
npm run db:up
INVENTORY=1 npx playwright test e2e/inventory.spec.ts --reporter=list \
  | tee /tmp/inventory-before.txt
```

Expected: four `Fonts: / Sizes: / Gaps: / Radii:` lines. **Keep this file** —
it is the before-number for T18, T19, T23 and T25, and it is what goes into
`PROGRESS.md`, not the hand-measured 2026-09-12 figures. If your numbers differ
materially from the quoted baseline (Archivo 1088 · Plex Mono 182 · Instrument
Serif 37 · Sora 4 · Newsreader 1), that is expected and fine — report the
discrepancy, record yours, and say which method produced it.

- [ ] **Step 3: Write the screenshot harness (T22 needs it; it lands here)**

Create `e2e/visual.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import { signInAs } from './support/session';

/**
 * The zero-pixel-diff harness for P17.T22.
 *
 * 🔴 Opt-in via `VISUAL=1`, and its baselines are NOT committed. This exists to
 * bracket exactly one commit — the surface rename — by capturing on the commit
 * before it and comparing on the commit after. A committed baseline would turn
 * every deliberate visual change in the phase into a red build, and people
 * would start passing `--update-snapshots` reflexively, which is the same as
 * having no baseline at all.
 *
 * Usage:
 *   # on the commit BEFORE the rename
 *   VISUAL=1 npx playwright test e2e/visual.spec.ts --update-snapshots
 *   # on the commit AFTER
 *   VISUAL=1 npx playwright test e2e/visual.spec.ts
 *
 * 🔴 Read-only against the restored production database. `signInAs` creates one
 * throwaway account and reads league 1; it writes nothing to league 1 itself.
 */
const WIDTHS = [1440, 1280, 1024, 390] as const;
const SCHEMES = ['dark', 'light'] as const;

/** Viewport-only, because `/browse` auto-appends on scroll (D80) and a
 *  full-page height there is not deterministic between runs. */
const SURFACES = [
  { name: 'dashboard', path: '/', full: true, auth: false },
  { name: 'browse', path: '/browse', full: false, auth: false },
  { name: 'award-shows', path: '/award-shows', full: true, auth: false },
  { name: 'film', path: '/films/313369', full: true, auth: false },
  { name: 'league', path: '/leagues/1', full: true, auth: true },
  { name: 'draft-board', path: '/leagues/1/draft', full: true, auth: true },
] as const;

test.skip(!process.env.VISUAL, 'set VISUAL=1 to capture or compare');
test.skip(!process.env.TMDB_API_KEY, 'TMDB_API_KEY not configured');

for (const surface of SURFACES) {
  for (const scheme of SCHEMES) {
    for (const width of WIDTHS) {
      test(`${surface.name} ${scheme} ${width}`, async ({ page }) => {
        if (surface.auth) {
          await signInAs(page, { email: `visual-${Date.now()}@example.test` });
        }
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(surface.path);
        await page.evaluate(
          (v) => document.documentElement.setAttribute('data-mui-color-scheme', v),
          scheme,
        );
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveScreenshot(`${surface.name}-${scheme}-${width}.png`, {
          fullPage: surface.full,
          // Remote TMDB art is the only genuinely non-deterministic pixel on
          // these pages — a different cached crop, a poster that 404s once.
          // Masking it is what makes a zero-diff claim about *our* CSS.
          mask: [page.locator('img')],
          maxDiffPixels: 0,
          animations: 'disabled',
        });
      });
    }
  }
}
```

Add the snapshot directory to `.gitignore`:

```
/e2e/visual.spec.ts-snapshots
```

- [ ] **Step 4: Write the failing test for the type scale**

Add to `theme/tokens.test.ts`, after the radius block:

```ts
describe('the type scale is the one D71 was amended to (P17.T18)', () => {
  /**
   * 🔴 `text-sm` is 15px and `text-xs` is 13px. The names are Tailwind's and
   * no longer describe their values, which is the price of changing the scale
   * in one place instead of in 261 class sites across 75 files — see the
   * comment in globals.css. This test is what stops the names being believed.
   */
  it.each([
    ['sm', '15px', 'calc(21 / 15)'],
    ['xs', '13px', 'calc(18 / 13)'],
  ])('--text-%s', (step, size, lineHeight) => {
    const block = css.match(/@theme\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(block).toContain(`--text-${step}: ${size};`);
    expect(block).toContain(`--text-${step}--line-height: ${lineHeight};`);
  });
});
```

- [ ] **Step 5: Run it and watch it fail**

Run: `npx vitest run theme/tokens.test.ts`
Expected: FAIL — two cases, `expected '…' to contain '--text-sm: 15px;'`.

- [ ] **Step 6: Make the change**

In `app/globals.css`, inside `@theme`, immediately after the radius block:

```css
  /* The type scale (P17.T18, amending D71).
   *
   * 🔴 `text-sm` is the BODY size and `text-xs` is the small step. The names
   * are Tailwind's own and they no longer describe their values — that is
   * deliberate. Redefining two custom properties moves every `text-sm` and
   * `text-xs` in app/, components/ and .storybook/ at once; renaming the
   * classes would have been 261 edits across 75 files with no test able to
   * prove the sweep complete, which is the exact objection D77 raised about
   * renaming tokens and is still correct.
   *
   * D71 kept Archivo for its x-height "at 11-13px, which is where a league app
   * lives". The face reasoning stands — Archivo stays. The density does not:
   * 79% of the product's text rendered at 14px, and at 14px body against an
   * 11px Eyebrow there is no step at all. Archivo carries 15px at almost no
   * width cost, and 13px keeps a real gap above the eyebrow floor.
   *
   * `text-base` (16px) is untouched and is NOT the body size: it renders serif
   * proper nouns (D70), which is a different axis.
   *
   * 🔴 Signed-in routes inherit this for free (P17.T33) — there is no second
   * pass and there must not be one. The one thing T33 still owns is the
   * `text-[0.65rem]` arbitrary value, which scripts/layering.sh now rejects.
   *
   * Line heights are ratios rather than lengths so the pairing survives if a
   * size is ever nudged again. theme/tokens.test.ts pins all four values.
   */
  --text-sm: 15px;
  --text-sm--line-height: calc(21 / 15);
  --text-xs: 13px;
  --text-xs--line-height: calc(18 / 13);
```

- [ ] **Step 7: Run the test and the full unit suite**

Run: `npx vitest run theme/ components/`
Expected: PASS. If a component test asserts a pixel font size it will fail —
fix the assertion to the new value, do not revert the token.

- [ ] **Step 8: Add the guard — no arbitrary text sizes**

This is the enforcement that makes the sweep checkable and closes the
`text-[0.65rem]` hole T33 found. Append to `scripts/layering.sh`, before
`exit $fail`:

```bash
# P17.T18. The type scale lives in globals.css and nowhere else.
#
# An arbitrary `text-[13px]` compiles, looks fine, and quietly forks the scale
# — which is how 117 elements came to render at 10.4px from a single
# `text-[0.65rem]`, below the 11px Eyebrow floor and outside the scale
# entirely. Two exceptions are real and are named here rather than tolerated
# silently: Eyebrow owns 11px (D74) and SectionHead owns the 28/20/17 heading
# ramp (P17.T1).
#
# No {n,m} interval: see the `set +B` note at the top of this file.
check "text sizes come from the scale" \
  "$(grep -rnE "text-\[[0-9.]+(px|rem|em)\]" components app .storybook \
     --include='*.tsx' --include='*.ts' --include='*.mdx' 2>/dev/null \
     | grep -v -e '^components/Eyebrow\.tsx:' -e '^components/SectionHead\.tsx:' \
     || true)"
```

Mirror it as a step in the `layering` job of `.github/workflows/ci.yml`,
following the shape of the existing "no raw hex outside the token system" step
(assign the grep to a plain `offenders=` variable, exactly as the neighbouring
steps do — that assignment form is why CI was never exposed to the bash 3.2
brace bug).

- [ ] **Step 9: Run the guard and fix what it finds**

Run: `npm run layering`
Expected: initially FAIL, listing `text-[10px]`, `text-[11px]`,
`text-[17px]`, `text-[20px]`, `text-[27px]` and `text-[0.65rem]` sites outside
the two exempt files. For each:
- `components/NotificationBell.tsx:131` `text-[10px]` → `text-xs`.
- the `text-[0.65rem]` poster round badge → `text-xs`. 🔴 This is tranche 5's
  T33 finding; fixing it here is in scope because the guard cannot land with a
  known offender, and it is a one-class change, not a redesign. Say so in the
  commit body and tell the coordinator T33 is now partly closed.
- anything in a file another tranche owns: change the class only.
Re-run until green.

- [ ] **Step 10: Measure, verify in a browser, and record**

```bash
INVENTORY=1 npx playwright test e2e/inventory.spec.ts --reporter=list \
  | tee /tmp/inventory-after-t18.txt
diff /tmp/inventory-before.txt /tmp/inventory-after-t18.txt
```

Expected: the `Sizes:` line moves from 14px/12px dominance to 15px/13px; the
`Fonts:` line is unchanged (this task changes no face).

Then, by hand in a browser at **1440 / 1280 / 1024 / 390px, in both schemes**,
on `/`, `/browse`, `/award-shows` and `/films/313369`: nothing wraps that did
not wrap before, the nav rail's labels still fit its 208px (D67), the
leaderboard's columns still fit at `lg`, and the tab bar's five destinations
still meet 44px. These are the browser-only claims; none of them can be made in
jsdom.

Append the before/after block to `docs/PROGRESS.md` under
`### Phase 17 notes`. 🔴 **Append only** — do not re-order or re-index the
Phase 17 checklist, which is being maintained centrally.

- [ ] **Step 11: Commit**

```bash
git add app/globals.css theme/tokens.test.ts scripts/layering.sh \
  .github/workflows/ci.yml .gitignore e2e/inventory.spec.ts e2e/visual.spec.ts \
  docs/PROGRESS.md
git add -A components app
git commit -m "P17.T18: body 15px, small 13px, and the inventory harness"
```

---

## Task 19: Poster captions get the serif at 15px

🔴 **A D70 violation, fixed as D70 intended.** D70 renders proper nouns — films,
members, leagues — in Instrument Serif, with one explicit escape: a name that
must render below 15px falls back to Archivo. `components/PosterFrame.tsx:120`
and `components/BrowseMonth.tsx:89` set film titles in `text-sm` Archivo, and at
14px that escape technically covered them. **That is exactly why the fix is 15px
serif and not a face swap at the old size** — it lifts the captions over the
floor so the rule is true rather than narrowly escaped.

After T18, `text-sm` *is* 15px. So this task is two `font-serif` classes.

🔴 **Newsreader is deferred, not decided.** It renders once on a public page
today and Phase 18 is a prose page that will change the arithmetic. Do not
remove `--font-prose`, do not remove it from `theme/fonts.ts`, and do not
mention dropping it in the commit. Re-judge the payload after Phase 18 ships.

**Files:**
- Modify: `components/PosterFrame.tsx:120`
- Modify: `components/BrowseMonth.tsx:89`
- Test: `components/PosterFrame.test.tsx`, `components/BrowseMonth.test.tsx`

**Interfaces:**
- Consumes: T18's `text-sm` = 15px. This task is wrong if run before T18.
- Produces: nothing other tasks read.

**Context an implementer needs.** `PosterFrame` is the poster primitive: its
`<figcaption>` title span at line 120 is what every poster grid in the app
renders, which is why one class here is most of the serif figure moving from
2.9%. `BrowseMonth` does not use `PosterFrame` for its caption — it renders its
own `<Link>` at line 89 — so both sites are needed and fixing one leaves the
release calendar in Archivo.

🔴 `components/BrowseMonth.tsx` is a **tranche 2** file (T8 takes the 17 unnamed
poster links out of the tab order). You are changing one class on line 89 and
nothing else; if T8 has already landed, rebase and re-locate the link.

**Browser-only claims.** Whether 15px Instrument Serif at two lines
(`line-clamp-2`) still clamps where it did, and whether the serif's shorter
x-height reads at 390px in a three-across grid. The class assertions below are
real jsdom tests; the legibility judgement is not, and is made at step 6.

- [ ] **Step 1: Write the failing tests**

Add to `components/PosterFrame.test.tsx`:

```tsx
  it('sets the film title in the serif — it is a name (D70, P17.T19)', () => {
    render(<PosterFrame title="La La Land" posterUrl={null} />);

    const caption = screen.getByText('La La Land');
    // 🔴 D70's sub-15px escape no longer applies: `text-sm` is 15px (P17.T18),
    // so a poster caption is above the floor and the rule is unconditional.
    expect(caption.className).toContain('font-serif');
    expect(caption.className).toContain('text-sm');
  });
```

Add to `components/BrowseMonth.test.tsx`:

```tsx
  it('sets the film title in the serif — it is a name (D70, P17.T19)', () => {
    render(
      <BrowseMonth
        month="January 2026"
        films={[{ tmdbId: 1, title: 'La La Land', posterUrl: null, watched: false }]}
      />,
    );

    const link = screen.getByRole('link', { name: 'La La Land' });
    expect(link.className).toContain('font-serif');
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run components/PosterFrame.test.tsx components/BrowseMonth.test.tsx`
Expected: FAIL — `expected '…text-sm leading-tight' to contain 'font-serif'`.
If `BrowseMonth`'s props differ from the shape above, match the file; the
assertion is the point, not the fixture.

- [ ] **Step 3: Add the face in `PosterFrame`**

`components/PosterFrame.tsx:120` — add `font-serif` to the caption span and
nothing else:

```tsx
        <span className="text-text-primary line-clamp-2 font-serif text-sm leading-tight">
```

- [ ] **Step 4: Add the face in `BrowseMonth`**

`components/BrowseMonth.tsx:89` — add `font-serif`, leaving every other class,
the href and the focus treatment alone:

```tsx
              className="text-text-secondary hover:text-text-primary focus-visible:outline-accent-fill font-serif text-sm leading-tight focus-visible:outline-2"
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run components/`
Expected: PASS.

- [ ] **Step 6: Measure and look at it**

```bash
INVENTORY=1 npx playwright test e2e/inventory.spec.ts --reporter=list \
  | tee /tmp/inventory-after-t19.txt
```

Expected: `Instrument Serif` rises sharply (the baseline's 37 is pre-sweep;
every poster caption on `/browse` and `/` joins it) and `Archivo` falls by the
same amount. Record the delta.

In a browser at 1440 / 1280 / 1024 / 390px, both schemes, on `/` and `/browse`:
two-line titles still clamp at two lines, the grid's row heights are unchanged,
and the serif is legible at the smallest poster in the shelf. **This is the
browser-only half and it is the half that can go wrong** — Instrument Serif is a
single weight with a shorter x-height than Archivo, so a caption that was
comfortable at 15px Archivo is the thing to look at first.

- [ ] **Step 7: Commit**

```bash
git add components/PosterFrame.tsx components/BrowseMonth.tsx \
  components/PosterFrame.test.tsx components/BrowseMonth.test.tsx
git commit -m "P17.T19: poster captions are names, so they are set in the serif"
```

---

## Task 24: The 4px grid, enforced

🔴 **Enforced in `scripts/layering.sh`, the same mechanism as the raw-hex and
layering greps** (decided 2026-09-12). The precedent for enforcing rather than
remembering is in this repo: two files carrying the retired `uppercase`
treatment shipped with every gate green until an inventory found them.

**This runs before T23** so the grid check is live while T23 is writing new
spacing, rather than being applied to it afterwards.

**Files:**
- Modify: `scripts/layering.sh`
- Modify: `.github/workflows/ci.yml` (the `layering` job)
- Modify: the ~11 `.tsx` files carrying fractional spacing utilities

**Interfaces:**
- Produces: a `check "spacing sits on the 4px grid"` that T23 and every later
  tranche must satisfy.
- Consumes: nothing.

**Context an implementer needs.** Tailwind's spacing scale is
`0.25rem × n`, so every integer step is already on the 4px grid. **Every
off-grid value in this codebase comes from a `.5` step** — `gap-1.5` is 6px,
`px-2.5` is 10px, `gap-0.5` is 2px — or from an arbitrary `[13px]` value. So the
grep is for `.5` steps and arbitrary spacing values, and nothing else. Measured
now: 24 occurrences across 11 files.

| Utility | Count | Value |
|---|---|---|
| `gap-0.5` | 7 | 2px |
| `h-1.5`, `w-1.5`, `mt-1.5` | 4 | 6px |
| `h-0.5`, `py-0.5`, `mt-0.5` | 4 | 2px |
| `gap-2.5`, `px-2.5`, `py-2.5`, `p-2.5` | 5 | 10px |
| `gap-1.5` | 2 | 6px |
| `w-3.5`, `h-3.5` | 2 | 14px |

🔴 **Two of these are not spacing and must not be swept.**
`components/PosterFrame.tsx`'s `h-0.5` score bar and
`components/SeenMeter.tsx`'s `h-1.5` progress track are **hairlines** — a 2px
rule and a 6px meter — where the number is the drawn object, not the space
around it. Rounding a 2px hairline to 4px doubles it. Restrict the grep to the
utilities that actually carry space — gap, padding, margin — and leave `w-*`
and `h-*` out of it entirely. A guard that forces a wrong edit is a guard people
delete.

**Browser-only claims.** None. This is a grep and a set of class substitutions;
the visual consequence is checked once at step 6 alongside T23's.

- [ ] **Step 1: Write the guard first, and let it fail**

Append to `scripts/layering.sh`, before `exit $fail`:

```bash
# P17.T24. Space sits on the 4px grid.
#
# Tailwind's integer steps are 0.25rem apart, so every integer is already on
# the grid — the only ways off it are a `.5` step (gap-1.5 = 6px, px-2.5 = 10px,
# gap-0.5 = 2px) and an arbitrary value. Both are grepped here.
#
# 🔴 Deliberately scoped to gap/padding/margin. `w-*` and `h-*` are excluded
# because a 2px score bar and a 6px meter track are drawn objects whose size IS
# the design (PosterFrame, SeenMeter); rounding a hairline to the grid doubles
# it. A check that demands a wrong edit gets deleted, so it does not ask.
#
# No {n,m} interval: see the `set +B` note at the top of this file.
check "spacing sits on the 4px grid" \
  "$(grep -rnE "(^|[\"' ])-?(gap|gap-x|gap-y|space-x|space-y|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml)-([0-9]+\.5|\[[0-9.]+(px|rem|em)\])" \
     components app .storybook --include='*.tsx' --include='*.mdx' 2>/dev/null \
     || true)"
```

Mirror it as a step in the `layering` job of `.github/workflows/ci.yml`, using
the `offenders=` assignment form the neighbouring steps use.

- [ ] **Step 2: Run it and read the list**

Run: `npm run layering`
Expected: FAIL — `✗ spacing sits on the 4px grid`, listing ~20 lines across
~11 files. Copy the list; it is your worklist.

- [ ] **Step 3: Sweep the offenders**

For each line, substitute the nearest grid step **downward for gaps inside a
group and upward for padding**, because shrinking a gap tightens a group (which
is the direction T23 wants) while shrinking padding clips content:

| From | To | Why |
|---|---|---|
| `gap-0.5` (2px) | `gap-1` (4px) | 2px is not a gap, it is a rendering accident |
| `gap-1.5` (6px) | `gap-2` (8px) | 8px is the within-a-group step (T23) |
| `gap-2.5` (10px) | `gap-2` (8px) | ditto — 10px is 12px pretending |
| `px-2.5`, `py-2.5`, `p-2.5` (10px) | `px-3`, `py-3`, `p-3` (12px) | padding rounds up |
| `py-0.5` (2px) | `py-1` (4px) | |
| `mt-0.5`, `mt-1.5` | `mt-1`, `mt-2` | |

🔴 `components/StatusChip.tsx:27` carries three of these (`gap-1.5`, `px-2.5`,
`py-1`). It is a primitive rendered several hundred times; check it in the
browser at step 6 before believing the chip still looks like a chip.

Leave `w-3.5`/`h-3.5`, `h-0.5` and `h-1.5` alone — the grep does not flag them
and they are drawn objects, not space.

- [ ] **Step 4: Run the guard again**

Run: `npm run layering`
Expected: PASS — `✓ spacing sits on the 4px grid`.

- [ ] **Step 5: Run the unit suite**

Run: `npx vitest run components/`
Expected: PASS. A test asserting `gap-1.5` on `StatusChip` fails here — update
the assertion to the new class; the class is the change.

- [ ] **Step 6: Look at the chips**

In a browser at 1440 / 1280 / 1024 / 390px, both schemes: `StatusChip` on
`/award-shows/[abbr]` and on the draft board still reads as a chip and still
clears 44px where it is interactive. This is browser-only — jsdom cannot tell
you a chip got fat.

- [ ] **Step 7: Commit**

```bash
git add scripts/layering.sh .github/workflows/ci.yml
git add -A components app
git commit -m "P17.T24: enforce the 4px grid, and fix the 24 values off it"
```

---

## Task 23: A large end — 40px between sections

🔴 **Decided 2026-09-12: 40px between sections, 16px inside a section, 8px
inside a group.** 12px is more than half of every gap in the product (250 of
483 measured) and 24px-or-more appears eleven times across four pages. That is
the mechanical reason D74's "space instead of rules" never read as a section
boundary — `LetterboxRule` was removed and the space that inherited its job was
never sized for it.

**Files:**
- Modify: the page-root section stacks (~22 files under `app/(app)/`)
- Modify: the section-level stacks inside them
- Test: no new unit test — see below

**Interfaces:**
- Consumes: T24's grid check, which is live and will reject any `.5` step you
  reach for.
- Produces: nothing other tasks read.

**Context an implementer needs.** The three steps map cleanly onto Tailwind:
**`gap-10` = 40px** (between sections), **`gap-4` = 16px** (inside a section),
**`gap-2` = 8px** (inside a group). Today the page-root stacks are:

- `gap-10` (40px, already right): `app/(app)/page.tsx:68`,
  `app/(app)/browse/page.tsx:86`
- `gap-8` (32px): `award-shows/page.tsx:59`, `award-shows/[abbr]/page.tsx:104`,
  `rules-and-scoring/page.tsx:25`, `films/[tmdbId]/page.tsx:131,132,179`,
  `leagues/[id]/page.tsx:134`, `leagues/[id]/draft/page.tsx:64`,
  `leagues/[id]/setup/page.tsx:48`, `admin/relink/page.tsx:19`,
  `admin/season/page.tsx:22`, `admin/broadcast/page.tsx:23`,
  `members/[uuid]/page.tsx:58`, `watchlist/page.tsx:116`,
  `auth/layout.tsx:17`
- `gap-6` (24px): `join/[uuid]/page.tsx:111`, `leagues/page.tsx:27`,
  `leagues/new/page.tsx:16`, `admin/page.tsx:28`, `list/page.tsx:37`,
  `app/(app)/page.tsx:139,157`, `watchlist/page.tsx:205,414`,
  `auth/register/.../page.tsx:32`, `auth/login/.../page.tsx:31`

🔴 **Scope this deliberately, and do not blanket-convert `gap-3`.** There are 73
`gap-3` sites across 39 files and they are not all the same thing: some are
within-a-section stacks that should become `gap-4`, and some are within-a-group
stacks that should become `gap-2`. Converting them all one way is how a
"spacing fix" turns into a redesign of screens this phase is forbidden to touch.
The sweep is therefore:

1. **Every page-root stack** (the `mx-auto flex max-w-* flex-col gap-*` div that
   is the direct child of the page's outer element) → `gap-10`. That is the
   section step and it is what the decision buys.
2. **Every `<section>`'s own stack** → `gap-4`.
3. `gap-3` and `gap-2` inside a `Panel` or a `<ul>` → leave them, unless the
   element is a `<section>` (rule 2). These are groups; 12px inside a group is
   a separate argument this task does not make.

🔴 **Two screens are out of bounds** (PLAN, Phase 17): the draft console
(`app/(app)/leagues/[id]/draft/page.tsx`, `components/DraftConsole.tsx`,
`components/DraftBoard.tsx`) and the watchlist (`app/(app)/watchlist/page.tsx`)
are the best-designed screens in the product and must **inherit tokens only**.
Apply rule 1 to their page-root stack — that is a token-level inheritance — and
apply nothing else. Leave `watchlist/page.tsx:205` and `:414` alone.

**The guard, honestly.** 🔴 **T23 has no grep guard, and one should not be
invented.** "This `gap-6` is a section boundary and that one is a group" is a
judgement about the DOM's meaning, and a grep that tried to encode it would
either flag every `gap-6` in the product or nothing. What T23 has instead is a
**number**: the inventory harness's `Gaps:` histogram, where 12px must fall and
40px must appear, and T24's grid check, which is live and constrains what values
can be written at all. Record the histogram; do not pretend there is a grep.

**Browser-only claims.** All of the interesting ones. Whether 40px reads as a
section boundary rather than as a gap, and whether the phone layout has become a
scroll of white space, cannot be asserted anywhere but a browser at 390px.

- [ ] **Step 1: List the page-root stacks**

```bash
grep -rnE "mx-auto flex (w-full )?max-w-[a-z0-9]+ flex-col gap-[0-9]+" app --include='*.tsx'
```

Expected: ~22 lines. This is the rule-1 worklist.

- [ ] **Step 2: Set every page-root stack to `gap-10`**

Each of those lines: `gap-6` or `gap-8` → `gap-10`. Nothing else on the line
changes — not `max-w-*`, not `mx-auto`, not the surrounding markup.

```tsx
// app/(app)/leagues/page.tsx:27 — before
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
// after
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
```

- [ ] **Step 3: Set every `<section>`'s own stack to `gap-4`**

```bash
grep -rnE "<section[^>]*flex flex-col gap-[0-9]+" app components --include='*.tsx'
```

For each hit that is not on the draft or watchlist screens, set `gap-4`. Note
that `app/(app)/page.tsx:69` and `:88` are already `gap-4` and need no change,
and `app/(app)/page.tsx:139` (`<section key={league.id}>`) moves `gap-6` →
`gap-4`.

🔴 `app/(app)/page.tsx` is owned by tranches 1, 3 and 5. You are changing
`gap-*` on three lines and nothing else. Rebase first; say so in the commit.

- [ ] **Step 4: Run the guards and the unit suite**

Run: `npm run layering && npx vitest run components/`
Expected: PASS both. The grid check from T24 stays green because `gap-10`,
`gap-4` and `gap-2` are all integer steps.

- [ ] **Step 5: Measure**

```bash
INVENTORY=1 npx playwright test e2e/inventory.spec.ts --reporter=list \
  | tee /tmp/inventory-after-t23.txt
```

Expected, against the baseline (12px ×250, 8px ×103, 4px ×57, 16px ×36,
6px ×26, 24px+ ×11): a **40px** bucket appears with a count in the tens, 6px
goes to zero (T24 removed it), and 24px/32px collapse into 40px. 12px falls but
does **not** go to zero and is not supposed to — it is the within-a-group value
this task deliberately did not re-litigate. Record the whole histogram.

- [ ] **Step 6: Look at it**

Browser, 1440 / 1280 / 1024 / 390px, both schemes, on `/`, `/browse`,
`/award-shows`, `/films/313369`, `/leagues`, `/list`: sections read as separate
without a rule between them (D74's claim, finally funded), and 390px has not
become a column of air. **Check the draft board and the watchlist specifically
to confirm they look exactly as they did except for their outermost gap.**

- [ ] **Step 7: Commit**

```bash
git add -A app components
git commit -m "P17.T23: 40px between sections, 16px inside one"
```

---

## Task 25: Radius — 6px is the default, and the drift gets fixed

🔴 **Upholds D73 rather than amending it.** D73 chose 6px deliberately: soft
enough not to read as a developer tool, hard enough to stay a projection room.
The argument still holds; the components drifted. `md` (10px) outnumbers `sm`
(6px) 58 to 36 in the browser, which means the documented anchor is not the real
one.

**Files:**
- Modify: `components/Panel.tsx:33`
- Modify: the ~13 other `rounded-md` sites
- Modify: `app/globals.css` (the `--radius-*` comment)
- Modify: `scripts/layering.sh`, `.github/workflows/ci.yml`
- Test: `components/Panel.test.tsx`

**Interfaces:**
- Produces: a `check "radius comes from the scale"` guard.
- Consumes: nothing.

**Context an implementer needs.**

🔴 **`Panel.tsx:33` is the whole drift.** `Panel` hardcodes `rounded-md` and is
the floating-surface primitive every page composes from — that one line is most
of the 58. Changing it to `rounded-sm` fixes the majority in one character.

🔴 **The premise about `lg` needs correcting before you act on it.** The PLAN
says `--radius-lg` "has no consumers" and the baseline records `16px ×0`. That
is a *rendered* measurement across four routes. In source there is exactly one
consumer: `components/SearchOverlay.tsx:130`, a full-width modal dialog, which
renders zero times on those routes because it is closed. So `lg` is unused on
the pages measured and used where it belongs.

**The call — flagged, not silently resolved.** Keep `lg` in the scale and keep
SearchOverlay as its documented sole consumer. The alternatives were to drop
`lg` (which forces SearchOverlay to 10px or 6px, and a 768px modal at 6px reads
as an un-styled box) or to leave it undocumented, which the task forbids. This
is the smallest change and it does not amend D73, whose scale stays 3/6/10/16/
pill exactly as locked. **If the coordinator prefers `lg` dropped, that is a
D73 amendment and needs a D-number; say so rather than doing it here.**

`rounded-full` is **not** radius drift and is not in scope: it makes circles —
avatars (`members/[uuid]/page.tsx:111,119`), the notification dot
(`NotificationBell.tsx:131,248`), the watched toggle
(`WatchedToggle.tsx:110`). `rounded-pill` is status and filter chips, per D73.
`poster-radius` is the proportional clamp and is untouched.

The 13 `rounded-md` sites are all cards or panels: `award-shows/page.tsx:97`,
`leagues/page.tsx:56`, `CreateLeagueForm.tsx:88`, `NotificationBell.tsx:145`,
`RelinkPanel.tsx:133`, `SeasonStepper.tsx:227`, `Panel.tsx:33`, `NavRail.tsx:51`,
`ShowLogo.tsx:35`, `GroupCeremony.tsx:218`, `EmptyState.tsx:38`,
`YourReview.tsx:40`, `Wordmark.stories.tsx:31`. All become `rounded-sm`.

🔴 `components/SeasonStepper.tsx` (tranche 1, T3), `components/NavRail.tsx`
(tranches 2 and 3) and `components/ShowLogo.tsx` (tranche 3, T12) are other
people's files. One class each.

**Browser-only claims.** Whether 6px on a full-width `Panel` still reads as a
floating surface rather than a rectangle is a judgement made at step 6. The
class assertion on `Panel` is a real jsdom test.

- [ ] **Step 1: Write the failing test**

Add to `components/Panel.test.tsx`:

```tsx
  it('uses the 6px default radius, not the 10px step (D73, P17.T25)', () => {
    const { container } = render(<Panel>content</Panel>);

    // 🔴 D73 anchors the scale at 6px and Panel is the primitive every page
    // composes from — this one class was 58 of the product's rendered radii.
    expect(container.firstElementChild?.className).toContain('rounded-sm');
    expect(container.firstElementChild?.className).not.toContain('rounded-md');
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run components/Panel.test.tsx`
Expected: FAIL — `expected 'rounded-md bg-bg-surface' to contain 'rounded-sm'`.

- [ ] **Step 3: Fix the primitive**

`components/Panel.tsx:33` — `'rounded-md'` → `'rounded-sm'`.

- [ ] **Step 4: Add the guard**

Append to `scripts/layering.sh`, before `exit $fail`:

```bash
# P17.T25. Radius comes from D73's scale, anchored at 6px.
#
# `md` (10px) outnumbered `sm` (6px) 58 to 36 in the browser, because Panel —
# the primitive every page composes from — hardcoded it. `lg` (16px) has
# exactly one legitimate consumer, the full-width search overlay, and is named
# here rather than left as an undiscussed dead token.
#
# `rounded-full` and `rounded-pill` are not radius: the first makes circles
# (avatars, dots, toggles), the second is D73's chip treatment. Neither is
# grepped. Neither is `poster-radius`, the proportional clamp.
#
# No {n,m} interval: see the `set +B` note at the top of this file.
check "radius comes from the scale" \
  "$(grep -rnE "rounded-(md|lg)\b|rounded-\[[0-9.]+(px|rem|%)\]" \
     components app .storybook --include='*.tsx' --include='*.mdx' 2>/dev/null \
     | grep -v '^components/SearchOverlay\.tsx:' || true)"
```

Mirror it into the `layering` job of `.github/workflows/ci.yml`.

- [ ] **Step 5: Run the guard and sweep what it finds**

Run: `npm run layering`
Expected: FAIL, listing the twelve remaining `rounded-md` sites. Change each to
`rounded-sm` — the class only, nothing else on the line. Re-run until
`✓ radius comes from the scale`.

Then document `lg` in `app/globals.css`, replacing the existing D73 comment
above the radius block:

```css
  /* D73, upheld by P17.T25. Tailwind's `--radius-*` namespace, so these are
   * `rounded-xs` … `rounded-pill` with no plugin. MUI's own default is 6px in
   * theme/index.ts; the two are set from the same numbers by hand because MUI
   * reads JS and Tailwind reads CSS, exactly as the colours do.
   *
   * 🔴 `sm` (6px) is THE default — buttons, panels, cards, plates. `md` (10px)
   * had drifted into being the default via Panel and is now unused; it stays
   * in the scale because D73 locked the scale, not because anything wants it.
   * `lg` (16px) has exactly one consumer, components/SearchOverlay.tsx: a
   * full-width modal, where 6px reads as an unstyled box. scripts/layering.sh
   * rejects `md`, `lg` and arbitrary radii everywhere else.
   *
   * `rounded-full` is not on this scale and is not drift — it makes circles.
   * Posters use the proportional `poster-radius` clamp below, not a token.
   */
```

- [ ] **Step 6: Run everything, then look at it**

```bash
npx vitest run components/ && npm run layering
INVENTORY=1 npx playwright test e2e/inventory.spec.ts --reporter=list \
  | tee /tmp/inventory-after-t25.txt
```

Expected: the `Radii:` line moves from `10px ×58, 6px ×36` to roughly
`6px ×94, 10px ×0`, with `poster-clamp` and `pill` unchanged. Record it.

Browser, 1440 / 1280 / 1024 / 390px, both schemes: panels still read as
floating surfaces against the ground (D67/D72), the nav rail's corner still
matches the panels it sits beside, and the award-show plates still look like
plates. This is the browser-only half.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css scripts/layering.sh .github/workflows/ci.yml
git add -A components app
git commit -m "P17.T25: 6px is the default radius, and Panel stops saying otherwise"
```

---

## Task 22: Rename the surfaces to match reality

🔴 **Decided 2026-09-12.** `bg-raised` renders 204 times, `bg-surface` 45 and
`bg-base` 8 — the surface called "raised" is the product's default and the
ground is the rarest thing on screen.

🔴 **D72 is unchanged and is not being re-litigated.** Separation by surface
step rather than hairline outline stays. **No border comes back.** If at any
point during this task the answer seems to be "add a border", stop: that is a
D72 amendment and it is not this task's to make.

🔴 **This task amends D77, and the PLAN's amendment table is missing it.** D77
reads: *"Token names are unchanged; only their values move… Renaming would
produce a mechanical diff across ~40 files with no behavioural gain and no test
that could catch a missed one."* That is precisely this rename, rejected for
precisely the reason this task must answer. The owner has confirmed T22
proceeds, so **write the commit and the PROGRESS note as an amendment to D77**,
not as work that happens to contradict it.

**The amendment is earned by this task's own two deliverables, and the ledger
entry will need the argument stated this way:**

- *"no test that could catch a missed one"* — there is one now. The
  `check "no retired surface token names"` grep in `scripts/layering.sh` and
  `.github/workflows/ci.yml` (step 5) fails the build on any surviving `base`
  or `raised` spelling, in `app/`, `components/`, `lib/`, `theme/` and
  `.storybook/`. A file written from an old example goes red rather than
  shipping a colour nobody chose.
- *"no behavioural gain"* — correct, and now demonstrable rather than assumed.
  The 48-screenshot zero-diff pair (step 7) proves the absence of a behavioural
  *change*, which is what makes a pure rename safe to run at all. D77 could not
  offer that evidence in 2026-08 and declined on exactly that ground.

D77's objection was right when it was made. The guard and the screenshot pair
are what retire it. 🔴 **Do not edit `docs/DECISIONS.md`** — record the
amendment in `docs/PROGRESS.md` § Phase 17 notes as awaiting a number, the way
tranche 1's T6 handles D80. P17.T26 (tranche 5) assigns D85+ in one pass.

🔴 **The phase now carries five amendments, not the PLAN's three.** T26's author
needs the full list, so it is written here as well as in the PROGRESS note:

| Decision | Task | Standing |
|---|---|---|
| **D71** | T18 (this tranche) | Amended — the face reasoning stands, the 11–13px density does not |
| **D72** | T22 (this tranche) | Compatible, explicitly unchanged — no border returns |
| **D77** | T22 (this tranche) | **Amended** — the rename D77 declined, now guarded and screenshot-proven |
| **D80** | T6 (tranche 1) | Amended in part — auto-append kept, the URL bought back |
| **D40** | T16a/T16b (tranche 3) | Amended — `/live/[abbr]` is public, decided after the PLAN was written |

**Files:**
- Modify: `app/globals.css` (both palette blocks, both `@custom-variant`
  comments)
- Modify: `theme/tokens.ts` (the `Palette['bg']` keys and both palettes)
- Modify: `theme/tokens.test.ts` (`flatten`'s pair list)
- Modify: `theme/index.ts` (`background.default` / `paper`)
- Modify: `.storybook/TokenTable.tsx`
- Modify: `scripts/layering.sh`, `.github/workflows/ci.yml`
- Modify: ~58 `.tsx` files under `app/` and `components/`
- Test: `theme/tokens.test.ts`, `theme/contrast.test.ts` (names only)

**Interfaces:**
- Consumes: `e2e/visual.spec.ts` from T18.
- Produces: the new token names, which tranche 5's T34 (`text-dim` audit)
  inherits. `theme/contrast.test.ts`'s pairs are renamed, never re-measured —
  the 4.69:1 `dim on raised` figure T34 argues from is about a colour, and no
  colour moves in this task.

**The rename — confirmed by the owner.** The three names below are decided; use
them verbatim.

| Old | New | Why |
|---|---|---|
| `bg.base` | `bg.ground` | The page ground behind the floating shell. 8 renders. "Base" implied a baseline everything sits on; it is the rarest thing on screen |
| `bg.surface` | `bg.panel` | The floating panel. `components/Panel.tsx` already calls it that, and it is spec §3.1's own word |
| `bg.raised` | `bg.surface` | The default. 204 renders. The most-used ground gets the most generic name |

This also walks back toward the spec's original vocabulary (§3.1: `void` /
`panel` / `raised`), which D77's map translated away; `panel` returns verbatim.

🔴 **The rename is `raised → surface` while `surface → panel`, which means a
naive sequential sed corrupts the file**: rename `surface` to `panel` first and
the subsequent `raised → surface` is safe; do it the other way and every
newly-created `surface` gets re-renamed to `panel`. Step 4 orders them
correctly. Verify after, do not trust the order from memory.

🔴 **`Panel`'s `tone` prop moves with the names.** It is a public prop whose
values are the old token names — `tone="raised"` now asks for what is called
`surface`, and `tone="surface"` for what is called `panel`. Every call site
moves too (step 4). Leaving the prop behind would give the codebase a prop
whose values contradict the tokens, which is the fault being fixed.

**Context an implementer needs.** The Tailwind class spelling is doubled —
`bg-bg-surface`, `border-bg-raised` — because the token namespace is `bg-*` and
the utility prefix is also `bg-`. So the sed targets `-bg-base`, `-bg-surface`,
`-bg-raised` (with the leading hyphen) in `.tsx`, and `--color-bg-*` in CSS, and
the JS object keys in `theme/`. Every utility prefix in use must be covered:
`bg-`, `border-`, `border-l-`, `text-`, `hover:bg-`, `[&::-webkit-progress-bar]:bg-`.
Grepping for the token fragment rather than for `bg-bg-` catches them all.

**No visual diff is the specification.** Not "a small diff". Not "nothing I
noticed". `maxDiffPixels: 0` across 6 surfaces × 2 schemes × 4 widths = 48
screenshots. The surfaces compared, and why each:

| Surface | Route | What it pins |
|---|---|---|
| dashboard | `/` | `Panel`, `Shelf`, `SectionHead`, the leaderboard, the season stepper — the densest mix of all three grounds |
| browse | `/browse` | The poster grid and `PosterFrame`'s raised placeholder, the highest-count `raised` surface on a public page |
| award-shows | `/award-shows` | `Panel tone="raised"` sections, `ShowLogo`'s raised plate, `StatusChip tone="neutral"` |
| film | `/films/313369` | `CinemaFrame`, the light-mode poster hairline, the one place a `light:` variant touches a surface |
| league | `/leagues/1` | The signed-in default: standings, rosters, the panel-inside-panel stack |
| draft board | `/leagues/1/draft` | 🔴 The screen this phase is forbidden to change. If any pixel moves here, the rename is wrong |

**Browser-only claims.** All of them. "No visual diff" is not a statement jsdom
can evaluate — it has no paint. The jsdom half of this task is name consistency
(`tokens.test.ts`), and that is all it is.

- [ ] **Step 1: Capture the before**

The names are decided; there is nothing to confirm. **On a clean tree with
nothing uncommitted**:

```bash
git status --porcelain   # must be empty
npm run db:up
VISUAL=1 npx playwright test e2e/visual.spec.ts --update-snapshots
```

Expected: 48 passing tests, 48 PNGs written under the gitignored
`e2e/visual.spec.ts-snapshots/`. 🔴 If any test fails to capture, fix that
before renaming anything — a missing baseline is a surface the rename is not
checked on.

- [ ] **Step 2: Write the failing test**

In `theme/tokens.test.ts`, rename the three pairs in `flatten`:

```ts
    ['bg-ground', palette.bg.ground],
    ['bg-panel', palette.bg.panel],
    ['bg-surface', palette.bg.surface],
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run theme/tokens.test.ts`
Expected: FAIL — a type error on `palette.bg.ground` and a mismatch between the
CSS's `bg-base` and the test's `bg-ground`.

- [ ] **Step 4: Rename the tokens, in this order**

🔴 **`surface → panel` must run before `raised → surface`.** Run each command
and check `git diff --stat` between them.

```bash
# 1. CSS custom properties, both palette blocks.
sed -i '' 's/--color-bg-surface/--color-bg-panel/g; ' app/globals.css
sed -i '' 's/--color-bg-raised/--color-bg-surface/g; ' app/globals.css
sed -i '' 's/--color-bg-base/--color-bg-ground/g' app/globals.css

# 2. Class sites. The leading hyphen is what makes `-bg-surface` match
#    `bg-bg-surface`, `border-bg-surface` and `hover:bg-bg-surface` alike.
FILES=$(grep -rlE "\-bg-(base|surface|raised)\b" app components .storybook \
  --include='*.tsx' --include='*.ts' --include='*.mdx')
echo "$FILES" | wc -l    # expect ~58
echo "$FILES" | xargs sed -i '' 's/-bg-surface\b/-bg-panel/g'
echo "$FILES" | xargs sed -i '' 's/-bg-raised\b/-bg-surface/g'
echo "$FILES" | xargs sed -i '' 's/-bg-base\b/-bg-ground/g'
```

Then by hand, because they are object keys rather than class strings:

- `theme/tokens.ts`: the `Palette` type's `bg: { base; surface; raised }` →
  `bg: { ground: string; panel: string; surface: string }`, and both palette
  literals. 🔴 Keep the three **values** exactly where they are — `ground` gets
  what `base` had, `panel` what `surface` had, `surface` what `raised` had. A
  transposed value here is the one way this task can change a pixel.
- `theme/index.ts`: `background: { default: p.bg.base, paper: p.bg.surface }` →
  `{ default: p.bg.ground, paper: p.bg.panel }`. MUI's `paper` is the floating
  card, which is now `panel`.
- `theme/contrast.test.ts`: the `on base` / `on surface` / `on raised` rows
  become `on ground` / `on panel` / `on surface`, pointing at the renamed keys.
  🔴 **Rename the labels and the property paths; change no threshold and no
  colour.** Every ratio in that file must be numerically identical afterwards.
- `.storybook/TokenTable.tsx`: the three surface rows.
- `components/Panel.tsx`: the `tone` prop's values. `tone="raised"` is now
  asking for what is called `surface`; `tone="surface"` for what is called
  `panel`. 🔴 This changes a **public prop**, so every `<Panel tone="raised">`
  call site must move too — grep `tone="` and fix all of them. If that feels
  like scope creep, the alternative is a prop whose values contradict the token
  names, which is the fault being fixed.

- [ ] **Step 5: Add the guard**

Append to `scripts/layering.sh`, before `exit $fail`:

```bash
# P17.T22. The retired surface names do not come back.
#
# 🔴 This is the check D77 said could not exist, and it is the reason the
# rename is allowed to happen at all. D77 declined this rename in 2026-08
# because "no test could catch a missed one" — true then, and this grep is the
# answer. `bg.raised` is now `bg.surface`, `bg.surface` is `bg.panel`, and
# `bg.base` is `bg.ground`: the names now match how often each renders (204 /
# 45 / 8), and a new file written from an old example fails here rather than
# shipping a colour nobody chose.
#
# No {n,m} interval: see the `set +B` note at the top of this file.
check "no retired surface token names" \
  "$(grep -rnE "\-bg-(base|raised)\b|--color-bg-(base|raised)\b|bg\.(base|raised)\b" \
     components app lib theme .storybook \
     --include='*.tsx' --include='*.ts' --include='*.css' --include='*.mdx' 2>/dev/null \
     || true)"
```

Mirror it into the `layering` job of `.github/workflows/ci.yml`.

🔴 The grep deliberately does not flag bare `surface`, because `surface` is a
*live* name after the rename. So the guard catches `base` and `raised` — the two
retired spellings — and that is all it can catch. A file that writes `bg-panel`
where it meant `bg-surface` is a real hole, and it is covered by the screenshot
pair, not by the grep. Say that out loud rather than claiming the grep is total.

- [ ] **Step 6: Run everything**

```bash
npx vitest run theme/ components/ && npm run layering && npm run typecheck
```

Expected: PASS all three. Typecheck is the one that catches a missed object key;
layering is the one that catches a missed class; `tokens.test.ts` is the one
that catches CSS and JS disagreeing. **If `contrast.test.ts` reports a different
ratio than before, a value was transposed in step 4 — revert and redo.**

- [ ] **Step 7: The verification this task exists for**

```bash
VISUAL=1 npx playwright test e2e/visual.spec.ts
```

Expected: **48 passed, zero diff pixels.** Not "a few". If any test fails,
Playwright writes the diff to `test-results/` — open it. The overwhelmingly
likely cause is a transposed value in `theme/tokens.ts` or a class the sed
order corrupted (`panel` where `surface` was meant). Fix and re-run; do not
raise `maxDiffPixels`.

Then, by hand, at 1440 / 1280 / 1024 / 390px in both schemes on all six
surfaces: confirm nothing moved and **confirm no border appeared** — D72 stands.

- [ ] **Step 8: Clean up the baselines and commit**

Before committing, append to `docs/PROGRESS.md` § "Phase 17 notes" — **append
only**, and **not** to `docs/DECISIONS.md`:

```markdown
- P17.T22 **amends D77** (awaiting a number; P17.T26 assigns D85+). D77 declined
  this rename as "a mechanical diff across ~40 files with no behavioural gain and
  no test that could catch a missed one". Both halves are now answered:
  `scripts/layering.sh` → `check "no retired surface token names"` fails the
  build on any surviving `base`/`raised` spelling, and the 48-screenshot
  zero-diff pair (6 surfaces × 2 schemes × 4 widths, `maxDiffPixels: 0`,
  including `/leagues/1/draft`) proves no behavioural change. Map:
  `base → ground`, `surface → panel`, `raised → surface`. D72 is unchanged — no
  border returns.
```

```bash
rm -rf e2e/visual.spec.ts-snapshots
git add app/globals.css theme .storybook scripts/layering.sh \
  .github/workflows/ci.yml docs/PROGRESS.md
git add -A app components
git commit -m "P17.T22: surface names say how often each one renders"
```

The commit body should carry the 48/48 zero-diff result and the D77 amendment,
so the ledger entry tranche 5 writes has something to cite.

---

## Task 20: Spend `beam` on live and countdowns

🔴 **Decided 2026-09-12**, closing a token with zero consumers today despite
being defined, mirrored in both schemes, contrast-tested against two grounds
and wired into MUI as `info.main`. It reads as a projector beam and there are
now two jobs for it: the live surface (**T16a, tranche 3** — T16 is split into
T16a/T16b behind a reviewer gate, and T16a is the half that renders it) and the
`Next · date TBA` chip (**T3, tranche 1**).

🔴 **This task is not done until `beam` renders somewhere, and neither of those
two places is yours.** That makes it dependent on two other tranches. Say so
plainly in the report; do not tick it because the affordance exists.

**Files:**
- Modify: `components/StatusChip.tsx`
- Modify: `components/StatusChip.stories.tsx`
- Modify: `theme/tokens.ts` (the docstring only)
- Test: `components/StatusChip.test.tsx`

**Interfaces:**
- Produces: `<StatusChip tone="beam">` — beam ink on the default surface.
  **Tranche 1's T3 and tranche 3's T16a are the consumers**; tell them it exists.
- Consumes: T22's surface names, if T22 has landed. The class below is written
  in post-T22 spelling; if T22 has not landed, write `bg-bg-raised`.

**Context an implementer needs.** `StatusChip` has three tones today: `brass`
(bg-brass-fill + brass-contrast), `carmine` (accent-fill + white) and `neutral`
(the default surface + text-secondary). The obvious fourth is a beam *fill* —
and it is the wrong one. A beam fill needs a `beam-contrast` token, a new row in
`theme/contrast.test.ts`, and a value measured in both schemes, all to serve one
chip. `beam` already has two rows in `contrast.test.ts` proving it readable **as
text** on `base` and on `raised` at 4.5:1 in both schemes — which is exactly the
pair a `neutral`-shaped chip with beam ink uses. So: same shape as `neutral`,
beam ink, no new token, no new contrast row, and the rule `contrast.test.ts`
already encodes is the rule it obeys.

🔴 That keeps `contrast.test.ts` honest by construction rather than by promise,
which the phase gate requires. If a future task does want a beam *fill*, it owes
a `beam.contrast` token and two rows in that file, in both schemes.

**Browser-only claims.** Whether the beam chip reads as distinct from `neutral`
at a glance. The class assertion is a real jsdom test; "does it read as blue" is
not, and is checked at step 6 — and cannot be checked at all until T3 or T16a
renders one.

- [ ] **Step 1: Write the failing test**

Add to `components/StatusChip.test.tsx`:

```tsx
  it('carries a beam tone for scheduled and live states (D69, P17.T20)', () => {
    render(<StatusChip tone="beam">Next · date TBA</StatusChip>);

    const chip = screen.getByText('Next · date TBA');
    // 🔴 Beam is ink here, not a fill. `theme/contrast.test.ts` proves beam
    // readable AS TEXT on this ground in both schemes; a fill would need a
    // beam-contrast token and two new rows in that file, for one chip.
    expect(chip.className).toContain('text-beam');
    expect(chip.className).not.toContain('bg-beam');
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run components/StatusChip.test.tsx`
Expected: FAIL — a type error, `"beam"` is not assignable to the `tone` union.

- [ ] **Step 3: Add the tone**

In `components/StatusChip.tsx`, widen the union and add the branch:

```tsx
  tone?: 'brass' | 'carmine' | 'beam' | 'neutral';
```

```tsx
        tone === 'beam' && 'bg-bg-surface text-beam',
```

(post-T22 spelling; `bg-bg-raised` if T22 has not landed) and add to the
component's docstring:

```tsx
/**
 * …
 * 🔴 `beam` is scheduled-and-not-yet: a countdown, a date TBA, a live surface
 * before it goes live (D69, P17.T20). It is deliberately NOT `carmine` — that
 * is urgency, a deadline you can miss — and deliberately NOT `brass`, which is
 * an award. It is ink rather than a fill because `theme/contrast.test.ts`
 * proves beam readable as text on this ground in both schemes and proves
 * nothing at all about white or black on top of it.
 */
```

- [ ] **Step 4: Add the story**

In `components/StatusChip.stories.tsx`, add a `Beam` story beside the existing
tones, labelled `Next · date TBA` so the story shows the actual first consumer.

- [ ] **Step 5: Record what beam means**

In `theme/tokens.ts`, add above the `beam: string;` field:

```ts
  /**
   * The projector beam. Scheduled, counting down, or live — never urgent
   * (carmine) and never an award (brass). Spent by P17.T20 as
   * `<StatusChip tone="beam">` and consumed by the `Next · date TBA` chip
   * (P17.T3) and the live surface (P17.T16a). Wired into MUI as `info.main`.
   *
   * 🔴 Ink, not a fill. contrast.test.ts proves it against `bg.ground` and
   * `bg.surface` as text; there is no measured on-beam contrast colour, so a
   * fill would need a `beam.contrast` token and two new rows there first.
   */
```

- [ ] **Step 6: Run the suite and report the blocker**

Run: `npx vitest run components/ && npm run typecheck && npm run build-storybook`
Expected: PASS.

🔴 **Now check whether the task can actually close.** `beam` renders nowhere
until tranche 1's T3 or tranche 3's T16a ships:

```bash
grep -rn "tone=\"beam\"\|text-beam\|bg-beam" app components --include='*.tsx' \
  | grep -v -e '\.test\.' -e '\.stories\.'
```

If that returns nothing outside `StatusChip.tsx` itself, **the task stays
open**. Report to the coordinator: "T20 affordance landed; unspent until T3
(tranche 1) or T16a (tranche 3) renders it." Do not tick the `PROGRESS.md` box.

If T3 or T16a has landed, navigate to it in a browser at all four widths in both
schemes and confirm the chip reads as distinct from `neutral` — then tick it.

- [ ] **Step 7: Commit**

```bash
git add components/StatusChip.tsx components/StatusChip.test.tsx \
  components/StatusChip.stories.tsx theme/tokens.ts
git commit -m "P17.T20: beam becomes a StatusChip tone for scheduled and live"
```

---

## Task 21: Brass reaches a public page — verification only

🔴 **This task does not implement anything and it closes in Phase 18.** Brass
never renders on a public page: every reference sits behind auth or on
award-show detail, so a logged-out visitor never meets the awards accent.
**Decided 2026-09-12: How-it-works carries it (P18.T6)** — the one public page
whose subject is the awards — rather than sprinkling brass around to raise a
count.

🔴 **Blocked by T35 (tranche 5), and that is a blocker rather than a footnote.**
Signed in, the review found **320 brass instances on the draft board**, where
brass already means "drafted". Giving one token two meanings is the exact fault
D69 split carmine and brass to fix. **P18.T6 must not spend brass as the awards
accent until T35 has decided what brass means on the draft board.** Do not
decide it here; tranche 5 owns it.

🔴 **And the 320 figure does not reproduce from source — flag this.** A grep of
`app/` and `components/` finds **11** brass class references in total, and
neither `components/DraftBoard.tsx` nor `components/DraftConsole.tsx` contains
one: the board's chips are `tone="neutral"` and `tone="carmine"`, and `Eyebrow`
defaults to `dim`, not `brass`. So either the review counted computed custom
properties per element (every element inherits `--color-brass-fill` whether or
not it uses it), or it measured something this tree no longer contains. **T35
must restate its measurement method before its count can be acted on**, and T21
cannot verify against a number nobody can reproduce. Report this; do not
silently pick an interpretation.

**Files:**
- Create: `e2e/brass.spec.ts`
- Test: itself

**Interfaces:**
- Consumes: nothing in this tranche.
- Produces: the assertion P18.T6 has to satisfy.

**Context an implementer needs.** The deliverable that is worth anything today
is the *check*, written now and failing visibly until P18.T6 lands. The
codebase already has this convention: D84 keeps `e2e/auth.spec.ts` "skipped
visibly" because it tests something the environment cannot provide.
`test.fixme()` is Playwright's version — the test is listed in every run as
expected-to-fail, so it is a standing reminder rather than a forgotten note, and
it flips to a real gate the moment P18.T6 makes it pass.

**Browser-only claims.** All of them. "Does a stranger meet brass" is a question
about rendered colour on a route with no session; there is no jsdom form of it.

- [ ] **Step 1: Write the check**

Create `e2e/brass.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

/**
 * 🔴 P17.T21 — brass must reach a page a stranger can open.
 *
 * All brass in the product sits behind auth or on award-show detail, so a
 * logged-out visitor never meets the awards accent. The fix is P18.T6:
 * /how-it-works, the one public page whose subject is the awards. This test is
 * written now and marked `fixme` so it appears in every run as a standing
 * obligation rather than as a note in a plan nobody re-reads.
 *
 * 🔴 BLOCKED BY P17.T35. Signed in, brass already means "drafted" on the draft
 * board. One token with two meanings is the fault D69 split carmine and brass
 * to fix, so P18.T6 must not spend brass until T35 says what it means. Unfixme
 * this test only after both have landed.
 *
 * 🔴 Signed out on purpose. No session, no cookie — that is the whole claim.
 */
test.fixme('brass renders on a public page (closes with P18.T6)', async ({ page }) => {
  await page.goto('/how-it-works');

  const brass = await page.evaluate(() => {
    const target = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-brass-fill')
      .trim();
    // Compare resolved colours, not the token string: a component may write
    // `text-brass-text`, `bg-brass-fill` or the custom property inline, and all
    // three are the token doing its job.
    const asRgb = (hex: string) => {
      const n = Number.parseInt(hex.replace('#', ''), 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    };
    const wanted = asRgb(target);
    return [...document.body.querySelectorAll<HTMLElement>('*')].some((el) => {
      const s = getComputedStyle(el);
      return s.color === wanted || s.backgroundColor === wanted || s.borderTopColor === wanted;
    });
  });

  expect(brass, 'no element on /how-it-works renders the brass token').toBe(true);
});
```

- [ ] **Step 2: Run it and confirm it is visibly pending**

Run: `npx playwright test e2e/brass.spec.ts`
Expected: **1 did not run** (fixme), not a pass and not a failure. If it reports
a pass, someone has already shipped P18.T6 — remove the `fixme` and tick both
boxes.

- [ ] **Step 3: Record the two blockers and stop**

Report to the coordinator, and put nothing in `DECISIONS.md`:
1. T21 closes in **P18.T6**, not here.
2. P18.T6 is blocked by **P17.T35** (tranche 5) — brass already means
   "drafted".
3. The **320 instances figure is not reproducible from source** (11 brass class
   references repo-wide; none in `DraftBoard.tsx` or `DraftConsole.tsx`). T35
   should restate its method before anyone acts on the number.

- [ ] **Step 4: Commit**

```bash
git add e2e/brass.spec.ts
git commit -m "P17.T21: the check that brass reaches a stranger, pending P18.T6"
```

---

## Closing the tranche

- [ ] **Step 1: Run the full gate**

```bash
npm run db:up
npm run verify
npx playwright test
```

Expected: green, with `e2e/brass.spec.ts` reporting as fixme.

- [ ] **Step 2: Record the measurements**

```bash
INVENTORY=1 npx playwright test e2e/inventory.spec.ts --reporter=list \
  | tee /tmp/inventory-final.txt
```

Append to `docs/PROGRESS.md` under `### Phase 17 notes`, **appending only**, in
the same shape as the baseline so the two read side by side:

```markdown
- After T18–T25, measured <date> with `e2e/inventory.spec.ts` across `/`,
  `/browse`, `/award-shows`, `/films/313369` at 1440px, both schemes:
  <fonts line>
  Gaps: <gaps line>
  Radii: <radii line>
  🔴 Before-figures re-measured with the same harness on the pre-sweep tree,
  because the 2026-09-12 baseline used an unrecorded method and its element
  total did not reconcile with its own histogram: <before lines>
```

- [ ] **Step 3: Report the open items**

T20 and T21 do not close in this tranche. Report their state, the D77 amendment
recorded by T22, and the `lg` call from T25.

Confirm the PROGRESS notes now carry **five** decision amendments for P17.T26 to
number in one pass — D71 (T18), D72 (T22, compatible and unchanged), D77 (T22),
D80 (T6, tranche 1) and D40 (T16a/T16b, tranche 3) — rather than the three the
PLAN's table lists.

---

## Self-review

**Spec coverage.** T18 body size and the D71 amendment — Task 18. T19 poster
captions at 15px serif, Newsreader preserved — Task 19. T20 beam spent, and
explicitly not closed — Task 20. T21 brass verification, blocked on T35 —
Task 21. T22 surface rename, D72 untouched, no border, zero-diff verification
— Task 22. T23 40px section step — Task 23. T24 4px grid enforced in
`layering.sh` — Task 24. T25 radius default at 6px, `lg` discussed and
resolved — Task 25. The gate's re-measurement is the harness in Task 18 and
the closing steps.

**Placeholders.** None: every step carries the command, the class, or the code.
The three surface names in T22 are owner-confirmed and stated verbatim. The one
place that still reads like an open question is deliberate — T25's `lg` decision
is stated with its alternative, because dropping `lg` would amend D73 and that
is not this task's to do.

**Type consistency.** `StatusChip`'s tone union is `'brass' | 'carmine' |
'beam' | 'neutral'` in T20 and nowhere else. `Palette['bg']` is
`{ ground; panel; surface }` after T22, used with that spelling in
`theme/index.ts`, `theme/tokens.test.ts`, `theme/contrast.test.ts` and
`.storybook/TokenTable.tsx`. `e2e/inventory.spec.ts` and `e2e/visual.spec.ts`
are named identically everywhere they are invoked. The `check` helper signature
in `scripts/layering.sh` is `check "<name>" "<offenders>"` in all four new
checks, matching the six that exist.

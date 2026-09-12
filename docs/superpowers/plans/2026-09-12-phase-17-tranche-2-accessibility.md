# Phase 17 — Tranche 2: Accessibility and correctness

Covers **P17.T8, P17.T9 and P17.T10** only. The other thirty-odd Phase 17 tasks
belong to four sibling tranches planned in parallel; see *What this tranche does
not own*.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three findings the 2026-09-12 design review classed as
correctness rather than taste — seventeen links that announce nothing, a missing
skip link, two focus rings that are not the product's, the only two contrast
failures in the product, and a film page that pushes a 390px phone to 1402px.

**Architecture:** Three independent tasks over code that already exists. One
of them changes a shared rule rather than a screen: the Clerk appearance map
moves out of `app/providers.tsx` into `theme/clerk.ts` so that
`theme/contrast.test.ts` can read it, which is what turns "the fill-only rule"
from a sentence in a comment into a test that fails. The other two are contained
edits with their proof in Playwright, because both are geometry and paint, and
jsdom has neither.

**Tech Stack:** Next 16 App Router, React 19, TypeScript strict, Tailwind 4 +
MUI (cascade layers), Clerk 7, Vitest + Testing Library, Playwright.

**Spec:** there is no standalone spec document for Phase 17. The sources of
record are:
- `docs/PLAN.md` § Phase 17 — the task list, the amended decisions, the gate
- `docs/PROGRESS.md` § Phase 17 — the decided detail and the 2026-09-12 baseline
- the published design review of 2026-09-12 against commit `7a1e8d8`
- `docs/DECISIONS.md` D69–D84 (locked)

**Plan of record:** `docs/PLAN.md` § Phase 17, which runs before the go-live
phases despite its number.

🔴 **The legacy app is evidence, not a target.** No step below is justified by
"cinemadraft.com did it", and no commit message may say so.

---

## What this tranche does not own

Phase 17 is being executed as five tranches. Read this before your first edit.

### The boundary

| Tranche | Tasks | Owns |
|---|---|---|
| 1 — Product and structure | T0–T7 | `proxy.ts`, `SectionHead`, **`AppShell` breakpoints and the tab-bar row**, `SeasonStepper`, `LeaderboardTable`, the signed-out lede, `/browse` URL cursor, draft-console `assign` |
| **2 — this plan** | **T8–T10** | `BrowseMonth` poster links, the **skip link** in `AppShell`, `NavRail`/`ThemeToggle` focus rings, `theme/clerk.ts` + `theme/contrast.test.ts` + `theme/tokens.ts`, `PosterCarousel`, `TrailerReel` |
| 3 — Visual | T11–T17 | `app/(app)/page.tsx` roster posters, award-show marks, **the film-page title/year lockup**, `NavRail` column, winner seal, `/live/[abbr]`, LCP priority |
| 4 — Type and colour system | T18–T25 | the 15/13 body-size sweep, serif poster captions, `beam`, brass, the **surface rename**, 40px section spacing, the 4px grid, radius |
| 5 — Signed-in surfaces | T26–T36 | `not-found`, `/admin/season`, signed-in home, league page, standings/roster, `/leagues`, signed-in type, `text-dim`, brass meaning, `/list` gutters, the D85+ ledger entries |

### The shared files

- **`components/AppShell.tsx` — tranche 1 (T2) and this tranche (T8).** T2
  rewrites the breakpoints and folds the wordmark, search and sign-in into the
  tab-bar row. **Re-read the file before Task 8 Step 9**, and anchor the skip
  link to *"first child of the element `AppShell` returns"*, never to a line
  number. Task 8's `AppShell.test.tsx` assertion is the handoff: if T2 lands
  after T8 and drops the skip link, that test goes red in T2's own run.
- **`app/(app)/films/[tmdbId]/page.tsx` — tranche 3 (T13) and this tranche
  (T10).** T13 rewrites `FilmBanner`'s title/year lockup, near the top of the
  file. T10 touches only the grid wrapper further down and, preferably, not the
  page file at all (the fix lands in `components/PosterCarousel.tsx`). Do not
  touch `FilmBanner`.
- **`components/Panel.tsx` — tranche 4 (T22) will sweep its surface classes.**
  Task 8 adds two optional props to its signature and changes no class. Say so
  in the commit message so T22's rename diff is readable.
- **The T18 body-size sweep touches 75 of 181 `.tsx` files under `app/` and
  `components/`; the T22 surface rename touches 58.** Every file this tranche
  edits is in one or both of those sets.

### The rule

Do not opportunistically fix anything another tranche owns — not a stray
`text-sm`, not a `bg-raised`, not a 6px gap, not a `rounded-md`, even when it is
one character away and obviously wrong. It is being swept deliberately, and an
early partial fix makes T22's *zero-pixel visual diff* verification unreadable.
If a task genuinely cannot be completed without crossing the line, cross it, and
say so in the commit message.

### Known entanglements

- T8's skip link lands in the shell T2 is rewriting (above).
- `beam` (T20) cannot complete until the live page (T16) renders it; brass (T21)
  is blocked on T35, because brass already means "drafted" in 320 places on the
  draft board. Neither touches this tranche — do not spend either token here.
- T33/T34 inherit tranche 4's type and colour decisions rather than forking a
  second pass. If you find yourself wanting a new size or a new grey, stop.

### If the tranches run concurrently

- Take your own `git worktree` and your own port. Never reuse a server you did
  not start — today one agent measured another agent's dev server on port 3000
  and nearly recorded a clean baseline for broken code.
- The DB-backed vitest project is **serial by design**: one Postgres on 5433, and
  `available_years_one_active` is a global partial unique index with no
  per-worker copy. Two suites racing it fail about one run in three.
- Playwright's `webServer` is pinned to port 3000 and `reuseExistingServer` is on
  outside CI. Before `npm run test:e2e`, confirm that whatever is on 3000 is
  yours.

---

## Global Constraints

- **Biome**, not ESLint or Prettier. `npm run lint` covers linting, formatting
  and import order; `npm run typecheck` is separate.
- **MUI for components, Tailwind for custom styling**, coexisting through the
  cascade layers `theme, base, mui, components, utilities`. Never `!important`.
- **All local databases run in Docker** — `npm run db:up` before anything that
  touches the database.
- 🔴 **The database on 5433 is a restored copy of production.** League 1 is sixty
  real people's history. Nothing in this tranche writes to it; if a step ever
  needs to, it uses a scratch league and deletes it.
- **Never regenerate `package-lock.json` on macOS.** Nothing here adds a
  dependency; if that changes, `npm install <pkg>` then `npm run lock`.
- **`fixtures/` is generated.** Never hand-edit it.
- **No raw hex outside the token system.** `scripts/layering.sh` greps
  `components/`, `app/` and `.storybook/` for `#rrggbb`. `theme/` is *not*
  covered, which is why the one literal white this tranche introduces lives in
  `theme/tokens.ts`.
- **`data-testid` is the only test handle** (D66), stripped from production
  output unless `KEEP_TEST_IDS=1`. Assertions still go through roles and
  accessible names.
- **Touch targets ≥44px**, focus rings never removed, colour never the only
  carrier of state, every animation has a `prefers-reduced-motion` path.
- **One commit per task**, message starting with the task ID (`P17.T9: ...`).
- 🔴 **Do not edit `docs/PROGRESS.md`.** The coordinator is indexing the five
  tranches centrally. Report the completed task IDs instead of ticking boxes.
- **`npm run verify` before pushing** — lint, typecheck, layering, both test
  suites, build.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `theme/clerk.ts` | The Clerk `appearance` map, as data, so a test can read it |

**Modified**

| File | Change |
|---|---|
| `theme/tokens.ts` | Gains `accent.contrast` (white) and exports `flatPalette` |
| `theme/tokens.test.ts` | Uses the exported `flatPalette` instead of its private copy |
| `theme/contrast.test.ts` | Asserts the Clerk appearance map's pairs, both schemes |
| `theme/index.ts` | `primary.contrastText` reads the new token instead of a literal |
| `app/globals.css` | `--color-accent-contrast` in both scheme blocks |
| `app/providers.tsx` | Imports `clerkAppearance` instead of declaring it inline |
| `components/PosterCarousel.tsx` | The scroll strip's width stops depending on its contents |
| `components/TrailerReel.tsx` | The trailer row stops overflowing its list item |
| `components/BrowseMonth.tsx` | The poster wrapper leaves the tab order |
| `components/BrowseMonth.test.tsx` | Pins the link count and the surviving name |
| `components/ThemeToggle.tsx` | Gets the product's focus ring and a 44px target |
| `components/NavRail.tsx` | The focus ring stops fading in from `currentColor` |
| `components/Panel.tsx` | Two optional forwarded props (`id`, `tabIndex`) |
| `components/AppShell.tsx` | Skip link; `<main>` becomes its target |
| `components/AppShell.test.tsx` | Pins the skip link as the first focusable element |
| `e2e/films.spec.ts` | 390px geometry, both schemes |
| `e2e/nav.spec.ts` | The focus rings, measured after they settle |

---

## Task order, and why

**T9, then T10, then T8.**

- **T9 first.** It is the only task in this tranche that collides with no other
  tranche at all — `theme/` and `app/providers.tsx` are untouched by 1, 3, 4 and
  5 — and it is the one marked 🔴 contrast-bearing. It can land while the others
  are still being written.
- **T10 second.** It shares one file with tranche 3 (T13) at a distance, and its
  fix is two component edits. Landing it early gives T13 a stable file.
- **T8 last**, because its final step edits `AppShell.tsx`, which tranche 1's T2
  is rewriting. Its first three steps touch nothing anybody else owns and could
  be done at any time; the ordering is for the fourth.

---

## Task 9: 🔴 Clerk's sign-in card stops failing contrast, and the rule gets a test

**Files:**
- Create: `theme/clerk.ts`
- Modify: `theme/tokens.ts` (the `Palette` type, both palettes, a new export)
- Modify: `theme/tokens.test.ts` (import `flatPalette` rather than define it)
- Modify: `theme/contrast.test.ts` (the new Clerk block)
- Modify: `theme/index.ts:38`
- Modify: `app/globals.css` (both scheme blocks)
- Modify: `app/providers.tsx:77-95`

**Interfaces:**
- Produces: `clerkAppearance` from `theme/clerk.ts`, typed
  `satisfies Appearance` (the type `@clerk/nextjs` re-exports). Its shape is
  `{ variables: Record<string, string>; elements: Record<string, { color: string }> }`.
  Every colour value is the literal string `var(--color-<token>)`.
- Produces: `flatPalette(palette: Palette): Map<string, string>` from
  `theme/tokens.ts` — CSS custom-property suffix (`accent-fill`) to hex, lower
  case. `theme/tokens.test.ts` and `theme/contrast.test.ts` both consume it.
- Produces: `Palette['accent']` gains `contrast: string`.

**Context an implementer needs.**

Clerk's appearance map is declared inline in `app/providers.tsx` and its comment
claims "White on carmine is 6.58:1" — but the map does not say white. It says
`colorPrimaryForeground: 'var(--color-text-primary)'`, and `text.primary` is
near-white in dark and *near-black in light*. Measured in a real browser on
`/auth/login` (Clerk mounted, `.env.local` keys present):

| Element | Clerk class | Scheme | Foreground | Background | Ratio |
|---|---|---|---|---|---|
| "Continue" | `.cl-formButtonPrimary` | light | `#1A151F` | `#9B2F3C` | **2.45** |
| "Continue" | `.cl-formButtonPrimary` | dark | `#EFECE9` | `#C03D4E` | **4.44** |
| "Register" | `.cl-footerActionLink` | dark | `#C03D4E` | `#0A0910` | **3.79** |
| "Register" | `.cl-footerActionLink` | light | `#9B2F3C` | `#EFEAE2` | 6.12 |

Three failures, not the two the review named — the dark "Continue" at 4.44 is
0.06 under AA and went unremarked. All four are the same two mistakes:

1. `colorPrimaryForeground` is a *pairing with a fill* and was given a token
   that flips with the scheme. `theme/index.ts:38` already gets this right for
   MUI — `primary: { main: p.accent.fill, contrastText: '#FFFFFF' }` — so the
   app already holds the correct answer and Clerk was handed a different one.
   White on carmine measures **5.23** dark and **7.33** light.
2. Clerk has **no link-colour variable**. `colorPrimary` drives the primary
   button's fill *and* every link (`footerActionLink`, `formResendCodeLink`,
   `backLink`, `footerPagesLink`), so passing `accent.fill` there breaks the
   fill-only rule `theme/tokens.ts` states in its own comment. Verified against
   `node_modules/@clerk/react/dist/types-Dd22QRBT.d.mts:10429-10545` — the
   `Variables` type has `colorPrimary` and `colorPrimaryForeground` and nothing
   for links. Links therefore have to be re-pointed through `elements`, whose
   values are `string | CSSObject` (`UserDefinedStyle`, line 9791), so a style
   object typechecks.

The fix has to be *enforced*, not written down, and the enforcement point is
`theme/contrast.test.ts` — which today asserts pairs drawn by hand and knows
nothing about the map that actually reaches Clerk. That is the whole reason the
appearance object moves into `theme/`: a test cannot read a literal buried in a
client component's JSX.

🔴 **Why the extraction comes before the fix.** Steps 1–3 move the map with its
values byte-identical, then write the test, then watch it fail with 2.45, 4.44
and 3.51. That failure *is* the evidence that the test would have caught the
shipped defect. Fixing first and testing after proves nothing.

🔴 **How this is verified, given the e2e harness cannot render it.** Under
`E2E_TEST_AUTH=1` the app boots with **no Clerk at all** (D84) — no
`ClerkProvider`, no `clerkMiddleware`, no sign-in card — so Playwright cannot see
this widget, and `e2e/auth.spec.ts` stays local-only and visibly skipped. The
three-layer verification is therefore: (a) `theme/contrast.test.ts` in CI, which
is the regression gate and runs everywhere; (b) `npm run typecheck`, which proves
the map still satisfies Clerk's `Appearance`; (c) one **manual** browser pass on
`npm run dev` with the real Clerk keys from `.env.local`, measuring the rendered
colours at `/auth/login` and `/auth/register` in both schemes (Step 9). The test
catches a regression in the mapping; only the browser catches Clerk changing
which variable drives which element.

- [ ] **Step 1: Add the `accent.contrast` token**

`theme/tokens.ts` — the type, then both palettes:

```ts
  accent: { fill: string; text: string; contrast: string };
```

```ts
    // dark
    accent: { fill: '#C03D4E', text: '#E78E99', contrast: '#FFFFFF' },
```

```ts
    // light
    accent: { fill: '#9B2F3C', text: '#8E2A36', contrast: '#FFFFFF' },
```

White in both schemes, unlike `brass.contrast`, which genuinely differs per
scheme. It is a token rather than a literal for one reason: the only consumers
that need it — `theme/index.ts` and now Clerk — sit on opposite sides of the
`no raw hex outside the token system` grep, and `app/providers.tsx` is inside it.

Extend the comment above `accent` so the next reader does not repeat the
mistake:

```ts
    // `fill` is still fill-only: white on #C03D4E is 5.23:1, but #C03D4E as
    // text on the ground is below AA (3.79:1). Components needing carmine
    // *text* use accent.text, never palette.primary.main.
    //
    // 🔴 `contrast` is the pairing `fill` was measured for, and it is white in
    // both schemes. Anything that paints text ON accent.fill uses it. Handing
    // that slot `text.primary` instead is what put the Clerk sign-in button at
    // 2.45:1 in light and 4.44:1 in dark (P17.T9).
```

- [ ] **Step 2: Mirror the token into the CSS, and share the flattener**

`app/globals.css` — inside the `@theme` block, beside `--color-accent-text`:

```css
  --color-accent-contrast: #ffffff;
```

and the identical line inside `[data-mui-color-scheme="light"]`. Both are
required: `theme/tokens.test.ts` asserts that every key declared in one block is
declared in the other, because a missing light override silently falls back to
the dark value.

Then move the flattener out of the test and into the module it describes. In
`theme/tokens.ts`, below `palettes`:

```ts
/**
 * A palette as the CSS custom properties it becomes: `accent-fill` → `#c03d4e`.
 *
 * Lives here rather than in a test because two tests need it — `tokens.test.ts`
 * to prove globals.css agrees with this file, and `contrast.test.ts` to resolve
 * the `var(--color-…)` strings in the Clerk appearance map back to colours.
 */
export function flatPalette(palette: Palette): Map<string, string> {
  const pairs: [string, string][] = [
    ['bg-base', palette.bg.base],
    ['bg-surface', palette.bg.surface],
    ['bg-raised', palette.bg.raised],
    ['border-rule', palette.border.rule],
    ['text-primary', palette.text.primary],
    ['text-secondary', palette.text.secondary],
    ['text-dim', palette.text.dim],
    ['accent-fill', palette.accent.fill],
    ['accent-text', palette.accent.text],
    ['accent-contrast', palette.accent.contrast],
    ['brass-fill', palette.brass.fill],
    ['brass-text', palette.brass.text],
    ['brass-contrast', palette.brass.contrast],
    ['beam', palette.beam],
    ['score-high', palette.score.high],
    ['score-mid', palette.score.mid],
    ['score-low', palette.score.low],
  ];
  return new Map(pairs.map(([k, v]) => [k, v.toLowerCase()]));
}
```

In `theme/tokens.test.ts`, delete the private `flatten` function and import the
new one instead, renaming its two call sites:

```ts
import { type ColorScheme, flatPalette, type Palette, palettes, radius } from './tokens';
```

```ts
    expect(propsIn(block as string)).toEqual(flatPalette(palettes[scheme]));
```

- [ ] **Step 3: Run the token tests — they must pass before anything moves**

```bash
npx vitest run theme/tokens.test.ts
```

Expected: PASS. A failure here means the CSS and `tokens.ts` disagree about the
new token, and every later step would be debugging the wrong thing.

- [ ] **Step 4: Extract the appearance map, values byte-identical**

Create `theme/clerk.ts`. 🔴 **Copy the values exactly as they stand in
`app/providers.tsx` today.** Changing one here makes Step 6's failure prove
nothing.

```ts
import type { Appearance } from '@clerk/types';

/**
 * Clerk's appearance, as data.
 *
 * 🔴 It lives here rather than inline in `app/providers.tsx` so that
 * `theme/contrast.test.ts` can read it. The fill-only rule — carmine is a
 * background, never a foreground — was written in `tokens.ts`'s comments and
 * enforced nowhere, and this map broke it in two places at once: it handed
 * `colorPrimaryForeground` a token that flips with the scheme, and it let
 * `colorPrimary` colour the links as well as the button fill. Light "Continue"
 * measured 2.45:1, dark "Continue" 4.44:1, dark "Register" 3.79:1 — the only
 * contrast failures in the product (P17.T9).
 *
 * Every colour is a `var(--color-…)` string on purpose: Clerk reads the custom
 * properties at render, so the theme toggle drives this map with no second
 * theme context and no branch on the scheme (D36, D37). The test resolves the
 * same strings back through `flatPalette` and asserts the pairs.
 */
export const clerkAppearance = {
  variables: {
    colorBackground: 'var(--color-bg-surface)',
    colorPrimary: 'var(--color-accent-fill)',
    colorPrimaryForeground: 'var(--color-text-primary)',
    colorForeground: 'var(--color-text-primary)',
    colorMutedForeground: 'var(--color-text-secondary)',
    colorInput: 'var(--color-bg-raised)',
    colorInputForeground: 'var(--color-text-primary)',
    colorBorder: 'var(--color-border-rule)',
    colorDanger: 'var(--color-accent-text)',
    // Buttons are always 6px, never the 2px Clerk shipped with (D73).
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-archivo)',
  },
} satisfies Appearance;
```

Then in `app/providers.tsx`, replace the inline object and its comment with the
import, keeping the surrounding `localization` prop untouched:

```tsx
import { clerkAppearance } from '@/theme/clerk';
```

```tsx
      appearance={clerkAppearance}
```

If `@clerk/types` does not resolve as a direct import, take `Appearance` from
`@clerk/nextjs` instead — it re-exports the same type. `npm run typecheck` is
the arbiter; do not widen the type to `any` to get past it.

- [ ] **Step 5: Write the failing test**

Append to `theme/contrast.test.ts`. Note the new imports at the top of the file:

```ts
import { clerkAppearance } from './clerk';
import { type ColorScheme, flatPalette, palettes } from './tokens';
```

```ts
/**
 * 🔴 The Clerk appearance map, held to the same threshold as the palette.
 *
 * This is the gate the fill-only rule never had. `app/providers.tsx` used to
 * declare the map inline, where no test could see it, and it drifted: the
 * primary button's label was pinned to `text.primary`, which is near-black in
 * light, and the links inherited `colorPrimary`, which is a fill. Both shipped.
 *
 * The rows below are not decoration — each one names a pair Clerk actually
 * paints. Adding a `color*` variable to `theme/clerk.ts` without adding its
 * pair here puts a colour into the sign-in card that nothing checks.
 */
function resolve(value: string, scheme: ColorScheme): string {
  const name = /^var\(--color-([a-z-]+)\)$/.exec(value)?.[1];
  if (!name) throw new TypeError(`not a colour token: ${value}`);
  const hex = flatPalette(palettes[scheme]).get(name);
  if (!hex) throw new TypeError(`unknown colour token: --color-${name}`);
  return hex;
}

describe.each(['dark', 'light'] as const)(
  'the Clerk appearance map meets WCAG AA in %s',
  (scheme) => {
    const v = clerkAppearance.variables;
    const linkColor = clerkAppearance.elements?.footerActionLink;

    it.each([
      // 🔴 The pair that shipped at 2.45:1 in light and 4.44:1 in dark. Clerk
      // paints colorPrimaryForeground ON colorPrimary — solid primary buttons,
      // per the Variables doc comment in @clerk/react.
      ['the primary button label on its fill', v.colorPrimaryForeground, v.colorPrimary],
      ['card text on the card', v.colorForeground, v.colorBackground],
      ['muted text on the card', v.colorMutedForeground, v.colorBackground],
      ['field text on the field', v.colorInputForeground, v.colorInput],
      ['error text on the card', v.colorDanger, v.colorBackground],
    ])('%s', (_label, fg, bg) => {
      expect(contrastRatio(resolve(fg, scheme), resolve(bg, scheme))).toBeGreaterThanOrEqual(
        TEXT,
      );
    });

    // 🔴 Two grounds, not one. The card is bg.surface, but the footer action —
    // "Register" / "Log in" — renders *outside* the card on the auth layout's
    // bg.base. Measured in the browser: the shipped link was 3.51:1 on the card
    // and 3.79:1 on the ground. Asserting only the card would miss the worse of
    // the two.
    it.each([
      ['the footer link on the card', 'colorBackground'],
      ['the footer link on the page ground', 'bg-base'],
    ])('%s', (_label, ground) => {
      const bg =
        ground === 'colorBackground'
          ? resolve(v.colorBackground, scheme)
          : palettes[scheme].bg.base;
      expect(linkColor).toBeDefined();
      expect(
        contrastRatio(resolve((linkColor as { color: string }).color, scheme), bg),
      ).toBeGreaterThanOrEqual(TEXT);
    });
  },
);

describe('the P17.T9 corrections stay corrected', () => {
  it('🔴 rejects text.primary as a foreground on accent.fill', () => {
    // 2.45:1 light, 4.44:1 dark — what shipped. If either of these ever passes,
    // somebody has changed a palette and this pair needs re-measuring, not
    // deleting.
    expect(
      contrastRatio(palettes.light.text.primary, palettes.light.accent.fill),
    ).toBeLessThan(TEXT);
    expect(
      contrastRatio(palettes.dark.text.primary, palettes.dark.accent.fill),
    ).toBeLessThan(TEXT);
  });

  it('accent.contrast is the pairing accent.fill was measured for', () => {
    expect(
      contrastRatio(palettes.dark.accent.contrast, palettes.dark.accent.fill),
    ).toBeGreaterThanOrEqual(TEXT); // 5.23
    expect(
      contrastRatio(palettes.light.accent.contrast, palettes.light.accent.fill),
    ).toBeGreaterThanOrEqual(TEXT); // 7.33
  });
});
```

The dark link-on-ground case is already covered by the existing
`rejects carmine fill as dark-mode text` test at the bottom of the file. Leave
it; it states the same fact about the palette rather than about the map.

- [ ] **Step 6: Run it and record the failure**

```bash
npx vitest run theme/contrast.test.ts
```

Expected: FAIL, with these five rows red and these numbers in the output —

| Row | Ratio |
|---|---|
| light › the primary button label on its fill | **2.45** |
| dark › the primary button label on its fill | **4.44** |
| dark › the footer link on the card | **3.51** |
| dark › the footer link on the page ground | **3.79** |
| both › the footer link rows | `linkColor` is `undefined` — `elements` does not exist yet |

🔴 Write the observed numbers into the commit message. This failure against the
unchanged map is the only proof that the test would have caught what shipped;
if the run is green here, the extraction changed a value and Step 4 must be
redone.

🔴 `npm run typecheck` is expected to fail between here and Step 7, on
`elements` not existing on `clerkAppearance` yet — `satisfies Appearance` keeps
the literal's type narrow. Vitest transpiles without typechecking, so the test
still runs and still reports the ratios above. Do not "fix" the type by widening
it; Step 7 adds the property and the error goes away.

- [ ] **Step 7: Fix the map**

In `theme/clerk.ts`, change one variable and add the `elements` block:

```ts
    // 🔴 White, not text.primary. This slot is a pairing with a fill, and
    // text.primary flips with the scheme — near-white in dark, near-black in
    // light, which is how the light "Continue" button reached 2.45:1. White on
    // carmine is 5.23:1 dark and 7.33:1 light, and it is the pairing
    // accent.fill was measured for. `theme/index.ts` already does this for
    // MUI's primary.contrastText; this makes Clerk agree with it.
    colorPrimaryForeground: 'var(--color-accent-contrast)',
```

```ts
  /**
   * 🔴 Clerk has no link colour. `colorPrimary` drives the primary button's
   * fill *and* every link in the card, and carmine as text is 3.79:1 on the
   * ground — the fill-only rule, broken by an API with one variable for two
   * jobs. Re-pointing them by selector is the only way to keep the fill
   * carmine and give the links the token built for carmine text.
   *
   * All four link elements, not just the one the review measured: the review
   * saw `footerActionLink` because that is what the sign-in card shows first,
   * and the other three inherit from exactly the same variable.
   */
  elements: {
    footerActionLink: { color: 'var(--color-accent-text)' },
    formResendCodeLink: { color: 'var(--color-accent-text)' },
    backLink: { color: 'var(--color-accent-text)' },
    footerPagesLink: { color: 'var(--color-accent-text)' },
  },
```

And in `theme/index.ts:38`, retire the literal now that a token says it:

```ts
      primary: { main: p.accent.fill, contrastText: p.accent.contrast },
```

- [ ] **Step 8: Run the tests, then the whole theme suite**

```bash
npx vitest run theme/
```

Expected: PASS. `accent.text` measures 7.63 dark / 7.88 light on the card and
6.12+ on the ground, so every link row clears AA with room.

- [ ] **Step 9: 🔴 Measure it in a real browser, because Playwright cannot**

The e2e harness boots with no Clerk (D84), so this is a hand pass and it is not
optional — the test proves the *mapping*, not that Clerk still reads
`colorPrimaryForeground` for that button.

```bash
npm run db:up
npx next dev -p <your port>     # .env.local supplies the real Clerk keys
```

Visit `/auth/login` and `/auth/register` at 1440px and 390px, in **both**
schemes (toggle via the theme control, or `localStorage.setItem('mui-mode',
'light')` and reload — `InitColorSchemeScript` reads that key). In the console:

```js
const lum = (c) => { const [r,g,b] = c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255)
  .map(x => x <= 0.03928 ? x/12.92 : Math.pow((x+0.055)/1.055, 2.4));
  return 0.2126*r + 0.7152*g + 0.0722*b; };
const ratio = (a,b) => { const l1 = lum(a), l2 = lum(b);
  return ((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)).toFixed(2); };
const bgOf = (el) => { let n = el; while (n) { const c = getComputedStyle(n).backgroundColor;
  if (c && c !== 'rgba(0, 0, 0, 0)') return c; n = n.parentElement; } return 'rgb(255,255,255)'; };
for (const sel of ['.cl-formButtonPrimary', '.cl-footerActionLink']) {
  const el = document.querySelector(sel);
  console.log(sel, getComputedStyle(el).color, bgOf(el), ratio(getComputedStyle(el).color, bgOf(el)));
}
```

Expected: `.cl-formButtonPrimary` reports `rgb(255, 255, 255)` on the carmine
fill at **5.23** (dark) and **7.33** (light); `.cl-footerActionLink` reports
`accent.text` at **7.63**/**6.12** or better.

🔴 Two traps in this measurement. Clerk's social button paints
`color(srgb 1 1 1 / 0.62)` — **alpha**, which the snippet above does not
composite, so it reports a meaningless 1.14. Composite it against its parent
before believing it; it is not a failure. And read the value *after* the card
has finished mounting: Clerk swaps a skeleton in first.

Record the eight numbers (two elements × two pages × two schemes) in the commit
message.

- [ ] **Step 10: Commit**

```bash
npm run lint && npm run typecheck && npm run layering
git add theme/clerk.ts theme/tokens.ts theme/tokens.test.ts theme/contrast.test.ts theme/index.ts app/globals.css app/providers.tsx
git commit -m "P17.T9: carmine goes back to being a fill, and a test says so"
```

The commit message body carries the before/after ratios and the note that
`contrast.test.ts` was run red against the unchanged map first.

---

## Task 10: 🔴 `/films/[tmdbId]` fits a 390px phone

**Files:**
- Modify: `components/PosterCarousel.tsx:100` (the scroll `<section>`)
- Modify: `components/TrailerReel.tsx:124` (the trailer row `<button>`)
- Test: `e2e/films.spec.ts` (new geometry test)

**Interfaces:** none. Both changes are class-only; no prop, type or signature
moves, and `app/(app)/films/[tmdbId]/page.tsx` is **not** edited — which is what
keeps this clear of tranche 3's T13.

**Context an implementer needs.**

The review reported a grid item overrunning its 326px track (352px dark, 398px
light) and the document reaching 430px at a 390px viewport. Measured again on
2026-09-12 against `/films/496243` (Parasite, 77 posters, 32 trailers), 390×844:

| | dark | light |
|---|---|---|
| `document.documentElement.scrollWidth` | 1248 | **1402** |
| each grid child | 1216 | **1370** |
| grid container `clientWidth` | 358 | 358 |

Same defect, larger film. The chain, end to end:

1. `AppShell`'s `<main>` has `p-4`; the page's grid has `px-4`. At 390px that
   leaves the grid container 358px wide and each column **326px** — the track
   width the review named.
2. Below `md` the grid is a single column, so its one track is `1fr`, which is
   `minmax(auto, 1fr)`. The `auto` minimum is the item's **min-content**, so a
   column whose contents refuse to shrink makes the track wider than its
   container, and the overflow escapes to the document.
3. The min-content of every section in the right column, measured by setting
   `width: min-content` on each: About **87**, Credits **100**, League points
   **116**, Trailers **124**, Similar films **53** — and **Posters 1370**.
4. `PosterCarousel`'s strip is `<ul class="flex gap-4">` inside an
   `overflow-x-auto` `<section>`. Each `<li>` is `w-full shrink-0`, so during
   intrinsic sizing its percentage width resolves to nothing and contributes
   zero — but **the 76 gaps do not**. 76 × 16px = **1216**, which is exactly the
   dark figure.
5. Light adds `light:border` to each poster image: 2px × 77 = **154**, and
   1216 + 154 = **1370**. That is the light-versus-dark delta, and at the
   review's film — 23 posters — the same arithmetic gives 2 × 23 = **46px**.
   🔴 So the `light:` variant the review suspected *is* the delta, and it is
   adding box exactly as suspected — but it is only visible at all because the
   carousel leaks its intrinsic width upward. Fixing the leak fixes both
   numbers; removing the light border would fix neither.

Three candidate fixes were measured in the browser, and **all three** return the
columns to 326 and the document to 390:

| Candidate | Result | Verdict |
|---|---|---|
| `min-w-0` on the two column `<div>`s in `page.tsx` | 326 / 390 | **Rejected.** Masks a component defect at the call site, leaves `PosterCarousel` ready to blow out the next layout, and edits the file tranche 3 owns |
| `w-0 min-w-full` on the strip | 326 / 390 | Rejected — works, reads as a riddle at 3am |
| `contain: inline-size` on the strip | 326 / 390 | **Chosen.** One declaration that says the thing that is true: this strip's width never depends on what is inside it |

A second, separate 16px overflow survives that fix and is worth closing in the
same task. `TrailerReel`'s row button is `w-full` with `px-2`, and it renders
**342px inside a 326px `<li>`** — because the button computes
`box-sizing: content-box`, so the 16px of padding lands outside the 100% width.
Setting `box-sizing: border-box` on it returns 342 → 326.

🔴 **That content-box is app-wide and is not this tranche's to fix.** 756 of the
1287 elements inside `<main>` on this page compute `content-box`. MUI's
`CssBaseline` emits `*, *::before, *::after { box-sizing: inherit }` into the
`mui` cascade layer, which sits *above* `base`, where Tailwind preflight's
`box-sizing: border-box` lives. It bites only where a percentage width meets
padding or a border, which is why the app mostly looks fine. Flag it to the
coordinator; fix the one instance that overflows here with `box-border` and
leave the rest alone.

🔴 **jsdom cannot see any of this.** It has no layout: every width is 0, and a
component test asserting a class string would pass just as happily over the
broken version. The proof goes in Playwright, at 390px, in both schemes. This
page has form: `e2e/films.spec.ts`'s own header records that the title was
rendered *behind* the backdrop while every unit test passed.

- [ ] **Step 1: Write the failing e2e test**

Append to `e2e/films.spec.ts`, inside the existing `test.describe('a film page')`:

```ts
  /**
   * 🔴 Geometry, which is why this is here and not in a component test.
   *
   * Below `md` the page is one grid column, and a `1fr` track takes its minimum
   * from the item's min-content. `PosterCarousel`'s strip contributed the sum of
   * its 16px gaps — 76 of them for this film — so the single column measured
   * 1216px inside a 358px container, and light added 2px of poster border per
   * poster on top of that. The document reached 1402px at a 390px viewport.
   *
   * Both schemes, because the failure was 154px worse in light and a dark-only
   * assertion would have called it fixed.
   */
  test('🔴 fits a 390px phone in both schemes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const widths: Record<string, { doc: number; columns: number[] }> = {};

    for (const scheme of ['dark', 'light'] as const) {
      // InitColorSchemeScript reads this key before paint; setting it as an
      // init script means the page never renders in the other scheme first.
      await page.addInitScript(
        (mode) => window.localStorage.setItem('mui-mode', mode),
        scheme,
      );
      await page.goto(`/films/${PARASITE}`);
      await expect(page.getByRole('heading', { name: 'Parasite', level: 1 })).toBeVisible();

      widths[scheme] = await page.evaluate(() => {
        const grid = document.querySelector('main .grid');
        return {
          doc: document.documentElement.scrollWidth,
          columns: [...(grid?.children ?? [])].map((c) =>
            Math.round(c.getBoundingClientRect().width),
          ),
        };
      });

      // The page never scrolls sideways. 390 exactly: one pixel more is the
      // defect, and `<=` would let a 1px regression through as "close enough".
      expect(widths[scheme]?.doc, `${scheme} document width`).toBe(390);

      // Both columns sit inside the 326px the shell's p-4 and the page's px-4
      // leave them.
      for (const width of widths[scheme]?.columns ?? []) {
        expect(width, `${scheme} column width`).toBeLessThanOrEqual(326);
      }
    }

    // 🔴 The light-versus-dark delta itself — 46px at the film the review
    // measured, 154px here. A `light:` variant may change colour; it may not
    // change how wide anything is.
    expect(widths.light?.columns).toEqual(widths.dark?.columns);
  });

  /**
   * The trailer rows are `w-full` with horizontal padding, and the button
   * computes `box-sizing: content-box` — so the padding landed outside the 100%
   * and every row rendered 342px inside a 326px list item. Scheme-independent.
   */
  test('🔴 a trailer row fits its list item', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/films/${PARASITE}`);

    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('main li')].filter(
        (li) => li.clientWidth > 100 && li.scrollWidth > li.clientWidth + 1,
      ).length,
    );

    expect(overflow).toBe(0);
  });
```

and beside the existing `LA_LA_LAND` constant at the top of the file:

```ts
/** 77 posters and 32 trailers — the film that made the overflow measurable. */
const PARASITE = '496243';
```

- [ ] **Step 2: Run it and record the failure**

```bash
npm run db:up
npx playwright test e2e/films.spec.ts -g "390px|trailer row"
```

Expected: FAIL. `dark document width` is **1248**, `light document width` is
**1402**, the columns are `[1216, 1216]` and `[1370, 1370]`, and the trailer
overflow count is 32 rather than 0.

🔴 The webServer builds and starts on **port 3000** and `reuseExistingServer` is
on outside CI. If something is already there and it is not yours, stop and sort
that out first — a stale server from another agent will report numbers for code
you did not write.

- [ ] **Step 3: Stop the poster strip contributing its own width**

`components/PosterCarousel.tsx`, on the scroll `<section>`:

```tsx
        className="focus-visible:outline-accent-fill snap-x snap-mandatory overflow-x-auto [contain:inline-size] focus-visible:outline-2"
```

and extend the comment block already above that element:

```tsx
      {/* 🔴 `contain: inline-size` is load-bearing, not an optimisation. The
          strip is `flex gap-4` with one full-width poster per item: the items
          contribute nothing to intrinsic width, but the *gaps* do — 16px × (n-1),
          which for a 77-poster film is 1216px, plus 2px of `light:border` per
          poster on top in light. A `1fr` grid track takes its minimum from its
          item's min-content, so that number became the width of the whole column
          and the page scrolled sideways to 1402px at a 390px viewport. Inline-size
          containment says the one thing that is actually true here: this strip is
          as wide as its parent and never as wide as its contents. Measured in a
          browser; jsdom reports every width as 0 and saw none of it. */}
```

- [ ] **Step 4: Stop the trailer row overflowing its list item**

`components/TrailerReel.tsx`, on `TrailerButton`'s `<button>`:

```tsx
      className="focus-visible:outline-accent-fill hover:bg-bg-raised box-border flex min-h-11 w-full items-center gap-3 px-2 text-left text-sm focus-visible:outline-2"
```

with the reason, because `box-border` looks redundant and the next reader will
delete it:

```tsx
  // 🔴 `box-border` is not redundant. MUI's CssBaseline emits
  // `*, *::before, *::after { box-sizing: inherit }` into the `mui` cascade
  // layer, which sits above `base` where Tailwind preflight's `border-box`
  // lives — and this button computes `content-box` as a result, so `w-full`
  // plus `px-2` rendered 342px inside a 326px list item. The app-wide version
  // of that (756 of 1287 elements inside <main> on this page) is not this
  // task's to fix; this is the one place it overflows.
```

- [ ] **Step 5: Re-run the e2e tests**

```bash
npx playwright test e2e/films.spec.ts
```

Expected: PASS, with both schemes reporting `doc: 390` and `columns: [326, 326]`,
and zero overflowing list items. The whole film spec is run, not just the two new
tests — the poster strip still has to scroll (`the poster strip scrolls`) and the
`<details>` still has to open from the keyboard.

- [ ] **Step 6: The four-width browser pass, both schemes**

The phase gate is 1440 / 1280 / 1024 / 390 in both schemes, and this task is the
one that changes geometry, so walk it by hand as well:

```bash
npx next dev -p <your port>
```

At each width, in each scheme, on `/films/496243` and on a film with no posters
and no trailers (`/films/999999999` 404s — use any recent release from
`/browse`):

```js
({ vw: innerWidth, doc: document.documentElement.scrollWidth,
   cols: [...document.querySelector('main .grid').children].map(c => Math.round(c.getBoundingClientRect().width)),
   spill: [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > innerWidth).length })
```

Expected: `doc === vw` and `spill === 0` at every width in both schemes. Baseline
for the desktop widths, measured before the fix: 1440 already reported
`doc: 1440` and `cols: [528, 528]`, so **the desktop widths must not move at
all** — the overflow is single-column-only, below `md`. A change at 1440, 1280 or
1024 means `contain: inline-size` did something unintended and this step is where
it gets caught.

Record the eight `doc`/`cols` pairs.

- [ ] **Step 7: Commit**

```bash
npm run lint && npm run typecheck && npm run layering && npx vitest run components/PosterCarousel.test.tsx components/TrailerReel.test.tsx
git add components/PosterCarousel.tsx components/TrailerReel.tsx e2e/films.spec.ts
git commit -m "P17.T10: the film page stops being 1402px wide on a phone"
```

Body: the before/after widths, the note that the light delta was 2px of poster
border per poster amplified by the carousel's leaked min-content, and the
app-wide `box-sizing` finding handed to the coordinator.

---

## Task 8: The accessibility batch

**Files:**
- Modify: `components/BrowseMonth.tsx:59-72`
- Modify: `components/BrowseMonth.test.tsx`
- Modify: `components/ThemeToggle.tsx:26-34`
- Modify: `components/NavRail.tsx:88-97`
- Modify: `components/Panel.tsx`
- Modify: `components/AppShell.tsx` (🔴 last — see the dependency below)
- Modify: `components/AppShell.test.tsx`
- Modify: `e2e/nav.spec.ts`

**Interfaces:**
- `Panel` gains two optional pass-throughs: `id?: string` and
  `tabIndex?: number`. Everything else about its signature — `children`, `as`,
  `tone`, `className` — is unchanged, and no class it emits changes.
- Nothing else in this task changes an interface.

**Context an implementer needs.**

Four items, three of them one-line, and one of them is not the defect the review
described. Take them in this order; the last is the only one that collides with
another tranche.

**(a) Seventeen links that announce nothing.** `/browse` renders two links per
film to the same href: the poster wrapper, whose only content is an `alt=""`
image, and the title below it. Counted in a browser on 2026-09-12: 54 links on
the page, **17 of them unnamed**, all of them `BrowseMonth`'s poster wrapper.
For a screen-reader reader that is seventeen "link" announcements with nothing
after them, and for a keyboard reader it is seventeen wasted stops before the
second link on the same film. `aria-hidden="true"` plus `tabindex="-1"` removes
both without removing the click target, which is the whole point — the poster is
still the obvious thing to press with a mouse or a thumb. 🔴 The `tabindex`
is not optional garnish: `aria-hidden` on a *focusable* element is itself a
violation (axe `aria-hidden-focus`), so the two attributes only make sense
together. `BrowseMonth.tsx` is the only place in the app with this shape —
`PosterFrame`'s callers wrap the caption too, so their links are named.

**(b) The theme toggle has no focus ring of its own.** Measured: `outline-style:
auto`, `outline-color: rgb(0, 95, 204)` — Chrome's default ring, on a warm-paper
and violet-black palette where every other control in the same strip carries
`focus-visible:outline-accent-fill focus-visible:outline-2`. Same component
renders in `MoreSheet`, so one fix covers both. While there, check its height:
it is `px-3 py-1` with no `min-h-11`, and the Global Constraints require ≥44px.

**(c) 🔴 The sidebar focus ring is not broken, and the review's diagnosis is
wrong.** Measured on all seven rail links, both schemes:

| | at `focus()` | 500ms later |
|---|---|---|
| light | `rgb(92, 85, 102)` (= `text.secondary`, i.e. `currentColor`) | `rgb(155, 47, 60)` = `accent.fill` ✅ |
| dark | `rgb(92, 85, 102)` | `rgb(192, 61, 78)` = `accent.fill` ✅ |

`focus-visible:outline-accent-fill` resolves correctly. What the review caught is
the *first frame* of a 150ms transition: the rail link carries
`transition-colors`, which in Tailwind 4 expands to `color, background-color,
border-color, outline-color, text-decoration-color, fill, stroke` — including
`outline-color` — so the ring animates from `currentColor` to carmine. The
fingerprint is conclusive: the wordmark link in the same rail has the identical
`focus-visible:outline-accent-fill focus-visible:outline-2` pair and **no**
`transition-colors`, and it measured `accent.fill` at frame zero.

So there is no token bug and nothing to fix in `tokens.ts` or `globals.css`.
There is a real, smaller residue: for 150ms after every Tab the ring is grey
rather than carmine. Narrowing the transition to the two properties that actually
need to animate makes the ring correct from frame one and costs one class.

🔴 **Flagged, not silently resolved.** If the coordinator would rather drop this
item than change a transition, drop it — the ring is compliant either way, and
the step below is self-contained.

**(d) The skip link.** There is none. The first focusable element on every page
is the strip's search button, so a keyboard reader Tabs through up to eleven
chrome controls before reaching content on every navigation.

🔴 **This is the step that collides.** Tranche 1's **T2** is rewriting
`AppShell.tsx` — separating the rail's breakpoint from the strip's, closing the
1024–1280px dead zone, and folding identity, search and sign-in into the tab-bar
row. Do not plan against the structure below without re-reading the file. What
the step needs is structural, not positional: the skip link must be **the first
child of whatever element `AppShell` returns**, and `<main>` must be its target.
That holds whether the shell is today's `xl:flex` wrapper or T2's rewrite. The
`AppShell.test.tsx` assertion added here is the handoff — if T2 lands afterwards
and loses the link, that test fails in T2's own run rather than in production.

- [ ] **Step 1: Write the failing browse test**

Add to `components/BrowseMonth.test.tsx`:

```tsx
  it('🔴 the poster wrapper is not a second, nameless stop', () => {
    // Two links per film point at the same page and only one of them says
    // where it goes. Measured on /browse: 17 of 54 links announced nothing.
    render(<BrowseMonth month={month} isSignedIn={false} />);

    const named = screen.getAllByRole('link');
    expect(named).toHaveLength(1);
    expect(named[0]).toHaveAccessibleName('The Matrix');
  });

  it('the poster is still reachable by mouse and still shows the image', () => {
    // Hidden from assistive tech and from Tab, not from the page: the poster
    // is the obvious thing to press with a thumb.
    const { container } = render(<BrowseMonth month={month} isSignedIn={false} />);
    const poster = container.querySelector('a[aria-hidden="true"]');

    expect(poster).toHaveAttribute('href', '/films/603');
    // aria-hidden on a focusable element is itself a violation; the two
    // attributes only make sense together.
    expect(poster).toHaveAttribute('tabindex', '-1');
    expect(poster?.querySelector('img')).not.toBeNull();
  });
```

- [ ] **Step 2: Run it, watch it fail**

```bash
npx vitest run components/BrowseMonth.test.tsx
```

Expected: FAIL — `getAllByRole('link')` returns 2, and no element matches
`a[aria-hidden="true"]`.

- [ ] **Step 3: Take the poster wrapper out of the tab order**

`components/BrowseMonth.tsx`, on the poster `<Link>`:

```tsx
              <Link
                href={`/films/${film.tmdbId}`}
                // 🔴 The same href as the title below it, and nothing to
                // announce — an `alt=""` poster inside a link is a link with no
                // accessible name. Measured on /browse: 17 of 54 links. Hidden
                // from assistive tech and from Tab, still pressable with a
                // mouse or a thumb. `tabindex` is not optional: aria-hidden on
                // a focusable element is its own violation.
                aria-hidden="true"
                tabIndex={-1}
                className="focus-visible:outline-accent-fill group relative block aspect-[2/3] focus-visible:outline-2"
              >
```

Leave `focus-visible:outline-*` in place — it costs nothing, and it is correct
again the moment somebody gives this link a name.

- [ ] **Step 4: Run the test**

```bash
npx vitest run components/BrowseMonth.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Give the theme toggle the product's focus ring**

`components/ThemeToggle.tsx`:

```tsx
      className="text-text-secondary hover:text-text-primary focus-visible:outline-accent-fill rounded-sm flex min-h-11 min-w-24 items-center justify-center px-3 py-1 text-sm focus-visible:outline-2"
```

and add to the docblock:

```tsx
 * 🔴 The focus ring is explicit because without it this control fell back to
 * Chrome's default — measured `outline-style: auto`, `rgb(0, 95, 204)` — on a
 * palette where every neighbouring control in the same strip draws a 2px
 * carmine outline. `min-h-11` is the 44px target the same strip's buttons
 * already carry; this one rendered at 28px, which matters most in `MoreSheet`,
 * where it is pressed with a thumb.
```

🔴 `min-h-11` changes this control's height in both `AppShell`'s strip and
`MoreSheet`. The strip is tranche 1's (T2). Measure the strip at 1440px before
and after; if the 52px strip visibly reflows, keep the `min-h-11` (the
constraint is not negotiable) and say so in the commit message so T2's author
sees it coming.

- [ ] **Step 6: Stop the rail's focus ring fading in from grey**

`components/NavRail.tsx`, in `Group`'s `cn(...)` — one class:

```tsx
                  'focus-visible:outline-accent-fill flex min-h-11 items-center gap-3 rounded-sm px-2 text-sm transition-[color,background-color] focus-visible:outline-2',
```

with the reason, because `transition-colors` is the obvious thing to write back:

```tsx
              // 🔴 `transition-[color,background-color]`, not `transition-colors`.
              // Tailwind 4 expands `transition-colors` to include `outline-color`,
              // so the focus ring animated from `currentColor` to carmine over
              // 150ms and every Tab showed a grey ring first. Measured: the rail
              // links read `rgb(92, 85, 102)` at focus and `accent.fill` 500ms
              // later, while the wordmark link above — same focus classes, no
              // transition — read `accent.fill` immediately. The token was always
              // correct; only the ring's first frame was wrong.
```

- [ ] **Step 7: Write the failing e2e focus test**

jsdom has no computed `outline-color` worth reading and no notion of a
transition, so this one goes in Playwright. Add to `e2e/nav.spec.ts`:

```ts
  /**
   * 🔴 Focus rings, measured after they settle.
   *
   * Both halves of this failed for different reasons: the theme toggle drew
   * Chrome's default ring because it declared none, and the rail links drew a
   * grey one for the first 150ms because `transition-colors` animates
   * `outline-color`. Neither is visible to jsdom, and reading the computed
   * style in the same frame as `focus()` reports the transition's start value —
   * which is how the ring was first misdiagnosed as a broken token.
   */
  test('🔴 every focus ring is the product’s own', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/browse');

    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-accent-fill').trim(),
    );

    const settled = async (locator: ReturnType<typeof page.locator>) => {
      await locator.focus();
      // Longer than the 150ms motion budget, so the transition has finished.
      await page.waitForTimeout(300);
      return locator.evaluate((el) => {
        const style = getComputedStyle(el);
        return { color: style.outlineColor, style: style.outlineStyle, width: style.outlineWidth };
      });
    };

    const railLink = page.getByRole('navigation', { name: 'Main' }).getByRole('link', {
      name: 'Award shows',
    });
    const ring = await settled(railLink);
    expect(ring.style).toBe('solid'); // not 'auto', which is the browser's
    expect(ring.width).toBe('2px');
    expect(toHex(ring.color)).toBe(accent);

    const toggleRing = await settled(page.getByRole('button', { name: /switch to .* theme/i }));
    expect(toggleRing.style).toBe('solid');
    expect(toggleRing.width).toBe('2px');
    expect(toHex(toggleRing.color)).toBe(accent);
  });
```

with this helper beside the other module-level helpers in the file:

```ts
/** `rgb(192, 61, 78)` → `#c03d4e`, so a computed colour can be compared to a token. */
function toHex(rgb: string): string {
  const parts = rgb.match(/\d+/g)?.slice(0, 3) ?? [];
  return `#${parts.map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
}
```

- [ ] **Step 8: Run it**

```bash
npx playwright test e2e/nav.spec.ts -g "focus ring"
```

Expected: PASS for the rail link (Steps 6's fix), PASS for the toggle (Step 5's
fix). Run it once with Step 5 and Step 6 reverted to confirm it can fail: the
toggle reports `style: 'auto'`, `width: '1px'`, `#005fcc`. The rail link will
*pass* even reverted — that is the honest situation, and it is why Step 6 is
flagged rather than asserted at frame zero.

- [ ] **Step 9: 🔴 The skip link — re-read `AppShell.tsx` first**

Tranche 1's T2 may have rewritten this file since this plan was written. Open it,
find the element `AppShell` returns, and put the link **first inside it**,
whatever its classes now are.

`components/Panel.tsx` — two optional pass-throughs, no class change:

```tsx
export function Panel({
  children,
  as: Tag = 'div' as ElementType,
  tone = 'surface',
  className,
  id,
  tabIndex,
}: {
  children: ReactNode;
  as?: ElementType;
  tone?: 'surface' | 'raised';
  className?: string;
  /** For the shell's skip-link target; `<main>` is the only caller that needs it. */
  id?: string;
  /** `-1` makes a non-interactive landmark focusable by script, never by Tab. */
  tabIndex?: number;
}) {
  return (
    <Tag
      id={id}
      tabIndex={tabIndex}
      className={cn(
        'rounded-md',
        tone === 'raised' ? 'bg-bg-raised' : 'bg-bg-surface',
        className,
      )}
    >
```

`components/AppShell.tsx` — first child of the returned element:

```tsx
      {/* 🔴 First focusable element on every page, by DOM order rather than by
          styling — a skip link that is not first is not a skip link. Visible
          only when focused: `sr-only` until `focus:not-sr-only` brings it back.
          Before this, a keyboard reader crossed up to eleven chrome controls to
          reach the content on every single navigation.

          Anchored to "first child of the shell", not to a line: P17.T2 moves the
          strip's contents into the tab bar row, and this has to survive that. */}
      <a
        href="#content"
        className="focus:bg-bg-raised focus:text-text-primary focus:outline-accent-fill sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:flex focus:min-h-11 focus:items-center focus:rounded-sm focus:px-4 focus:text-sm focus:outline-2"
      >
        Skip to content
      </a>
```

and on the content panel:

```tsx
        <Panel
          as="main"
          id="content"
          // 🔴 Without this the fragment target is not focusable, so the browser
          // moves the *sequential focus navigation starting point* but not focus
          // itself — which means a screen reader keeps reading from the chrome.
          // -1 keeps it out of Tab; only the skip link ever lands here.
          tabIndex={-1}
          className="min-w-0 flex-1 p-4 pb-[calc(4rem+env(safe-area-inset-bottom))] xl:p-6"
        >
```

- [ ] **Step 10: Write the shell test**

Add to `components/AppShell.test.tsx`:

```tsx
  it('🔴 the skip link is the first focusable element, and it points at <main>', () => {
    // Structural, not positional: whatever P17.T2 does to the shell's layout,
    // this link has to stay first in DOM order and `<main>` has to stay its
    // target. If this goes red in someone else's task, that is this test
    // working.
    const { container } = render(
      <AppShell isSignedIn={false}>
        <p>Board</p>
      </AppShell>,
    );

    const focusable = container.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];

    expect(first).toHaveAccessibleName('Skip to content');
    expect(first).toHaveAttribute('href', '#content');

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'content');
    // Focusable by script so focus actually moves, never by Tab.
    expect(main).toHaveAttribute('tabindex', '-1');
  });
```

- [ ] **Step 11: Run the component tests**

```bash
npx vitest run components/AppShell.test.tsx components/BrowseMonth.test.tsx components/Panel.test.tsx components/NavRail.test.tsx
```

Expected: PASS. `Panel.test.tsx` should be unaffected — the two new props are
optional and no class changed; if it fails, something in the `cn(...)` call moved
and needs putting back.

- [ ] **Step 12: Walk it with the keyboard, at four widths, in both schemes**

```bash
npx next dev -p <your port>
```

On `/browse` and on `/`, at 1440 / 1280 / 1024 / 390, in both schemes:

1. Reload, press **Tab once** — "Skip to content" appears, on the app's own
   surface, with a carmine ring, and its target is at least 44px tall.
2. Press **Enter** — focus lands on `<main>`; the next Tab goes to a control
   inside the content, not back into the chrome.
3. Hold **Tab** across `/browse` — count the stops between the header and the
   first film title. Before: 17 nameless stops. After: none. A quick count from
   the console:

```js
[...document.querySelectorAll('a[href]')].filter(a =>
  !(a.getAttribute('aria-label') || a.textContent || '').trim()).length
```

   Expected: **0** (it was 17).
4. Tab to the theme toggle — a 2px carmine ring, not a blue one — and to a rail
   link at 1440, where the ring is carmine on the first painted frame.

- [ ] **Step 13: Commit**

```bash
npm run lint && npm run typecheck && npm run layering && npm run test
git add components/BrowseMonth.tsx components/BrowseMonth.test.tsx components/ThemeToggle.tsx components/NavRail.tsx components/Panel.tsx components/AppShell.tsx components/AppShell.test.tsx e2e/nav.spec.ts
git commit -m "P17.T8: a keyboard reader can reach the page"
```

🔴 The body must record two things for the coordinator: that `Panel`'s signature
gained `id`/`tabIndex` while its classes did not change (so T22's rename diff
stays readable), and that the sidebar focus-ring finding was a measurement
artifact — the token was always right, and what changed was the transition's
scope.

---

## Tranche gate

Before this tranche is handed back:

```bash
npm run verify          # lint, typecheck, layering, both test suites, build
npm run test:e2e        # on a server you started, on port 3000
```

Then the browser pass the phase gate requires — **1440, 1280, 1024 and 390, in
both schemes** — over `/browse`, `/films/496243`, and `/auth/login` with real
Clerk keys, confirming:

| | Expected |
|---|---|
| `/browse` unnamed links | 0 (was 17) |
| First Tab on any page | "Skip to content" |
| Rail link focus ring | `accent.fill`, 2px solid, from frame one |
| Theme toggle focus ring | `accent.fill`, 2px solid (was Chrome's `auto` blue) |
| `/films/496243` document width at 390px | 390 in both schemes (was 1248 / 1402) |
| `/films/496243` column widths at 390px | `[326, 326]`, identical in both schemes |
| Clerk "Continue" | ≥ 5.23:1 (was 2.45 light / 4.44 dark) |
| Clerk "Register" | ≥ 6.12:1 (was 3.79 dark) |

Report the numbers to the coordinator rather than ticking `docs/PROGRESS.md` —
the tranches are being indexed centrally.

**Carried forward, not fixed here:**

- 🔴 **App-wide `box-sizing: content-box`.** 756 of 1287 elements inside `<main>`
  on the film page compute `content-box`, because MUI's `CssBaseline` emits
  `*, *::before, *::after { box-sizing: inherit }` into the `mui` cascade layer,
  which sits above `base` where Tailwind preflight's `border-box` lives. It bites
  wherever a percentage width meets padding or a border. This belongs with D29
  and the three pinned cascade-layer assertions in `e2e/smoke.spec.ts`, and it
  may explain findings in other tranches (T30's invite URL wrapping at 390px,
  T36's three left edges). Not touched here beyond the single element in
  `TrailerReel` that overflows.
- The review's sidebar focus-ring item, as written, describes a defect that does
  not exist; see Task 8 (c). The coordinator decides whether the transition
  narrowing stays.

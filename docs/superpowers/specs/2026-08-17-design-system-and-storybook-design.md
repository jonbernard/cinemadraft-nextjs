# Design system refinement + Storybook — Design

**Date:** 2026-08-17
**Status:** approved by the owner in conversation; supersedes parts of §6 of
[`2026-08-13-cinemadraft-nextjs-conversion-design.md`](2026-08-13-cinemadraft-nextjs-conversion-design.md)

---

## 1. Why this exists

The owner's report was that the app reads "too techy/nerdy", naming three things:
the all-caps headings, the squared-off buttons, and the desktop top navigation.

The running app was measured at 1440px across `/`, `/browse`, `/films/313369`
and `/leagues/1` before anything was proposed. Five faults were found, and only
two of them are the ones named:

1. **Everything is a hairline table.** Radius 2px, no elevation, 1px
   `#2A2F38` borders on all four sides of every card, and section headers
   rendered as `border-y` rules. Flat + hairline + uniform grey boxes is the
   monitoring-dashboard signature. This is the largest offender and it is
   structural, not typographic.
2. **Mono carries labels, not just data.** `SEAT 01 02 03`, `07/2026`,
   `Jan 11`, `Season 2026`, `620 ▸`, `unclaimed`. §6.5 scopes mono to *data
   columns*; it leaked into chrome. `07/2026` where a person would write
   "July 2026" is the single most terminal-flavoured string in the product.
3. **All-caps at small sizes.** `LetterboxRule` renders every section header as
   14px bold uppercase Archivo Expanded. At that size the width axis does not
   read as a film credit block — it reads as a legend key.
4. **Squared buttons.** `shape.borderRadius: 2` plus bordered-not-filled
   secondary buttons. The browse page's "The past / The future" pair reads as a
   developer-tools segmented control.
5. **Redundancy and dead space.** The wordmark appears twice on every page (nav
   and page `h1`). Page titles restate the nav item — a `BROWSE` heading under a
   "Browse" tab. Browse spends a 180px left gutter on a date chip. Home is ~60%
   empty below the fold.

What already works and must survive: the film page's banner with its gradient
scrim, posters carrying the league board, warm off-white on near-black, and
tabular figures in the real point columns.

### 1.1 Research basis

🔴 **Full findings, with per-site measurements and source links, are in
[`../../reference/2026-08-17-design-research.md`](../../reference/2026-08-17-design-research.md).**
That document also holds the Storybook/Vercel/Turborepo investigation behind §7.
This section is a summary; the reference doc is the evidence.

Ten products were measured live from their own CSS and `getComputedStyle` on
2026-08-17 — Letterboxd, MUBI, The Criterion Channel, A24, Apple TV, Sleeper,
Underdog, DraftKings, Are.na and the Spotify web player. Findings that drive
decisions below are cited inline. The four load-bearing ones:

- **Criterion sets 64px headings mixed case at −0.04em tracking** and confines
  uppercase to 16px eyebrows at +0.075em. A dark, formal, awards-adjacent film
  product gets *more* gravity from mixed case, not less.
- **Sleeper's ground is `#05091D`** — a hue-shifted navy at the same luminance
  as a neutral near-black. That hue shift alone stops a dense stats UI reading
  as a terminal. This is the highest-leverage single change available.
- **Letterboxd gives posters a proportional radius**,
  `clamp(2px, 2.667%, 8px)`, so a chip and a hero poster are tuned rather than
  tokenised.
- **Spotify's desktop shell is floating panels on black** — a `#121212` rail at
  8px radius on a pure-black ground — which is why a dense list UI reads as a
  media player rather than an admin console.

And the negative control: **Sleeper and Underdog both use Druk Wide**, expanded
uppercase. That is now the fantasy-sports uniform, and it is the same gesture
the owner rejected. Adopting it would make cinemadraft look like a sportsbook.

---

## 2. Decisions

Proposed for `docs/DECISIONS.md` as **D67–D76**.

| # | Decision |
|---|---|
| D67 | Visual direction is **Screening Room**: floating rail + slim strip + content panel on a hue-shifted dark ground. Supersedes the top-bar layout of §6.9 |
| D68 | The ground is **violet-warm, not neutral**. Hue shift at matched luminance is the primary anti-"developer tool" signal |
| D69 | **Two accents with separate jobs** — brass for awards (nomination, win, seal, eyebrow), carmine for urgency (deadline, live, on the clock, destructive). One red doing both is why a winner and a countdown currently look identical |
| D70 | **Serif for proper nouns only.** Instrument Serif renders things that have names — films, members, leagues. Every structural label is Archivo. The rule is semantic, so no pixel threshold has to be remembered |
| D71 | **Archivo stays** as the UI face; its `wdth` axis is retired. Instrument Serif and Newsreader are added; IBM Plex Mono is scoped to numerals only |
| D72 | **Elevation is a surface-value step**, never a hairline border. Cards lose their four-sided borders |
| D73 | Radius scale is **3 / 6 / 10 / 16 / pill**; posters use a proportional `clamp()` rather than a token. Buttons are 6px — never 0, never pill |
| D74 | **`LetterboxRule` is retired as a section header**, replaced by a brass eyebrow plus a serif or sans heading. The 2.39:1 frame is kept as a layout unit. Partially supersedes §6.1 |
| D75 | Mobile navigation becomes a **bottom tab bar of the four primary destinations plus a More sheet** carrying the three under "Yours". Replaces the `<dialog>` drawer |
| D76 | **Storybook is the design-system gate**, replacing the `/tokens` page. Single package — no monorepo, no Turborepo — deployed as a second Vercel project |

### 2.1 Explicitly rejected

- **Turborepo / npm workspaces.** Remote caching is free on Hobby, so cost is
  not the objection. Turborepo's product is task-graph parallelism across many
  packages, and Hobby allows **1 concurrent deployment** — the parallelism
  cannot be spent. Against that sit real migration costs: Prisma's `postinstall`
  resolving against a hoisted root, Playwright's `testDir`/`webServer.cwd`/
  snapshot paths, Docker Compose's build context, and Tailwind 4 not crawling
  `node_modules` (so a future `packages/ui` needs explicit `@source`). Revisit
  **npm workspaces alone** if double-building becomes painful — workspaces are
  the prerequisite for Vercel's native skip-unaffected. Turborepo earns its keep
  at a third package.
- **Vercel microfrontends.** Free-tier accessible (2 projects, 50K routing
  requests) but its purpose is many projects under *one domain with path
  routing*. Storybook wants its own URL.
- **Fraunces** as the display face. It has the full weight range and needs no
  fallback rule, but the owner chose Instrument Serif. D70's semantic rule makes
  the weight range unnecessary: names are never set below 15px.
- **Instrument Sans** replacing Archivo. Considered and measured. Its uppercase
  is 5–6% narrower, which would pay off on every eyebrow, and it shares
  Instrument Serif's proportions. Rejected because Archivo is already installed,
  already tested, and has a larger x-height (53 vs 51 per 100px em) which is
  worth real legibility at 11–13px. An earlier claim that Instrument Sans is
  narrower at body sizes was **wrong** — measured, it is 1–3% *wider*.
- **`@storybook/addon-vitest`**, `addon-themes`, `storybook-design-token`. See
  §7.3 and §7.4.
- **2026-generic defaults**, named so they are not reached for later:
  `#0A0A0A`/`#171717` plus one violet accent plus Inter plus 8px radius (the
  shadcn default look); glassmorphism; bento grids; aurora gradient blobs;
  expanded-caps display faces; neon glow accents; 16–24px radius on table rows;
  mono as a data affectation; dark-mode-only.

---

## 3. Foundations

### 3.1 Palette

Every value below was computed with `theme/contrast.ts`'s own algorithm before
being written here, against **all three grounds**, and the number shown is the
**worst case**. Four candidate values failed on the first pass and were
replaced; those are noted.

**Dark (default)**

| Token | Hex | Worst-case ratio | Use |
|---|---|---|---|
| `bg.void` | `#0A0910` | — | Page ground, behind the floating panels |
| `bg.panel` | `#16131C` | 1.08 vs void | Rail, strip, content panel |
| `bg.raised` | `#211C29` | 1.10 vs panel | Inputs, hover, wells, active rail item |
| `border.rule` | `#302938` | — | Dividers and table rules only — not card outlines |
| `text.primary` | `#EFECE9` | 14.13 | Body |
| `text.secondary` | `#A8A1B2` | 6.66 | Secondary copy |
| `text.dim` | `#8C8598` | **4.69** | Small labels. First pass `#7E7789` failed at 3.87 on raised |
| `accent.fill` | `#C03D4E` | 5.23 with white | Carmine fills, bars, on-clock outline |
| `accent.text` | `#E78E99` | 6.91 | Carmine as text or icon |
| `brass.fill` | `#CFA93A` | 7.55 with ink `#241C05` | Winner seal, brass button |
| `brass.text` | `#CFA93A` | 7.44 | Eyebrows, award metadata |
| `score.high` | `#63C08A` | 7.47 | Critic score band |
| `score.mid` | `#D6A64A` | 7.45 | Critic score band |
| `score.low` | `#E06C74` | 5.20 | Critic score band |

**Light**

| Token | Hex | Worst-case ratio | Use |
|---|---|---|---|
| `bg.void` | `#EFEAE2` | — | Page ground — warm paper |
| `bg.panel` | `#FBF9F6` | 1.14 vs void | Panels |
| `bg.raised` | `#E7E1D7` | 1.24 vs panel | Inputs, hover |
| `border.rule` | `#D5CDC0` | — | Dividers |
| `text.primary` | `#1A151F` | 13.79 | Body |
| `text.secondary` | `#5C5566` | 5.48 | Secondary copy |
| `text.dim` | `#665E70` | **4.75** | First pass `#6B6375` failed at 4.40 on raised |
| `accent.fill` | `#9B2F3C` | 7.33 with white | Carmine fills |
| `accent.text` | `#8E2A36` | 6.37 | Carmine as text |
| `brass.fill` | `#7A5A12` | 6.37 **with white** | Winner seal |
| `brass.text` | `#7A5A12` | 4.90 | Eyebrows |
| `score.high` | `#1F6B41` | 4.99 | Critic score band |
| `score.mid` | `#7A5410` | 5.20 | Critic score band |
| `score.low` | `#8C2F39` | 6.26 | Critic score band |

🔴 **`brass` needs the same fill/text split `accent` already has, and its
`contrastText` differs per scheme** — dark ink `#241C05` on the dark theme's
bright brass (7.55), white on the light theme's dark brass (6.37). Dark ink on
light brass is 2.65 and fails. This is a token pair, not a component branch, so
D15's "no component branches on theme" holds.

`beam` (`#7FA6B8` dark / `#3F6273` light) is retained unchanged from §6.2–6.3
for informational states.

**Elevation.** The panel-to-void and raised-to-panel steps are ~1.1:1 — far
below any contrast threshold, which is correct and intentional. They separate
surfaces, they do not carry information. Anything that carries information needs
text, an icon or a border, per §6.7's one-signal-per-fact rule.

### 3.2 Typography

| Role | Face | Setting | Applies to |
|---|---|---|---|
| Names | **Instrument Serif** 400 | −0.015em, mixed case | Film titles, member names, league names, page `h1` |
| Structure | **Archivo** 600 | −0.01em, mixed case, normal width | Section headings, labels, buttons, nav |
| Eyebrow | **Archivo** 700 | 11px, `+0.085em`, uppercase | The only surviving uppercase |
| Prose | **Newsreader** 400 | 15.5–17px, 1.55 line-height | Synopses, ledes, explanatory copy |
| Numerals | **IBM Plex Mono** 500 | `tabular-nums` | Digits only — never labels |

**Tracking is negative and scales with size**: −0.02em at 24–32px, −0.03em at
40–56px, −0.04em above 64px. Never positive on a heading. This inversion — big
type gets *tighter*, not wider — is the single typographic move that separates
editorial from techy, and it is the direct opposite of the retired `wdth` axis.

**Instrument Serif ships one weight (400) plus italic.** D70's semantic rule is
what makes that safe: names are never set below 15px, so the face never has to
signal "heading" at a size where 400 cannot. If a name ever needs to be set
below 15px, it renders in Archivo — that is the one exception and it belongs in
the styleguide as an explicit note.

**Font loading.** Four families, all via `next/font/google` with
`display: swap`. Archivo drops its `axes: ['wdth']` request, which removes the
width axis from the payload. Instrument Serif is ~14KB. Newsreader is variable.
The `--font-plex-mono` naming workaround stays exactly as-is — it exists because
`--font-mono` is Tailwind's own theme key and self-reference silently voids the
family.

### 3.3 Shape

```
--r-xs: 3px    chips, tags, badges
--r-sm: 6px    buttons, inputs, row hover
--r-md: 10px   cards, panels, modals, the rail
--r-lg: 16px   hero and feature containers only
--r-pill: 999px  status and filter chips ONLY — never a button
```

**Posters use a rule, not a token:** `border-radius: clamp(4px, 2.8%, 12px)`.
Percentage radius resolves against the element's own box, so a 40px thumbnail
gets ~4px and a hero poster ~12px from one declaration.

MUI's `shape.borderRadius` moves from `2` to `6` — the button default.

### 3.4 Motion

The §6.8 budget is unchanged and re-affirmed: 150ms/200ms, ease-out on enter,
`prefers-reduced-motion` respected globally via the `MuiCssBaseline` override
already in place. The winner seal remains the single orchestrated exception.

One addition: **exit transitions run at ~65% of their enter duration**, which is
what makes a dismissal feel responsive rather than sluggish.

### 3.5 Iconography

Inline SVG stays — `lib/nav/links.ts`'s reasoning holds and now extends to the
whole system: `currentColor` inherits state for free, and a handful of glyphs do
not justify a dependency. Stroke width is standardised at **1.6** (the nav
currently mixes 1.5 and 2). Every glyph is `aria-hidden` with a text label
beside it. No emoji, ever.

---

## 4. The shell

`components/AppShell.tsx` replaces `AppNav.tsx`.

### 4.1 Desktop (≥1100px)

```
┌ void ────────────────────────────────────────────────┐
│ ┌ rail 236 ─┐ ┌ strip 52 ──────────────────────────┐ │
│ │ wordmark  │ │ search · create · countdown · you  │ │
│ │           │ └────────────────────────────────────┘ │
│ │ Home      │ ┌ content panel ─────────────────────┐ │
│ │ Leagues ◀ │ │ eyebrow                            │ │
│ │ Browse    │ │ Name (serif 46)                    │ │
│ │ Awards    │ │ lede (Newsreader)                  │ │
│ │           │ │                                    │ │
│ │ YOURS     │ │ Roster →              955 pts      │ │
│ │ Watchlist │ │ [poster shelf]                     │ │
│ │ Draft list│ │                                    │ │
│ │ Rules     │ │                                    │ │
│ └───────────┘ └────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

- Rail: 236px, `bg.panel`, `--r-md`, inset 10px from the void, sticky,
  self-aligned to the top.
- Grouped four + three per D62's seven destinations — all seven remain
  reachable, which is what the owner's override requires, but the eye now gets a
  hierarchy that a flat list of seven cannot provide.
- Active item: `bg.raised` plus a 2px carmine inset shadow on the leading edge,
  plus `aria-current`. Two signals, as §6.7 requires.
- Strip: 52px, carries search, the create action, the live countdown chip and
  the Clerk `UserButton`. Apple TV's is 52px; Letterboxd's 72px is too tall for
  this density.
- Content is a second floating panel at the same radius. This framing is what
  makes the product read as a media player rather than a dashboard.
- Between ~900 and 1100px the rail collapses to a 64px icon strip with
  `title`/`aria-label` on each item.

### 4.2 Mobile (<900px)

- **Bottom tab bar**: Home, Leagues, Browse, Awards, More. Five slots, 44px
  minimum targets, icon plus label — icon-only navigation hurts discoverability
  in an app most members open once a year.
- **More opens a sheet** carrying Watchlist, Draft list, Rules & scoring, and
  the account control. The three demoted destinations are the ones a member
  opens once a season — a draft list before the draft, rules when a score
  surprises them. Two taps is the right price for those; the four used weekly
  stay at one.
- The sheet remains a native `<dialog>`, so the focus trap, `Escape`, the inert
  background and the backdrop stay the platform's job. Only the *presentation*
  changes from a left drawer to a bottom sheet — this is deliberately the
  smallest possible change to working, accessible code.
- Safe-area insets are respected on the tab bar
  (`padding-bottom: env(safe-area-inset-bottom)`).

### 4.3 Section headings

Replacing `LetterboxRule` (D74):

```
eyebrow      SEAT 01 · ROUNDS 1–7        ← Archivo 700, 11px, +0.085em, brass or dim
heading      Roster                       ← Archivo 600, 17px  (structure)
             Sarah Powers                 ← Instrument Serif, 23–46px (a name)
right slot   955 pts                      ← mono, tabular, dim
```

The eyebrow carries **real metadata** — round range, date span, seat count,
show count — where a hairline rule carried nothing. Separation comes from space.
The right-hand slot gives every section a scannable right edge.

---

## 5. Component inventory

### 5.1 New

| Component | Responsibility |
|---|---|
| `AppShell` | Rail, strip, content panel, responsive collapse. Server-resolved auth state as a prop, as `AppNav` already does |
| `NavRail` | Grouped destination list, active state |
| `TabBar` | Mobile bottom tabs |
| `MoreSheet` | Native `<dialog>` bottom sheet |
| `SectionHead` | Eyebrow + heading + right slot. The `LetterboxRule` replacement |
| `Eyebrow` | The one uppercase treatment, brass or dim |
| `Shelf` | Horizontal poster row with a linked heading, scroll-snap, and the existing carousel behaviour |
| `Button` | MUI `Button` wrapper pinning the 6px radius and the two accent roles |
| `StatusChip` | Pill, brass or carmine, award status and live states |
| `Panel` | The floating surface — radius, surface step, inset highlight |
| `CinemaFrame` | The retained 2.39:1 layout unit |

### 5.2 Restyled, behaviour unchanged

All 27 surviving components, enumerated against the tree so none is discovered
mid-sweep:

`PosterFrame` (proportional radius, border only in light, brass seal),
`PointsLedger`, `FilmPointsPanel`, `StandingsPanel`, `RosterStrip`,
`DraftBoard`, `PickCell`, `PickList`, `DraftConsole`, `SeasonRail`,
`SeasonSetup`, `BrowseMonth` (month names, not `MM/YYYY`), `FilmFacts`,
`CreditsPanel`, `RatingChip`, `TrailerReel`, `PosterCarousel`, `WatchedToggle`,
`EmptyState`, `ErrorPanel`, `FilmSearch`, `CategoryAdmin`, `CreateLeagueForm`,
`InviteLink`, `JoinLeagueButton`, `NomineeGrid`, `ThemeToggle`.

`ThemeToggle` additionally **moves** — it belongs in the strip on desktop and in
the More sheet on mobile, rather than wherever the page happens to place it now.

### 5.3 Removed

- `LetterboxRule` — its section-header role is gone (D74). The 2.39:1 frame
  moves to `CinemaFrame`.
- `AppNav` — replaced by `AppShell`.
- `app/(marketing)/tokens/page.tsx` — replaced by the Storybook styleguide
  (D76). Its `layering` no-raw-hex guarantee must be preserved; see §7.5.

---

## 6. The styleguide

A hand-written `Styleguide.mdx` in Storybook, reading live CSS custom
properties so it cannot drift from the tokens. Contents:

**Foundations**
- Palette — every token as a swatch, with its **computed contrast ratio
  printed beside it** and the threshold it must clear. The number is computed at
  render from `theme/contrast.ts`, not typed in.
- Type — the five roles, the tracking-by-size table, and the "names vs
  structure" rule stated as a rule with examples of each.
- Scale — the spacing ramp (4/8-based), the radius scale, the elevation steps.
- Motion — the durations, the easing, the exit-at-65% rule, and a
  reduced-motion demonstration.
- Iconography — the glyph set, stroke width, and the labelling requirement.

**Primitives** — one story per component in §5.1, each with its states
(default, hover, focus-visible, pressed, disabled, loading, error).

**Patterns**
- Shelf with a linked heading.
- Section head, all three variants.
- Empty states — one per surface that can be empty.
- Loading — skeletons, and the >300ms rule.
- Forms — visible labels, error below the field, inline validation on blur.
- Error surfaces.

**Rules** — accessibility (44px targets, focus-visible, contrast, reduced
motion, one-signal-per-fact) and **voice**: log in / log out / register, never
sign in/up/out; active voice; the same verb through a whole flow.

---

## 7. Storybook

### 7.1 Framework

**Storybook 10 (`10.5.8`) with `@storybook/nextjs-vite`.** Both framework
packages support Next 16 (`next: ^14.1 || ^15 || ^16`), and Storybook 10's
release notes name Next 16 and Vitest 4 explicitly. The Vite variant is the
documented default for a project without custom Webpack or Babel config — this
project has neither, since Next 16 uses Turbopack. It is also the only variant
that *could* run the Vitest addon later; the Webpack framework cannot.

Accepted cost: Storybook is bundled by Vite, so it is a second build pipeline
that can diverge from `next dev` on aliases, PostCSS and env handling. This is
unavoidable — the Webpack variant diverges too.

Storybook 10 is **ESM-only**, so every `.storybook/*` file is ESM and every
addon must be ESM.

### 7.2 The five known landmines

1. **`postcss.config.mjs` must use the object form.** Next accepts
   `plugins: ["@tailwindcss/postcss"]`; Vite's `postcss-load-config` rejects it
   with `Invalid PostCSS Plugin found at: plugins[0]`. Storybook closed this as
   not-fixable on their side because Next's shorthand is non-standard. Both
   tools accept `plugins: { "@tailwindcss/postcss": {} }`.
2. **`preview.tsx`, never `preview.ts`.** The `.ts` extension is a documented
   cause of `Cannot read properties of undefined (reading 'className')` with
   `next/font`.
3. **Fonts must reach `<html>` from a decorator.** Storybook never renders the
   root layout, so `var(--font-archivo)` is undefined in stories.
   `theme/fonts.ts` already exports the loaders, so the decorator imports from
   there — calling a `next/font` loader a second time inside `preview.tsx` is a
   reported source of breakage — and applies the variable classes to
   `document.documentElement`, not a wrapper div, because stories render in an
   iframe. Set `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` in CI so a Google Fonts
   hiccup cannot fail the build.
4. **Drive MUI's `setMode()`; do not use `withThemeByDataAttribute`.** MUI
   *owns* `data-mui-color-scheme` — it is `InitColorSchemeScript`'s default
   attribute. An addon writing it directly creates two sources of truth:
   `useColorScheme()` goes stale, `localStorage['mui-mode']` is not updated, and
   MUI can overwrite the attribute on mount. A toolbar global feeding a small
   `SyncMode` component that calls `setMode` keeps one source of truth, and
   Tailwind's `@custom-variant dark` binding then works in Storybook with no
   extra plumbing.
5. **`forceThemeRerender` is required on `ThemeProvider`.** With
   `cssVariables: true`, MUI deliberately does not re-render on a mode switch
   because CSS variables handle it — so any component branching on
   `palette.mode` in JS will not update in the toolbar without it.

Also: `globals.css` must be the **first** import in `preview.tsx`, because
`@layer` order is fixed by first declaration. And Storybook injects its own
preview styles *un-layered*, which outranks every layered rule — so if a story
looks wrong only in Storybook, suspect that first.

Clerk: `@clerk/nextjs` pulls server-only code that breaks stories. Storybook
10's `sb.mock` mocks it per-story rather than rendering a real `ClerkProvider`.

### 7.3 Addons

`addon-essentials` **no longer exists** — Actions, Backgrounds, Controls,
Highlight, Measure & Outline, Toolbars and Viewport ship inside the core
`storybook` package in v10. Installing:

- `@storybook/addon-docs` — autodocs and the MDX styleguide.
- `@storybook/addon-a11y` — axe. Worth it.

Not installing: `addon-themes` (see landmine 4), `addon-vitest` (a third
overlapping test layer on top of RTL and Playwright, requiring browser-mode
Vitest and Playwright binaries in CI — revisit only to pair it with `addon-a11y`
for axe assertions on every story), `storybook-design-token` (it parses
annotation comments in stylesheets, a model that does not fit Tailwind 4's
`@theme` block).

Story reuse in existing Vitest tests, if ever wanted, is `composeStories` from
`@storybook/react` inside the current jsdom setup — no new project.

**There is no Biome equivalent of `eslint-plugin-storybook`** and no port
exists. Accepted: those rules are conveniences, not correctness. ESLint is not
coming back.

### 7.4 Hosting

A **second Vercel project on the same repo**: Root Directory left at the repo
root, Framework Preset `Other`, build `npm run build-storybook`, output
`storybook-static`. Static, so no functions and no runtime cost. Hobby allows 25
projects per repo and 200 projects total.

Accepted costs, both real: Hobby permits **1 concurrent deployment**, so each
push now queues two builds serially (roughly double the wall clock to a green
preview), and two builds consume two of the 100 daily deployments.

🔴 **Blocked on the owner.** The Vercel Git integration is currently
disconnected — the project is flagged `sourceless` with zero webhooks on
`jonbernard/cinemadraft-nextjs` — so no project, first or second, builds until
it is reconnected through Project Settings → Git. Hobby also cannot connect to
repos owned by a Git *organisation*; this repo is personally owned, so that is
satisfied.

### 7.5 Tests

- `theme/contrast.test.ts` — extended to every new pair in both themes,
  including the per-scheme `brass.fill` contrast text. **Must pass before any
  component consumes a new token**, exactly as in Phase 3.
- `theme/tokens.test.ts` — the CSS↔JS drift test. Its parser must cover the new
  token names, and the `brass` split must be asserted in both directions.
- `scripts/layering.sh` — the no-raw-hex check currently scans `components` and
  `app`. It must also scan `.storybook/` and any `*.stories.tsx`, or the
  guarantee the `/tokens` page used to carry is quietly lost when that page is
  deleted.
- Component tests: every restyled component keeps its behavioural assertions.
  Assertions on copy or class names will break by design and are updated, not
  weakened.
- `AppNav.test.tsx` is rewritten as `AppShell.test.tsx` with tab-bar and sheet
  coverage.
- 🔴 **`e2e/nav.spec.ts` must be rewritten, not merely adjusted.** It asserts
  the current structure directly — a `Menu` button hidden at 1280px, a drawer
  opening on a phone, Escape closing it. Under D75 the phone has no `Menu`
  trigger at all and the desktop has no inline top-bar list, so every assertion
  in that file changes. What it proves must survive in the new file: that the
  sheet's `<dialog>` behaviour (Escape, focus trap, inert background) is real,
  since jsdom implements none of it and only a browser can show it.
- E2E: `e2e/smoke.spec.ts` asserts the cascade-layer contract and must keep
  doing so. New coverage for the shell — rail active state at desktop, tab bar
  at a 390px viewport, More sheet open and close by keyboard.
- `data-testid` is the only test handle, stripped in production. Unchanged.

---

## 8. Page sweep

The owner chose to restyle everything now rather than page-by-page as Phase 10
proceeds. Surfaces, in dependency order:

The exact file list, verified against the tree rather than recalled:

1. `app/layout.tsx` and `app/(app)/layout.tsx` + `AppShell` — everything else
   renders inside them.
2. `app/(app)/page.tsx` — home. Also fixes the duplicated wordmark and the
   empty lower fold.
3. `app/(app)/browse/page.tsx` — month names not `MM/YYYY`, the left gutter
   reclaimed, the segmented control restyled.
4. `app/(app)/films/[tmdbId]/page.tsx` — the banner survives; the About table
   loses its right-aligned dim-label spec-sheet look.
5. `app/(app)/leagues/page.tsx`, `leagues/new/page.tsx`,
   `leagues/[id]/page.tsx`, `leagues/[id]/draft/page.tsx`,
   `leagues/[id]/setup/page.tsx` — the core object, five surfaces.
6. `app/(app)/award-shows/page.tsx`, `award-shows/[abbr]/page.tsx`.
7. `app/(app)/join/[uuid]/page.tsx`.
8. `app/auth/layout.tsx`, `auth/login/[[...login]]/page.tsx`,
   `auth/register/[[...register]]/page.tsx` — Clerk appearance config retuned.
9. `app/error.tsx`, `app/(app)/error.tsx`, and `app/global-error.tsx` — the
   last is the one file allowed raw hex, since it renders without the token
   layer, so its palette is updated by hand.

**Not in the sweep:** `app/(app)/live/[abbr]` holds only a `.gitkeep` — the page
is still owed and is deferred to phase 14 by D23, so there is nothing to
restyle. `app/(marketing)/tokens/page.tsx` is deleted, not restyled (§5.3).

---

## 9. Phases and gates

| Phase | Deliverable | Gate |
|---|---|---|
| **1** | Storybook stands up: framework, PostCSS fix, font decorator, MUI mode wiring, a11y addon | `npm run build-storybook` succeeds; one existing component renders in both themes with correct fonts |
| **2** | Foundations: tokens, both palettes, type scale, radius, elevation, motion; `contrast.test.ts` and `tokens.test.ts` extended; `Styleguide.mdx` foundations | Every pair passes its threshold; drift test green; styleguide renders every token with its live ratio |
| **3** | Primitives from §5.1, each with stories and states | a11y addon clean on every primitive story; unit tests green |
| **4** | `AppShell`, `NavRail`, `TabBar`, `MoreSheet`; `AppNav` deleted | Keyboard-only navigation works at desktop and mobile widths; E2E green |
| **5** | The §8 page sweep | Full `npm run verify` plus E2E; every page in both themes |
| **6** | Docs: `PROGRESS`, `PLAN`, `DECISIONS`, `PARITY` reconciled; `/tokens` deleted; second Vercel project live | Docs agree with the code; Storybook deployed |

Phases 1–3 carry the design thinking; phase 5 carries most of the hours. The
page sweep will break unit tests that assert copy or class names — expected, and
updated rather than weakened.

---

## 10. Reconciliation with existing docs

Statements in the conversion spec that this document **supersedes**:

| Where | Was | Now |
|---|---|---|
| §6.1 | Letterbox hairline rules are the signature device | The signature is the floating-panel shell plus the proportional poster radius. Letterbox rules retired as section headers; the 2.39:1 frame kept (D74) |
| §6.2 / §6.3 | Neutral near-black `#0B0D10`; warm paper `#F5F3EF` | Violet-warm `#0A0910`; warm paper `#EFEAE2`. All values re-verified (§3.1) |
| §6.2 | One carmine accent | Two accents with separate jobs (D69) |
| §6.5 | Display is Archivo Expanded, `wdth` 118–120, uppercase | The `wdth` axis is retired. Instrument Serif for names, Archivo mixed case for structure, uppercase only as the 11px eyebrow (D70, D71) |
| §6.7 | Cards carry hairline borders | Elevation is a surface step; borders only where they carry meaning (D72) |
| §6.9 | Four nav items, top bar | Seven grouped in a rail (D62 already overrode the count; D67 changes the placement) |

**Unchanged and re-affirmed:** §6.4's contrast discipline and the
test-before-consume rule; §6.6's poster-derived accent with OKLCH clamping;
§6.8's motion budget; §6.10's deferred logo — the Archivo wordmark stands, and
the MUI Minimal pinwheel still must not appear. `PLAN.md`'s Phase 3 gate
("a token-gallery page renders both themes with no raw hex") is **reworded**:
Storybook is the gallery, and the CI hex check is what enforces it.

`PROGRESS.md` gains a section for this work. Phase 3's entries stay ticked —
they were met — with a pointer noting they were superseded here.

---

## 11. Risks

1. **The page sweep is the largest single diff in the project so far.** ~20 page
   and component files plus test churn. Mitigation: phases 1–4 land first, so
   every page is restyled against primitives that already exist and are already
   proven in Storybook.
2. **Four font families on the critical path.** Archivo and Newsreader are
   variable, Instrument Serif is small, all with `display: swap`. If measured
   LCP regresses, Newsreader is the one to cut — prose could fall back to
   Archivo without touching the identity.
3. **Storybook is a second build pipeline** that can drift from `next dev`.
   Mitigation: it imports the real `globals.css` and the real `theme/fonts.ts`
   rather than a copy, so drift shows up as a broken story rather than a silent
   difference.
4. 🔴 **The rail costs real horizontal room, more than first estimated.**
   Measured in the browser at a 1280px viewport: the current `max-w-6xl`
   container gives the league board **1152px** of usable content width. The rail
   layout — 236px rail, three 10px insets, 24px panel padding each side — leaves
   **966px**, a **16% loss**. An earlier claim in this spec that the two were
   "close to neutral" was wrong and has been corrected here.

   What that costs concretely: a 7-seat roster row goes from ~154px per poster
   to ~128px, which is still legible. A 10-seat league would not be. Three
   mitigations, in order of preference: raise the icon-strip collapse breakpoint
   from 1100px to **1280px** so laptops keep the full width; let the roster shelf
   scroll horizontally with snap rather than compressing (it already does on
   `PosterCarousel`); and treat 1440px as the design target since that is where
   the mockups were measured. **This must be checked in a browser at 1280px and
   1366px with a 10-seat league before phase 5 commits to the rail width** — the
   rail is cheap to narrow to 208px if it does not hold.
5. **`brass` doubles the accent vocabulary.** Two accents can drift into
   decoration. Mitigation: D69 states the split as a rule — awards versus
   urgency — and the styleguide documents it with examples of each, so a
   reviewer can call a violation.

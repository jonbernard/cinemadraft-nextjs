# Design and tooling research — 2026-08-17

Raw findings behind
[`../superpowers/specs/2026-08-17-design-system-and-storybook-design.md`](../superpowers/specs/2026-08-17-design-system-and-storybook-design.md)
and decisions **D67–D76**.

Two investigations ran in parallel. Both are reproduced here in full, lightly
edited only for formatting, because the spec cites conclusions and a reader
should be able to check the evidence.

**How to read this.** Section A is measurements of ten live products, taken from
their own CSS and `getComputedStyle` in Chromium at 1512px on 2026-08-17.
Section B is version-and-compatibility facts for Storybook, Vercel and
Turborepo, checked against live docs and npm the same day. Where a fact could
not be verified, both reports say so rather than guessing — those admissions are
preserved.

**Staleness warning.** Everything in Section B is version-pinned and will rot.
Everything in Section A is a snapshot of sites that redesign without notice. Do
not treat either as current beyond about six months; re-measure instead.

---

# A · Ten design references, measured

## 1. Letterboxd — letterboxd.com

**Type (verified):** `GraphikWeb` (Commercial Type Graphik) is the UI/body face —
body 16px/400. `TiemposHeadlineWeb` + `TiemposTextWeb` (Klim) for
editorial/Journal. `PitchSansWeb` (Klim Pitch Sans — a *proportional* face with
mono DNA, not a true monospace) for data/labels. Headings mostly **mixed case**;
uppercase is confined to small nav/section labels at 13px with +0.075em tracking
(measured `letter-spacing: 0.975px`). Scale is deliberately small and dense: the
most-used sizes in the bundle are 0.75rem (78×), 0.8125rem (70×), 0.6875rem
(35×) — a *tiny*-type product.

**Color (verified):** page `#14181C`, panel `#12161A`, surfaces `#2C3440` /
`#202830` / `#303840`, hairlines `#334455` / `#445566`, muted text `#8899AA`,
bright text `#CCDDEE`. Accents: blue `#40BCF4`, green `#00E054`, star orange
`#FF8000`, gold `#E0C010`. Dark-only.

**Shape (verified):** the crown jewel — poster radius is **proportional**:
`border-radius: clamp(2px, 2.667%, 8px) / clamp(2px, 1.778%, 8px)` (290
instances on one page). Tokens `--border-radius-base: 4px` against
`--border-radius-base-width: 150px` → ratio `.02666667`. Chips/panels 3px. Flat;
separation by hairline + surface step, essentially no shadow.

**Nav (verified):** desktop = **top bar, 72px**, logo left, `Films / Lists /
Members / Journal`, search + `+` add-menu right. No sidebar anywhere. Mobile =
same bar collapsed; app uses bottom tabs.

**Steal:** the proportional-radius rule. One rule gives a 24px chip 2px corners
and a 200px poster card ~5px, so the whole UI feels tuned instead of tokenized.

**Avoid:** the 11–13px type floor and the cool blue-grey ramp — that combination
is why Letterboxd reads "database" to non-fans, and it is the exact failure mode
cinemadraft already had.

## 2. MUBI — mubi.com

**Type (verified):** `Riforma` (Lineto) as the workhorse, `Tiempos Headline
Light` + `Tiempos Text` (Klim), and `K-Compress` for compressed display. Hero
measured at **Riforma 500, 60px, `text-transform: uppercase`, normal tracking**.

**Color (verified):** brand blue `#001489` (+ `#001AAF`), red `#FF4238`, `#000`,
`#EAEAEA`, greys `#323232` `#9B9B9B` `#C8C8C8`. Marketing surface is white; the
player/browse is black.

**Shape (verified):** radius is **0 or 2px**, nothing else (4 instances of 2px, a
few 6px, no card rounding). Zero shadow. Full-bleed imagery does all the work.

**Nav (verified labels):** desktop top bar — `Now Showing / Browse / Notebook`.
Editorial (Notebook) sits as a peer of the catalogue, not in a footer.

**Steal:** one saturated non-neutral brand color (that blue) used as *ground* on
occasion, not as a 4%-of-pixels accent. It makes black-and-white photography
read as curation.

**Avoid:** all of its shape/case language. MUBI is uppercase + 2px radius — it is
the thing the owner rejected, done well. Not the shape reference.

## 3. The Criterion Channel — criterionchannel.com

**Type (verified):** `Gotham` (Bold/Medium/Book/Narrow) + `Mercury Text G1` and
`Mercury Display` — both Hoefler&Co. Body font on `<body>` is
**MercuryTextG1Regular** (a serif). Measured display heading: **GothamBold 64px,
`text-transform: none`, `letter-spacing: -2.56px` (−0.04em)**. Uppercase appears
*only* on 16px eyebrows: `GothamNarrowBold, uppercase, +1.2px`.

**Color (verified):** ground `#252525` (a light-charcoal dark, not near-black),
deeper `#141414`, brass/gold `#B4841E`, off-white `#F6F6F6` / `#F0F0EF`, warm
greys `#CDCDCB` `#BEBEBB`, mint `#00CC8F`, red `#D0021B`.

**Shape (verified):** `border-radius` count on the rendered page: **zero**.
Bundle-wide it is 0/2/3px plus circles. Flat, print-derived.

**Nav:** desktop top bar + "Toggle Menu"; the browse surface is horizontal
collections/shelves.

**Steal:** the **case split** — mixed-case Gotham Bold at −4% tracking for
headings, uppercase-with-positive-tracking reserved exclusively for tiny eyebrow
labels. That is precisely the treatment that solves the owner's complaint
without losing formality. Also: a *serif body face* on a dark ground is the
single cheapest "cinema, not terminal" signal in the set.

**Avoid:** 0px radius everywhere, and Gotham itself (2010s-agency-default now).
`#252525` on `#141414` with brass hairlines is a whisker from looking unfinished
at small sizes.

## 4. A24 — a24films.com

**Type (verified):** `NB International Web` (Neubau Grotesk) is primary —
headings measured at **74px / weight 500 / `text-transform: none` /
`letter-spacing: -2.96px` (−0.04em)**. `NB International Mono Web` for small
caps/meta, and Typekit-served `akzidenz-grotesk-extended` for wordmark-level
display. Body 15px.

**Color (verified):** `#000` (40 uses) and `#EEEEEE` (17), greys `#888888`
`#646464` `#CACACA`. Per-film pages recolor entirely to the film's palette.

**Shape (verified):** radius 0 dominant, with a handful of true pills (46px/50px)
for buttons. Shadows near-invisible (`rgba(0,0,0,0.024) 2.1px 0 2.2px`) —
decorative paper lift, not elevation hierarchy.

**Nav (verified):** fixed 119px header carrying **only logo + a 22px hamburger,
on desktop too**. The menu contains `Films / Television / Docs / Shop /
Membership / Notes / App / Search`.

**Steal:** giant mixed-case grotesque titles at −4% tracking as the primary
graphic element — the film's *name* is the design.

**Avoid:** hiding all navigation behind a hamburger on desktop. A24 can afford it
(you arrive knowing what you want); a league app with 7 recurring destinations
cannot.

## 5. Apple TV — tv.apple.com

**Type (verified):** system stack only — `-apple-system / system-ui` (SF Pro), no
webfont. h2 shelf headings = **17px / 700 / mixed case / normal tracking**; page
h1 26px/700; marketing h2 34px/600. No uppercase anywhere in the measured set
except 7 CSS instances.

**Color (verified, signed-out):** the 2026 signed-out page renders **light** —
body `#FFF`, text `rgba(0,0,0,.88)`, action blue `#007AFF`. The in-app surface is
dark; **not verified logged in.**

**Shape (verified):** poster/lockup images `border-radius: 0px`. Buttons 6px.
Bundle tokens: `--global-border-radius-medium: 7px`, common 4/6/8/10/12px. Flat.

**Nav (verified):** thin **52px top bar**, logo left, a *three-item* centered nav
(`Apple TV / Formula 1 / MLS`), search + Sign In right. Body is a stack of
horizontal shelves each with a 17px linked heading and its own carousel.

**Steal:** the **shelf-with-a-linked-heading** pattern — every row heading is
itself the link to the full collection. Zero chrome, infinite sections, and it
maps onto "This Week's Nominees / Your Roster / League Standings."

**Avoid:** relying on the system font. On the web, SF Pro/system-ui *is* the
default-looking choice; it will not give cinemadraft an identity.

## 6. Sleeper — sleeper.com

**Type (verified):** `Inter` / `Inter Tight` for UI (body computed `Inter`),
`Poppins` for marketing headings (section labels at **Poppins 700, 11px,
uppercase, +0.25px**; card titles Poppins 600/16 mixed case), plus `Druk` /
`Druk Condensed` / `Druk Wide` (Commercial Type), a proprietary `Superline`, and
`Google Sans Flex` in the bundle.

**Color (verified):** ground is **`#05091D` — a deep navy, not black**. Surfaces
`#131B38`, `#022047`, `#27455C`, steel `#98B3D6`. Accents: coral/pink `#FF6482`
and a DLS teal ramp topping out at `#00FFF9` / `#03C3C5`. Dark-first.

**Shape (verified):** **10px is the dominant radius (51 instances)**, plus full
pills (`1.67e7px`, 33 instances) and 2px for meters. Web app is built on shadcn
(`--radius: 6px`, `--radius-2xl: 1rem`) layered under its own DLS.

**Nav (verified):** sticky 80px top bar **plus a second sticky 64px sport-switcher
row** (`nfl / mlb / wnba`) directly beneath — a two-tier top nav. Mobile is
bottom tabs.

**Steal:** the **tinted dark ground**. `#05091D` is the same *luminance* as a
near-black but reads as "arena at night" instead of "terminal," purely from the
hue shift. Highest-leverage single change available. → **D68**

**Avoid:** Druk Wide + uppercase. Sleeper and Underdog both use it, which is
exactly why it now signals "fantasy sports app" — and it is the same
expanded-caps gesture the owner disliked.

## 7. Underdog (now Underdog Sports) — underdogsports.com

Note: `underdogfantasy.com` **301s to underdogsports.com** as of this check.

**Type (verified):** `Druk Wide` / `Druk Text` / `Druk Text Wide` for display —
measured **88px/700/uppercase at `letter-spacing: -1.76px`, and 120px at −7.2px
(−6%)**; `Neue Haas Grotesk Text 55/65/75` and `General Sans` for text; `Kanit`
on `<body>`; `Roboto` on buttons (inconsistent).

**Color (verified):** yellow `#FFCE00` / `#FFBF01`, near-blacks `#040404`
`#0A0A0A` `#101010`, whites `#FFF` `#FAFAFA`, blue `#3898EC` / `#0050BD`, steel
`#758696`. Marketing is light; the product is dark.

**Shape (verified):** the loosest in the set — **20px (18×), 40px (9×), 12px on
buttons**, 35px, 13.29px. Everything is a soft rect or a pill.

**Nav (verified):** marketing nav is a 115px band. Product is bottom-tab-first;
desktop web mirrors it as a top bar.

**Steal:** the **negative tracking at scale** — −2% at 88px, −6% at 120px. Big
type gets *tighter*, not wider. The inverse of expanded headings, and the single
typographic move that converts "techy" into "editorial." → **§3.2**

**Avoid:** the 20–40px radius family. At those values a stats table stops reading
as a table; and `#FFCE00` on `#040404` is aggressively sportsbook.

## 8. DraftKings — draftkings.com

**Type (verified):** `Saira Extra Condensed` / `Saira Condensed` 700 for headings
(42px/32px, `text-transform: none` — the caps are typed into the copy, e.g.
"THE CROWN IS YOURS"), `Open Sans` body, `Open Sans Condensed` and `Inter` also
loaded.

**Color (verified):** body `#323232`, header `#242424`, `#1B1B1B`, `#000`; greens
`#61B510` / `#53D337` / `#6DC918`.

**Shape (verified):** 8px (30×) and 4px (19×) dominant, plus 3/5/14/15px. Flat
with heavy dividers.

**Nav (verified):** 64px `#242424` top bar with a **10-item horizontal nav**
(`Home, My Bets, Live In-Game, Rewards, How to Bet, VIP, Pools, Social, Stats
Hub, More`).

**Steal:** one thing only — the persistent **"my active position" strip** (bet
slip / My Bets always reachable). Translates as an always-present "your picks &
live points" rail.

**Avoid:** essentially everything else. Ten top-nav items, condensed screaming
caps, three type families in one bundle, `#323232`-on-`#242424` with a betting
green. A useful negative control.

## 9. Are.na — are.na

**Type (verified):** a single custom face named **`areal`**, self-hosted, with
`local("Arial")` as a metric-matched fallback (`size-adjust: 100.76%`) — an
Arial-derivative commissioned for the product. Declared for `--fonts-sans` *and*
`--fonts-mono`. On Explore: **the dominant font-size is 16px (434 elements)**,
with only 12.5px (144), 14.4px (74), 24px (20), 28px (6) — and **zero
`<h1>/<h2>/<h3>` on the page at all**. Hierarchy comes from position and space.

**Color (verified):** white / `#F7F7F7` / `rgba(255,255,255,.95)`, black text,
greys `#999` `#696969`, ink blue `#00075F`. Light-first with a real dark mode.

**Shape (verified):** **3px, 57 instances — the entire radius vocabulary**, plus
4 pills (`9999px`). Tokens: `--radii-1: 3px`, `--radii-pill: 9999px`,
`--radii-round: 50%`. No shadows.

**Nav (verified):** 55px top bar containing *only* the wordmark and auth/search.

**Steal:** **one radius value and one type size** as a discipline. Are.na proves a
content app can be near-typographically-flat and still feel authored.

**Avoid:** the absence of hierarchy. A league app has scores, standings and
deadlines — flat 16px everything would make the data unreadable.

## 10. Spotify Web Player — open.spotify.com

**Type (verified):** proprietary `SpotifyMixUI`, `SpotifyMixUITitle` (+
`SpotifyMixUITitleVariable`), `SpotifyMixMono`. Shelf headings at
**SpotifyMixUITitle 24px/700, mixed case, normal tracking**; sidebar heading
16px/700. Effectively **no uppercase**.

**Color (verified):** page `#000`, panel `#121212`, elevated `#1F1F1F` / `#333`,
muted text `#B3B3B3`, green `#1ED760`. Encore tokens: `--background-base`,
`--background-elevated-base` — a real two-tier elevation-by-color system.

**Shape (verified):** `--encore-corner-radius-smaller: 2px / base: 4px / larger:
6px / larger-2: 8px / larger-3: 16px`. Rendered: **6px (147×), pills (193×
combined), 2px (30×), 8px (10×)**. Elevation by *color steps*, not shadows.

**Nav (verified):** desktop = a **floating left panel** at `x:8, y:64,
width:348, height:754, background #121212, border-radius 8px`, on a pure-black
page ground, with the main content as a second floating panel. Mobile = bottom
tabs.

**Steal:** the **floating-panels-on-black shell**. Gives a persistent left nav
*and* a cinematic black frame, and is why Spotify reads "media player" rather
than "dashboard" despite being a dense list UI. → **D67**

**Avoid:** `#121212` on `#000` neutral greys with a single neon accent — now the
most-copied dark palette on the web. Also Encore's 4px/6px default: app-chrome
radius, not cinema radius.

---

## Synthesis

### Strongest fits

**Criterion Channel** is closest to the brief: a dark, formal, awards-adjacent
film product that achieves gravity with **mixed-case headings at −4% tracking**
and a serif body face, restricting uppercase to 16px eyebrows. It proves you can
drop all-caps headings and get *more* prestige. Its brass `#B4841E` is the only
awards-legible accent in the set that is not a sports-betting color.

**Letterboxd** is closest to the information architecture: posters in grids,
per-title pages, member lists, dense stats. Its proportional-radius system is
directly transplantable. Take its structure; reject its 11px type and cool-grey
ramp.

**Spotify's shell** answers the desktop-nav complaint. A floating `#121212` left
panel with 8px corners on a black ground is proven for exactly this nav count
(6–8 destinations) and visually frames content like a screen.

**Sleeper** contributes one thing, the most valuable single datapoint here: its
ground is `#05091D`, a **hue-shifted dark**, and that alone stops a dense stats
UI reading as a terminal.

Runner-up for the mood board: **A24** hero typography (74px, weight 500,
−0.04em, mixed case).

### Concrete recommendations

**Heading case.** Adopt the Criterion split verbatim in structure:

- H1/H2/H3 **mixed case (sentence case, not Title Case)**, tracking **−0.02em at
  24–32px, −0.03em at 40–56px, −0.04em above 64px**. Never positive tracking on
  a heading.
- Uppercase survives in exactly one role: the **eyebrow/kicker** — 11–12px,
  weight 600–700, `letter-spacing: +0.06em to +0.08em`, muted. Letterboxd
  measures 13px/+0.075em; Criterion 16px/+0.075em. That range is the proven one.
- Weight: prefer a usable **Medium (500)** for large headings over Bold — A24
  (500 @74px) and MUBI (500 @60px) both do. Bold-at-large-size is a sports move;
  Medium-at-large-size is editorial.
- Face direction: a grotesque with editorial character (Söhne, Riforma, NB
  International, Graphik, Neue Haas Grotesk Display) paired with a **serif for
  prose and synopses** (Tiempos Text, Mercury Text, Lyon). The serif is the
  strongest anti-techy signal and **no fantasy sports product in this set has
  one.** Keep a designed mono for numerals only, tabular figures on.

**Radius scale.** Up from 2px, but not to Underdog's 20px:

- `--r-xs: 3px` — chips, tags, badges (Letterboxd's 3px; Are.na's only value)
- `--r-sm: 6px` — inputs, buttons, row hover
- `--r-md: 10px` — cards, panels, modals, nav rail (Sleeper 10px; Spotify 8px)
- `--r-lg: 16px` — hero/feature containers only
- `--r-pill: 999px` — **status and filter chips only**. Pills as buttons is what
  makes Underdog read as a game.
- **Posters get the Letterboxd rule, not a token:** `clamp(3px, 2.6%, 10px)`.
  Highest craft-per-line-of-CSS item in the report.
- Buttons: 6px, never 0, never 999px.

**Desktop nav.** The Spotify floating-rail hybrid:

- Left rail 240–260px, `--r-md`, inset 8px from a darker ground, sticky.
- A slim **52–56px top strip** for search, create, avatar. Apple TV's is 52px;
  Letterboxd's 72px is too tall. Hybrid, not pure sidebar — avoids the "left
  rail plus nothing" admin-dashboard look.
- Content as a second floating panel, same corners. This is what reads
  player-not-dashboard.
- Collapse to a 64px icon strip below ~1100px; **bottom tab bar on mobile** —
  Sleeper, Underdog, Spotify and Letterboxd's app all do it. Not optional in
  2026.
- Inside the panel, **Apple TV shelves with linked headings** for browse; dense
  tables only for standings and scoring.

### Dark that reads cinema, not developer-tool

| Reads *developer tool* | Reads *cinema* |
|---|---|
| Neutral or **cool-blue** near-black (`#0D1117`, `#121212`, `#14181C`) | **Warm or violet-shifted** dark at the same luminance — ink/plum/warm-charcoal, or Sleeper's navy `#05091D` |
| Elevation by **1px hairline rules** on the same value | Elevation by **surface value step**, plus one 1px inset highlight at the top edge |
| Monospace for *columns and labels* | Monospace for **numerals only**, tabular; labels in the text face |
| **Expanded/wide** tracking on caps headings | **Negative** tracking on mixed-case headings |
| Neon single accent at high saturation (`#1ED760`, `#00FFF9`) | **Metallic/desaturated** accent — Criterion's brass `#B4841E`, gold `#C9A227`–`#E0C010`, deep red used sparingly |
| Pure `#FFF` body text | Slightly off, tinted light text (Letterboxd `#CCDDEE`) |
| 11–13px type floor, uniform density | **Wide dynamic range** — 12px eyebrows beside 64px titles, generous air between shelves |
| Zero imagery; color blocks and charts | **Poster art carrying the color**; tint a card's surface from its film |
| Sharp 0–2px corners everywhere | 3/6/10/16 scale with proportional poster radius |
| Charts as the hero | **Type and stills as the hero** |

### Trends to avoid — already generic or AI-default

1. **`#0A0A0A` + `#171717` + one violet/cyan accent + Inter + 8px radius.** The
   shadcn-plus-default-tokens look. Sleeper's own bundle ships `--radius: 6px`,
   `--muted: #262626`, `--foreground: #0A0A0A` — the defaults are everywhere, and
   any UI keeping them is unidentifiable.
2. **Glassmorphism / frosted `backdrop-filter` cards over a gradient blob.** Not
   one of the ten uses it as a system; every measured card is opaque.
3. **Bento grids** of unequal rounded tiles as a homepage. Reads 2023 marketing
   site, and fights a poster grid.
4. **Aurora/mesh gradient hero blobs** and animated gradient borders.
5. **Druk Wide / Monument Extended / any expanded-caps display face.** Now the
   fantasy-sports uniform.
6. **Neon-on-black glow accents.** Reads crypto/esports.
7. **16–24px radius on everything** including table rows and inputs.
8. **Monospace as a "data" affectation** across labels and column heads.
   Letterboxd uses Pitch *Sans* — proportional — precisely to avoid this.
9. **Emoji or generic line icons as section markers.** None of the ten do it.
10. **Dark-mode-only with no light theme.** A 2026 awards product that cannot
    render a shareable light-mode standings card leaves distribution on the
    table.

---

# B · Storybook, Vercel and Turborepo

Verified against live docs/npm on 2026-08-17.

## 1. Version and framework → `@storybook/nextjs-vite@10.x`

| Fact | Value |
|---|---|
| Current stable major | **Storybook 10**; latest `10.5.8` |
| Node requirement | `20.16+`, `22.19+`, or `24+` — Node 24 is fine |
| Only breaking change vs 9 | **ESM-only** (CJS removed; −29% install size). All addons must be ESM-only |
| Both framework packages exist at `10.5.8` | `@storybook/nextjs` (Webpack) and `@storybook/nextjs-vite` — neither deprecated |
| Next 16 support | Both declare `next: "^14.1.0 \|\| ^15.0.0 \|\| ^16.0.0"`. SB10 release notes call out "support for Next 16 and Vitest 4" |
| `nextjs-vite` also needs | Vite `^5–^8` (peer), and internally `vite-plugin-storybook-nextjs` (`3.3.2`; **≥3.0.3 required for Next 16**) |

**Recommendation: `@storybook/nextjs-vite`.** Docs state it is the recommended
default and the CLI auto-selects it unless you have custom Webpack/Babel config —
this project has neither. Decisive: **`@storybook/addon-vitest` only works with
Vite-based frameworks**; the Webpack framework cannot run it at all. Downside:
Storybook is bundled by Vite, not Turbopack, so it is a second build pipeline
that can diverge (aliases, `postcss.config`, env handling). Unavoidable either
way — Webpack Storybook diverges too.

`@mui/material-nextjs`'s `AppRouterCacheProvider` is **not** needed in Storybook;
it exists for SSR style flushing, which Storybook does not do.

- https://storybook.js.org/blog/storybook-10/
- https://storybook.js.org/docs/get-started/frameworks/nextjs-vite

## 2. `next/font` — handled, but the CSS variables are not

The Vite adapter **does** support `next/font`:

- `next/font/google` works out of the box; the Vite framework "automatically
  handles font path mapping, so you don't need to configure `staticDirs`."
- `next/font/local` works if `src` is relative to the calling file.
- **Not supported:** loaders configured in `next.config.js`; the `fallback`,
  `adjustFontFallback`, `preload` options; and `display` (fonts always load
  `display: block`).
- **CI:** set `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` or a Google Fonts hiccup fails
  the build.

**The gap that bites:** font CSS custom properties are attached to `<html>` by
`app/layout.tsx`, and Storybook never renders the root layout. So
`var(--font-archivo)` is undefined in stories. Community-standard workaround:

1. Keep the loader calls in **one shared module** that both `layout.tsx` and
   Storybook import. (This project already has `theme/fonts.ts`.) Calling
   `Google()`/`localFont()` a second time in `preview.tsx` is a reported source
   of breakage, because `src` paths resolve relative to the calling file.
2. In `.storybook/preview.tsx` (**must be `.tsx`** — the `.ts` extension is a
   documented cause of `Cannot read properties of undefined (reading
   'className')`), apply the variable classes to `documentElement`, because
   stories render in an iframe whose `<html>` you otherwise never touch:

```tsx
import { archivo, plexMono } from '../theme/fonts';

const decorators = [
  (Story) => {
    document.documentElement.classList.add(archivo.variable, plexMono.variable);
    return <Story />;
  },
];
```

Known open friction: `@storybook/nextjs-vite` users report `font.variable`
resolving to `undefined` even where the same code works in Next (discussions
#31984, #33721). **Fallback if hit:** skip `next/font` in Storybook, use a plain
`@font-face`/Google `<link>` plus hand-written `--font-archivo` in a
`preview.css`. Slightly divergent from prod, zero risk.

## 3. Tailwind 4 — near-zero config, one landmine

`nextjs-vite` handles CSS Modules, styled-jsx, Sass, **Tailwind and PostCSS
configs** automatically — Vite reads the root `postcss.config.mjs`, so with
`@tailwindcss/postcss` you need nothing beyond importing `globals.css` in
`preview.tsx`. Do **not** add `@tailwindcss/vite` alongside the PostCSS plugin.

**The landmine (issue #31373, closed 2025-05-07 as won't-fix-on-our-side):** Next
accepts a *non-standard* PostCSS shorthand that Vite's `postcss-load-config`
rejects:

```js
// works in Next, FAILS in Storybook/Vite: "Invalid PostCSS Plugin found at: plugins[0]"
const config = { plugins: ["@tailwindcss/postcss"] };
// use the object form — both accept it
const config = { plugins: { "@tailwindcss/postcss": {} } };
```

**On `@layer theme, base, mui, components, utilities;` before `@import
"tailwindcss"`:** legal CSS (the spec permits `@charset` and *empty* `@layer`
statements before `@import`), and Vite's incorrect warning for exactly this
pattern was fixed in vitejs/vite#17424 (closed 2024-08-21). Fine on Vite ≥5.4.
Two residual cautions:

- Layer order is fixed by **first declaration**, so `globals.css` must be the
  *first* CSS Storybook loads — the very first statement in `preview.tsx`.
- Storybook injects its own preview styles **un-layered**, and un-layered styles
  beat all layered styles. If a story looks wrong only in Storybook, suspect
  this first.

## 4. MUI 9 + Emotion — do **not** use `withThemeByDataAttribute`

`@mui/material` latest is **9.3.1**. `InitColorSchemeScript`'s **default
`attribute` is `data-mui-color-scheme`**, `modeStorageKey` is `'mui-mode'`,
`colorSchemeStorageKey` is `'mui-color-scheme'`, `defaultMode` is `'system'`.

`@storybook/addon-themes` offers `withThemeByDataAttribute({ attributeName,
themes, defaultTheme, parentSelector })`. **Wrong tool here.** It writes the
attribute directly, but MUI owns it: `useColorScheme()` state and
`localStorage['mui-mode']` are not updated, MUI can overwrite the attribute on
mount, and stories calling `useColorScheme()` read a stale mode.

**Recommended — Storybook global drives MUI's own `setMode`:**

```tsx
import { ThemeProvider, useColorScheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from '../theme';

function SyncMode({ mode }: { mode: 'light' | 'dark' }) {
  const { setMode } = useColorScheme();
  React.useEffect(() => setMode(mode), [mode, setMode]);
  return null;
}

const preview = {
  initialGlobals: { theme: 'dark' },
  globalTypes: {
    theme: {
      description: 'Color scheme',
      toolbar: { icon: 'circlehollow', items: ['light', 'dark'], dynamicTitle: true },
    },
  },
  decorators: [
    (Story, ctx) => (
      <ThemeProvider theme={theme} defaultMode={ctx.globals.theme} forceThemeRerender>
        <SyncMode mode={ctx.globals.theme} />
        <CssBaseline />
        <Story />
      </ThemeProvider>
    ),
  ],
};
```

Four points:

- `ThemeProvider` (v6+) subsumes the old `CssVarsProvider`.
- **`forceThemeRerender` is required for Storybook.** With `cssVariables: true`,
  `ThemeProvider` deliberately does *not* re-render on mode switch (CSS vars
  handle it), so any story branching on `theme.palette.mode` in JS will not
  update without it.
- Because MUI writes the attribute onto `<html>` itself, the Tailwind
  `@custom-variant dark` binding keeps working in Storybook with no extra
  plumbing. This is the main argument for driving MUI rather than the attribute.
- **Watch localStorage persistence:** MUI persists `mui-mode`, so a story can
  boot in the previously chosen mode rather than `initialGlobals`. Use a
  Storybook-specific `modeStorageKey`, or clear it in a preview `beforeEach`.

## 5. `@storybook/addon-vitest` — works, but skip it

Exists at `10.5.8`. Peers: `vitest: ^3.0.0 || ^4.0.0`, `@vitest/browser: ^3||^4`,
**`@vitest/browser-playwright: ^4.0.0`**. Vitest 4.1.10 ✓. Requires
`@storybook/nextjs-vite` for Next projects.

**On `fileParallelism: false`:** in Vitest 4, `projects[].test` options are
per-project and `extends: true` inherits from the base config, so the root
setting is inherited by the storybook project. **Not a hard conflict** — it just
serializes browser tests. The real documented conflict is *"Found multiple
projects that run browser tests in headed mode"*, which only fires if a
browser-mode project already exists; this project is jsdom-only. Also: if the
Vite config carries a `test` property, move it to the Vitest config. And per
issue #33347, do not double-register annotations — `setProjectAnnotations` in
`vitest.setup.ts` duplicating hooks already in `preview.ts` causes odd failures.

**Recommendation: do not adopt now.** Testing Library + Vitest cover behavior and
Playwright covers flows; the addon's value is real-browser rendering of stories,
a third overlapping layer. Costs: Playwright browser binaries in CI, a second
Vitest project, `--project=storybook` plumbing, and coupling that breaks on
Storybook upgrades. Worth revisiting only for **`addon-a11y` + axe assertions on
every story in CI**, which is a genuinely new capability.

For story reuse without the addon: **portable stories** (`composeStories` from
`@storybook/react`) inside the existing jsdom setup.

## 6. Essentials, a11y, design tokens

**"Essentials" is no longer a package.** `@storybook/addon-essentials`,
`addon-interactions`, `addon-links` and `@storybook/blocks` are **empty since
Storybook 9 and unpublished in 10**. Those features ship inside the core
`storybook` package: Actions, Backgrounds, Controls, Highlight, Measure &
Outline, Toolbars & Globals, Viewport.

Still separate (all `10.5.8`):

- **`@storybook/addon-docs`** — autodocs and MDX. Installed by default by the CLI.
- **`@storybook/addon-a11y`** — **yes, still separate.** Built on axe-core (docs
  claim ~57% WCAG coverage automatically). Integrates with the Vitest addon via
  `parameters.a11y.test: 'error' | 'todo' | 'off'`.
- **`@storybook/addon-themes`** — see §4 for why to skip.
- `@storybook/addon-onboarding` — remove after setup.

**Design tokens: write MDX by hand.** `storybook-design-token@5.0.0` does declare
`storybook: ^10.0.0`, but it was last published 2025-12-09 and works by
**parsing stylesheets for annotation comments** — a model that fits
Sass/CSS-variable files, not Tailwind 4's `@theme` block. A hand-written MDX page
rendering swatches from live `var(--color-*)` is less machinery, always accurate,
and doubles as the doc humans read.

## 7. Vercel Hobby hosting — a second project is the right answer

From https://vercel.com/docs/limits (last_updated 2026-08-03):

| Limit | Hobby | Pro |
|---|---|---|
| Projects | **200** | Unlimited |
| **Projects connected per Git repository** | **25** | 150 |
| Deployments created per day | **100** | 6000 |
| Builds per hour (Hobby) | 100 / 3600s | — |
| Concurrent deployments | **1** | up to 500 |
| CLI source upload max | 100 MB | 1 GB |

**(a) Second project with a Root Directory — fully supported on Hobby.** No plan
gate. **You do not even need a subdirectory:** second project, same repo, Root
Directory at repo root, Framework Preset **Other**, Build Command
`npm run build-storybook`, Output Directory `storybook-static`. Static output, so
no functions and no runtime cost.

Hobby caveats that matter:

- **Concurrent deployments = 1.** Every push queues two builds serially — roughly
  doubled wall-clock to a green preview.
- **100 deployments/day and 100 builds/hour.** Two projects per push halves the
  effective push budget to ~50/day.
- **Hobby cannot connect to repos owned by a Git *organization*.** If the repo
  sits under a GitHub org, this needs a Team.
- **"Skipping unaffected projects"** (so a Storybook-only change does not rebuild
  Next) requires **GitHub + npm/pnpm/yarn/bun workspaces** with unique package
  names and explicit inter-package deps. Without workspaces you fall back to an
  **Ignored Build Step** script — and Ignored-Build-Step cancellations *still
  consume* deployment and concurrent-build quota, whereas native skipping does
  not. Strongest single argument for workspaces.

**(b) Microfrontends: available on Hobby, but wrong tool.** Hobby includes **2
microfrontend projects** and **50K routing requests/month**. Its purpose is
serving multiple projects under **one domain with path routing**; Storybook wants
its own URL. Vercel's own docs list monorepos/Turborepo as the preferred
alternative for velocity.

## 8. Turborepo vs single-package → stay single-package

`turbo@2.10.10`. **Remote caching is free on every plan including Hobby** (Vercel
made Vercel Remote Cache free for everyone, Dec 2024), so cost is not the
objection.

**What Turborepo buys one Next app + one Storybook: almost nothing.** Its value
is task-graph parallelism and cache hits across *many* packages. With two build
targets you get `turbo run build` in parallel (marginal — Hobby gives 1
concurrent build, so CI serializes regardless) and local cache hits on unchanged
Storybook builds. Against that: a `turbo.json`, a root `package.json`, changed
Vercel settings, and a new failure surface.

**`npm workspaces` alone is sufficient** — and is the only piece with a concrete
payoff, since workspaces are the prerequisite for Vercel's native
skip-unaffected. Workspaces do not require Turborepo.

**Migration friction, concretely:**

- **Vercel Root Directory** → `apps/web`. Vercel auto-detects npm from the *root*
  lockfile; every package needs a unique `name` or skip-detection degrades to
  "rebuild everything."
- **Prisma `postinstall`** → the classic breakage. Root `npm install` hoists
  `node_modules`, and `postinstall: prisma generate` inside `apps/web` runs with
  a different CWD/schema resolution. Likely needs an explicit schema path in
  `package.json` or `prisma.config.ts`, and confirmation that the generated
  client lands where the app resolves it. Vercel's **filtered install** can also
  skip the workspace whose postinstall you depend on.
- **Playwright** → `testDir`, `webServer.command`/`cwd`, `baseURL`, snapshot dirs
  and `outputDir` all move. Playwright resolves relative to the config file, so
  moving it shifts everything at once; CI artifact paths need updating.
- **Docker Compose** → `build.context` must widen to the repo root with
  `dockerfile: apps/web/Dockerfile`; bind-mount and `env_file` paths shift.
- **Tailwind 4** → if UI is ever split into `packages/ui`, Tailwind 4's automatic
  source detection **does not crawl `node_modules`**, so workspace-package
  classes get tree-shaken away without explicit `@source` directives.
- **Vitest/`tsconfig` paths, Biome `includes`, Clerk env** all need path sweeps.

**Recommendation:** `.storybook/` at the root of the existing single package;
second Vercel project, Root Directory = repo root, Framework Other. **Zero
migration.** Introduce **npm workspaces alone** only if double-build noise
becomes painful; add Turborepo only when a third package appears.

## 9. Known incompatibilities

| Against | Status |
|---|---|
| **Next 16** | Supported (peer `^16.0.0`; called out in the SB10 announcement). Residual: `"request for 'react-remove-scroll' is not in cache"` on Next 16 + `nextjs-vite` (discussion #33752) — diagnosed as **Windows-specific module resolution**, fixed by wiping `node_modules` + lockfile and ensuring `vite-plugin-storybook-nextjs ≥ 3.0.3`. macOS/Node 24 is low risk. "Cannot find module `@storybook/nextjs`" reports (#33762) are all **version mismatch across `@storybook/*` packages** — keep every Storybook package on the identical version |
| **React 19.2** | Supported; peers allow `^19.0.0`. No 19.2-specific open issue found |
| **Tailwind 4** | The `postcss.config` array-vs-object incompatibility in §3 is the only confirmed one — real, closed won't-fix upstream, trivially worked around |
| **MUI 9** | **No open Storybook↔MUI 9 incompatibility found.** Treat as *unverified-clean* rather than verified-clean — no MUI-9-specific reports either way. The `forceThemeRerender` behavior is by-design MUI, not a bug |
| **Biome 2.5.8** | No conflict — Storybook does not require ESLint. But **there is no Biome equivalent of `eslint-plugin-storybook`**; Biome's ~423 rules do not cover Storybook-specific lints and no port exists. Accept the gap — those rules are conveniences, not correctness |
| **Vitest 4** | Supported (`^3||^4`), see §5 |
| **ESM-only (SB10)** | `.storybook/*.ts` files must be ESM. Also: **Clerk** — `@clerk/nextjs` pulls server-only code that breaks stories. Use Storybook 10's **`sb.mock`** (works in dev and production builds, both builders) to mock `@clerk/nextjs` per-story rather than rendering a real `ClerkProvider` |

## Suggested install

```bash
npx storybook@latest init          # should auto-select @storybook/nextjs-vite
npx storybook add @storybook/addon-a11y
```

Then: `postcss.config.mjs` to object form; `preview.tsx` (not `.ts`) importing
`globals.css` first; font decorator from `theme/fonts.ts`; MUI `ThemeProvider` +
`forceThemeRerender` + `SyncMode`; `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` in CI.
Skip `addon-vitest`, `addon-themes`, `storybook-design-token`, Turborepo and
microfrontends.

---

## Sources

**Storybook**
- [Storybook 10 announcement](https://storybook.js.org/blog/storybook-10/)
- [Next.js with Vite framework](https://storybook.js.org/docs/get-started/frameworks/nextjs-vite)
- [Next.js with Webpack framework](https://storybook.js.org/docs/get-started/frameworks/nextjs)
- [Essentials](https://storybook.js.org/docs/essentials)
- [Themes addon](https://storybook.js.org/docs/essentials/themes)
- [Accessibility testing](https://storybook.js.org/docs/writing-tests/accessibility-testing)
- [Vitest addon](https://storybook.js.org/docs/writing-tests/integrations/vitest-addon)
- [Portable stories in Vitest](https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest)
- [Addon migration guide for v10](https://storybook.js.org/docs/addons/addon-migration-guide)
- [Material UI in Storybook](https://storybook.js.org/blog/material-ui-in-storybook/)
- Issues/discussions: [#31373 Tailwind v4 postcss](https://github.com/storybookjs/storybook/issues/31373), [#33752 Next 16](https://github.com/storybookjs/storybook/discussions/33752), [#33762](https://github.com/storybookjs/storybook/discussions/33762), [#31984 next/font](https://github.com/storybookjs/storybook/discussions/31984), [#26699 next/font className](https://github.com/storybookjs/storybook/issues/26699), [#33347 CI after vitest-addon](https://github.com/storybookjs/storybook/issues/33347)
- [vitejs/vite#17424 — @layer before @import](https://github.com/vitejs/vite/issues/17424)

**MUI**
- [InitColorSchemeScript API](https://mui.com/material-ui/api/init-color-scheme-script/)
- [CSS theme variables configuration](https://mui.com/material-ui/customization/css-theme-variables/configuration/)

**Vercel / Turborepo**
- [Limits](https://vercel.com/docs/limits)
- [Monorepos](https://vercel.com/docs/monorepos)
- [Microfrontends](https://vercel.com/docs/microfrontends)
- [Remote Cache is now free](https://vercel.com/changelog/free-vercel-remote-cache)
- [Turborepo Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching)

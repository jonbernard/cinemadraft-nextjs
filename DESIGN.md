---
name: Cinemadraft
description: Draft a team of films before awards season and score every nomination and win they collect.
colors:
  bg-ground: "#0a0910"
  bg-panel: "#16131c"
  bg-surface: "#211c29"
  border-rule: "#302938"
  text-primary: "#efece9"
  text-secondary: "#a8a1b2"
  text-dim: "#8c8598"
  accent-fill: "#c03d4e"
  accent-text: "#e78e99"
  accent-contrast: "#ffffff"
  brass-fill: "#cfa93a"
  brass-text: "#cfa93a"
  brass-contrast: "#241c05"
  beam: "#7fa6b8"
  score-high: "#63c08a"
  score-mid: "#d6a64a"
  score-low: "#e06c74"
  light-bg-ground: "#efeae2"
  light-bg-panel: "#fbf9f6"
  light-bg-surface: "#e7e1d7"
  light-border-rule: "#d5cdc0"
  light-text-primary: "#1a151f"
  light-text-secondary: "#5c5566"
  light-text-dim: "#665e70"
  light-accent-fill: "#9b2f3c"
  light-accent-text: "#8e2a36"
  light-brass-fill: "#7a5a12"
  light-brass-contrast: "#ffffff"
  light-beam: "#3f6273"
typography:
  wordmark:
    fontFamily: "Sora, Archivo, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    letterSpacing: "-0.035em"
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  name:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "24px"
    fontWeight: 400
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "15px"
    lineHeight: 1.4
  small:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "13px"
    lineHeight: 1.3846
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.085em"
  numeric:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontFeature: "tnum"
rounded:
  xs: "3px"
  sm: "6px"
  md: "10px"
  lg: "16px"
  pill: "999px"
  poster: "clamp(4px, 2.8%, 12px)"
spacing:
  group: "8px"
  within-section: "16px"
  between-sections: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent-fill}"
    textColor: "{colors.accent-contrast}"
    rounded: "{rounded.sm}"
    height: "44px"
  button-award:
    backgroundColor: "{colors.brass-fill}"
    textColor: "{colors.brass-contrast}"
    rounded: "{rounded.sm}"
    height: "44px"
  panel:
    backgroundColor: "{colors.bg-panel}"
    rounded: "{rounded.sm}"
    padding: "20px"
  panel-surface:
    backgroundColor: "{colors.bg-surface}"
    rounded: "{rounded.sm}"
    padding: "20px"
  chip-award:
    backgroundColor: "{colors.brass-fill}"
    textColor: "{colors.brass-contrast}"
    rounded: "{rounded.pill}"
  chip-scheduled:
    backgroundColor: "{colors.bg-surface}"
    textColor: "{colors.beam}"
    rounded: "{rounded.pill}"
---

# Design System: Cinemadraft

## Overview

**Creative North Star: "The Screening Room"**

The room with the lights down. The ground is a violet-warm near-black, not a
neutral one, and that hue shift at matched luminance is the whole reason a
dense stats product does not read as a terminal. Posters are the content;
everything the app draws around them steps back. Chrome is quiet by
construction — surfaces separate by tone, never by outline — so the brightest
things on any screen are the artwork and the one number that changed.

The system is refined and restrained. Nothing raises its voice until something
is actually won, and then exactly one colour does: brass. That reservation is
enforced socially and in tests, because the product's failure mode is a page
where a countdown, a draft pick and an Oscar all look equally urgent.

Both schemes are first-class. Light is warm paper, not white, and every pairing
in both is proved by an automated contrast test rather than by eye.

**Key Characteristics:**
- Violet-warm darkness, never neutral grey, never terminal black
- Three surfaces, separated by tone; no card ever wears a border
- Two accents with disjoint meanings — carmine acts, brass awards — plus beam for what is merely scheduled
- Serif for names, sans for structure, mono for anything a reader might add up
- One radius (6px) unless the shape is a poster, which scales its own

## Colors

A single warm-dark room with two accents that are never interchangeable, and a
light scheme that is paper rather than white.

### Primary
- **Carmine** (`#c03d4e` dark / `#9b2f3c` light): the product's own voice — the primary action, the viewer's own seat, a deadline that can be missed. Used as a **fill**; carmine *text* is `accent-text` (`#e78e99` / `#8e2a36`), because the fill colour is below AA as text on the ground.

### Secondary
- **Brass** (`#cfa93a` dark / `#7a5a12` light): **an award outcome, and nothing else.** A nomination that paid, a win, a seal on a poster. Never "drafted", never decoration, never a highlight.
- **Beam** (`#7fa6b8` dark / `#3f6273` light): scheduled and not yet — a countdown, a date to be announced, a live surface before it goes live. The projector's colour. **Ink, never a fill:** no on-beam contrast pairing has been measured, so a beam fill would need its own token first.

### Neutral
- **Ground** (`#0a0910` / `#efeae2`): the room. The page's own background, behind everything.
- **Panel** (`#16131c` / `#fbf9f6`): the default raised surface — the layer most content sits on.
- **Surface** (`#211c29` / `#e7e1d7`): the top step, for something sitting on a panel.
- **Rule** (`#302938` / `#d5cdc0`): dividers and table rules only — never a card outline.
- **Text** primary / secondary / dim (`#efece9` / `#a8a1b2` / `#8c8598` dark).

### Tertiary
- **Score** high / mid / low (`#63c08a` / `#d6a64a` / `#e06c74`): critic-score bands only, ported from Metacritic so a film does not look better here than there. **Text and border, never a fill** — filling forces all three dark enough to carry white text, which makes them muddy and mutually indistinguishable, destroying the one thing a traffic light is for.

### Named Rules

**The Brass Rule.** Brass means an award outcome. If the thing being coloured
is not a nomination that paid or a win, it is not brass. This was measured: 570
brass elements on a real league page, every one of them the word "Won", and the
largest board in the corpus renders zero because none of its films won anything.

**The Fill/Ink Rule.** `accent-fill` is for fills and `accent-text` for text;
they are different colours because the fill is unreadable as text on the ground.
A component that paints text *on* a fill uses that fill's `contrast` token and
never `text-primary` — handing it `text-primary` is what once put a sign-in
button at 2.45:1.

**The Dim Rule.** `text-dim` is for text a reader never needs to read —
decoration, disclosure marks, placeholders standing in for absent content.
Real but subordinate content (column headers, metadata, ledger lines, status
words) is `text-secondary`. The test: if removing the text would lose
information, it is not dim.

## Typography

**Display / UI Font:** Archivo (with system-ui, sans-serif)
**Name Font:** Instrument Serif (with Georgia, serif)
**Numeric Font:** IBM Plex Mono, tabular figures
**Wordmark Only:** Sora — the one place it appears in the product

**Character:** Archivo carries structure with a large x-height that stays legible
at label sizes; Instrument Serif carries *names* — films, leagues, people —
because a proper noun should look different from a heading. Numbers a reader
might add up are set in Plex Mono with tabular figures so columns align.

**Scale:** 28 / 20 / 17 for headings (h4 shares h3's 17px — three sizes for four
levels, deliberately, since a fourth step would collide with body), 15px body,
13px small, 11px labels as the floor. The scale lives in `@theme` custom
properties, so `text-sm` *is* 15px; an arbitrary `text-[Npx]` fails the build.

**The name axis is separate.** A serif name renders 24px regardless of whether
it sits in an h2 or an h3, which is why the 28px h1 exists: the document's own
heading has to outrank a name.

## Layout

- **Content column** `max-w-3xl` for prose surfaces, wider for boards and tables.
- **Section rhythm:** 40px between sections, 16px within one, 8px within a group. Enforced by a grep, along with a strict 4px grid — the only ways off it are a `.5` Tailwind step or an arbitrary value.
- **Breakpoints:** the navigation rail appears at `xl` (1280px), where 208px of rail still leaves a ten-seat draft board 930px. The identity strip appears at `sm` (640px) — a phone keeps its five-slot tab bar, because five slots need 365px of a 390px screen and chrome does not fit beside them.
- **Two layouts, both in the DOM:** dense boards render a mobile list and a desktop table, one hidden at any width. Count reachable elements, not elements.

## Elevation & Depth

**Flat and tonal. There are no shadows in this system.** Separation is a surface
step: ground → panel → surface. A card never wears a four-sided hairline; the
only borders are table rules and dividers, where the line carries meaning.

🔴 **Tone is the only cue.** The original spec for this decision also described
a 1px inset top highlight on a raised surface; the code never grew one, and
three surface steps turned out to be enough on their own. Documented here as
what ships, not as what was drawn.

## Shapes

- **6px is the default radius** — buttons, panels, chips, inputs. Never 0, which reads unstyled; never a pill, except where a shape is genuinely a badge.
- **Posters scale their own corner:** a percentage-based `clamp(4px, 2.8%, 12px)` so a 40px thumbnail gets ~4px and a hero poster ~12px from one declaration.
- **16px** exists for exactly one consumer, the full-width search overlay, where 6px would read as an unstyled box.
- Every touch target clears 44px.

## Components

- **Button** — MUI underneath, 6px radius, elevation disabled. Two accents: carmine (default) and brass, the latter only for an award-shaped action. Links that navigate are links, not buttons.
- **Panel** — the surface primitive, `tone="panel" | "surface"`. No border, no shadow.
- **SectionHead** — the only heading component; `as` sets both the tag and the size, so hierarchy cannot drift from semantics.
- **Eyebrow** — the only place uppercase is allowed, at 11px with 0.085em tracking.
- **StatusChip** — `brass | carmine | beam | neutral`. Brass is an outcome, carmine urgency, beam scheduled-not-yet. Never colour alone: the chip always carries a word.
- **PosterFrame / RemoteImage** — 2:3 posters with declared aspect ratios so grids do not reflow as images arrive; a won film carries the brass seal.
- **Dialogs are native `<dialog>` opened with `showModal()`** — the focus trap, Escape, the inert background and the backdrop are the platform's job.

## Do's and Don'ts

**Do** compute every number a page displays from the service that owns it. The
scoring page states the rule the app actually runs, and the app is the only
authority on what that is.

**Do** let both colour schemes be real: define the full palette on `:root`,
override only what changes, and prove every pairing with the contrast test.

**Do** give every animation a `prefers-reduced-motion` path that lands in the
finished state rather than removing the information.

**Don't** reach for `!important` to make a Tailwind class beat MUI. They coexist
through cascade layers ordered `theme, base, mui, components, utilities`; if a
utility is losing, the layer order is what's wrong.

**Don't** use brass for anything that is not an award outcome, or beam for
anything urgent.

**Don't** add a border to separate two things. Step the surface.

**Don't** introduce a font size outside the scale, a gap off the 4px grid, or a
raw hex outside the token system — all three fail the build, by design.

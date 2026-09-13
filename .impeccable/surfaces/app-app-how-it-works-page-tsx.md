---
version: 1
slug: "app-app-how-it-works-page-tsx"
primary_target: "app/(app)/how-it-works/page.tsx"
related_targets: []
---

## Scope

`/how-it-works` — the public explainer, Persuade. The audience is somebody a
member already sent a link to: they have no account, no seat, and no reason yet
to care about a league's standings. Success is that they understand the game
and know whether they have time for it.

## Direction contract

**THESIS.** The page runs on the season's own calendar, teaching one rule at the
moment that rule starts to matter. It refuses the rulebook arrangement the old
page shipped — prose panel, then a bare point table — where every rule arrives
at once, out of time, and the funniest fact in the game is the eighth
paragraph.

**OWN-WORLD.** The committed Cinemadraft system, unchanged: `bg-bg-ground`
under `bg-bg-panel` under `bg-bg-surface`, separation by surface step and never
a hairline (D72). Carmine is the product's own action, **brass is an award
outcome only** (D99), beam is scheduled-and-not-yet (D103). Archivo for
structure, Instrument Serif for names, the 28/20/17 ramp, 15px body, 4px
spacing grid, 6px radius. Recognizable with all content removed by one thing:
a dated vertical spine down the left, its beats keyed by colour — beam ahead,
carmine now, brass paid out, one red debit.

**STORY.** A reader arrives knowing nothing. They learn, in order: you draft a
team of films before the season starts; nominations arrive on real dates and
pay their category's points; a win pays that category a second time; a Razzie
nomination takes points off you; the season is about five months and ends at
the Oscars. They leave either starting a league or watching this season.

**FIRST VIEWPORT.** At 1440: the h1 and a two-line lede top-left over the
ground, no card. Immediately under it, the spine begins — a vertical rule down
the left gutter with the first beat, **draft night**, as the first dated node:
a real film from the restored corpus being taken, its poster at roster scale,
the seat name beside it. The lede's last clause carries the Razzie inversion so
it is above the fold at 390px. The primary action ("Start a league") sits at
the spine's end, not in the first viewport — the offer is made after the
argument, per the PLAN's own section order — with one repeat in the chrome-free
footer beat. At 390px the spine collapses to a 2-col rail and the beats stack.

**FORM.** The season spine, index 2 of my seven ordered structures, dealt by
`concept-seed --scope surface --mode persuade`, seed key **3ece0956**, dealt
indices 3/5/2, lead 3 — the user declined the dealt lead (standings-first) and
locked this one. Code-led: no comp round; the ambition lives in FIRST VIEWPORT
and in the signature interaction — **each beat's points ledger totals in place
as it enters**, an exponential ease-out from an already-visible resting state,
with a `prefers-reduced-motion` path that renders every total already arrived.

**FINISH.** unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.

## Constraints that outrank taste

- Every number computed from `lib/services/scoring.ts` or the `points` table.
  No testimonial, no metric, no invented claim (PRODUCT.md § Evidence on Hand).
- The page must render for a signed-out reader with an empty season.
- Phase 3.5 primitives, each new component with a Storybook story.

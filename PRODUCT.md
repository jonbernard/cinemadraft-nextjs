# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Sixty-odd friends and family in private leagues, most of them film-literate
adults who already follow awards season. They are not fantasy-sports power
users: the league is a group chat with scoring attached, run for one season a
year by an owner who does the administration for everybody else.

Three jobs, in descending frequency: **check where I stand** (a member, on a
phone, after a ceremony); **run the draft** (an owner, once a season, on a
video call with the league watching); **explain the game to someone new** (a
member sending a link into a group chat, which is the job `/how-it-works`
exists for).

## Product Purpose

Draft a team of films before awards season, then score every nomination and win
they collect across twelve award shows. Success is a league that keeps playing:
the season has two peak moments — draft night and ceremony night — and the
product's job is to make both legible and to keep the standings honest in
between.

## Positioning

The scoring rule is the product. Twelve real award shows, tiered categories,
a nomination worth its category's points and a win worth those points twice
(because a winner was necessarily nominated). **Razzie nominations score
negative**, which is the rule people quote — but 🔴 **it is minor arithmetic,
not the hook** (owner, 2026-09-12, correcting an earlier reading of this file):
across a season the worst pick costs a fraction of what the best one earns, and
a surface that gives the inversion its own section weights a footnote like a
headline. What a neighbouring product does not have is the twelve-show scoring
rule itself.

Nothing about it is a marketplace or a public competition: leagues are private
and invite-only, and there is no global directory of members (D100).

## Operating Context

The season runs roughly September to March. Nomination dates and ceremony dates
are real, published, and already in the database (`events.nom_date`,
`events.awards_date`), so the season has a visible shape. A league drafts once,
in a snake order, usually on a call. After that the app is read-mostly until a
ceremony, when an admin enters winners and every league's standings move at
once.

## Capabilities and Constraints

- Twelve shows in three groups: the nine "Alphabet Awards" (guilds, BAFTA, AFI,
  ASC, ACE, ADG), the Golden Globes, the Academy Awards, and the Razzies.
- Golden Globes, Academy Awards and Razzies are tiered (1: Best Picture; 2:
  acting, writing, directing; 3: everything else televised). Alphabet Awards are
  flat — every category worth the same.
- Any film may be picked; there is no authoritative eligibility list.
- Point values live in the `points` table and are read through
  `lib/services/scoring-table.ts`. The scoring rule itself is
  `lib/services/scoring.ts` and is the single definition (D19, D41).
- Free tier is a standing constraint: Vercel Hobby and Neon Free (D102).
- Auth is Clerk; league and member pages are public so a pasted link opens,
  but are not indexed.

## Brand Commitments

The mark is a broken film reel with a carmine hub; the wordmark is Sora, the
one place Sora is used (D83). The palette is carmine for the product's own
actions, **brass for an award outcome only** (D99), and beam for scheduled and
not-yet. Names are set in Instrument Serif, structure in Archivo (D70).
Separation is a surface step, never a hairline border (D72).

## Evidence on Hand

Real, and the only material this page may use: the `points` table; every
nomination and win in the restored corpus, including nine seasons of real
league play; the twelve shows' logos in Blob storage; real nomination and
ceremony dates.

**There are no testimonials, no customer logos, no usage metrics, and no
pricing.** `docs/PLAN.md` § Phase 18 forbids inventing any. A figure that
cannot be traced to the scoring service or the `points` table does not go on
the page.

## Product Principles

1. Every number is computed, never typed. The page that explains the scoring is
   the worst possible place to drift from it.
2. The Razzie inversion is a good line, not the argument. Worth a clause
   wherever the scoring is explained; never worth a section of its own.
3. A league is private. Nothing here recruits strangers into a public
   competition; the audience is somebody a member already invited.
4. The season has a shape, and a reader deciding whether to play needs to know
   whether this is a weekend or five months.

## Accessibility & Inclusion

WCAG AA contrast is enforced by `theme/contrast.test.ts`; touch targets ≥44px;
colour is never the only carrier of state; every animation has a
`prefers-reduced-motion` path. The page must work at 390px.

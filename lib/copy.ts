/**
 * The product's one claim, written once (P18.T10).
 *
 * The signed-out `/` hero and `/how-it-works`'s opener make the same argument
 * to the same stranger. Two hand-typed copies of it drift the first time
 * either page is edited, and nobody notices until the two pages say different
 * things about the same game — so the sentence lives here and the pages read
 * it.
 *
 * 🔴 `/how-it-works/page.tsx` still holds the literals inline: P18.T10 runs
 * beside an SEO pass on that file (branch `p18seo`) and may not edit it. It is
 * pinned to these exact strings by `app/(app)/how-it-works/page.test.tsx`
 * instead, so an edit to either copy goes red rather than silently forking;
 * the literals there become imports the moment the two branches are merged.
 */

/** The headline. Both public surfaces open on it. */
export const PITCH_HEADLINE = 'Draft a team of films. Let the awards keep score.';

/**
 * The pitch, Razzie clause included — the inversion is the funniest fact in
 * the game and it is not allowed to sink below the fold again (Phase 18).
 */
export const PITCH =
  'Pick before the nominations land — then every nomination pays, every win pays twice, and every Razzie takes points back.';

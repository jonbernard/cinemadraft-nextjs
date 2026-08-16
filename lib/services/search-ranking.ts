/**
 * How search results are ordered (§10).
 *
 * Search is load-bearing in three different places and the source app served
 * none of them: `server/routes/search.js` forwarded the query straight to TMDB
 * and returned the page unaltered — no local table, no dedupe, no awards
 * relevance. The three jobs are genuinely different:
 *
 * | Context | What the person is doing | What must rank first |
 * |---|---|---|
 * | draft | finding a film for this award year | eligible films the system knows, with taken ones sunk |
 * | browse | finding any film | general relevance, tracked films marked |
 * | award-admin | attaching a nominee | ingested films, exact titles, year-scoped |
 *
 * This is a pure function on purpose: it is the only interesting logic in the
 * search path, and keeping it away from the database means it is tested
 * directly rather than through a query.
 */

export type SearchContext =
  | {
      kind: 'draft';
      year: number;
      /** Films already taken in this league — sunk, never hidden. */
      takenMovieIds: readonly number[];
    }
  | { kind: 'browse' }
  | { kind: 'award-admin'; year: number };

export type Candidate = {
  /** Null for a film TMDB knows and this app has never ingested. */
  id: number | null;
  tmdbId: string | null;
  title: string;
  releaseYear: number | null;
  isLocal: boolean;
  /** Years this film has a nomination in. Empty for most films. */
  nominatedYears: readonly number[];
  /**
   * Bare TMDB poster path, from whichever source produced this candidate.
   *
   * Carried here rather than looked up afterwards because a TMDB-only result
   * has no local row to look it up from, and §10 asks for poster-first results
   * — this audience recognises films by artwork faster than by title, so a
   * result with no image is a result that does not do its job.
   */
  posterPath: string | null;
};

/**
 * Weights, not magic numbers.
 *
 * An exact title outranks everything because someone typing a whole title has
 * told you what they want. Being local outweighs any single relevance signal
 * except that: a local row is already ingested, already scoreable, already
 * carries an accent colour, and a TMDB duplicate ranked above it would offer
 * the copy that cannot be drafted.
 */
const WEIGHT = {
  exactTitle: 1000,
  prefix: 400,
  wordPrefix: 200,
  local: 300,
  nominatedInYear: 250,
  /**
   * Released in the year an award season actually honours — the year before
   * it. Measured across every nomination in the restored data with a known
   * release date: **96.5% sit exactly one year before their season**.
   */
  releasedInSeason: 120,
  /**
   * One year either side of that: the season year itself (1.5%) and two years
   * before (1.9%).
   */
  releasedNearSeason: 100,
  /**
   * 🔴 The long tail, out to five years before the season.
   *
   * Confirmed by the owner as their own search practice, and the data says
   * why: the nominations with a long gap are **shorts and foreign-language
   * films**, whose TMDB primary release year is a festival or home-country
   * date years before the award that recognises them. *This Is Endometriosis*
   * is a 2022 film nominated for Best Short Film in **2026**; *Son of Saul*
   * and *The Handmaiden* carry 2015 and 2016 dates against 2017 and 2018
   * seasons.
   *
   * Weighted well below the dominant case rather than flat across the window.
   * A flat ±5 would rank a 2021 film level with a 2025 one for the 2026
   * season, discarding the signal that is correct 96.5% of the time — and
   * nothing here is a filter, so a film outside the window is still findable,
   * just not promoted.
   */
  releasedInSeasonTail: 55,
  /**
   * 🔴 Negative, and deliberately smaller than an exact title match.
   *
   * A taken film sinks below an **equally relevant available** film — not
   * below everything. The owner typed that title because someone said it out
   * loud, so if the film is gone the most useful thing on screen is that film,
   * marked Taken. Burying it under an unrelated title that happens to be
   * available answers a question nobody asked, and the owner goes on hunting
   * for the one they were told about.
   *
   * Hiding it outright would be worse still: the UI could no longer say it is
   * taken, and an absent film reads as "not in the system".
   */
  alreadyTaken: -900,
} as const;

/**
 * How far before a season a nominated film's release year can sit.
 *
 * Five, per the owner's own search practice, and the data supports it: the
 * outliers are shorts and foreign-language films. Everything from 0 to 5 years
 * before the season is boosted, on a curve rather than flatly.
 */
const SEASON_WINDOW = 5;

/**
 * How much a film's release year suggests it belongs to this award season.
 *
 * A season *honours the previous year*, so the gap — not the year — is what
 * carries the meaning. Zero for anything outside the window; ranking never
 * excludes, so those films still appear.
 */
function seasonBoost(releaseYear: number | null, seasonYear: number): number {
  if (releaseYear == null) return 0;

  const gap = seasonYear - releaseYear;
  // A film dated after its season. No nomination in ten years of data has one,
  // and a draft picks films already scheduled, so this earns nothing.
  if (gap < 0 || gap > SEASON_WINDOW) return 0;

  if (gap === 1) return WEIGHT.releasedInSeason;
  if (gap === 0 || gap === 2) return WEIGHT.releasedNearSeason;
  return WEIGHT.releasedInSeasonTail;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** Score one candidate. Higher is better; nothing is ever excluded. */
function score(query: string, candidate: Candidate, context: SearchContext): number {
  const q = normalize(query);
  const title = normalize(candidate.title);
  let total = 0;

  if (title === q) total += WEIGHT.exactTitle;
  else if (title.startsWith(q)) total += WEIGHT.prefix;
  else if (title.split(/\s+/).some((word) => word.startsWith(q))) {
    // "battle" should find "One Battle After Another" — the owner is repeating
    // a title they heard, and people rarely start at the first word.
    total += WEIGHT.wordPrefix;
  }

  if (candidate.isLocal) total += WEIGHT.local;

  if (context.kind !== 'browse') {
    if (candidate.nominatedYears.includes(context.year)) total += WEIGHT.nominatedInYear;
    total += seasonBoost(candidate.releaseYear, context.year);
  }

  if (
    context.kind === 'draft' &&
    candidate.id != null &&
    context.takenMovieIds.includes(candidate.id)
  ) {
    total += WEIGHT.alreadyTaken;
  }

  return total;
}

/**
 * Order candidates for this query and context.
 *
 * 🔴 **Ranking orders; it never filters.** Every candidate handed in comes
 * back. Dropping one would make the UI unable to distinguish "no such film"
 * from "that film is unavailable", and those need different reactions from the
 * person searching.
 *
 * The sort is **total** — ties break on title, then on id — so the same input
 * always produces the same output. That matters more than it sounds during a
 * live draft: the owner is aiming at a row, and two equally-scored films that
 * swapped places between keystrokes would move the target under the cursor.
 */
export function rankCandidates(
  query: string,
  candidates: readonly Candidate[],
  context: SearchContext,
): Candidate[] {
  const scored = candidates.map((candidate) => ({
    candidate,
    score: score(query, candidate, context),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const byTitle = a.candidate.title.localeCompare(b.candidate.title);
    if (byTitle !== 0) return byTitle;
    return (a.candidate.id ?? 0) - (b.candidate.id ?? 0);
  });

  return scored.map((entry) => entry.candidate);
}

/**
 * Merge two sources into one list, deduped on `tmdbId`, the local row winning.
 *
 * §10: "a film must never appear twice". The local row wins because it is the
 * one that can be drafted, nominated and scored — the TMDB copy is a stranger
 * with the same name.
 *
 * A candidate with no `tmdbId` can never be a duplicate of anything, so it is
 * kept as-is rather than collapsed with every other id-less row.
 */
export function mergeCandidates(
  local: readonly Candidate[],
  remote: readonly Candidate[],
): Candidate[] {
  const seen = new Set(
    local.flatMap((candidate) => (candidate.tmdbId == null ? [] : [candidate.tmdbId])),
  );

  return [
    ...local,
    ...remote.filter((candidate) => {
      if (candidate.tmdbId == null) return true;
      if (seen.has(candidate.tmdbId)) return false;
      seen.add(candidate.tmdbId);
      return true;
    }),
  ];
}

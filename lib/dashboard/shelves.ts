import type { LeagueView, RosterEntry } from '@/lib/services/dashboard';

/**
 * The lower fold's two shelves, as pure functions of what `getDashboard`
 * already returns (spec §1, fault 5: "Home is ~60% empty below the fold").
 *
 * Separate from `lib/services/dashboard.ts` because it fetches nothing: this
 * is arrangement, not assembly, and keeping it here is what lets it be tested
 * without a database. The import above is type-only and erases at build time,
 * so nothing in this module reaches a repository.
 *
 * 🔴 Both shelves are a *different cut* of the roster, never a second copy of
 * it. The strips on the page are ordered by draft round and must stay that way
 * — snake order is real information — so neither "what is carrying my team"
 * nor "what did I take most recently" has anywhere else to be answered.
 */

/** One frame on a shelf. */
export type ShelfFilm = {
  id: number;
  title: string;
  points: number;
  /**
   * 0–1, this film measured against the best on **its own shelf**.
   *
   * Deliberately not `RosterEntry.share`, which is a share of one seat's
   * total: a film held in two leagues has two of those, and the shelf would
   * draw whichever copy it happened to keep. Rescaling here gives the
   * contribution bar one meaning per shelf regardless of how many leagues the
   * viewer plays in.
   */
  share: number;
};

export type ShelfView = {
  /** Distinct films the viewer holds across every league this season. */
  held: number;
  /** How many of those qualified for this shelf, before the cap. */
  matching: number;
  /** At most `SHELF_LIMIT`, already in shelf order. */
  films: ShelfFilm[];
};

/**
 * A shelf scrolls, so the cap is about attention rather than space: past a
 * dozen frames nobody is reading, they are scrubbing. The eyebrow reports the
 * uncapped count so the number never understates the team.
 */
export const SHELF_LIMIT = 12;

/**
 * Every film the viewer holds, once.
 *
 * One film drafted in two leagues is one film — points come from
 * `pointsForMovieIds(ids, year)` and are a property of the film and the
 * season, not of the seat, so both entries carry the same score and showing it
 * twice would read as two different films with the same name. The most recent
 * pick wins the tie, which is the only one of the two that "recent" can mean.
 */
function distinct(leagues: readonly LeagueView[]): RosterEntry[] {
  const byFilm = new Map<number, RosterEntry>();
  for (const entry of leagues.flatMap((league) => league.roster)) {
    const held = byFilm.get(entry.movie.id);
    if (held == null || isNewer(entry, held)) byFilm.set(entry.movie.id, entry);
  }
  return [...byFilm.values()];
}

/**
 * Newest pick first, untimed last.
 *
 * Written out rather than subtracting two `?? -Infinity` fallbacks: two
 * untimed picks would make that `-Infinity - -Infinity`, i.e. `NaN`, and a
 * comparator returning NaN leaves the sort order unspecified.
 */
function byTime(a: RosterEntry, b: RosterEntry): number {
  if (a.pickedAt == null && b.pickedAt == null) return 0;
  if (a.pickedAt == null) return 1;
  if (b.pickedAt == null) return -1;
  return b.pickedAt - a.pickedAt;
}

/** Later pick first; an untimed pick never displaces a timed one. */
function isNewer(a: RosterEntry, b: RosterEntry): boolean {
  if (a.pickedAt == null) return false;
  if (b.pickedAt == null) return true;
  return a.pickedAt > b.pickedAt;
}

function toShelf(held: number, matching: RosterEntry[]): ShelfView {
  const films = matching.slice(0, SHELF_LIMIT);
  // The shelf's own scale. Guarded: a shelf where nothing has scored would
  // divide by zero and render every bar as NaN.
  const best = films.reduce((top, entry) => Math.max(top, entry.points), 0);

  return {
    held,
    matching: matching.length,
    films: films.map((entry) => ({
      id: entry.movie.id,
      title: entry.movie.title ?? 'Untitled',
      points: entry.points,
      share: best > 0 ? entry.points / best : 0,
    })),
  };
}

/**
 * The viewer's films ranked by what they have scored.
 *
 * Films on zero are excluded rather than sorted to the end: a shelf is read as
 * a recommendation, and a tail of zeroes says nothing the roster strip has not
 * already said. On opening day that leaves the shelf empty, which is correct —
 * the page renders nothing rather than a row of zeroes.
 *
 * Ties break by film id so the order is total, and therefore stable between a
 * server render and any re-render of the same data.
 */
export function topScorers(leagues: readonly LeagueView[]): ShelfView {
  const films = distinct(leagues);
  const scoring = films
    .filter((entry) => entry.points > 0)
    .sort((a, b) => b.points - a.points || a.movie.id - b.movie.id);

  return toShelf(films.length, scoring);
}

/**
 * The viewer's films in the order they were taken, newest first.
 *
 * 🔴 Ordered by `pickedAt`, which is a real pick time for every season the
 * dashboard can show. Verified against the restored data rather than assumed:
 * the 2024, 2025 and 2026 drafts have a distinct timestamp on every row,
 * minutes apart and monotonic in `order`. The 2017–2022 rows *do* share one
 * import stamp — but they are historic seasons, and the dashboard only ever
 * renders `getActiveYear()`. The `round` tie-break below is what keeps those
 * legacy rows in a sensible order anyway if a league ever reopens one, and it
 * is why this does not fall back to insertion order.
 *
 * An untimed pick sorts last rather than to the epoch: unknown is not old.
 */
export function recentPicks(leagues: readonly LeagueView[]): ShelfView {
  const films = distinct(leagues);
  const newest = [...films].sort(
    (a, b) => byTime(a, b) || b.round - a.round || a.movie.id - b.movie.id,
  );

  return toShelf(films.length, newest);
}

/**
 * A TMDB poster path turned into something an `<img>` can load.
 *
 * `movies.poster` holds a bare path — `/4Iu5f2nv7huqvuYkmZvSPOtbFjs.jpg` — and
 * the repository deliberately leaves it that way: the host and the size belong
 * to the renderer, not to the row. Storing an absolute URL would freeze both
 * into the database, and TMDB has changed its image host before.
 *
 * The phase gate for the draft board is that a taken film is unmistakable from
 * artwork alone (§6.7), so this is load-bearing rather than decorative — a
 * board of grey placeholders would fail it.
 *
 * Sizes are TMDB's own bucket names; anything else 404s. `w185` is the board
 * cell, `w342` the console's search results and roster strip. Phase 11 moves
 * media behind `next/image` and this becomes the loader's input.
 *
 * `w1280` is a **backdrop** bucket rather than a poster one — TMDB serves the
 * two shapes from the same host under different size lists, and this function
 * only ever builds the path. The browse hero (P15.T8) is its one caller.
 */
export type PosterSize = 'w92' | 'w185' | 'w342' | 'w500' | 'w1280' | 'original';

const BASE = 'https://image.tmdb.org/t/p';

export function posterUrl(path: string | null, size: PosterSize = 'w185'): string | null {
  if (!path) return null;
  // Stored paths lead with a slash, but a path pasted in by hand may not.
  return `${BASE}/${size}${path.startsWith('/') ? path : `/${path}`}`;
}

import { NotFoundError } from '@/lib/errors';
import { fetchTmdbFilm } from '@/lib/external/tmdb';
import { type Movie, movieRepository } from '@/lib/repositories/movies';

/**
 * Make sure a film exists locally, fetching it from TMDB if it does not.
 *
 * 🔴 **This is what makes a TMDB search result usable.** `movies` is a cache of
 * TMDB: a film enters it the first time somebody drafts or nominates it, and
 * every id the rest of the app deals in — draft picks, nominations, winners,
 * watchlists — is a *local* `movies.id`. A search result with only a `tmdbId`
 * is therefore not yet something anyone can act on, and this is the step that
 * converts one into something they can.
 *
 * Ported from the source app's `saveFilm` (`server/utils/routes.js:26`), which
 * both `POST /draftpicks/add` and `POST /nominations` called for exactly this
 * reason. The port keeps its two decisions:
 *
 * - **Look up by `tmdbId` first.** A film already cached is returned as-is
 *   rather than re-fetched; TMDB is asked once per film, ever.
 * - **The cached row wins.** No refresh, no overwrite. A row may have been
 *   edited by hand, and it carries an `accentHex` this app derived and TMDB
 *   knows nothing about.
 *
 * Throws `NotFoundError` when TMDB cannot supply the film — including when no
 * key is configured, because from the caller's side those are the same
 * situation: the film cannot be obtained, and the action must refuse rather
 * than write a half-film.
 */
export async function ensureFilm(tmdbId: string): Promise<Movie> {
  const existing = await movieRepository.findByTmdbId(tmdbId);
  if (existing) return existing;

  const detail = await fetchTmdbFilm(tmdbId);
  if (!detail) throw new NotFoundError('film on TMDB', tmdbId);

  return movieRepository.upsertByTmdbId(detail);
}

/**
 * Resolve whichever identifier a caller has into a local film.
 *
 * Search returns both kinds of result — a local row with an `id`, and a TMDB
 * film with only a `tmdbId` — and every action that accepts a film has to
 * handle both. Putting that here means each action states *what* it needs
 * rather than repeating how to get it.
 */
export async function resolveFilm(input: {
  movieId?: number | null;
  tmdbId?: string | null;
}): Promise<Movie> {
  if (input.movieId != null) return movieRepository.findById(input.movieId);
  if (input.tmdbId) return ensureFilm(input.tmdbId);
  throw new NotFoundError('film', 'no identifier given');
}

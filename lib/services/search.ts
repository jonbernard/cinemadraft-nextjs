import { searchTmdb } from '@/lib/external/tmdb';
import { type Movie, movieRepository } from '@/lib/repositories/movies';
import { nominationRepository } from '@/lib/repositories/nominations';
import { posterUrl } from '@/lib/utils/poster';
import {
  type Candidate,
  mergeCandidates,
  rankCandidates,
  type SearchContext,
} from './search-ranking';

export type { SearchContext } from './search-ranking';

export type FilmResult = {
  /** Null for a film TMDB knows and this app has never ingested. */
  id: number | null;
  tmdbId: string | null;
  title: string;
  year: number | null;
  posterUrl: string | null;
  /** True when the film is already taken in the caller's league. */
  isTaken: boolean;
  /** False for a TMDB-only result — it must be ingested before it can be used. */
  isLocal: boolean;
};

/** How many candidates the local query considers before ranking. */
const LOCAL_LIMIT = 25;

type RemoteSource = (query: string) => Promise<Candidate[]>;

function toCandidate(movie: Movie, nominatedYears: readonly number[]): Candidate {
  return {
    id: movie.id,
    tmdbId: movie.tmdbId,
    title: movie.title ?? 'Untitled',
    releaseYear: movie.releaseDate ? movie.releaseDate.getUTCFullYear() : null,
    isLocal: true,
    nominatedYears,
    posterPath: movie.poster,
  };
}

/**
 * Find films, local first (§10).
 *
 * The source app's search was a proxy: `server/routes/search.js` forwarded the
 * query to TMDB and returned the page. It never consulted the local table, so
 * the film the league had drafted for ten years ranked below whatever TMDB
 * thought was popular, and the result the owner picked could be a film the app
 * did not have.
 *
 * The order here is the opposite: local rows rank first because they are the
 * ones that can be drafted, nominated and scored today.
 *
 * 🔴 **But TMDB is always asked.** `movies` is a *cache* of TMDB — a film
 * enters it the first time somebody drafts or nominates it — so the local
 * table can only ever answer with films the league has already used. Gating
 * the remote call on "local results look thin" would mean a query like
 * "wicked", which matches several cached films, never reaches TMDB, and the
 * brand-new release nobody has drafted yet stays invisible at exactly the
 * moment somebody is trying to draft it. Cheap answers are not the point;
 * finding the film is. The rate limit is handled by caching identical queries
 * (`lib/external/tmdb.ts`), not by declining to ask.
 *
 * `remote` defaults to TMDB and is overridable so this function is testable
 * without a network.
 */
export async function findFilms(
  query: string,
  context: SearchContext,
  remote: RemoteSource = searchTmdb,
): Promise<FilmResult[]> {
  const trimmed = query.trim();
  if (trimmed === '') return [];

  const movies = await movieRepository.searchFuzzy(trimmed, LOCAL_LIMIT);

  // One query for every candidate's nomination years, not one per film.
  const nominations = await nominationRepository.findManyByMovieIds(
    movies.map((movie) => movie.id),
  );
  const yearsByMovie = new Map<number, number[]>();
  for (const nomination of nominations) {
    const year = nomination.year;
    if (year == null) continue;
    const existing = yearsByMovie.get(nomination.movieId);
    if (existing) existing.push(year);
    else yearsByMovie.set(nomination.movieId, [year]);
  }

  const local = movies.map((movie) =>
    toCandidate(movie, yearsByMovie.get(movie.id) ?? []),
  );

  // 🔴 A TMDB failure must never fail the search. Somebody is mid-draft and can
  // see the local films in front of them; an error where the results should be
  // is strictly worse than a shorter list.
  //
  // The season is not passed: an award year honours the previous year's films,
  // so filtering TMDB by it hides the candidates (see `searchTmdb`). Ranking
  // applies the season instead, as a boost.
  const fetched = await remote(trimmed).catch(() => [] as Candidate[]);
  const candidates = mergeCandidates(local, fetched);

  const taken =
    context.kind === 'draft' ? new Set(context.takenMovieIds) : new Set<number>();

  return rankCandidates(trimmed, candidates, context).map((candidate) => ({
    id: candidate.id,
    tmdbId: candidate.tmdbId,
    title: candidate.title,
    year: candidate.releaseYear,
    posterUrl: posterUrl(candidate.posterPath, 'w92'),
    isTaken: candidate.id != null && taken.has(candidate.id),
    isLocal: candidate.isLocal,
  }));
}

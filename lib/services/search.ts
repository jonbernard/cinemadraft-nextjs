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

/**
 * How thin local results have to be before TMDB is worth asking (§10).
 *
 * The point is the rate limit: during a live draft the same handful of queries
 * are typed over and over, and every one of them already matches locally
 * because the league has been drafting these films for a decade. Asking TMDB
 * anyway would spend the budget on questions already answered.
 */
const TMDB_THRESHOLD = 5;

/** How many candidates the local query considers before ranking. */
const LOCAL_LIMIT = 25;

type RemoteSource = (query: string, year: number | null) => Promise<Candidate[]>;

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
 * The order here is the opposite. Local rows are the valuable ones — already
 * ingested, already scoreable, already carrying an accent — so they are found
 * first, and TMDB is asked only when there are too few of them to be a useful
 * answer.
 *
 * `remote` defaults to TMDB and is overridable so this function is testable
 * without a network. It behaves identically whether TMDB is configured or not:
 * with no key `searchTmdb` returns nothing and this is a local search, which
 * is a correct answer rather than a degraded one.
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
    if (nomination.year == null) continue;
    const year = Number(nomination.year);
    if (!Number.isSafeInteger(year)) continue;
    const existing = yearsByMovie.get(nomination.movieId);
    if (existing) existing.push(year);
    else yearsByMovie.set(nomination.movieId, [year]);
  }

  const local = movies.map((movie) =>
    toCandidate(movie, yearsByMovie.get(movie.id) ?? []),
  );

  let candidates = local;
  if (local.length < TMDB_THRESHOLD) {
    const year = context.kind === 'browse' ? null : context.year;
    // 🔴 A TMDB failure must never fail the search. The owner is mid-draft and
    // can see the film in the local list; an error where the results should be
    // is strictly worse than a shorter list.
    const fetched = await remote(trimmed, year).catch(() => [] as Candidate[]);
    candidates = mergeCandidates(local, fetched);
  }

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

import type { Candidate } from '@/lib/services/search-ranking';
import { tmdbFetch } from './tmdb-client';

/**
 * Search, and the one-film fetch that caches a search result locally.
 *
 * The transport lives in `tmdb-client.ts`; this module is the two queries the
 * draft and nomination flows need, and the field mapping they depend on.
 *
 * 🔴 **TMDB is the source of truth for films; `movies` is a cache of it.**
 * Every one of the 1,355 local rows carries a `tmdbId` because every one of
 * them arrived this way — a film enters the database the first time somebody
 * drafts or nominates it, and never before. So a search that consults only the
 * cache can only ever find films the league has already used, which is the
 * opposite of what search is for during nominations season.
 *
 * That makes a `TMDB_API_KEY` a **requirement, not an enhancement**. Without
 * one this module returns nothing and the app degrades to searching its own
 * history: existing pages still render, existing films are still findable, and
 * no new film can be drafted or nominated at all.
 *
 * Failures are still absorbed rather than thrown — a timeout mid-draft should
 * cost the remote results, not the local ones — but "no key" is a
 * misconfiguration, not a mode.
 */

type TmdbMovie = {
  id: number;
  title?: string;
  release_date?: string;
  poster_path?: string | null;
};

/** The single-film response, with `release_dates` appended. */
type TmdbMovieDetail = TmdbMovie & {
  imdb_id?: string | null;
  backdrop_path?: string | null;
  release_dates?: {
    results?: {
      iso_3166_1?: string;
      release_dates?: { release_date?: string }[];
    }[];
  };
};

/** What the local cache needs to store a film TMDB knows about. */
export type TmdbFilmDetail = {
  tmdbId: string;
  imdbId: string | null;
  title: string;
  sortTitle: string;
  poster: string | null;
  backdrop: string | null;
  releaseDate: Date | null;
};

/**
 * Re-exported so callers that already depend on this module do not need to know
 * the transport was split out from under them.
 */
export { isTmdbConfigured } from './tmdb-client';

function toCandidate(movie: TmdbMovie): Candidate {
  const year = movie.release_date ? Number(movie.release_date.slice(0, 4)) : Number.NaN;
  return {
    // Null id: TMDB knows this film and this app has never ingested it. It
    // cannot be drafted or nominated until it is saved locally.
    id: null,
    tmdbId: String(movie.id),
    title: movie.title ?? 'Untitled',
    releaseYear: Number.isSafeInteger(year) ? year : null,
    isLocal: false,
    nominatedYears: [],
    posterPath: movie.poster_path ?? null,
  };
}

/**
 * Search TMDB for films matching a title.
 *
 * Returns `[]` — never throws — when there is no key, when the request fails,
 * when it times out, or when the response is not the shape expected. Every one
 * of those is "TMDB added nothing this time", and the caller has local results
 * in hand. An exception here would turn a slow third party into a broken
 * search box during a live draft.
 *
 * 🔴 **The award year is deliberately NOT sent to TMDB.** An earlier version
 * passed it as `primary_release_year`, which looked like sensible scoping and
 * excluded almost every film the caller wanted: an award season honours the
 * *previous* year's releases. Measured in the restored data — of 526
 * nominations in the 2026 season, **507 are 2025 films and 7 are 2026 films**.
 * Filtering on the season year therefore hid 96% of the candidates, and an
 * admin entering nominations would have found nothing. Caught by an E2E test
 * that tried to nominate a real film TMDB knows.
 *
 * The year still matters — it just belongs to *ranking* (`search-ranking.ts`),
 * where being in season is a boost rather than a filter, and nothing gets
 * excluded for being a year out.
 *
 * Cached on the query alone, since that is now the only input.
 */
export async function searchTmdb(query: string): Promise<Candidate[]> {
  const trimmed = query.trim();
  if (trimmed === '') return [];

  const body = await tmdbFetch<{ results?: unknown }>(
    '/search/movie',
    { query: trimmed },
    {
      key: `tmdb:search:${trimmed.toLowerCase()}`,
      tags: ['tmdb', 'tmdb-search'],
      name: 'tmdb-search',
    },
  );

  const results = body?.results;
  if (!Array.isArray(results)) return [];

  return results
    .filter((entry): entry is TmdbMovie => {
      const movie = entry as TmdbMovie;
      return typeof movie?.id === 'number' && typeof movie?.title === 'string';
    })
    .map(toCandidate);
}

/**
 * The US release date, falling back to TMDB's primary one.
 *
 * Ported from `server/utils/routes.js:34-42` rather than simplified. The league
 * is scored on US award seasons, and a film's international date can fall in a
 * different eligibility year — so preferring the US entry is a domain rule,
 * not a formatting preference.
 *
 * It takes the **first** US entry of any release type, which is what the source
 * did, and that was checked against the live API rather than assumed. Across
 * twelve real award films — Oppenheimer, Sinners, Wicked, Killers of the Flower
 * Moon, CODA, Dune: Part Two among them — the first US entry and the
 * theatrical one give the **same year every time**, because a contender's
 * premiere and release fall in one eligibility year by design.
 *
 * It can differ on old catalogue titles: *Wicked City* (1992) has exactly one
 * US entry, a 1999 home-video release, so it stores 1999. Nothing scored
 * depends on this — `releaseDate` drives a ranking boost, the year shown beside
 * a search result, and watchlist sorting — so preferring theatrical types would
 * add a rule with no measured benefit on the films that matter. Recorded rather
 * than fixed, so the odd year has an explanation when somebody notices it.
 */
function releaseDateOf(detail: TmdbMovieDetail): Date | null {
  const us = detail.release_dates?.results?.find((entry) => entry.iso_3166_1 === 'US');
  const raw = us?.release_dates?.[0]?.release_date ?? detail.release_date;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Everything the local cache needs about one film.
 *
 * Returns null rather than throwing when TMDB cannot answer, so the caller
 * reports "that film could not be saved" instead of crashing a page.
 *
 * The field mapping matches the source app's `saveFilm` exactly, including two
 * rules that look arbitrary and are not:
 *
 * - **`imdbId` is stored without its `tt` prefix.** 1,355 existing rows are
 *   stored that way, and a new row keeping the prefix would be the only one
 *   that did — invisible until something compared or linked them.
 * - **`sortTitle` drops a leading "the" or "a".** It is what alphabetical
 *   ordering uses, so a new film would otherwise file under T.
 */
export async function fetchTmdbFilm(tmdbId: string): Promise<TmdbFilmDetail | null> {
  const detail = await tmdbFetch<TmdbMovieDetail>(
    `/movie/${tmdbId}`,
    { append_to_response: 'release_dates' },
    { key: `tmdb:film:${tmdbId}`, tags: ['tmdb', 'tmdb-film'], name: 'tmdb-film' },
  );

  if (typeof detail?.id !== 'number' || typeof detail?.title !== 'string') {
    return null;
  }

  return {
    tmdbId: String(detail.id),
    imdbId: detail.imdb_id ? detail.imdb_id.replace(/^tt/, '') : null,
    title: detail.title,
    sortTitle: detail.title.replace(/^(the|a)\s/i, ''),
    poster: detail.poster_path ?? null,
    backdrop: detail.backdrop_path ?? null,
    releaseDate: releaseDateOf(detail),
  };
}

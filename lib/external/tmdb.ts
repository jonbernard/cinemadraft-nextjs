import { tmdbEnv } from '@/lib/env';
import type { Candidate } from '@/lib/services/search-ranking';
import { cached } from './cache';

/**
 * The only module that knows TMDB exists.
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

const BASE = 'https://api.themoviedb.org/3';

/**
 * A day. TMDB's catalogue moves slowly and the same handful of queries are
 * typed over and over during a live draft, which is the case this exists for.
 */
const TTL_SECONDS = 86_400;

/** How long to wait before giving up and letting local results stand. */
const TIMEOUT_MS = 3_000;

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
 * Read the key at call time, not at module load.
 *
 * Reading it eagerly would bake the answer into the module the first time
 * anything imported it — which in tests is before a case can set or clear the
 * variable, and in a build is before the runtime environment exists.
 */
export function isTmdbConfigured(): boolean {
  return tmdbEnv.isConfigured;
}

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
 * Cached on query plus year, because those are the only inputs; two people
 * typing the same title in the same season are asking one question.
 */
export async function searchTmdb(
  query: string,
  year: number | null,
): Promise<Candidate[]> {
  const key = tmdbEnv.apiKey;
  if (!key) return [];

  const trimmed = query.trim();
  if (trimmed === '') return [];

  return cached(
    `tmdb:search:${year ?? 'any'}:${trimmed.toLowerCase()}`,
    { ttlSeconds: TTL_SECONDS, tags: ['tmdb', 'tmdb-search'], name: 'tmdb-search' },
    async () => {
      const params = new URLSearchParams({
        api_key: key,
        query: trimmed,
        include_adult: 'false',
      });
      if (year != null) params.set('primary_release_year', String(year));

      try {
        const response = await fetch(`${BASE}/search/movie?${params}`, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok) return [];

        const body: unknown = await response.json();
        const results = (body as { results?: unknown })?.results;
        if (!Array.isArray(results)) return [];

        return results
          .filter((entry): entry is TmdbMovie => {
            const movie = entry as TmdbMovie;
            return typeof movie?.id === 'number' && typeof movie?.title === 'string';
          })
          .map(toCandidate);
      } catch {
        return [];
      }
    },
  );
}

/**
 * The US theatrical release date, falling back to TMDB's primary one.
 *
 * Ported from `server/utils/routes.js:34-42` rather than simplified. The league
 * is scored on US award seasons, and a film's international date can fall in a
 * different eligibility year — so preferring the US entry is a domain rule,
 * not a formatting preference.
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
  const key = tmdbEnv.apiKey;
  if (!key) return null;

  return cached(
    `tmdb:film:${tmdbId}`,
    { ttlSeconds: TTL_SECONDS, tags: ['tmdb', 'tmdb-film'], name: 'tmdb-film' },
    async () => {
      try {
        const params = new URLSearchParams({
          api_key: key,
          append_to_response: 'release_dates',
        });
        const response = await fetch(`${BASE}/movie/${tmdbId}?${params}`, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok) return null;

        const detail = (await response.json()) as TmdbMovieDetail;
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
      } catch {
        return null;
      }
    },
  );
}

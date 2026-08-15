import type { Candidate } from '@/lib/services/search-ranking';
import { cached } from './cache';

/**
 * The only module that knows TMDB exists.
 *
 * 🔴 **There is no TMDB key in this repository, and the app must not need
 * one.** The local `movies` table holds 1,355 films, every one carrying a
 * `tmdbId` — the league's entire drafting and nominating history. Search is
 * complete against that on its own.
 *
 * So this is an *optional second source*: with no key configured it returns
 * nothing, and `lib/services/search.ts` returns local results, which is a
 * correct answer rather than a degraded one. Nothing throws, nothing warns on
 * every keystroke, and no code path exists that only works once a secret is
 * added.
 *
 * What a key would unlock is narrow and specific: attaching a film that
 * **nobody has ever drafted or nominated** — a brand-new release during
 * nominations season. Everything else already works.
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

/**
 * Read the key at call time, not at module load.
 *
 * Reading it eagerly would bake the answer into the module the first time
 * anything imported it — which in tests is before a case can set or clear the
 * variable, and in a build is before the runtime environment exists.
 */
export function isTmdbConfigured(): boolean {
  return Boolean(process.env.TMDB_API_KEY);
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
  const key = process.env.TMDB_API_KEY;
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

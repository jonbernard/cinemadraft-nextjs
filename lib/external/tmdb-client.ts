import { tmdbEnv } from '@/lib/env';
import { cached } from './cache';

/**
 * One way to ask TMDB anything.
 *
 * 🔴 **Extracted because there are now four callers, not one.** Search, the
 * single-film ingest fetch, the film page and discovery all need the same six
 * things: the base URL, the day-long TTL, the timeout, the key read at call
 * time, the read-through cache and the try/catch that turns every failure into
 * an absorbed miss. Copied four times, that is four places to forget the
 * timeout — and the one that forgets it is the one that hangs a page render on
 * a third party.
 *
 * The contract is deliberately narrow: **`null` means "TMDB added nothing this
 * time"**, for every reason. No key, a 404, a 500, a timeout, an unparseable
 * body — the caller has the same job in all five cases, and distinguishing them
 * would mean every caller writing the same five-branch switch. Callers that
 * want a list turn null into `[]` themselves; callers that want one film
 * propagate it.
 */

const BASE = 'https://api.themoviedb.org/3';

/**
 * A day. TMDB's catalogue moves slowly and the same handful of queries are
 * typed over and over during a live draft, which is the case this exists for.
 */
export const TTL_SECONDS = 86_400;

/** How long to wait before giving up and letting local data stand. */
export const TIMEOUT_MS = 3_000;

/**
 * Whether TMDB can be reached at all.
 *
 * Read at call time, not at module load. Reading it eagerly would bake the
 * answer into the module the first time anything imported it — which in tests
 * is before a case can set or clear the variable, and in a build is before the
 * runtime environment exists.
 */
export function isTmdbConfigured(): boolean {
  return tmdbEnv.isConfigured;
}

export type TmdbCacheOptions = {
  key: string;
  tags: readonly string[];
  name: string;
};

/**
 * Fetch and parse one TMDB endpoint, or return null.
 *
 * `include_adult=false` is applied to every request rather than per call site:
 * it is a property of this league, not of any one query, and a default that has
 * to be repeated is a default that will be missed.
 */
export async function tmdbFetch<T>(
  path: string,
  params: Record<string, string>,
  cache: TmdbCacheOptions,
): Promise<T | null> {
  const key = tmdbEnv.apiKey;
  if (!key) return null;

  return cached(
    cache.key,
    { ttlSeconds: TTL_SECONDS, tags: cache.tags, name: cache.name },
    async () => {
      try {
        const query = new URLSearchParams({
          api_key: key,
          include_adult: 'false',
          ...params,
        });
        const response = await fetch(`${BASE}${path}?${query}`, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok) return null;
        return (await response.json()) as T;
      } catch {
        return null;
      }
    },
  );
}

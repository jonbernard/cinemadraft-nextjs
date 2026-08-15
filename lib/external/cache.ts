import { getCache } from '@vercel/functions';

/**
 * A read-through cache for third-party responses.
 *
 * Backed by the **Vercel Runtime Cache** — a regional key-value store scoped
 * per project and per environment, which survives deployments and evicts by
 * LRU. Entries here are always reconstructible by asking the third party
 * again, so losing one costs a request rather than data; that is what makes
 * this the right tool rather than a database.
 *
 * 🔴 **`getCache()` does not throw outside Vercel** — it logs once and falls
 * back to an in-process map of its own. This was checked rather than assumed,
 * and it deleted code: the first version of this module carried a hand-written
 * in-memory fallback with its own eviction and TTL handling, which was pure
 * dead weight duplicating what the SDK already does. The lesson generalises —
 * the fallback path is the one nobody exercises, so it is the one worth not
 * writing.
 *
 * Deliberately **not** `'use cache: remote'`, the framework-level route to the
 * same store: that needs `cacheComponents`, and enabling it turns every
 * uncached read during prerendering into a build error (D42, verified — it
 * fails the build on `/leagues`). This is a plain function call with no such
 * reach.
 */

/**
 * Bumped by `clearCacheForTests`, and part of every key.
 *
 * The store has no "clear everything" operation and no way to enumerate keys,
 * so a test cannot empty it. Changing the namespace makes every previously
 * written key unreachable instead, which is the same thing from the caller's
 * point of view and works whichever backend is underneath.
 */
let generation = 0;

function store() {
  return getCache({ namespace: `g${generation}` });
}

/**
 * Return the cached value for `key`, or produce, store and return a fresh one.
 *
 * 🔴 **A cache failure never fails the caller.** Reading and writing are both
 * wrapped: if the store is unreachable or an entry is corrupt, `produce` runs
 * and its result is returned uncached. The alternative — an error from the
 * cache layer surfacing as a failed search — would make the cache a new way
 * for the feature to break, which is the opposite of the point.
 *
 * `tags` are for bulk invalidation via `expireTag`. Nothing invalidates these
 * entries yet; TMDB's catalogue moves slowly and the TTL is the whole
 * strategy. They are attached now because adding them later leaves every
 * already-cached entry untaggable until it expires.
 */
export async function cached<T>(
  key: string,
  options: { ttlSeconds: number; tags?: readonly string[]; name?: string },
  produce: () => Promise<T>,
): Promise<T> {
  try {
    const hit = await store().get(key);
    if (hit !== undefined && hit !== null) return hit as T;
  } catch {
    // A cache that cannot be read is a slow path, not an error path.
  }

  const value = await produce();

  try {
    await store().set(key, value, {
      ttl: options.ttlSeconds,
      ...(options.tags ? { tags: [...options.tags] } : {}),
      ...(options.name ? { name: options.name } : {}),
    });
  } catch {
    // The value is already computed and is being returned regardless.
  }

  return value;
}

/**
 * Make every previously cached entry unreachable.
 *
 * A test seam, and the only honest one available: the store cannot be
 * enumerated or emptied, so this moves the namespace rather than deleting
 * anything. Without it, one test's cached response answers the next test's
 * question — which is exactly the bug that found this function.
 */
export function clearCacheForTests(): void {
  generation += 1;
}

import { getCache } from '@vercel/functions';

/**
 * A read-through cache for third-party responses and for public reads of our
 * own database.
 *
 * Backed by the **Vercel Runtime Cache** — a regional key-value store scoped
 * per project and per environment, which survives deployments and evicts by
 * LRU. Entries here are always reconstructible by asking the source again, so
 * losing one costs a request rather than data; that is what makes this the
 * right tool rather than a database.
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
 *
 * 🔴 `v2` because entries are now stored as `encode`d strings. An entry written
 * by the old code is a bare object, and decoding it as the new format would be
 * a corrupt read; under a new namespace it is simply never asked for.
 */
let generation = 0;

function store() {
  return getCache({ namespace: `v2-g${generation}` });
}

/** The key under which `encode` records a value JSON cannot carry. */
const TYPE = '\u0000type';

/**
 * JSON that round-trips `Date`, `bigint`, `Map` and `Set`.
 *
 * 🔴 **The store serialises with plain `JSON.stringify`**, both the Runtime
 * Cache and the in-memory fallback. A `Date` comes back a string, a `Map` or
 * `Set` comes back `{}`, and a `bigint` throws on write — which `cached`
 * swallows, so the value would silently never be cached at all. Prisma rows
 * can carry all of these (`BigInt` columns, `Date` timestamps), and the
 * services build `Map`s. Encoding here, before the store sees it, means a
 * cached value is the value.
 *
 * `this[key]` rather than the replacer's `value`: `JSON.stringify` has already
 * called `Date.prototype.toJSON` by the time the replacer sees `value`.
 */
export function encode(value: unknown): string {
  return JSON.stringify(value, function replace(this: Record<string, unknown>, key, v) {
    const raw = this[key];
    if (raw instanceof Date) return { [TYPE]: 'Date', v: raw.getTime() };
    if (typeof v === 'bigint') return { [TYPE]: 'BigInt', v: v.toString() };
    if (v instanceof Map) return { [TYPE]: 'Map', v: [...v] };
    if (v instanceof Set) return { [TYPE]: 'Set', v: [...v] };
    return v;
  });
}

/** The inverse of `encode`. The reviver runs leaves first, so nesting works. */
export function decode(text: string): unknown {
  return JSON.parse(text, (_key, v) => {
    if (v === null || typeof v !== 'object' || !(TYPE in v)) return v;
    switch (v[TYPE]) {
      case 'Date':
        return new Date(v.v ?? Number.NaN);
      case 'BigInt':
        return BigInt(v.v);
      case 'Map':
        return new Map(v.v);
      case 'Set':
        return new Set(v.v);
      default:
        return v;
    }
  });
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
 * `tags` are for bulk invalidation via `expireCached`.
 */
export async function cached<T>(
  key: string,
  options: { ttlSeconds: number; tags?: readonly string[]; name?: string },
  produce: () => Promise<T>,
): Promise<T> {
  try {
    const hit = await store().get(key);
    // 🔴 The value is wrapped so that a cached `null` is a *hit*. Stored bare,
    // `get` answers null for both "cached a null" and "nothing here", so every
    // repeat request for a film TMDB does not have re-fetched *and re-wrote*
    // the same entry — an unbounded write loop against a metered store, paced
    // by whoever was asking. Only a missing string is a miss.
    if (typeof hit === 'string') return (decode(hit) as { v: T }).v;
  } catch {
    // A cache that cannot be read is a slow path, not an error path.
  }

  const value = await produce();

  try {
    await store().set(key, encode({ v: value }), {
      ttl: options.ttlSeconds,
      ...(options.tags ? { tags: [...options.tags] } : {}),
      ...(options.name ? { name: options.name } : {}),
    });
  } catch {
    // The value is already computed and is being returned regardless.
  }

  return value;
}

/** Expire every entry carrying `tag`. Never throws, for the reason `cached` does not. */
export async function expireCached(tag: string): Promise<void> {
  try {
    await store().expireTag(tag);
  } catch {
    // An entry that outlives a failed purge still expires on its TTL.
  }
}

/**
 * The tag on everything derived from our own database. Expired after every
 * write (`lib/db.ts`) and by `/api/revalidate`, which the award-import script
 * calls because it writes through a client of its own.
 */
export const DB_TAG = 'db';

/**
 * 🔴 **Why public reads are cached at all.** Neon bills compute for every
 * minute it is awake and suspends only after five idle ones. Facebook's link
 * scraper fetches `/` every few minutes around the clock, and every page here
 * renders per request, so before this the database never slept: 100 CU-hours
 * were gone by the 17th of the month with nobody using the app.
 *
 * An hour, because a write purges the tag and the TTL is only the backstop
 * for the purge that cannot happen (see `lib/db.ts`). Shorter would let the
 * scraper wake the database on every expiry.
 */
const DB_TTL_SECONDS = 3600;

/**
 * DB-derived caching runs only on Vercel, where a write's purge reaches the
 * same store every reader uses.
 *
 * 🔴 Off everywhere else on purpose. Locally the store is a per-process map,
 * and nearly every e2e spec seeds its state with raw SQL through a client of
 * its own — nothing that could purge the server's map — so a cached page would
 * show the state from before the seed. The tests that are *about* this cache
 * stub `VERCEL=1`.
 */
export function dbCacheEnabled(): boolean {
  return process.env.VERCEL === '1';
}

/**
 * `cached`, for a read of our own database that is the same for every viewer.
 *
 * 🔴 **Never for anything per-user, and never for a live stream's poll.** A
 * stream must see a write the moment it lands; a per-user value must never be
 * served to another user. Both stay on the database.
 *
 * 🔴 **Nothing clock-dependent inside `produce`.** A value computed against
 * `Date.now()` would be frozen for the TTL; cache the rows and derive the
 * time-based part after.
 */
export function cachedFromDb<T>(key: string, produce: () => Promise<T>): Promise<T> {
  if (!dbCacheEnabled()) return produce();
  return cached(
    `db:${key}`,
    { ttlSeconds: DB_TTL_SECONDS, tags: [DB_TAG], name: `db:${key}` },
    produce,
  );
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

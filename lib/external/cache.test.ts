import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cached, cachedFromDb, clearCacheForTests, decode, encode } from './cache';

/**
 * The metered-writes regression.
 *
 * A third party answering "no such film" is a perfectly good answer to cache —
 * and the one a crawler walking made-up ids asks for over and over. Stored bare,
 * that `null` read back as a miss, so each repeat both re-asked the third party
 * and wrote the entry again, against a store that bills writes.
 *
 * `produce` call counts are the assertion, not the returned value: the old code
 * returned the right `null` every time. Only the second write gave it away.
 */
describe('cached', () => {
  beforeEach(clearCacheForTests);

  it('caches a null result instead of re-producing it', async () => {
    const produce = vi.fn(async () => null);

    expect(await cached('k', { ttlSeconds: 60 }, produce)).toBeNull();
    expect(await cached('k', { ttlSeconds: 60 }, produce)).toBeNull();

    expect(produce).toHaveBeenCalledTimes(1);
  });

  it('caches a value and returns it unwrapped', async () => {
    const produce = vi.fn(async () => ({ title: 'Heat' }));

    expect(await cached('k', { ttlSeconds: 60 }, produce)).toEqual({ title: 'Heat' });
    expect(await cached('k', { ttlSeconds: 60 }, produce)).toEqual({ title: 'Heat' });

    expect(produce).toHaveBeenCalledTimes(1);
  });

  it('does not answer one key from another', async () => {
    await cached('a', { ttlSeconds: 60 }, async () => 'a');
    expect(await cached('b', { ttlSeconds: 60 }, async () => 'b')).toBe('b');
  });
});

/**
 * 🔴 The store serialises with plain JSON — the Runtime Cache and the local
 * fallback alike — so without the codec a cached Prisma row came back with its
 * `Date`s as strings, its `Map`s as `{}`, and a `bigint` threw on write and was
 * never cached at all.
 */
describe('encode/decode', () => {
  it('round-trips the types JSON cannot carry, nested', () => {
    const value = {
      at: new Date(Date.UTC(2026, 1, 3, 4, 5, 6)),
      big: 9007199254740993n,
      byId: new Map<number, Set<string>>([[1, new Set(['a', 'b'])]]),
      list: [new Date(0), null, { inner: new Map([['k', 2n]]) }],
      none: null,
      text: 'plain',
    };

    const back = decode(encode(value)) as typeof value;

    expect(back).toEqual(value);
    expect(back.at).toBeInstanceOf(Date);
    expect(back.byId.get(1)).toBeInstanceOf(Set);
    expect(typeof back.big).toBe('bigint');
  });

  it('returns a cached Date as a Date', async () => {
    clearCacheForTests();
    const produce = vi.fn(async () => ({ at: new Date(0) }));
    await cached('date', { ttlSeconds: 60 }, produce);
    const hit = await cached('date', { ttlSeconds: 60 }, produce);
    expect(produce).toHaveBeenCalledTimes(1);
    expect(hit.at).toBeInstanceOf(Date);
  });
});

describe('cachedFromDb', () => {
  beforeEach(clearCacheForTests);

  // 🔴 Off the platform the store is a per-process map no raw-SQL seed can
  // purge, and the e2e specs seed that way — so caching there would show them
  // the page from before their own seed.
  it('does not cache off Vercel', async () => {
    vi.stubEnv('VERCEL', '');
    const produce = vi.fn(async () => 1);
    await cachedFromDb('off', produce);
    await cachedFromDb('off', produce);
    expect(produce).toHaveBeenCalledTimes(2);
    vi.unstubAllEnvs();
  });

  it('caches on Vercel', async () => {
    vi.stubEnv('VERCEL', '1');
    const produce = vi.fn(async () => 1);
    await cachedFromDb('on', produce);
    await cachedFromDb('on', produce);
    expect(produce).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
  });
});

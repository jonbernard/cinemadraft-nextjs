import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cached, clearCacheForTests } from './cache';

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

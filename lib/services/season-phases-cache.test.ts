import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearCacheForTests } from '@/lib/external/cache';

const NOMINATIONS = Date.UTC(2026, 0, 8, 12);

const findAll = vi.hoisted(() => vi.fn());
vi.mock('@/lib/repositories/events', () => ({ eventRepository: { findAll } }));
vi.mock('@/lib/repositories/available-years', () => ({
  availableYearRepository: {
    findActive: async () => ({ year: 2026 }),
    listYears: async () => [2026],
  },
}));

import { getSeasonPhases } from './season';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/**
 * 🔴 The rows are cached; `complete` is not. It is computed against the clock,
 * so caching the finished phases would have held "nominations: upcoming" for an
 * hour after the announcement.
 */
describe('getSeasonPhases under the public-read cache', () => {
  it('re-derives completeness from the clock on a cache hit', async () => {
    vi.stubEnv('VERCEL', '1');
    clearCacheForTests();
    findAll.mockResolvedValue([
      {
        id: 1,
        name: 'Show',
        abbreviation: 's',
        hasCeremony: false,
        nomDate: NOMINATIONS,
        awardsDate: null,
      },
    ]);
    vi.useFakeTimers({ toFake: ['Date'] });

    // Twenty minutes apart: inside the hour's TTL, so the second read is a hit.
    vi.setSystemTime(NOMINATIONS - 10 * 60_000);
    const before = await getSeasonPhases();
    vi.setSystemTime(NOMINATIONS + 10 * 60_000);
    const after = await getSeasonPhases();

    expect(findAll).toHaveBeenCalledTimes(1);
    expect(before[0]?.complete).toBe(false);
    expect(after[0]?.complete).toBe(true);
  });
});

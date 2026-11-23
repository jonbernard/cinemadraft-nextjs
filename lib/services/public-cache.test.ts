import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/lib/db';
import { clearCacheForTests } from '@/lib/external/cache';
import { countQueries } from '@/test/query-count';
import { getDashboard } from './dashboard';
import { getLandingFacts } from './how-it-works';
import { availableSeasons, getLeaderboard } from './leaderboard';

/**
 * 🔴 **The Neon bill, as a test.** Facebook's link scraper fetches `/` every
 * few minutes and Neon suspends only after five idle ones, so a signed-out
 * home page that touched the database kept it awake all month. These pin the
 * fix: once warm, the signed-out home page costs nothing, and any write makes
 * the next read fresh.
 *
 * Runs on CI's seeded database as well as the restored one — every assertion
 * is about query counts, not rows.
 */

/** Exactly what `app/(app)/page.tsx` reads for a signed-out visitor. */
async function signedOutHome() {
  const seasons = await availableSeasons();
  const year = seasons[0] ?? 2026;
  await Promise.all([getDashboard(null), getLeaderboard(year), getLandingFacts(10)]);
}

beforeEach(() => {
  vi.stubEnv('VERCEL', '1');
  clearCacheForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the public-read cache', () => {
  it('serves a warm signed-out home page without a single query', async () => {
    const cold = await countQueries(signedOutHome);
    const warm = await countQueries(signedOutHome);

    expect(cold.queries).toBeGreaterThan(0);
    expect(warm.queries).toBe(0);
  });

  it('reads fresh after a model write through db', async () => {
    await signedOutHome();
    // Matches nothing; the operation, not the row, is what purges.
    await db.event.updateMany({ where: { id: -1 }, data: { name: 'never' } });

    const after = await countQueries(signedOutHome);
    expect(after.queries).toBeGreaterThan(0);
  });

  it('reads fresh after a raw write through db', async () => {
    await signedOutHome();
    await db.$executeRaw`UPDATE events SET name = name WHERE id = -1`;

    const after = await countQueries(signedOutHome);
    expect(after.queries).toBeGreaterThan(0);
  });

  it('does not purge on a read', async () => {
    await signedOutHome();
    await db.event.findMany({ where: { id: -1 } });

    const after = await countQueries(signedOutHome);
    expect(after.queries).toBe(0);
  });

  // 🔴 Per-user data must never be served from a shared entry.
  it('never caches a signed-in dashboard', async () => {
    await getDashboard(1);
    const again = await countQueries(() => getDashboard(1));
    expect(again.queries).toBeGreaterThan(0);
  });
});

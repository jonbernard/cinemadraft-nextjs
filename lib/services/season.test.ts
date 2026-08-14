import { afterEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/lib/db';
import { getActiveYear, getSeasons } from './season';

/**
 * D22: the active season is data, not a build-time constant.
 *
 * These run against the restored `available_years` table, which has 2026
 * flagged. The suite restores that flag in `afterEach` — the active row is a
 * database-wide singleton (a partial unique index), so a test that moves it
 * and does not put it back changes what every other suite sees. That is
 * exactly the cross-file race that forced `fileParallelism: false`.
 */
async function activeYear(): Promise<number | null> {
  const row = await db.availableYear.findFirst({ where: { isActive: true } });
  return row?.year ?? null;
}

describe('getActiveYear', () => {
  afterEach(async () => {
    await db.availableYear.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    await db.availableYear.updateMany({
      where: { year: 2026 },
      data: { isActive: true },
    });
  });

  it('returns the flagged season', async () => {
    expect(await getActiveYear()).toBe(2026);
  });

  it('follows the flag when it moves — this is the whole point of D22', async () => {
    // No rebuild, no redeploy, no env var. The next request sees the change.
    await db.availableYear.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    await db.availableYear.updateMany({
      where: { year: 2025 },
      data: { isActive: true },
    });

    expect(await getActiveYear()).toBe(2025);
  });

  it('falls back to the newest season when nothing is flagged', async () => {
    // A real state: it is what the table looked like before the seeding
    // migration, and the partial unique index permits zero as readily as one.
    // A blank site in January is worse than showing the most recent season.
    await db.availableYear.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    expect(await activeYear()).toBeNull();

    const years = await getSeasons();
    expect(await getActiveYear()).toBe(years[0]);
  });
});

describe('getSeasons', () => {
  it('lists every season, newest first', async () => {
    const years = await getSeasons();

    expect(years.length).toBeGreaterThan(1);
    expect([...years]).toEqual([...years].sort((a, b) => b - a));
  });

  it('drops null years rather than rendering a blank option', async () => {
    expect((await getSeasons()).every((year) => Number.isInteger(year))).toBe(true);
  });
});

describe('setActiveYear', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await db.availableYear.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    await db.availableYear.updateMany({
      where: { year: 2026 },
      data: { isActive: true },
    });
  });

  it('🔴 refuses a non-admin — the season scopes every page in the app', async () => {
    vi.resetModules();
    vi.doMock('@/lib/auth', () => ({
      requireAdmin: () => Promise.reject(new Error('admin only')),
    }));
    const { setActiveYear } = await import('@/actions/admin/set-active-year');

    await expect(setActiveYear(2025)).rejects.toThrow('admin only');
    expect(await activeYear()).toBe(2026);
  });

  it('moves the season for an admin', async () => {
    vi.resetModules();
    vi.doMock('@/lib/auth', () => ({
      requireAdmin: () => Promise.resolve({ id: 1, role: 'admin' }),
    }));
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }));
    const { setActiveYear } = await import('@/actions/admin/set-active-year');

    await setActiveYear(2025);

    expect(await activeYear()).toBe(2025);
    expect(await getActiveYear()).toBe(2025);
  });
});

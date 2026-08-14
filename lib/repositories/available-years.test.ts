// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { loadFixture } from '@/test/fixtures';

import { availableYearRepository } from './available-years';

/**
 * The season this database was restored with, and what every other suite
 * assumes. `setActive` tests move it, so it is put back before the worker
 * exits — an active year left pointing at 2024 would silently change what
 * every year-defaulted page renders.
 */
const SEEDED_ACTIVE_YEAR = 2026;

afterAll(async () => {
  await availableYearRepository.setActive(SEEDED_ACTIVE_YEAR);
  await db.$disconnect();
});

/** `GET /years` — the source API returned bare numbers, newest first. */
const years = loadFixture<number[]>('years');

describe('availableYearRepository.listYears', () => {
  it('returns the same list the source API did', async () => {
    expect(await availableYearRepository.listYears()).toEqual(years);
  });

  it('orders newest first, using the database ordering', async () => {
    const listed = await availableYearRepository.listYears();

    const ordered = await db.$queryRaw<{ year: number }[]>`
      select year from available_years where year is not null order by year desc
    `;

    expect(listed).toEqual(ordered.map((r) => r.year));
  });
});

describe('availableYearRepository.findAll', () => {
  it('returns a row per year, newest first', async () => {
    const rows = await availableYearRepository.findAll();
    expect(rows.map((r) => r.year)).toEqual(years);
  });

  it('carries the flag that replaced NEXT_PUBLIC_ACTIVE_YEAR', async () => {
    const rows = await availableYearRepository.findAll();
    expect(rows.filter((r) => r.isActive)).toHaveLength(1);
  });
});

describe('availableYearRepository.findActive', () => {
  it('returns the row flagged active', async () => {
    // D22: the active season is data, read at request time, not a build-time
    // environment variable that forces an annual redeploy.
    const active = await availableYearRepository.findActive();
    expect(active?.year).toBe(SEEDED_ACTIVE_YEAR);
    expect(active?.isActive).toBe(true);
  });

  it('returns null rather than throwing when no year is flagged', async () => {
    // A database with nothing active is a legitimate state — it is what the
    // table looked like before the seeding migration ran — and the caller
    // falls back rather than crashing the whole app.
    await db.$executeRaw`update available_years set is_active = false where is_active`;
    try {
      expect(await availableYearRepository.findActive()).toBeNull();
    } finally {
      await availableYearRepository.setActive(SEEDED_ACTIVE_YEAR);
    }
  });
});

describe('availableYearRepository.setActive', () => {
  it('moves the active year and clears the previous one', async () => {
    const updated = await availableYearRepository.setActive(2025);

    expect(updated.year).toBe(2025);
    expect(updated.isActive).toBe(true);
    expect((await availableYearRepository.findActive())?.year).toBe(2025);

    const active = await db.$queryRaw<{ year: number }[]>`
      select year from available_years where is_active
    `;
    expect(active).toHaveLength(1);

    await availableYearRepository.setActive(SEEDED_ACTIVE_YEAR);
  });

  it('is idempotent for the year that is already active', async () => {
    await availableYearRepository.setActive(SEEDED_ACTIVE_YEAR);
    const again = await availableYearRepository.setActive(SEEDED_ACTIVE_YEAR);

    expect(again.year).toBe(SEEDED_ACTIVE_YEAR);
    expect(
      await db.$queryRaw<
        { year: number }[]
      >`select year from available_years where is_active`,
    ).toHaveLength(1);
  });

  it('throws NotFoundError for a year the table does not hold', async () => {
    await expect(availableYearRepository.setActive(1899)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(availableYearRepository.setActive(1899)).rejects.toThrow(
      'available year 1899 not found',
    );
  });
});

describe('the one-active-year invariant', () => {
  it('is enforced by the database, not by application code', async () => {
    // available_years_one_active is a partial unique index on (is_active)
    // WHERE is_active. Prisma cannot express it, so it lives in
    // prisma/migrations/20260814130000_app_columns/migration.sql — and this
    // test is what keeps it from being dropped by a future `migrate diff`.
    await expect(
      db.$executeRaw`update available_years set is_active = true where year = 2025`,
    ).rejects.toThrow(/available_years_one_active/);

    expect((await availableYearRepository.findActive())?.year).toBe(SEEDED_ACTIVE_YEAR);
  });

  it('surfaces a rejected write as ConflictError, not as a raw driver error', async () => {
    // Reachable only under concurrency, which is the point: setActive clears
    // the old row inside a transaction, so a single caller can never trip the
    // index. Two callers can. The competing transaction below flips the flag
    // to 2025 and holds it uncommitted; setActive(2024) blocks on the 2026 row
    // it is trying to clear, and once the competitor commits, its own insert
    // of an is_active index entry collides with the one 2025 just committed.
    //
    // Without the mapping the caller gets a Postgres error object, and the
    // source app's habit of echoing those to the client is exactly the schema
    // disclosure lib/errors.ts exists to stop.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    const competitor = db.$transaction(async (tx) => {
      await tx.$executeRaw`update available_years set is_active = false where is_active`;
      await tx.$executeRaw`update available_years set is_active = true where year = 2025`;
      await held;
    });

    // Let the competitor take its row locks before the repository starts.
    await new Promise((resolve) => setTimeout(resolve, 200));
    const conflicted = availableYearRepository.setActive(2024);
    // Claim the rejection now so Node does not report it as unhandled while
    // the competitor is still being waited on.
    conflicted.catch(() => {});

    await new Promise((resolve) => setTimeout(resolve, 200));
    release();
    await competitor.catch(() => {});

    await expect(conflicted).rejects.toBeInstanceOf(ConflictError);
    await expect(conflicted).rejects.toThrow(/already active/i);
  });
});

describe('the DTO', () => {
  it('carries exactly the table columns', async () => {
    const active = await availableYearRepository.findActive();
    expect(Object.keys(active ?? {}).sort()).toEqual(
      ['id', 'year', 'isActive', 'createdAt', 'updatedAt'].sort(),
    );
  });

  it('returns no Prisma internals, and survives JSON.stringify', async () => {
    const active = await availableYearRepository.findActive();
    if (!active) throw new Error('no active year');

    expect(Object.getPrototypeOf(active)).toBe(Object.prototype);
    expect(() => JSON.stringify(active)).not.toThrow();
  });
});

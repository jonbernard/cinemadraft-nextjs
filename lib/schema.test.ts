// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from './db';

afterAll(async () => {
  await db.$disconnect();
});

describe('active year (D22)', () => {
  it('has exactly one active year seeded', async () => {
    const active = await db.availableYear.findMany({ where: { isActive: true } });
    expect(active).toHaveLength(1);
    expect(active[0]?.year).toBe(2026);
  });

  it('refuses a second active year', async () => {
    // The invariant is enforced by a partial unique index, not by application
    // code, so it holds against concurrent writes and against anyone editing
    // the table directly. This test is what proves the index exists — the
    // schema cannot express it, so nothing else would catch its absence.
    await expect(
      db.$transaction(async (tx) => {
        await tx.availableYear.update({
          where: { year: 2025 },
          data: { isActive: true },
        });
      }),
    ).rejects.toThrow();

    // And the failed write left the invariant intact.
    const stillOne = await db.availableYear.count({ where: { isActive: true } });
    expect(stillOne).toBe(1);
  });

  it('allows any number of inactive years', async () => {
    const inactive = await db.availableYear.count({ where: { isActive: false } });
    expect(inactive).toBe(9);
  });
});

describe('claimable accounts (D25)', () => {
  it('starts with every account unclaimed', async () => {
    expect(await db.user.count({ where: { clerkId: { not: null } } })).toBe(0);
  });

  it('refuses two accounts claiming the same Clerk identity', async () => {
    // Unique on clerk_id is what stops a second Clerk identity attaching to an
    // already-claimed account, which would be an account-takeover vector.
    await expect(
      db.$transaction(async (tx) => {
        const [a, b] = await tx.user.findMany({ take: 2, orderBy: { id: 'asc' } });
        if (!a || !b) throw new Error('fixture requires two users');
        await tx.user.update({
          where: { id: a.id },
          data: { clerkId: 'user_duplicate' },
        });
        await tx.user.update({
          where: { id: b.id },
          data: { clerkId: 'user_duplicate' },
        });
      }),
    ).rejects.toThrow();

    expect(await db.user.count({ where: { clerkId: { not: null } } })).toBe(0);
  });
});

describe('poster accent (spec 6.6)', () => {
  it('starts unpopulated and accepts a hex value', async () => {
    expect(await db.movie.count({ where: { accentHex: { not: null } } })).toBe(0);

    await expect(
      db.$transaction(async (tx) => {
        await tx.movie.update({ where: { id: 1 }, data: { accentHex: '#A8323E' } });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    // Rolled back, so the column is still empty for every other test.
    expect(await db.movie.count({ where: { accentHex: { not: null } } })).toBe(0);
  });
});

// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';

import { listRepository } from './lists';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * The list writes.
 *
 * 🔴 Seeded rows, never the restored ones — these tests renumber and delete,
 * and `lists.test.ts` asserts against user 3's real 2024 list. That separation
 * is also what lets this file run on CI while the contract tests do not.
 *
 * `lists` declares no foreign keys, so synthetic user and movie ids need no
 * parent rows. That is the schema's shape rather than a shortcut, and it is
 * exactly why every write below carries `userId` in its WHERE clause.
 */
const WRITER = 900_001;
const STRANGER = 900_002;
const WRITE_YEAR = 2097;
const OTHER_YEAR = 2096;

async function seedList(userId: number, year: number, movieIds: number[]) {
  for (const [index, movieId] of movieIds.entries()) {
    await listRepository.create({ userId, movieId, year, order: index + 1 });
  }
  return listRepository.findByUserAndYear(userId, year);
}

async function clearWrites() {
  await db.list.deleteMany({ where: { userId: { in: [WRITER, STRANGER] } } });
}

function idAt(entries: readonly { id: number }[], index: number): number {
  const entry = entries[index];
  if (!entry) throw new Error(`nothing seeded at index ${index}`);
  return entry.id;
}

async function orderOf(id: number): Promise<number> {
  return (await listRepository.findById(id)).order;
}

describe('the writes', () => {
  beforeEach(clearWrites);
  afterAll(clearWrites);

  it('appends a row with no mark and both timestamps set', async () => {
    const entry = await listRepository.create({
      userId: WRITER,
      movieId: 911,
      year: WRITE_YEAR,
      order: 1,
    });

    expect(entry.status).toBe('none');
    // Nullable columns the Sequelize app always wrote. A null pair would make
    // a new row indistinguishable from a legacy one.
    expect(entry.createdAt).toBeInstanceOf(Date);
    expect(entry.updatedAt).toBeInstanceOf(Date);
  });

  it('finds an existing entry for one film, so a duplicate can be refused', async () => {
    await seedList(WRITER, WRITE_YEAR, [11, 12]);

    expect(
      await listRepository.findByUserYearAndMovie(WRITER, WRITE_YEAR, 12),
    ).not.toBeNull();
    expect(
      await listRepository.findByUserYearAndMovie(WRITER, WRITE_YEAR, 13),
    ).toBeNull();
    // Same film, different season: a separate list, not a duplicate.
    expect(
      await listRepository.findByUserYearAndMovie(WRITER, OTHER_YEAR, 12),
    ).toBeNull();
  });

  describe('reorder', () => {
    it('assigns 1..N in the order it is given', async () => {
      const seeded = await seedList(WRITER, WRITE_YEAR, [11, 12, 13]);
      const reversed = [...seeded].reverse().map((entry) => entry.id);

      await listRepository.reorder(WRITER, WRITE_YEAR, reversed);

      const after = await listRepository.findByUserAndYear(WRITER, WRITE_YEAR);
      expect(after.map((entry) => entry.id)).toEqual(reversed);
      expect(after.map((entry) => entry.order)).toEqual([1, 2, 3]);
    });

    it('🔴 will not renumber another member’s row, even given its id', async () => {
      // The service refuses this before it gets here, but the scope is
      // structural rather than dependent on that check: `userId` is in every
      // WHERE clause.
      const mine = await seedList(WRITER, WRITE_YEAR, [11, 12]);
      const theirs = await seedList(STRANGER, WRITE_YEAR, [13, 14]);

      // The intruder is passed at the position that would *move* it: last of
      // three, so a WHERE clause missing `userId` writes 3 over its stored 1.
      await listRepository.reorder(WRITER, WRITE_YEAR, [
        idAt(mine, 1),
        idAt(mine, 0),
        idAt(theirs, 0),
      ]);

      expect(await orderOf(idAt(theirs, 0))).toBe(1);
      expect(await orderOf(idAt(theirs, 1))).toBe(2);
      expect(await orderOf(idAt(mine, 1))).toBe(1);
      expect(await orderOf(idAt(mine, 0))).toBe(2);
    });

    it('🔴 will not renumber the same member’s other season', async () => {
      const other = await seedList(WRITER, OTHER_YEAR, [11, 12]);

      // Index 0 of the reorder, so `year` dropping out of the WHERE clause
      // writes 1 over the stored 2.
      await listRepository.reorder(WRITER, WRITE_YEAR, [idAt(other, 1)]);

      expect(await orderOf(idAt(other, 1))).toBe(2);
      expect(await orderOf(idAt(other, 0))).toBe(1);
    });

    it('does nothing at all for an empty list', async () => {
      await expect(
        listRepository.reorder(WRITER, WRITE_YEAR, []),
      ).resolves.toBeUndefined();
    });
  });

  describe('setStatus', () => {
    it('stores each of the three states', async () => {
      const seeded = await seedList(WRITER, WRITE_YEAR, [11]);
      const id = idAt(seeded, 0);

      for (const status of ['selected', 'unavailable', 'none'] as const) {
        await listRepository.setStatus(id, WRITER, status);
        expect((await listRepository.findById(id)).status).toBe(status);
      }
    });

    it('🔴 throws for another member’s row, and leaves it alone', async () => {
      const theirs = await seedList(STRANGER, WRITE_YEAR, [11]);
      const id = idAt(theirs, 0);

      await expect(
        listRepository.setStatus(id, WRITER, 'selected'),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect((await listRepository.findById(id)).status).toBe('none');
    });
  });

  describe('deleteByIdForUser', () => {
    it('removes the caller’s row', async () => {
      const seeded = await seedList(WRITER, WRITE_YEAR, [11, 12]);

      await listRepository.deleteByIdForUser(idAt(seeded, 0), WRITER);

      expect(await listRepository.findByUserAndYear(WRITER, WRITE_YEAR)).toHaveLength(1);
    });

    it('🔴 throws for another member’s row, and leaves it in place', async () => {
      const theirs = await seedList(STRANGER, WRITE_YEAR, [11]);
      const id = idAt(theirs, 0);

      await expect(listRepository.deleteByIdForUser(id, WRITER)).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(await listRepository.findById(id)).toBeDefined();
    });

    it('throws for a row that is already gone', async () => {
      await expect(
        listRepository.deleteByIdForUser(999_999, WRITER),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

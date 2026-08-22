// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { loadFixture } from '@/test/fixtures';

import { listRepository } from './lists';

afterAll(async () => {
  await db.$disconnect();
});

/** A list row as the source API returned it, with the movie nested inside. */
type FixtureList = {
  id: number;
  userId: number;
  movieId: number;
  order: number;
  year: number;
  createdAt: string;
  updatedAt: string;
  status: string;
  movie: Record<string, unknown>;
};

/** Captured as user 3, for list year 2024 — the only year that user has rows in. */
const lists = loadFixture<FixtureList[]>('lists-by-year');

const USER = 3;
const YEAR = 2024;

describe('listRepository.findById', () => {
  it('returns the list entry', async () => {
    const entry = await listRepository.findById(10);
    expect(entry.userId).toBe(USER);
    expect(entry.movieId).toBe(911);
    expect(entry.order).toBe(0);
  });

  it('throws NotFoundError for an id that does not exist', async () => {
    await expect(listRepository.findById(999_999)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listRepository.findById(999_999)).rejects.toThrow(
      'list 999999 not found',
    );
  });
});

describe('listRepository.findByUserAndYear', () => {
  it('returns every entry the user has that year', async () => {
    const entries = await listRepository.findByUserAndYear(USER, YEAR);
    expect(entries).toHaveLength(lists.length);
    expect(entries.every((e) => e.userId === USER && e.year === YEAR)).toBe(true);
  });

  it('orders by the user-chosen order column, using the database ordering', async () => {
    // Asserting against a JS sort would reimplement the ordering rather than
    // check that the repository asked for it. Compare against an explicit SQL
    // ORDER BY instead, the same way movies.test.ts checks `search`.
    const entries = await listRepository.findByUserAndYear(USER, YEAR);

    const ordered = await db.$queryRaw<{ id: number }[]>`
      select id from lists
      where user_id = ${USER} and year = ${YEAR}
      order by "order" asc
    `;

    expect(entries.map((e) => e.id)).toEqual(ordered.map((r) => r.id));
    expect(entries.length).toBeGreaterThan(1);
  });

  it('matches the captured order exactly', async () => {
    const entries = await listRepository.findByUserAndYear(USER, YEAR);
    expect(entries.map((e) => e.id)).toEqual(lists.map((l) => l.id));
  });

  it('returns an empty array for a year the user has no list in', async () => {
    // This is why `lists-by-year` was captured at 2024 rather than the 2025
    // every other fixture uses: user 3 simply has no 2025 list. An empty
    // result here is the correct answer, not a missing-data bug.
    expect(await listRepository.findByUserAndYear(USER, 2025)).toEqual([]);
  });

  it('returns an empty array for a user with no lists at all', async () => {
    expect(await listRepository.findByUserAndYear(999_999, YEAR)).toEqual([]);
  });
});

describe('the DTO matches the captured contract', () => {
  it('carries the columns the source API returned, without the nested movie', async () => {
    const expected = lists[0];
    if (!expected) throw new Error('lists-by-year fixture is empty');

    const entry = await listRepository.findById(expected.id);

    // The API nested the whole movie inside every list row. Repositories
    // return one table's rows; composing the movie is the caller's job, via
    // movieRepository.findManyByIds.
    expect(Object.keys(entry).sort()).toEqual(
      Object.keys(expected)
        .filter((k) => k !== 'movie')
        .sort(),
    );
  });

  it('matches the captured values field for field', async () => {
    const expected = lists[0];
    if (!expected) throw new Error('lists-by-year fixture is empty');

    const entry = await listRepository.findById(expected.id);

    expect(entry.id).toBe(expected.id);
    expect(entry.userId).toBe(expected.userId);
    expect(entry.movieId).toBe(expected.movieId);
    expect(entry.order).toBe(expected.order);
    expect(entry.year).toBe(expected.year);
    expect(entry.status).toBe(expected.status);
    expect(entry.createdAt?.toISOString()).toBe(expected.createdAt);
    expect(entry.updatedAt?.toISOString()).toBe(expected.updatedAt);
  });

  it('returns the status as one of the three enum members', async () => {
    const entries = await listRepository.findByUserAndYear(USER, YEAR);
    const statuses = new Set(entries.map((e) => e.status));

    for (const status of statuses) {
      expect(['none', 'selected', 'unavailable']).toContain(status);
    }
    // The fixture exercises more than one of them, so this is a real check.
    expect(statuses.size).toBeGreaterThan(1);
  });

  it('returns Date objects, not the strings JSON gave us', async () => {
    const entry = await listRepository.findById(10);
    expect(entry.createdAt).toBeInstanceOf(Date);
  });

  it('returns no Prisma internals', async () => {
    const entry = await listRepository.findById(10);
    expect(Object.getPrototypeOf(entry)).toBe(Object.prototype);
  });

  it('survives JSON.stringify', async () => {
    // Every DTO crosses the RSC boundary eventually. lists has no bigint
    // column today, but the assertion is cheap and catches one appearing.
    const entry = await listRepository.findById(10);
    expect(() => JSON.stringify(entry)).not.toThrow();
  });
});

/**
 * The writes.
 *
 * 🔴 Seeded rows, never the restored ones. These tests renumber and delete, and
 * the captured fixture above asserts against user 3's real 2024 list — a write
 * test that touched it would corrupt the contract tests in the same file.
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
      const theirs = await seedList(STRANGER, WRITE_YEAR, [13]);
      const intruder = theirs[0];
      if (!intruder) throw new Error('nothing seeded for the stranger');

      await listRepository.reorder(WRITER, WRITE_YEAR, [
        intruder.id,
        mine[1]?.id ?? 0,
        mine[0]?.id ?? 0,
      ]);

      // Their row keeps its position; the two that are the caller's take the
      // positions their places in the list asked for.
      expect((await listRepository.findById(intruder.id)).order).toBe(1);
      expect((await listRepository.findById(mine[1]?.id ?? 0)).order).toBe(2);
      expect((await listRepository.findById(mine[0]?.id ?? 0)).order).toBe(3);
    });

    it('🔴 will not renumber the same member’s other season', async () => {
      const other = await seedList(WRITER, OTHER_YEAR, [11]);
      const target = other[0];
      if (!target) throw new Error('nothing seeded');

      await listRepository.reorder(WRITER, WRITE_YEAR, [target.id]);

      expect((await listRepository.findById(target.id)).order).toBe(1);
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
      const id = seeded[0]?.id ?? 0;

      for (const status of ['selected', 'unavailable', 'none'] as const) {
        await listRepository.setStatus(id, WRITER, status);
        expect((await listRepository.findById(id)).status).toBe(status);
      }
    });

    it('🔴 throws for another member’s row, and leaves it alone', async () => {
      const theirs = await seedList(STRANGER, WRITE_YEAR, [11]);
      const id = theirs[0]?.id ?? 0;

      await expect(
        listRepository.setStatus(id, WRITER, 'selected'),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect((await listRepository.findById(id)).status).toBe('none');
    });
  });

  describe('deleteByIdForUser', () => {
    it('removes the caller’s row', async () => {
      const seeded = await seedList(WRITER, WRITE_YEAR, [11, 12]);

      await listRepository.deleteByIdForUser(seeded[0]?.id ?? 0, WRITER);

      expect(await listRepository.findByUserAndYear(WRITER, WRITE_YEAR)).toHaveLength(1);
    });

    it('🔴 throws for another member’s row, and leaves it in place', async () => {
      const theirs = await seedList(STRANGER, WRITE_YEAR, [11]);
      const id = theirs[0]?.id ?? 0;

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

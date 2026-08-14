// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

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

// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { loadFixture } from '@/test/fixtures';

import { pointRepository } from './points';

afterAll(async () => {
  await db.$disconnect();
});

/** A points row as `GET /points` returned it. */
type FixturePoint = {
  id: number;
  level: string | null;
  tier: number | null;
  points: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

/**
 * `GET /points` returned `{ [level]: { [tier]: Point[] } }` — grouped twice
 * and sorted by point value. Both layers are presentation, so the repository
 * returns rows and this flattens the fixture back into them.
 */
const grouped = loadFixture<Record<string, Record<string, FixturePoint[]>>>('points-all');

const flat = Object.values(grouped).flatMap((tiers) => Object.values(tiers).flat());

describe('pointRepository.findById', () => {
  it('returns the points row', async () => {
    const point = await pointRepository.findById(9);
    expect(point.level).toBe('Oscars');
    expect(point.tier).toBe(1);
    expect(point.points).toBe(20);
  });

  it('throws NotFoundError for an id that does not exist', async () => {
    await expect(pointRepository.findById(999_999)).rejects.toBeInstanceOf(NotFoundError);
    await expect(pointRepository.findById(999_999)).rejects.toThrow(
      'point 999999 not found',
    );
  });
});

describe('the DTO matches the captured contract', () => {
  it('carries exactly the fields the source API returned', async () => {
    const expected = flat[0];
    if (!expected) throw new Error('points fixture is empty');

    const point = await pointRepository.findById(expected.id);

    expect(Object.keys(point).sort()).toEqual(Object.keys(expected).sort());
  });

  it('matches every captured row field for field', async () => {
    // Twelve rows. The whole lookup table is small enough to check exactly,
    // and every point total in the app is a multiple of one of these numbers.
    const rows = await pointRepository.findAll();
    const byId = new Map(rows.map((r) => [r.id, r]));

    expect(rows).toHaveLength(flat.length);

    for (const expected of flat) {
      const point = byId.get(expected.id);
      expect(point?.level).toBe(expected.level);
      expect(point?.tier).toBe(expected.tier);
      expect(point?.points).toBe(expected.points);
      expect(point?.createdAt?.toISOString()).toBe(expected.createdAt);
    }
  });

  it('keeps negative point values intact', async () => {
    // The Razzies tiers are worth -20, -15 and -10. Anything that treated
    // points as unsigned, or filtered on `points > 0`, would silently drop the
    // only penalty in the scoring system.
    const razzies = await pointRepository.findAll();
    const negative = razzies.filter((p) => (p.points ?? 0) < 0);

    expect(negative).toHaveLength(3);
    expect(negative.every((p) => p.level === 'Razzies')).toBe(true);
  });

  it('returns Date objects, not the strings JSON gave us', async () => {
    const point = await pointRepository.findById(9);
    expect(point.createdAt).toBeInstanceOf(Date);
  });

  it('returns no Prisma internals', async () => {
    const point = await pointRepository.findById(9);
    expect(Object.getPrototypeOf(point)).toBe(Object.prototype);
  });

  it('has no bigint columns to normalize', async () => {
    // Unlike awards, nominations and winners, every column here is integer.
    // Recorded as a test so the claim is checked rather than assumed.
    const point = await pointRepository.findById(9);
    expect(() => JSON.stringify(point)).not.toThrow();
    expect(typeof point.id).toBe('number');
    expect(typeof point.tier).toBe('number');
    expect(typeof point.points).toBe('number');
  });
});

describe('pointRepository.findAll', () => {
  it('returns every row, ordered by level then tier', async () => {
    // Asserted against an explicit ORDER BY rather than a JS sort: `level` is
    // text, the database collates en_US.utf8, and JS localeCompare disagrees
    // with it on case and punctuation.
    const rows = await pointRepository.findAll();

    const ordered = await db.$queryRaw<{ id: number }[]>`
      select id from points order by level asc, tier asc
    `;

    expect(rows.map((r) => r.id)).toEqual(ordered.map((r) => r.id));
  });

  it('does not reproduce the API grouping', async () => {
    // `GET /points` returned `{ level: { tier: [row] } }`, with levels ordered
    // by descending point value and tiers ordered ascending because V8 sorts
    // integer-like object keys numerically. Both facts are about how the page
    // renders, not about the data, so they belong to whatever renders it.
    const rows = await pointRepository.findAll();
    expect(Array.isArray(rows)).toBe(true);
  });
});

describe('pointRepository.findByLevelAndTier', () => {
  it('returns the row for a level and tier', async () => {
    const point = await pointRepository.findByLevelAndTier('Oscars', 1);
    expect(point?.id).toBe(9);
    expect(point?.points).toBe(20);
  });

  it('returns null for a combination that does not exist', async () => {
    // A legitimate miss: an admin screen asks whether a tier is configured
    // before offering it.
    expect(await pointRepository.findByLevelAndTier('Oscars', 99)).toBeNull();
    expect(await pointRepository.findByLevelAndTier('Nope', 1)).toBeNull();
  });
});

describe('pointRepository.findManyByIds', () => {
  it('returns the requested rows', async () => {
    // This is the join that turns awards into scores: awards.points holds a
    // points.id, so the scoring service collects those ids and resolves them
    // here in one query rather than once per award.
    const rows = await pointRepository.findManyByIds([7, 8, 9]);
    expect(rows.map((r) => r.id)).toEqual([7, 8, 9]);
    expect(rows.map((r) => r.points)).toEqual([10, 15, 20]);
  });

  it('silently skips ids that do not exist', async () => {
    // awards.points has no foreign key behind it. An award pointing at a
    // deleted tier must not throw — it scores nothing, which is the service
    // layer's decision to make.
    const rows = await pointRepository.findManyByIds([9, 999_999]);
    expect(rows).toHaveLength(1);
  });

  it('accepts bigint ids', async () => {
    // awards.points is integer, but callers batching ids from several tables
    // hold a mixture, and widening the parameter is cheaper than making every
    // caller narrow it.
    const rows = await pointRepository.findManyByIds([9n]);
    expect(rows).toHaveLength(1);
  });

  it('returns an empty array for an empty request', async () => {
    expect(await pointRepository.findManyByIds([])).toEqual([]);
  });
});

describe('the /points/league/:type route parameter is not carried forward', () => {
  it('has byte-identical total and event fixtures, because the source ignored :type', async () => {
    // `GET /points/league/:type(total|event)/:id/:year?` declared a `type`
    // parameter that `getPointsByLeagueId` never read (server/routes/points.js
    // has no reference to `req.params.type`), so both spellings ran the same
    // handler and returned the same bytes. The frontend only ever called
    // `total`; `event` is dead route surface that was declared and never
    // implemented.
    //
    // Nothing in this repository takes a `type`. A parameter that does not
    // change the result is worse than no parameter, because it reads like a
    // promise the code does not keep. If a per-event league leaderboard is
    // wanted later it is a new feature, built on findManyByIds and the awards
    // and winners repositories — not the restoration of something that once
    // worked.
    const dir = join(process.cwd(), 'fixtures');
    const total = readFileSync(join(dir, 'points-league-total.json'));
    const byEvent = readFileSync(join(dir, 'points-league-event.json'));

    expect(total.equals(byEvent)).toBe(true);
    expect(pointRepository).not.toHaveProperty('findByLeagueType');
  });
});

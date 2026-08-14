// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { loadFixture } from '@/test/fixtures';

import { awardRepository } from './awards';

afterAll(async () => {
  await db.$disconnect();
});

/** An award as the source API nested it inside winners and events. */
type FixtureAward = {
  id: number;
  fbId: string | null;
  name: string;
  eventId: number;
  active: boolean | null;
  points: number | null;
  requiresNomineeName: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const winners = loadFixture<{ award: FixtureAward }[]>('winners');

/**
 * `/events/oscars/2025` — the only capture that shows `points` resolved. Each
 * award carries a `pointsData` array holding the row that `award.points`
 * points at, which is what proves the column is a foreign key.
 */
const oscars = loadFixture<{
  id: number;
  awards: (FixtureAward & { pointsData: { points: number }[] })[];
}>('event-by-abbr-year');

describe('awardRepository.findById', () => {
  it('returns the award', async () => {
    const award = await awardRepository.findById(62);
    expect(award.name).toBe('Best Picture');
    expect(award.eventId).toBe(8);
  });

  it('throws NotFoundError for an id that does not exist', async () => {
    // Same contract as movieRepository: a by-id lookup never returns null,
    // because every caller would have to null-check and most would forget.
    await expect(awardRepository.findById(999_999)).rejects.toBeInstanceOf(NotFoundError);
    await expect(awardRepository.findById(999_999)).rejects.toThrow(
      'award 999999 not found',
    );
  });
});

describe('the DTO matches the captured contract', () => {
  it('carries exactly the fields the source API returned', async () => {
    const expected = winners[0]?.award;
    if (!expected) throw new Error('winners fixture is empty');

    const award = await awardRepository.findById(expected.id);

    // `points` is renamed to `pointsId` — see the rename test below. Every
    // other field is carried across unchanged.
    expect(Object.keys(award).sort()).toEqual(
      [...Object.keys(expected).filter((k) => k !== 'points'), 'pointsId'].sort(),
    );
  });

  it('matches the captured values field for field', async () => {
    const expected = winners[0]?.award;
    if (!expected) throw new Error('winners fixture is empty');

    const award = await awardRepository.findById(expected.id);

    expect(award.id).toBe(expected.id);
    expect(award.fbId).toBe(expected.fbId);
    expect(award.name).toBe(expected.name);
    expect(award.eventId).toBe(expected.eventId);
    expect(award.active).toBe(expected.active);
    expect(award.pointsId).toBe(expected.points);
    expect(award.requiresNomineeName).toBe(expected.requiresNomineeName);
    expect(award.createdAt?.toISOString()).toBe(expected.createdAt);
  });

  it('returns Date objects, not the strings JSON gave us', async () => {
    const award = await awardRepository.findById(62);
    expect(award.createdAt).toBeInstanceOf(Date);
    expect(award.updatedAt).toBeInstanceOf(Date);
  });

  it('returns no Prisma internals', async () => {
    const award = await awardRepository.findById(62);
    expect(Object.getPrototypeOf(award)).toBe(Object.prototype);
  });
});

describe('awards.points is a foreign key, and the DTO says so', () => {
  it('exposes it as pointsId, not points', async () => {
    // `awards.points` is not a point value. The source app declared
    // `Awards.hasMany(Points, { sourceKey: 'points', foreignKey: 'id' })`
    // (server/models/points.js), so the column holds a `points.id`. Best
    // Picture stores 9, and points row 9 is Oscars tier 1, worth 20 points.
    //
    // Carrying the API's name across would be the single most dangerous field
    // in the port: a scoring service that summed `award.points` would award
    // Best Picture 9 points instead of 20, and every total in the app would be
    // quietly wrong. The DTO is named for what the column is.
    const award = await awardRepository.findById(62);

    expect(award.pointsId).toBe(9);
    expect(award).not.toHaveProperty('points');
  });

  it('resolves against the points table the way the source API did', async () => {
    // The event capture nested the resolved row as `pointsData`. Reading
    // points.id = award.pointsId reproduces it exactly, which is the proof
    // that the rename describes the real relationship.
    const expected = oscars.awards.find((a) => a.id === 62);
    if (!expected) throw new Error('oscars fixture is missing award 62');

    const award = await awardRepository.findById(62);

    const [row] = await db.$queryRaw<{ points: number | null }[]>`
      select points from points where id = ${award.pointsId}
    `;

    expect(row?.points).toBe(expected.pointsData[0]?.points);
    expect(row?.points).toBe(20);
    // The stored value and the value it resolves to are genuinely different
    // numbers, so nothing here works by coincidence.
    expect(award.pointsId).not.toBe(row?.points);
  });

  it('is nullable, because the column is', async () => {
    // `points` is `Int?`. An award with no tier assigned scores nothing, and
    // that is the service layer's problem, not a reason to throw here.
    const awards = await awardRepository.findAll();
    expect(
      awards.every((a) => a.pointsId === null || typeof a.pointsId === 'number'),
    ).toBe(true);
  });
});

describe('bigint hygiene', () => {
  it('returns eventId as a number, not a bigint', async () => {
    // awards.event_id is bigint while events.id is integer. A bigint in the
    // DTO would throw "Do not know how to serialize a BigInt" the moment
    // anything called JSON.stringify on it — a Server Action result, a cache
    // write, a log line.
    const award = await awardRepository.findById(62);
    expect(typeof award.eventId).toBe('number');
  });

  it('survives JSON.stringify', async () => {
    const award = await awardRepository.findById(62);
    expect(() => JSON.stringify(award)).not.toThrow();
  });
});

describe('awardRepository.findByEventId', () => {
  it('returns every award for the event', async () => {
    const awards = await awardRepository.findByEventId(oscars.id);
    expect(awards).toHaveLength(oscars.awards.length);
    // Membership, not order — the ordering contract is the test below.
    expect(new Set(awards.map((a) => a.id))).toEqual(
      new Set(oscars.awards.map((a) => a.id)),
    );
  });

  it('orders by id, as the database returns them', async () => {
    // Asserted against an explicit ORDER BY rather than a JS sort. The source
    // API returned Postgres physical order here, which is not a contract.
    const awards = await awardRepository.findByEventId(8);

    const ordered = await db.$queryRaw<{ id: number }[]>`
      select id from awards where event_id = 8 order by id asc
    `;

    expect(awards.map((a) => a.id)).toEqual(ordered.map((r) => r.id));
  });

  it('accepts the bigint ids that other tables store', async () => {
    // awards.event_id is bigint, so a caller holding one has a bigint.
    const awards = await awardRepository.findByEventId(8n);
    expect(awards).toHaveLength(oscars.awards.length);
  });

  it('returns an empty array for an event that does not exist', async () => {
    // This schema has no foreign keys, so a dangling event_id is possible.
    // An event with no awards is also just a new event.
    expect(await awardRepository.findByEventId(999_999)).toEqual([]);
  });
});

describe('awardRepository.findManyByEventIds', () => {
  it('returns the awards for every requested event', async () => {
    const awards = await awardRepository.findManyByEventIds([8, 6]);
    expect(new Set(awards.map((a) => a.eventId))).toEqual(new Set([6, 8]));
    expect(awards.length).toBeGreaterThan(oscars.awards.length);
  });

  it('silently skips event ids that resolve to nothing', async () => {
    const awards = await awardRepository.findManyByEventIds([8, 999_999]);
    expect(awards).toHaveLength(oscars.awards.length);
  });

  it('returns an empty array for an empty request', async () => {
    expect(await awardRepository.findManyByEventIds([])).toEqual([]);
  });
});

describe('awardRepository.findManyByIds', () => {
  it('returns the requested awards', async () => {
    const awards = await awardRepository.findManyByIds([1, 62, 63]);
    expect(awards.map((a) => a.id)).toEqual([1, 62, 63]);
  });

  it('silently skips ids that do not exist', async () => {
    // nominations.award_id and winners.award_id are bigint against an integer
    // awards.id, with no foreign key enforcing either. A dangling reference
    // must not take down a page render.
    const awards = await awardRepository.findManyByIds([62, 999_999]);
    expect(awards).toHaveLength(1);
  });

  it('accepts the bigint ids that other tables store', async () => {
    const awards = await awardRepository.findManyByIds([62n, 63n]);
    expect(awards).toHaveLength(2);
  });

  it('returns an empty array for an empty request', async () => {
    expect(await awardRepository.findManyByIds([])).toEqual([]);
  });
});

describe('awardRepository.findAll', () => {
  it('returns every award, ordered by id', async () => {
    const awards = await awardRepository.findAll();

    const ordered = await db.$queryRaw<{ id: number }[]>`
      select id from awards order by id asc
    `;

    expect(awards.map((a) => a.id)).toEqual(ordered.map((r) => r.id));
    expect(awards).toHaveLength(100);
  });
});

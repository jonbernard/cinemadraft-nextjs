// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { loadFixture } from '@/test/fixtures';

import { leagueRepository } from './leagues';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * A league as the source API nested it inside `/user/drafts`.
 *
 * This is the only fixture that carries the league unedited. The two
 * `/league/*` endpoints ran it through `formatDrafts` (server/routes/league.js),
 * which stripped `owner` and bolted on the derived `isOwner`, `selections` and
 * `years` — none of which are columns.
 */
type FixtureLeague = {
  id: number;
  fbId: string | null;
  draftingStatus: string | null;
  name: string;
  activeYear: number | null;
  uuid: string | null;
  type: string | null;
  owner: number[];
  createdAt: string | null;
  updatedAt: string | null;
};

const userDrafts = loadFixture<{ drafts: { league: FixtureLeague }[] }>('user-drafts');
const fixtureLeague = userDrafts.drafts[0]?.league;
if (!fixtureLeague) throw new Error('user-drafts fixture carries no league');

describe('leagueRepository.findById', () => {
  it('returns the league', async () => {
    const league = await leagueRepository.findById(1);
    expect(league.name).toBe('Racso award');
    expect(league.type).toBe('snake');
    expect(league.draftingStatus).toBe('complete');
  });

  it('throws NotFoundError for an id that does not exist', async () => {
    await expect(leagueRepository.findById(999_999)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(leagueRepository.findById(999_999)).rejects.toThrow(
      'league 999999 not found',
    );
  });
});

describe('leagueRepository.findByUuid', () => {
  it('returns the league behind an invite uuid', async () => {
    // The uuid is the join link: /draft/uuid/:uuid was the only way a member
    // ever entered a league they did not own.
    const expected = await leagueRepository.findById(1);
    if (!expected.uuid) throw new Error('league 1 has no uuid');

    const league = await leagueRepository.findByUuid(expected.uuid);
    expect(league?.id).toBe(1);
  });

  it('returns null for a uuid nobody holds', async () => {
    // A miss here is a user pasting a stale or mistyped invite link, not a
    // programming error, so it is a value rather than a throw.
    expect(
      await leagueRepository.findByUuid('00000000-0000-0000-0000-000000000000'),
    ).toBeNull();
  });

  it('returns null rather than throwing on a malformed uuid', async () => {
    // Postgres rejects a bad uuid literal at the type level, which Prisma
    // surfaces as a raw driver error. That would leak the query out of the
    // repository — see the note at the top of lib/errors.ts.
    expect(await leagueRepository.findByUuid('not-a-uuid')).toBeNull();
  });
});

describe('leagueRepository.findManyByIds', () => {
  it('returns the requested leagues', async () => {
    const leagues = await leagueRepository.findManyByIds([1, 70]);
    expect(leagues.map((l) => l.id)).toEqual([1, 70]);
  });

  it('silently skips ids that do not resolve', async () => {
    // This schema has no foreign keys, so drafts.league_id can point at a
    // league that no longer exists. A dangling reference must not take down a
    // page render.
    const leagues = await leagueRepository.findManyByIds([1, 999_999]);
    expect(leagues).toHaveLength(1);
  });

  it('accepts bigint ids', async () => {
    const leagues = await leagueRepository.findManyByIds([1n, 70n]);
    expect(leagues.map((l) => l.id)).toEqual([1, 70]);
  });

  it('returns an empty array for an empty request', async () => {
    expect(await leagueRepository.findManyByIds([])).toEqual([]);
  });

  it('orders by id, using the database collation', async () => {
    const leagues = await leagueRepository.findManyByIds([301, 1, 136, 70]);

    const ordered = await db.$queryRaw<{ id: number }[]>`
      select id from leagues where id in (301, 1, 136, 70) order by id asc
    `;

    expect(leagues.map((l) => l.id)).toEqual(ordered.map((r) => r.id));
  });
});

describe('the DTO matches the captured contract', () => {
  it('carries the columns the source API returned, with owner parsed', async () => {
    const league = await leagueRepository.findById(fixtureLeague.id);

    expect(Object.keys(league).sort()).toEqual(
      Object.keys(fixtureLeague)
        .map((key) => (key === 'owner' ? 'ownerIds' : key))
        .sort(),
    );
  });

  it('matches the captured values field for field', async () => {
    const league = await leagueRepository.findById(fixtureLeague.id);

    expect(league.id).toBe(fixtureLeague.id);
    expect(league.name).toBe(fixtureLeague.name);
    expect(league.fbId).toBe(fixtureLeague.fbId);
    expect(league.type).toBe(fixtureLeague.type);
    expect(league.draftingStatus).toBe(fixtureLeague.draftingStatus);
    expect(league.activeYear).toBe(fixtureLeague.activeYear);
    expect(league.createdAt?.toISOString()).toBe(fixtureLeague.createdAt);
  });

  it('parses owner, which is stored as JSON text rather than a column of ids', async () => {
    // leagues.owner is a TEXT column holding `[3]`. The source app hid that
    // behind a Sequelize getter (server/models/leagues.js), so every caller
    // saw an array and nothing in the app ever saw the raw string. Parsing
    // here keeps that true without a getter: a caller that received the string
    // would `.includes(userId)` on it and match substrings — `"[13]".includes(3)`
    // is false, but `"[31]".includes(3)` is true, which is an ownership check
    // that silently passes for the wrong user.
    const league = await leagueRepository.findById(fixtureLeague.id);

    expect(league.ownerIds).toEqual(fixtureLeague.owner);
    expect(Array.isArray(league.ownerIds)).toBe(true);
    expect(league.ownerIds.every((id) => typeof id === 'number')).toBe(true);
  });

  it('returns an empty owner list rather than throwing on unparseable text', async () => {
    // Nothing constrains that column to valid JSON. An unparseable owner must
    // fail closed — an empty list denies ownership — rather than throw and
    // take out every league listing.
    const leagues = await leagueRepository.findManyByIds([1, 70]);
    for (const league of leagues) {
      expect(Array.isArray(league.ownerIds)).toBe(true);
    }
  });

  it('carries only the enum members the schema declares', async () => {
    // The DTO takes these types from the generated enums rather than
    // restating them, so the values below are the whole domain by
    // construction. This asserts the data agrees.
    const leagues = await leagueRepository.findManyByIds([1, 2, 3, 4, 37, 70, 103, 136]);

    for (const league of leagues) {
      expect(['linear', 'snake', null]).toContain(league.type);
      expect(['pending', 'active', 'complete', null]).toContain(league.draftingStatus);
    }
  });

  it('returns Date objects, not the strings JSON gave us', async () => {
    const league = await leagueRepository.findById(1);
    expect(league.createdAt).toBeInstanceOf(Date);
  });

  it('survives JSON.stringify', async () => {
    // Nothing in this DTO may be a bigint: a Server Component handing it to a
    // Client Component serializes it, and bigint throws there.
    const leagues = await leagueRepository.findManyByIds([1, 70]);
    expect(() => JSON.stringify(leagues)).not.toThrow();
  });

  it('returns no Prisma internals', async () => {
    const league = await leagueRepository.findById(1);
    expect(Object.getPrototypeOf(league)).toBe(Object.prototype);
  });
});

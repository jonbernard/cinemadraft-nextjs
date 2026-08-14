// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { loadFixture } from '@/test/fixtures';

import { draftRepository } from './drafts';

afterAll(async () => {
  await db.$disconnect();
});

/** A draft row as the source API returned it, before any nesting was added. */
type FixtureDraft = {
  id: number;
  userId: number | null;
  leagueId: number | null;
  year: number | null;
  group: number | null;
  order: number | null;
  dummy: boolean | null;
  dummyName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const userDrafts = loadFixture<{ id: number; drafts: FixtureDraft[] }>('user-drafts');
const leagueByIdYear =
  loadFixture<{ id: number; selections: FixtureDraft[]; years: number[] }[]>(
    'league-by-id-year',
  );
const leagueDraftYear = loadFixture<Record<string, FixtureDraft[]>>('league-draft-year');
const draftUsers = loadFixture<{ id: number }[]>('draft-users');

const league = leagueByIdYear[0];
if (!league) throw new Error('league-by-id-year fixture is empty');

describe('draftRepository.findById', () => {
  it('returns the draft', async () => {
    const draft = await draftRepository.findById(124);
    expect(draft.leagueId).toBe(1);
    expect(draft.year).toBe(2025);
    expect(draft.group).toBe(1);
    expect(draft.order).toBe(3);
  });

  it('throws NotFoundError for an id that does not exist', async () => {
    await expect(draftRepository.findById(999_999)).rejects.toBeInstanceOf(NotFoundError);
    await expect(draftRepository.findById(999_999)).rejects.toThrow(
      'draft 999999 not found',
    );
  });
});

describe('draftRepository.findByLeagueIdAndYear', () => {
  it('returns every seat in that league-year', async () => {
    // `/league/1/draft/2025` grouped these by `group` for the board. The
    // fixture holds four groups of three; the grouping is a presentation
    // concern, so the repository returns the flat, ordered list.
    const drafts = await draftRepository.findByLeagueIdAndYear(1, 2025);

    const fixtureCount = Object.values(leagueDraftYear).flat().length;
    expect(drafts).toHaveLength(fixtureCount);
    expect(drafts.every((d) => d.year === 2025 && d.leagueId === 1)).toBe(true);
  });

  it('orders by group then order — this is the draft board', async () => {
    // Asserting against a JS sort would only re-run the comparison in a second
    // language. Comparing against an explicit SQL ordering checks the
    // repository asked the database for the right ORDER BY.
    //
    // `group` and `order` together are the seat: group is the round-robin
    // bucket, order is the position within it. Snake leagues reverse `order`
    // on alternate rounds, and lib/services/draft.ts derives that from this
    // ordering — get it wrong and every pick lands on the wrong person.
    const drafts = await draftRepository.findByLeagueIdAndYear(1, 2025);

    const ordered = await db.$queryRaw<{ id: number }[]>`
      select id from drafts
      where league_id = 1 and year = 2025
      order by "group" asc, "order" asc, id asc
    `;

    expect(drafts.map((d) => d.id)).toEqual(ordered.map((r) => r.id));
    expect(drafts.length).toBeGreaterThan(1);
  });

  it('returns an empty array for a league-year nobody drafted', async () => {
    expect(await draftRepository.findByLeagueIdAndYear(1, 1900)).toEqual([]);
  });
});

describe('draftRepository.findByLeagueId', () => {
  it('returns every draft in the league, across all years', async () => {
    // `/league/:id/:year?` accepts a year and then ignores it: the route calls
    // Drafts.getByLeagueId, which filters on leagueId alone
    // (server/controllers/draft.js). That is why the fixture captured at
    // /league/1/2025 carries selections from 2017 through 2026. The year
    // filter belongs to findByLeagueIdAndYear; this method is deliberately
    // year-wide, matching what the endpoint actually returned.
    const drafts = await draftRepository.findByLeagueId(1);
    expect(drafts).toHaveLength(league.selections.length);
  });

  it('orders by year descending, then by seat', async () => {
    const drafts = await draftRepository.findByLeagueId(1);

    const ordered = await db.$queryRaw<{ id: number }[]>`
      select id from drafts
      where league_id = 1
      order by year desc, "group" asc, "order" asc, id asc
    `;

    expect(drafts.map((d) => d.id)).toEqual(ordered.map((r) => r.id));
  });

  it('returns an empty array for a league that does not exist', async () => {
    // No foreign keys, so a stale league id is a real possibility. An empty
    // roster is the honest answer; findById is where a missing league throws.
    expect(await draftRepository.findByLeagueId(999_999)).toEqual([]);
  });
});

describe('draftRepository.findByLeagueIdsAndYear', () => {
  it('returns the drafts for every requested league in one query', async () => {
    // The draft watchlist (`/watchlist/drafts/:year`) loads the user's leagues
    // and then every seat in them for one year, so this is a batch by design —
    // one query, not one per league.
    const drafts = await draftRepository.findByLeagueIdsAndYear([1, 70], 2026);

    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts.every((d) => d.year === 2026)).toBe(true);
    expect(new Set(drafts.map((d) => d.leagueId))).toEqual(new Set([1, 70]));
  });

  it('accepts bigint ids', async () => {
    const drafts = await draftRepository.findByLeagueIdsAndYear([1n], 2025);
    expect(drafts.length).toBeGreaterThan(0);
  });

  it('returns an empty array for an empty request', async () => {
    expect(await draftRepository.findByLeagueIdsAndYear([], 2025)).toEqual([]);
  });

  it('silently skips league ids that do not resolve', async () => {
    const drafts = await draftRepository.findByLeagueIdsAndYear([1, 999_999], 2025);
    expect(drafts.every((d) => d.leagueId === 1)).toBe(true);
  });

  it('orders by league then seat', async () => {
    const drafts = await draftRepository.findByLeagueIdsAndYear([1, 70], 2026);

    const ordered = await db.$queryRaw<{ id: number }[]>`
      select id from drafts
      where league_id in (1, 70) and year = 2026
      order by league_id asc, "group" asc, "order" asc, id asc
    `;

    expect(drafts.map((d) => d.id)).toEqual(ordered.map((r) => r.id));
  });
});

describe('draftRepository.findByUserId', () => {
  it('returns every draft the user holds a seat in', async () => {
    const drafts = await draftRepository.findByUserId(userDrafts.id);
    expect(drafts).toHaveLength(userDrafts.drafts.length);
    expect(drafts.every((d) => d.userId === userDrafts.id)).toBe(true);
  });

  it('orders by year descending — the profile lists most recent first', async () => {
    const drafts = await draftRepository.findByUserId(userDrafts.id);

    const ordered = await db.$queryRaw<{ id: number }[]>`
      select id from drafts
      where user_id = ${userDrafts.id}
      order by year desc, league_id asc, id asc
    `;

    expect(drafts.map((d) => d.id)).toEqual(ordered.map((r) => r.id));
  });

  it('returns an empty array for a user who has never drafted', async () => {
    expect(await draftRepository.findByUserId(999_999)).toEqual([]);
  });
});

describe('draftRepository.findLeagueIdsByUserId', () => {
  it('returns the distinct leagues the user has a seat in', async () => {
    // `/league/user` is this, then a batch load of the leagues themselves.
    // Composing the two lives in the service; each repository stays on its
    // own table because this schema has no foreign keys for Prisma to join on.
    const ids = await draftRepository.findLeagueIdsByUserId(userDrafts.id);
    expect(ids).toEqual([1, 70]);
  });

  it('does not repeat a league the user drafted in for many years', async () => {
    // User 3 holds nine seats in league 1, one per year.
    const ids = await draftRepository.findLeagueIdsByUserId(userDrafts.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns an empty array for a user who has never drafted', async () => {
    expect(await draftRepository.findLeagueIdsByUserId(999_999)).toEqual([]);
  });
});

describe('draftRepository.findUserIdsByLeagueId', () => {
  it('returns the distinct members of a league', async () => {
    // Named for what it takes. The source route is `GET /draft/users/:id`,
    // which reads as a draft id and is not: the handler calls
    // Drafts.getUsersByLeagueId (server/routes/draft.js). Handed a draft id it
    // returned `[]` rather than erroring, so the bug was silent — the fixture
    // was captured at /draft/users/1 with league 1, not draft 1. Recorded in
    // docs/PROGRESS.md; the name is corrected here rather than carried over.
    const ids = await draftRepository.findUserIdsByLeagueId(1);
    expect(ids).toHaveLength(draftUsers.length);
    expect(new Set(ids)).toEqual(new Set(draftUsers.map((u) => u.id)));
  });

  it('drops the dummy seats, which have no user', async () => {
    // A league owner can seat a placeholder for someone without an account:
    // drafts.dummy with a free-text drafts.dummy_name. Those rows have a null
    // user_id and must not surface as a null in a list of member ids.
    const ids = await draftRepository.findUserIdsByLeagueId(1);
    expect(ids.every((id) => typeof id === 'number')).toBe(true);
    expect(ids).not.toContain(null);
  });

  it('returns an empty array for a league that does not exist', async () => {
    expect(await draftRepository.findUserIdsByLeagueId(999_999)).toEqual([]);
  });
});

describe('draftRepository.findYearsByLeagueId', () => {
  it('returns the distinct years the league has drafted, newest first', async () => {
    // The league page renders these as its year switcher — `years` in the
    // captured response, which the source route derived in JS from the
    // selections it had already loaded.
    const years = await draftRepository.findYearsByLeagueId(league.id);
    expect(years).toEqual(league.years);
  });

  it('returns an empty array for a league that does not exist', async () => {
    expect(await draftRepository.findYearsByLeagueId(999_999)).toEqual([]);
  });
});

describe('the DTO matches the captured contract', () => {
  const expected = userDrafts.drafts[0];
  if (!expected) throw new Error('user-drafts fixture carries no drafts');

  it('carries exactly the columns the source API returned', async () => {
    // The captured draft nests `league`; that join belongs to the service, so
    // it is not part of this DTO.
    const draft = await draftRepository.findById(expected.id);
    expect(Object.keys(draft).sort()).toEqual(
      Object.keys(expected)
        .filter((key) => key !== 'league')
        .sort(),
    );
  });

  it('matches the captured values field for field', async () => {
    const draft = await draftRepository.findById(expected.id);

    expect(draft.id).toBe(expected.id);
    expect(draft.userId).toBe(expected.userId);
    expect(draft.leagueId).toBe(expected.leagueId);
    expect(draft.year).toBe(expected.year);
    expect(draft.group).toBe(expected.group);
    expect(draft.order).toBe(expected.order);
    expect(draft.dummy).toBe(expected.dummy);
    expect(draft.dummyName).toBe(expected.dummyName);
    expect(draft.createdAt?.toISOString()).toBe(expected.createdAt);
  });

  it('keeps dummy seats, which carry a name instead of a user', async () => {
    // dummy/dummyName are how an owner seats someone without an account. The
    // `/draft/:id` endpoint stripped them (getByIdExtend excludes dummy,
    // dummyName and userId), but the league board needs them to label the
    // seat, so the DTO keeps them and the route shape does not constrain it.
    const drafts = await draftRepository.findByLeagueIdAndYear(1, 2026);
    const dummies = drafts.filter((d) => d.dummy === true);

    expect(dummies.length).toBeGreaterThan(0);
    for (const seat of dummies) {
      expect(seat.userId).toBeNull();
      expect(typeof seat.dummyName).toBe('string');
    }
  });

  it('returns Date objects, not the strings JSON gave us', async () => {
    const draft = await draftRepository.findById(124);
    expect(draft.createdAt).toBeInstanceOf(Date);
  });

  it('survives JSON.stringify', async () => {
    const drafts = await draftRepository.findByLeagueIdAndYear(1, 2025);
    expect(() => JSON.stringify(drafts)).not.toThrow();
  });

  it('returns no Prisma internals', async () => {
    const draft = await draftRepository.findById(124);
    expect(Object.getPrototypeOf(draft)).toBe(Object.prototype);
  });
});

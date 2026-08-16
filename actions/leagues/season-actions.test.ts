// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ currentUser }));

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath }));

import { db } from '@/lib/db';
import { leagueRepository } from '@/lib/repositories/leagues';
import {
  completeDraft,
  stageNextSeason,
  startDraft,
  updateLeagueSettings,
} from './manage-league';
import {
  addDummySeat,
  assignSeats,
  randomiseGroups,
  removeSeat,
  renameDummySeat,
} from './manage-seats';

/**
 * Running a season: the owner's yearly work.
 *
 * 🔴 Three source bugs live in this area (`PARITY.md` 4, 5 and 6), and all
 * three are the same shape — a write that does more, or checks less, than its
 * name suggests. The refusals are tested before the successes and assert the
 * database is unchanged.
 */
const TAG = 'season-actions';
const DOMAIN = '@example.test';
const YEAR = 2993;

type Fixture = Awaited<ReturnType<typeof seed>>;

async function seed() {
  const now = new Date();
  const [owner, member, stranger] = await Promise.all(
    ['owner', 'member', 'stranger'].map((role) =>
      db.user.create({
        data: {
          uuid: randomUUID(),
          email: `${TAG}-${role}-${randomUUID().slice(0, 8)}${DOMAIN}`,
          clerkId: `user_${TAG}_${role}_${randomUUID().slice(0, 8)}`,
          createdAt: now,
          updatedAt: now,
        },
        select: { id: true, email: true, clerkId: true },
      }),
    ),
  );

  const league = await db.league.create({
    data: {
      name: `${TAG} league`,
      owner: JSON.stringify([owner?.id]),
      uuid: randomUUID(),
      draftingStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });

  const seats = await Promise.all(
    [owner, member].map((user) =>
      db.draft.create({
        data: { leagueId: league.id, year: YEAR, userId: user?.id },
        select: { id: true, userId: true },
      }),
    ),
  );

  return { owner, member, stranger, league, seats };
}

function signInAs(user: { clerkId: string | null; email: string } | null | undefined) {
  if (!user) {
    currentUser.mockResolvedValue(null);
    return;
  }
  currentUser.mockResolvedValue({
    id: user.clerkId,
    emailAddresses: [{ emailAddress: user.email, verification: { status: 'verified' } }],
    firstName: null,
    lastName: null,
    imageUrl: null,
  });
}

const seatsOf = (leagueId: number) =>
  db.draft.findMany({
    where: { leagueId },
    select: {
      id: true,
      userId: true,
      year: true,
      group: true,
      order: true,
      dummyName: true,
    },
    orderBy: { id: 'asc' },
  });

async function cleanup() {
  const leagues = await db.league.findMany({
    where: { name: { startsWith: TAG } },
    select: { id: true },
  });
  const ids = leagues.map((league) => league.id);
  const seats = await db.draft.findMany({
    where: { leagueId: { in: ids } },
    select: { id: true },
  });
  await db.draftPick.deleteMany({
    where: { draftId: { in: seats.map((seat) => seat.id) } },
  });
  await db.draft.deleteMany({ where: { leagueId: { in: ids } } });
  await db.league.deleteMany({ where: { id: { in: ids } } });
  await db.user.deleteMany({ where: { email: { contains: `${TAG}-` } } });
  await db.movie.deleteMany({ where: { title: { startsWith: TAG } } });
}

let fixture: Fixture;

beforeEach(async () => {
  currentUser.mockReset();
  revalidatePath.mockClear();
  await cleanup();
  fixture = await seed();
});

afterEach(cleanup);

afterAll(async () => {
  await db.$disconnect();
});

describe('seat management — refusals', () => {
  it('🔴 a member cannot add a seat to a league they do not own', async () => {
    // Source bug 4: `verifyLeagueOwner` guards on a param that route does not
    // have, so any logged-in user could add a seat to any league.
    signInAs(fixture.member);

    const result = await addDummySeat({
      leagueId: fixture.league.id,
      year: YEAR,
      dummyName: 'Interloper',
    });

    expect(result.ok).toBe(false);
    expect(await seatsOf(fixture.league.id)).toHaveLength(2);
  });

  it('🔴 a stranger cannot remove a seat', async () => {
    // Source bug 5: `DELETE /draft/:id` authenticated but never authorised, so
    // any logged-in user could delete any seat in any league.
    signInAs(fixture.stranger);

    const result = await removeSeat({
      leagueId: fixture.league.id,
      draftId: fixture.seats[0]?.id as number,
    });

    expect(result.ok).toBe(false);
    expect(await seatsOf(fixture.league.id)).toHaveLength(2);
  });

  it('🔴 a logged-out caller cannot rearrange groups', async () => {
    signInAs(null);

    const result = await randomiseGroups({
      leagueId: fixture.league.id,
      year: YEAR,
      groupCount: 2,
    });

    expect(result.ok).toBe(false);
    expect((await seatsOf(fixture.league.id)).every((seat) => seat.group === null)).toBe(
      true,
    );
  });
});

describe('seat management', () => {
  it('seats a placeholder for someone with no account', async () => {
    // 17 of these exist in production; they are normal.
    signInAs(fixture.owner);

    const result = await addDummySeat({
      leagueId: fixture.league.id,
      year: YEAR,
      dummyName: 'Celebrity Guest',
    });

    expect(result.ok).toBe(true);
    const seats = await seatsOf(fixture.league.id);
    const dummy = seats.find((seat) => seat.dummyName === 'Celebrity Guest');
    expect(dummy?.userId).toBeNull();
  });

  it('renames a placeholder', async () => {
    signInAs(fixture.owner);
    const added = await addDummySeat({
      leagueId: fixture.league.id,
      year: YEAR,
      dummyName: 'Typo',
    });
    const draftId = (added as { data: { draftId: number } }).data.draftId;

    await renameDummySeat({ leagueId: fixture.league.id, draftId, dummyName: 'Fixed' });

    const seats = await seatsOf(fixture.league.id);
    expect(seats.find((seat) => seat.id === draftId)?.dummyName).toBe('Fixed');
  });

  it('🔴 refuses to rename a real member’s seat', async () => {
    // Their name is their own, and it is the same person in every league.
    signInAs(fixture.owner);

    const result = await renameDummySeat({
      leagueId: fixture.league.id,
      draftId: fixture.seats[1]?.id as number,
      dummyName: 'Not Their Name',
    });

    expect(result).toMatchObject({ ok: false, code: 'CONFLICT' });
  });

  it('removes an empty seat', async () => {
    signInAs(fixture.owner);

    const result = await removeSeat({
      leagueId: fixture.league.id,
      draftId: fixture.seats[1]?.id as number,
    });

    expect(result.ok).toBe(true);
    expect(await seatsOf(fixture.league.id)).toHaveLength(1);
  });

  it('🔴 refuses to remove a seat that holds picks, which would orphan them', async () => {
    // `draft_picks` has no foreign key, so nothing cascades: the picks would
    // belong to nobody, and the board drops them while scoring keeps them.
    signInAs(fixture.owner);
    const movie = await db.movie.create({
      data: { title: `${TAG} film`, createdAt: new Date(), updatedAt: new Date() },
      select: { id: true },
    });
    await db.draftPick.create({
      data: {
        draftId: fixture.seats[1]?.id as number,
        movieId: BigInt(movie.id),
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const result = await removeSeat({
      leagueId: fixture.league.id,
      draftId: fixture.seats[1]?.id as number,
    });

    expect(result).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(await seatsOf(fixture.league.id)).toHaveLength(2);
  });
});

describe('groups', () => {
  it('deals everyone into groups', async () => {
    signInAs(fixture.owner);

    const result = await randomiseGroups({
      leagueId: fixture.league.id,
      year: YEAR,
      groupCount: 2,
    });

    expect(result).toMatchObject({ ok: true, data: { assigned: 2 } });
    const seats = await seatsOf(fixture.league.id);
    expect(seats.every((seat) => seat.group != null && seat.order != null)).toBe(true);
  });

  it('🔴 refuses once the draft has started', async () => {
    // Reshuffling mid-draft moves people away from picks they already made,
    // and the board reads `group` to decide which board a seat is on.
    signInAs(fixture.owner);
    await randomiseGroups({ leagueId: fixture.league.id, year: YEAR, groupCount: 1 });
    await startDraft({ leagueId: fixture.league.id, year: YEAR });

    const result = await randomiseGroups({
      leagueId: fixture.league.id,
      year: YEAR,
      groupCount: 2,
    });

    expect(result).toMatchObject({ ok: false, code: 'CONFLICT' });
  });

  it('saves a layout the owner arranged by hand', async () => {
    signInAs(fixture.owner);

    await assignSeats({
      leagueId: fixture.league.id,
      assignments: [
        { draftId: fixture.seats[0]?.id as number, group: 2, order: 1 },
        { draftId: fixture.seats[1]?.id as number, group: 1, order: 1 },
      ],
    });

    const seats = await seatsOf(fixture.league.id);
    expect(seats.find((s) => s.id === fixture.seats[0]?.id)?.group).toBe(2);
    expect(seats.find((s) => s.id === fixture.seats[1]?.id)?.group).toBe(1);
  });

  it('🔴 cannot reassign a seat belonging to another league', async () => {
    // The league is in the WHERE clause, so a foreign seat id matches nothing
    // rather than being silently rewritten.
    const other = await db.league.create({
      data: {
        name: `${TAG} other`,
        owner: JSON.stringify([fixture.stranger?.id]),
        uuid: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      select: { id: true },
    });
    const foreign = await db.draft.create({
      data: { leagueId: other.id, year: YEAR, userId: fixture.stranger?.id },
      select: { id: true },
    });
    signInAs(fixture.owner);

    await assignSeats({
      leagueId: fixture.league.id,
      assignments: [{ draftId: foreign.id, group: 9, order: 9 }],
    });

    const untouched = await db.draft.findUnique({ where: { id: foreign.id } });
    expect(untouched?.group).toBeNull();
  });
});

describe('draft status', () => {
  it('🔴 starting the draft does not seat the owner again', async () => {
    // Source bug 6: the equivalent route inserted a `drafts` row for the
    // caller on every call, so an owner who clicked twice got two seats.
    signInAs(fixture.owner);
    await randomiseGroups({ leagueId: fixture.league.id, year: YEAR, groupCount: 1 });

    await startDraft({ leagueId: fixture.league.id, year: YEAR });
    await startDraft({ leagueId: fixture.league.id, year: YEAR });

    expect(await seatsOf(fixture.league.id)).toHaveLength(2);
    expect((await leagueRepository.findById(fixture.league.id)).draftingStatus).toBe(
      'active',
    );
  });

  it('🔴 refuses to start with everyone ungrouped', async () => {
    // `getLeagueBoard` groups by `group`; all-null collapses into one group of
    // everybody, which is not the league anyone set up.
    signInAs(fixture.owner);

    const result = await startDraft({ leagueId: fixture.league.id, year: YEAR });

    expect(result).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect((await leagueRepository.findById(fixture.league.id)).draftingStatus).toBe(
      'pending',
    );
  });

  it('marks the draft complete', async () => {
    signInAs(fixture.owner);

    await completeDraft({ leagueId: fixture.league.id, year: YEAR });

    expect((await leagueRepository.findById(fixture.league.id)).draftingStatus).toBe(
      'complete',
    );
  });
});

describe('settings', () => {
  it('renames a league', async () => {
    signInAs(fixture.owner);

    await updateLeagueSettings({ leagueId: fixture.league.id, name: `${TAG} renamed` });

    expect((await leagueRepository.findById(fixture.league.id)).name).toBe(
      `${TAG} renamed`,
    );
  });

  it('🔴 cannot be used to take the league', async () => {
    // Source bug 6: `PUT /league/:id` wrote req.body straight through, so a
    // request could set `owner` — the column every ownership check reads. The
    // schema here is an allowlist, so the extra field is dropped rather than
    // forwarded.
    signInAs(fixture.owner);

    await updateLeagueSettings({
      leagueId: fixture.league.id,
      name: `${TAG} still mine`,
      // @ts-expect-error deliberately passing a field the schema does not allow
      owner: JSON.stringify([fixture.stranger?.id]),
    });

    expect((await leagueRepository.findById(fixture.league.id)).ownerIds).toEqual([
      fixture.owner?.id,
    ]);
  });

  it('refuses a member changing settings', async () => {
    signInAs(fixture.member);

    const result = await updateLeagueSettings({
      leagueId: fixture.league.id,
      name: 'Hijacked',
    });

    expect(result.ok).toBe(false);
    expect((await leagueRepository.findById(fixture.league.id)).name).toBe(
      `${TAG} league`,
    );
  });
});

describe('staging next season', () => {
  it('carries this year’s people into next year', async () => {
    signInAs(fixture.owner);

    const result = await stageNextSeason({
      leagueId: fixture.league.id,
      year: YEAR + 1,
    });

    expect(result).toMatchObject({ ok: true, data: { seated: 2 } });
    const next = (await seatsOf(fixture.league.id)).filter(
      (seat) => seat.year === YEAR + 1,
    );
    expect(next).toHaveLength(2);
  });

  it('🔴 running it twice does not double the league', async () => {
    signInAs(fixture.owner);
    await stageNextSeason({ leagueId: fixture.league.id, year: YEAR + 1 });

    const second = await stageNextSeason({
      leagueId: fixture.league.id,
      year: YEAR + 1,
    });

    expect(second).toMatchObject({ ok: true, data: { seated: 0 } });
    expect(
      (await seatsOf(fixture.league.id)).filter((seat) => seat.year === YEAR + 1),
    ).toHaveLength(2);
  });

  it('carries placeholder seats too', async () => {
    signInAs(fixture.owner);
    await addDummySeat({
      leagueId: fixture.league.id,
      year: YEAR,
      dummyName: 'Placeholder',
    });

    await stageNextSeason({ leagueId: fixture.league.id, year: YEAR + 1 });

    const next = (await seatsOf(fixture.league.id)).filter(
      (seat) => seat.year === YEAR + 1,
    );
    expect(next.some((seat) => seat.dummyName === 'Placeholder')).toBe(true);
  });

  it('returns the league to pending, because a new season has no groups', async () => {
    signInAs(fixture.owner);

    await stageNextSeason({ leagueId: fixture.league.id, year: YEAR + 1 });

    expect((await leagueRepository.findById(fixture.league.id)).draftingStatus).toBe(
      'pending',
    );
  });
});

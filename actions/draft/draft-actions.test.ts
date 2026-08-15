// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ currentUser }));

// `revalidatePath` needs a request store, which no test has. Mocking it keeps
// these tests about authorization and data; that the paths are revalidated is
// asserted directly, below.
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath }));

import { db } from '@/lib/db';
import { addPick } from './add-pick';
import { removePick } from './remove-pick';
import { reorderPicks } from './reorder-picks';

/**
 * 🔴 These three actions are the only writes in the app that can rewrite
 * another league's draft, and the source app's authorization on all three was
 * broken in both directions (D47). So the refusals are asserted first and
 * asserted hardest: every one of them checks the *database is unchanged*, not
 * merely that the call came back unhappy. A guard that throws after writing is
 * not a guard.
 *
 * Everything is seeded, so this suite runs on CI where there is a schema and
 * no data.
 */
const TAG = 'draft-actions';
const DOMAIN = '@example.test';

/** The seats and films one test owns, so the assertions can name them. */
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
      // Stored exactly as production stores it: TEXT holding a JSON array.
      owner: JSON.stringify([owner.id]),
      uuid: randomUUID(),
      draftingStatus: 'active',
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });

  const year = 2999;
  const [seatA, seatB, otherGroup] = await Promise.all([
    db.draft.create({
      data: { userId: member.id, leagueId: league.id, year, group: 1, order: 1 },
      select: { id: true },
    }),
    db.draft.create({
      data: { userId: stranger.id, leagueId: league.id, year, group: 1, order: 2 },
      select: { id: true },
    }),
    db.draft.create({
      data: {
        leagueId: league.id,
        year,
        group: 2,
        order: 1,
        dummy: true,
        dummyName: 'Empty seat',
      },
      select: { id: true },
    }),
  ]);

  const films = await Promise.all(
    // Titles carry the tag so cleanup cannot reach a real film. The restored
    // database has an *Arrival* at id 1, and a fixture that deletes by plain
    // title would take it.
    ['Arrival', 'Moonlight', 'Paterson', 'Jackie'].map((title) =>
      db.movie.create({
        data: {
          title: `${TAG} ${title}`,
          sortTitle: `${TAG} ${title}`,
          createdAt: now,
          updatedAt: now,
        },
        select: { id: true, title: true },
      }),
    ),
  );

  return { owner, member, stranger, league, year, seatA, seatB, otherGroup, films };
}

/** Points Clerk at a seeded row, or at nobody. */
function signInAs(user: { clerkId: string | null; email: string } | null) {
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

/** The seat's picks as `[movieId, order]`, in stored order. */
async function picksOf(draftId: number) {
  const picks = await db.draftPick.findMany({
    where: { draftId },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    select: { id: true, movieId: true, order: true },
  });
  return picks.map((pick) => ({
    id: pick.id,
    movieId: Number(pick.movieId),
    order: pick.order,
  }));
}

async function cleanup() {
  const leagues = await db.league.findMany({
    where: { name: { contains: TAG } },
    select: { id: true },
  });
  const drafts = await db.draft.findMany({
    where: { leagueId: { in: leagues.map((league) => league.id) } },
    select: { id: true },
  });
  await db.draftPick.deleteMany({
    where: { draftId: { in: drafts.map((draft) => draft.id) } },
  });
  await db.draft.deleteMany({ where: { id: { in: drafts.map((draft) => draft.id) } } });
  await db.league.deleteMany({
    where: { id: { in: leagues.map((league) => league.id) } },
  });
  await db.user.deleteMany({ where: { email: { contains: `${TAG}-` } } });
  await db.movie.deleteMany({ where: { title: { startsWith: `${TAG} ` } } });
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

describe('addPick — refusals', () => {
  it('🔴 refuses a signed-out caller and writes nothing', async () => {
    signInAs(null);

    const result = await addPick({
      draftId: fixture.seatA.id,
      movieId: fixture.films[0]?.id as number,
    });

    expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(await picksOf(fixture.seatA.id)).toEqual([]);
  });

  it('🔴 refuses a league member who is not the owner', async () => {
    // Members do not enter their own picks — the owner does, on the call
    // (D46). A member holding a seat is the most plausible attacker.
    signInAs(fixture.member);

    const result = await addPick({
      draftId: fixture.seatA.id,
      movieId: fixture.films[0]?.id as number,
    });

    expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(await picksOf(fixture.seatA.id)).toEqual([]);
  });

  it('🔴 refuses a stranger whose id is a substring of the owner’s (D47)', async () => {
    // The exact source bug: `"[31]".includes(3)`. Seeded ids are whatever the
    // sequence gives, so the substring relationship is constructed rather than
    // hoped for — the league is owned by an id that *contains* the attacker's
    // as text, and the check must still refuse.
    const attacker = fixture.stranger;
    await db.league.update({
      where: { id: fixture.league.id },
      data: { owner: JSON.stringify([Number(`${attacker.id}9`)]) },
    });
    signInAs(attacker);

    const result = await addPick({
      draftId: fixture.seatA.id,
      movieId: fixture.films[0]?.id as number,
    });

    expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(await picksOf(fixture.seatA.id)).toEqual([]);
  });

  it('rejects a film that does not exist', async () => {
    signInAs(fixture.owner);

    const result = await addPick({ draftId: fixture.seatA.id, movieId: 999_999_999 });

    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(await picksOf(fixture.seatA.id)).toEqual([]);
  });

  it('rejects input that is not a pick at all', async () => {
    signInAs(fixture.owner);

    const result = await addPick({ draftId: 0, movieId: -1 });

    expect(result).toMatchObject({ ok: false, code: 'INVALID' });
  });
});

describe('addPick', () => {
  it('adds the film and numbers the round from the seat', async () => {
    signInAs(fixture.owner);
    const [first, second] = fixture.films;

    await addPick({ draftId: fixture.seatA.id, movieId: first?.id as number });
    await addPick({ draftId: fixture.seatA.id, movieId: second?.id as number });

    expect(await picksOf(fixture.seatA.id)).toEqual([
      { id: expect.any(Number), movieId: first?.id, order: 1 },
      { id: expect.any(Number), movieId: second?.id, order: 2 },
    ]);
  });

  it('carries the seat’s member on the pick, not the acting owner', async () => {
    signInAs(fixture.owner);

    await addPick({ draftId: fixture.seatA.id, movieId: fixture.films[0]?.id as number });

    const pick = await db.draftPick.findFirst({ where: { draftId: fixture.seatA.id } });
    expect(pick?.userId).toBe(fixture.member.id);
  });

  it('leaves a dummy seat’s pick unattributed', async () => {
    signInAs(fixture.owner);

    await addPick({
      draftId: fixture.otherGroup.id,
      movieId: fixture.films[0]?.id as number,
    });

    const pick = await db.draftPick.findFirst({
      where: { draftId: fixture.otherGroup.id },
    });
    expect(pick?.userId).toBeNull();
  });

  it('🔴 refuses a film already taken in the same group', async () => {
    signInAs(fixture.owner);
    const film = fixture.films[0]?.id as number;
    await addPick({ draftId: fixture.seatA.id, movieId: film });

    const result = await addPick({ draftId: fixture.seatB.id, movieId: film });

    expect(result).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(await picksOf(fixture.seatB.id)).toEqual([]);
  });

  it('🔴 allows the same film in a different group of the same league', async () => {
    // Measured, not assumed: across all 1025 production picks no film repeats
    // within a group, while 25 films in league 1's 2017 season were each taken
    // five times across its groups. Each group is its own draft.
    signInAs(fixture.owner);
    const film = fixture.films[0]?.id as number;
    await addPick({ draftId: fixture.seatA.id, movieId: film });

    const result = await addPick({ draftId: fixture.otherGroup.id, movieId: film });

    expect(result).toMatchObject({ ok: true });
    expect(await picksOf(fixture.otherGroup.id)).toHaveLength(1);
  });

  it('revalidates the league page so the board reflects the pick', async () => {
    signInAs(fixture.owner);

    await addPick({ draftId: fixture.seatA.id, movieId: fixture.films[0]?.id as number });

    // 'layout' rather than the default: the console lives at
    // /leagues/:id/draft, and revalidating only the board would leave the
    // owner's own page showing the pick they just made as still available.
    expect(revalidatePath).toHaveBeenCalledWith(
      `/leagues/${fixture.league.id}`,
      'layout',
    );
  });
});

describe('removePick', () => {
  async function threePicks() {
    signInAs(fixture.owner);
    for (const film of fixture.films.slice(0, 3)) {
      await addPick({ draftId: fixture.seatA.id, movieId: film.id });
    }
    return picksOf(fixture.seatA.id);
  }

  it('🔴 refuses a non-owner and leaves the pick in place', async () => {
    const [pick] = await threePicks();
    signInAs(fixture.member);

    const result = await removePick(pick?.id as number);

    expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(await picksOf(fixture.seatA.id)).toHaveLength(3);
  });

  it('🔴 refuses a signed-out caller', async () => {
    const [pick] = await threePicks();
    signInAs(null);

    const result = await removePick(pick?.id as number);

    expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(await picksOf(fixture.seatA.id)).toHaveLength(3);
  });

  it('removes the pick and closes the gap it left', async () => {
    const before = await threePicks();
    signInAs(fixture.owner);

    const result = await removePick(before[0]?.id as number);

    expect(result).toMatchObject({ ok: true });
    // Rounds stay 1..N. A hole at round 1 would render as an empty cell
    // mid-roster, indistinguishable from a seat that is simply shorter.
    expect(await picksOf(fixture.seatA.id)).toEqual([
      { id: before[1]?.id, movieId: before[1]?.movieId, order: 1 },
      { id: before[2]?.id, movieId: before[2]?.movieId, order: 2 },
    ]);
  });

  it('reports a pick that is already gone', async () => {
    signInAs(fixture.owner);

    expect(await removePick(999_999_999)).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });
});

describe('reorderPicks', () => {
  async function threePicks() {
    signInAs(fixture.owner);
    for (const film of fixture.films.slice(0, 3)) {
      await addPick({ draftId: fixture.seatA.id, movieId: film.id });
    }
    return picksOf(fixture.seatA.id);
  }

  it('🔴 refuses a non-owner and leaves the ordering untouched', async () => {
    const before = await threePicks();
    signInAs(fixture.stranger);

    const result = await reorderPicks({
      draftId: fixture.seatA.id,
      pickIds: [...before].reverse().map((pick) => pick.id),
    });

    expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(await picksOf(fixture.seatA.id)).toEqual(before);
  });

  it('🔴 refuses a signed-out caller', async () => {
    const before = await threePicks();
    signInAs(null);

    const result = await reorderPicks({
      draftId: fixture.seatA.id,
      pickIds: [...before].reverse().map((pick) => pick.id),
    });

    expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(await picksOf(fixture.seatA.id)).toEqual(before);
  });

  it('renumbers the seat 1..N in the order given', async () => {
    const before = await threePicks();
    signInAs(fixture.owner);
    const reversed = [...before].reverse();

    const result = await reorderPicks({
      draftId: fixture.seatA.id,
      pickIds: reversed.map((pick) => pick.id),
    });

    expect(result).toMatchObject({ ok: true });
    expect(await picksOf(fixture.seatA.id)).toEqual([
      { id: reversed[0]?.id, movieId: reversed[0]?.movieId, order: 1 },
      { id: reversed[1]?.id, movieId: reversed[1]?.movieId, order: 2 },
      { id: reversed[2]?.id, movieId: reversed[2]?.movieId, order: 3 },
    ]);
  });

  it('🔴 refuses a partial ordering rather than half-applying it', async () => {
    // The state this prevents: some picks renumbered, the rest left where they
    // were, two films sharing a round and the board unable to say which is
    // which.
    const before = await threePicks();
    signInAs(fixture.owner);

    const result = await reorderPicks({
      draftId: fixture.seatA.id,
      pickIds: [before[2]?.id as number, before[0]?.id as number],
    });

    expect(result).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(await picksOf(fixture.seatA.id)).toEqual(before);
  });

  it('🔴 refuses a list naming another seat’s pick', async () => {
    const before = await threePicks();
    signInAs(fixture.owner);
    await addPick({ draftId: fixture.seatB.id, movieId: fixture.films[3]?.id as number });
    const [foreign] = await picksOf(fixture.seatB.id);

    const result = await reorderPicks({
      draftId: fixture.seatA.id,
      pickIds: [before[0]?.id as number, before[1]?.id as number, foreign?.id as number],
    });

    expect(result).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(await picksOf(fixture.seatA.id)).toEqual(before);
    expect(await picksOf(fixture.seatB.id)).toEqual([foreign]);
  });

  it('refuses a list that repeats a pick', async () => {
    const before = await threePicks();
    signInAs(fixture.owner);

    const result = await reorderPicks({
      draftId: fixture.seatA.id,
      pickIds: [
        before[0]?.id as number,
        before[0]?.id as number,
        before[1]?.id as number,
      ],
    });

    expect(result).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(await picksOf(fixture.seatA.id)).toEqual(before);
  });
});

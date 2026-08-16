// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ currentUser }));

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath }));

import { db } from '@/lib/db';
import { leagueRepository } from '@/lib/repositories/leagues';
import { createLeague } from './create-league';
import { joinLeague } from './join-league';

/**
 * Creating and joining leagues.
 *
 * 🔴 Two properties carry the weight here, and both fail silently if wrong:
 * the owner column round-trips (a bad write locks the creator out of their own
 * league, D47), and joining is idempotent (a second seat means drafting and
 * scoring twice).
 */
const TAG = 'league-actions';
const DOMAIN = '@example.test';

/**
 * 🔴 Make sure a season exists, without disturbing one that already does.
 *
 * `createLeague` and `joinLeague` seat people for the *active* season, which
 * `getActiveYear()` reads from `available_years` (D22). Locally that table is
 * full of restored data; **on CI the schema is migrated and empty**, so
 * `getActiveYear` threw "no seasons exist" and every test here failed.
 *
 * Seeding is the honest fix rather than excluding the suite — these are the
 * refusal tests for creating and joining, and they belong on every push.
 *
 * But it cannot simply insert an active row: a **partial unique index**
 * (`available_years_one_active`) allows only one, and locally 2026 already
 * holds it. So this seeds only when the table has no active season, and
 * removes only what it added. Found by the insert failing against the real
 * constraint, which is the index doing precisely its job.
 */
const SEASON = 2992;

/** True when this run created the season, so cleanup knows whether to remove it. */
let seededSeason = false;

async function ensureSeason(now: Date): Promise<void> {
  const active = await db.availableYear.findFirst({ where: { isActive: true } });
  if (active) return;

  await db.availableYear.upsert({
    where: { year: SEASON },
    update: { isActive: true },
    create: { year: SEASON, isActive: true, createdAt: now, updatedAt: now },
  });
  seededSeason = true;
}

type Fixture = Awaited<ReturnType<typeof seed>>;

async function seed() {
  const now = new Date();

  await ensureSeason(now);
  const [creator, joiner] = await Promise.all(
    ['creator', 'joiner'].map((role) =>
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
  return { creator, joiner };
}

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

async function cleanup() {
  const leagues = await db.league.findMany({
    where: { name: { startsWith: TAG } },
    select: { id: true },
  });
  const ids = leagues.map((league) => league.id);
  await db.draft.deleteMany({ where: { leagueId: { in: ids } } });
  await db.league.deleteMany({ where: { id: { in: ids } } });
  await db.user.deleteMany({ where: { email: { contains: `${TAG}-` } } });
  if (seededSeason) {
    await db.availableYear.deleteMany({ where: { year: SEASON } });
    seededSeason = false;
  }
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

describe('createLeague', () => {
  it('🔴 refuses a logged-out caller and writes nothing', async () => {
    signInAs(null);

    const result = await createLeague({ name: `${TAG} nope`, type: 'snake' });

    expect(result.ok).toBe(false);
    expect(await db.league.findMany({ where: { name: `${TAG} nope` } })).toEqual([]);
  });

  it('rejects an empty name', async () => {
    signInAs(fixture.creator);

    expect(await createLeague({ name: '   ', type: 'snake' })).toMatchObject({
      ok: false,
      code: 'INVALID',
    });
  });

  it('🔴 writes an owner column that parses back to the creator (D47)', async () => {
    // `leagues.owner` is TEXT holding a JSON array. A write in any other shape
    // parses to an empty list, and the creator is locked out of their own
    // league — the exact failure D47 exists to prevent, arrived at from the
    // other direction.
    signInAs(fixture.creator);

    const result = await createLeague({ name: `${TAG} owners`, type: 'snake' });
    const leagueId = (result as { data: { leagueId: number } }).data.leagueId;

    const league = await leagueRepository.findById(leagueId);
    expect(league.ownerIds).toEqual([fixture.creator.id]);

    // And the raw column really is JSON, not a coincidence of parsing.
    const raw = await db.league.findUnique({
      where: { id: leagueId },
      select: { owner: true },
    });
    expect(JSON.parse(raw?.owner as string)).toEqual([fixture.creator.id]);
  });

  it('🔴 seats the creator, or the league is half-created', async () => {
    // Membership is the existence of a drafts row. Without a seat the creator
    // does not appear on their own board or in their own league list.
    signInAs(fixture.creator);

    const result = await createLeague({ name: `${TAG} seated`, type: 'snake' });
    const leagueId = (result as { data: { leagueId: number } }).data.leagueId;

    const seats = await db.draft.findMany({ where: { leagueId } });
    expect(seats).toHaveLength(1);
    expect(seats[0]?.userId).toBe(fixture.creator.id);
  });

  it('🔴 generates an invite uuid, which has no database default', async () => {
    // The source got one from Sequelize's defaultValue: UUIDV4 — ORM
    // behaviour the schema never carried. Without it the league would have no
    // shareable link at all.
    signInAs(fixture.creator);

    const result = await createLeague({ name: `${TAG} invite`, type: 'snake' });
    const leagueId = (result as { data: { leagueId: number } }).data.leagueId;

    const league = await leagueRepository.findById(leagueId);
    expect(league.uuid).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('starts pending, because order and groups are not set yet', async () => {
    signInAs(fixture.creator);
    const result = await createLeague({ name: `${TAG} pending`, type: 'snake' });
    const leagueId = (result as { data: { leagueId: number } }).data.leagueId;

    expect((await leagueRepository.findById(leagueId)).draftingStatus).toBe('pending');
  });

  it('keeps the draft type the creator chose', async () => {
    signInAs(fixture.creator);
    const result = await createLeague({ name: `${TAG} linear`, type: 'linear' });
    const leagueId = (result as { data: { leagueId: number } }).data.leagueId;

    expect((await leagueRepository.findById(leagueId)).type).toBe('linear');
  });
});

describe('joinLeague', () => {
  async function makeLeague() {
    signInAs(fixture.creator);
    const result = await createLeague({ name: `${TAG} joinable`, type: 'snake' });
    const leagueId = (result as { data: { leagueId: number } }).data.leagueId;
    const league = await leagueRepository.findById(leagueId);
    return { leagueId, uuid: league.uuid as string };
  }

  it('🔴 refuses a logged-out caller', async () => {
    const { leagueId, uuid } = await makeLeague();
    signInAs(null);

    const result = await joinLeague(uuid);

    expect(result.ok).toBe(false);
    expect(await db.draft.findMany({ where: { leagueId } })).toHaveLength(1);
  });

  it('seats someone who follows the link', async () => {
    const { leagueId, uuid } = await makeLeague();
    signInAs(fixture.joiner);

    const result = await joinLeague(uuid);

    expect(result).toMatchObject({ ok: true, data: { alreadyMember: false } });
    const seats = await db.draft.findMany({ where: { leagueId } });
    expect(seats.map((seat) => seat.userId).sort()).toEqual(
      [fixture.creator.id, fixture.joiner.id].sort(),
    );
  });

  it('🔴 joining twice does not create a second seat', async () => {
    // Two seats means appearing twice on the board, drafting twice and
    // scoring twice.
    const { leagueId, uuid } = await makeLeague();
    signInAs(fixture.joiner);
    await joinLeague(uuid);

    const second = await joinLeague(uuid);

    expect(second).toMatchObject({ ok: true, data: { alreadyMember: true } });
    expect(await db.draft.findMany({ where: { leagueId } })).toHaveLength(2);
  });

  it('🔴 the creator following their own link stays at one seat', async () => {
    const { leagueId, uuid } = await makeLeague();
    signInAs(fixture.creator);

    const result = await joinLeague(uuid);

    expect(result).toMatchObject({ ok: true, data: { alreadyMember: true } });
    expect(await db.draft.findMany({ where: { leagueId } })).toHaveLength(1);
  });

  it('404s an unknown invite rather than erroring', async () => {
    signInAs(fixture.joiner);

    expect(await joinLeague(randomUUID())).toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
    });
  });

  it('404s a malformed invite without touching the database', async () => {
    signInAs(fixture.joiner);

    expect(await joinLeague('not-a-uuid')).toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
    });
  });
});

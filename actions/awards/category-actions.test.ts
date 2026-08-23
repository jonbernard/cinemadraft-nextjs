// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ currentUser }));

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath }));

import { db } from '@/lib/db';
import { createCategory } from './create-category';
import { deleteCategory } from './delete-category';

/**
 * 🔴 T27. `POST /awards` was `Awards.create(req.body)` — mass assignment,
 * `points` included straight from the client — and `DELETE /awards/:id`
 * scoped on id alone, leaving any nominations pointing at nothing. Both bugs
 * get their own refusal here, proven by database state, not just a response
 * shape.
 */
const TAG = 'category-actions';
const DOMAIN = '@example.test';
const YEAR = 2996;

async function makeUser(role: 'admin' | 'user') {
  return db.user.create({
    data: {
      uuid: randomUUID(),
      email: `${TAG}-${role}-${randomUUID().slice(0, 8)}${DOMAIN}`,
      clerkId: `user_${TAG}_${role}_${randomUUID().slice(0, 8)}`,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    select: { id: true, email: true, clerkId: true },
  });
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

async function makeEvent() {
  const now = new Date();
  return db.event.create({
    data: {
      name: `${TAG} show`,
      abbreviation: `${TAG}-${randomUUID().slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true, abbreviation: true },
  });
}

/** A real tier — Best Picture is worth this, never the tier's own id. */
async function makeTier(points = 20) {
  const now = new Date();
  return db.point.create({
    data: { points, level: `${TAG}-level`, tier: 1, createdAt: now, updatedAt: now },
    select: { id: true, points: true },
  });
}

async function makeAward(eventId: number, pointsId: number | null) {
  const now = new Date();
  return db.award.create({
    data: {
      name: `${TAG} category`,
      eventId,
      points: pointsId,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true, name: true },
  });
}

async function makeMovie() {
  const now = new Date();
  return db.movie.create({
    data: {
      title: `${TAG} film ${randomUUID().slice(0, 8)}`,
      sortTitle: `${TAG} film`,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });
}

async function cleanup() {
  const events = await db.event.findMany({
    where: { abbreviation: { startsWith: TAG } },
    select: { id: true },
  });
  const awards = await db.award.findMany({
    where: {
      OR: [{ name: { startsWith: TAG } }, { eventId: { in: events.map((e) => e.id) } }],
    },
    select: { id: true },
  });
  const awardIds = awards.map((a) => BigInt(a.id));

  // By year as well as by award id: this suite's own subject is an action
  // that can delete an award out from under a nomination, so a bug under
  // test can leave a nomination with no surviving award to find it by.
  await db.nomination.deleteMany({
    where: { OR: [{ awardId: { in: awardIds } }, { year: YEAR }] },
  });
  await db.winner.deleteMany({
    where: { OR: [{ awardId: { in: awardIds } }, { year: YEAR }] },
  });
  await db.award.deleteMany({ where: { id: { in: awards.map((a) => a.id) } } });
  await db.event.deleteMany({ where: { id: { in: events.map((e) => e.id) } } });
  await db.point.deleteMany({ where: { level: { startsWith: TAG } } });
  await db.movie.deleteMany({ where: { title: { startsWith: `${TAG} ` } } });
  await db.user.deleteMany({ where: { email: { contains: `${TAG}-` } } });
}

beforeEach(async () => {
  currentUser.mockReset();
  revalidatePath.mockClear();
  await cleanup();
});
afterEach(cleanup);
afterAll(async () => {
  await db.$disconnect();
});

describe('createCategory — refusals', () => {
  it('🔴 refuses a signed-out caller and creates nothing', async () => {
    const event = await makeEvent();
    signInAs(null);

    const result = await createCategory({
      eventId: event.id,
      name: 'New category',
      pointsId: null,
      active: true,
      requiresNomineeName: false,
    });

    expect(result.ok).toBe(false);
    expect(await db.award.count({ where: { eventId: event.id } })).toBe(0);
  });

  it('🔴 refuses a signed-in non-admin', async () => {
    const event = await makeEvent();
    const member = await makeUser('user');
    signInAs(member);

    const result = await createCategory({
      eventId: event.id,
      name: 'New category',
      pointsId: null,
      active: true,
      requiresNomineeName: false,
    });

    expect(result.ok).toBe(false);
    expect(await db.award.count({ where: { eventId: event.id } })).toBe(0);
  });

  it('rejects a tier id that does not exist, rather than storing a dangling one', async () => {
    // 🔴 The whole point of D41: a tier id that does not resolve would sit in
    // `awards.points` looking exactly like a real one, and the category would
    // silently score zero until someone noticed.
    const event = await makeEvent();
    const admin = await makeUser('admin');
    signInAs(admin);

    const result = await createCategory({
      eventId: event.id,
      name: 'New category',
      pointsId: 999_999_999,
      active: true,
      requiresNomineeName: false,
    });

    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(await db.award.count({ where: { eventId: event.id } })).toBe(0);
  });
});

describe('createCategory', () => {
  it('🔴 stores the tier id, never the point value it resolves to', async () => {
    const event = await makeEvent();
    const tier = await makeTier(20);
    const admin = await makeUser('admin');
    signInAs(admin);

    const result = await createCategory({
      eventId: event.id,
      name: 'Best Picture',
      pointsId: tier.id,
      active: true,
      requiresNomineeName: false,
    });

    expect(result.ok).toBe(true);
    const row = await db.award.findFirst({ where: { eventId: event.id } });
    // The column is named `points` and must hold `tier.id`, not `tier.points`
    // — storing the value instead is the exact corruption D41 exists to name.
    expect(row?.points).toBe(tier.id);
    expect(row?.points).not.toBe(tier.points);
  });

  it('allows no tier at all — a brand-new category scores nothing until one is set', async () => {
    const event = await makeEvent();
    const admin = await makeUser('admin');
    signInAs(admin);

    const result = await createCategory({
      eventId: event.id,
      name: 'Untiered category',
      pointsId: null,
      active: true,
      requiresNomineeName: false,
    });

    expect(result.ok).toBe(true);
    const row = await db.award.findFirst({ where: { eventId: event.id } });
    expect(row?.points).toBeNull();
  });
});

describe('deleteCategory — refusals', () => {
  it('🔴 refuses a signed-out caller', async () => {
    const event = await makeEvent();
    const award = await makeAward(event.id, null);
    signInAs(null);

    const result = await deleteCategory(award.id);

    expect(result.ok).toBe(false);
    expect(await db.award.findUnique({ where: { id: award.id } })).not.toBeNull();
  });

  it('🔴 refuses a signed-in non-admin', async () => {
    const event = await makeEvent();
    const award = await makeAward(event.id, null);
    const member = await makeUser('user');
    signInAs(member);

    const result = await deleteCategory(award.id);

    expect(result.ok).toBe(false);
    expect(await db.award.findUnique({ where: { id: award.id } })).not.toBeNull();
  });

  it('🔴 refuses to delete a category with nominations, naming the count', async () => {
    // Fixture adequacy: this category has nominations, the sibling test below
    // has one with none — without both, "refuses correctly" is
    // indistinguishable from "refuses always".
    const event = await makeEvent();
    const award = await makeAward(event.id, null);
    const movie = await makeMovie();
    await db.nomination.create({
      data: {
        movieId: movie.id,
        awardId: award.id,
        year: YEAR,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const admin = await makeUser('admin');
    signInAs(admin);

    const result = await deleteCategory(award.id);

    expect(result).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(result.ok === false && result.message).toMatch(/1/);
    expect(await db.award.findUnique({ where: { id: award.id } })).not.toBeNull();
  });

  it('🔴 refuses to delete a category with a winner but no nomination', async () => {
    // F7: `Winner.awardId` is its own unenforced reference, and a win pays
    // the category's points a second time (D41) — the same class of silent
    // score rewrite an orphaned nomination is. This is unreachable through
    // the app's own paths (removing a winning nominee clears the winner too),
    // but the predicate should catch it anyway.
    const event = await makeEvent();
    const award = await makeAward(event.id, null);
    const movie = await makeMovie();
    await db.winner.create({
      data: {
        movieId: movie.id,
        awardId: award.id,
        nominationId: 999_999_999,
        year: YEAR,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const admin = await makeUser('admin');
    signInAs(admin);

    const result = await deleteCategory(award.id);

    expect(result).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(await db.award.findUnique({ where: { id: award.id } })).not.toBeNull();
  });
});

describe('deleteCategory', () => {
  it('removes a category with no nominations', async () => {
    const event = await makeEvent();
    const award = await makeAward(event.id, null);
    const admin = await makeUser('admin');
    signInAs(admin);

    const result = await deleteCategory(award.id);

    expect(result.ok).toBe(true);
    expect(await db.award.findUnique({ where: { id: award.id } })).toBeNull();
  });
});

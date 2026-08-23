// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ currentUser }));

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath }));

import { db } from '@/lib/db';
import { setActiveYear } from './set-active-year';

/**
 * 🔴 `lib/services/season.test.ts` also exercises this gate, but it is one of
 * the suites `vitest.ci.config.mts` excludes — it reads the restored active
 * season to prove `getActiveYear` follows the flag. That means its refusal
 * test for `setActiveYear` never runs on a push. This file seeds its own
 * users and its own season row so the admin gate on the one action in the
 * app that can change every page's default year is covered on every push.
 */
const TAG = 'set-active-year';
const DOMAIN = '@example.test';

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

/**
 * One inactive season of our own — never a second *active* row. The
 * database permits exactly one active row across the whole table
 * (`available_years_one_active`), so a fixture cannot create a competing
 * active one without racing whichever row the rest of the suite has flagged.
 * A refusal is proven by this row staying inactive, not by an active row
 * elsewhere staying put.
 */
async function makeSeason() {
  const now = new Date();
  return db.availableYear.create({
    data: {
      year: 8_000 + Math.floor(Math.random() * 1900),
      isActive: false,
      createdAt: now,
    },
    select: { id: true, year: true },
  });
}

async function cleanup() {
  await db.availableYear.deleteMany({ where: { year: { gte: 8_000 } } });
  await db.user.deleteMany({ where: { email: { contains: `${TAG}-` } } });
}

/**
 * `setActive` clears every other active row in the same transaction it sets
 * one (`available_years_one_active` allows exactly one) — an admin call in
 * this suite really does flip the restored table's active flag off 2026, the
 * same global singleton `lib/services/season.test.ts` restores in its own
 * `afterEach`. Every other test here is refused before it reaches the
 * repository, so this only has anything to undo after the one that succeeds.
 */
async function restoreProductionSeason() {
  await db.availableYear.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });
  await db.availableYear.updateMany({ where: { year: 2026 }, data: { isActive: true } });
}

beforeEach(async () => {
  currentUser.mockReset();
  revalidatePath.mockClear();
  await cleanup();
});
afterEach(async () => {
  await cleanup();
  await restoreProductionSeason();
});
afterAll(async () => {
  await db.$disconnect();
});

describe('setActiveYear — refusals', () => {
  it('🔴 refuses a signed-out caller and leaves the season inactive', async () => {
    const season = await makeSeason();
    signInAs(null);

    const result = await setActiveYear(season.year as number);

    expect(result.ok).toBe(false);
    const row = await db.availableYear.findUnique({ where: { id: season.id } });
    expect(row?.isActive).toBe(false);
  });

  it('🔴 refuses a signed-in non-admin and leaves the season inactive', async () => {
    const season = await makeSeason();
    const member = await makeUser('user');
    signInAs(member);

    const result = await setActiveYear(season.year as number);

    expect(result.ok).toBe(false);
    const row = await db.availableYear.findUnique({ where: { id: season.id } });
    expect(row?.isActive).toBe(false);
  });

  it('rejects input that is not a season', async () => {
    const admin = await makeUser('admin');
    signInAs(admin);

    expect(await setActiveYear(-1)).toMatchObject({ ok: false, code: 'INVALID' });
  });
});

describe('setActiveYear', () => {
  it('activates the season for an admin', async () => {
    const season = await makeSeason();
    const admin = await makeUser('admin');
    signInAs(admin);

    const result = await setActiveYear(season.year as number);

    expect(result).toMatchObject({ ok: true, data: { year: season.year } });
    const row = await db.availableYear.findUnique({ where: { id: season.id } });
    expect(row?.isActive).toBe(true);
  });
});

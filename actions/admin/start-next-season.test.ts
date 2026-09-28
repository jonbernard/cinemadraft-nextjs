// @vitest-environment node

import { randomUUID } from 'node:crypto';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ currentUser }));

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath }));

import { db } from '@/lib/db';
import { startNextSeason } from './start-next-season';

/**
 * 🔴 CI-runnable: it reads whatever season is active (CI's seed has one, 2026;
 * the restored copy has ten) instead of assuming one, and starts the year
 * after that. It remembers which of the next two years already had rows, and
 * afterwards deletes only the ones it created and puts the flag back where it
 * found it — `lib/db.test.ts` counts `available_years` exactly.
 */
const TAG = 'start-next-season';
const DOMAIN = '@example.test';

let original: number;
let preexisting: Set<number>;

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
  currentUser.mockResolvedValue(
    user && {
      id: user.clerkId,
      emailAddresses: [
        { emailAddress: user.email, verification: { status: 'verified' } },
      ],
      firstName: null,
      lastName: null,
      imageUrl: null,
    },
  );
}

const rowFor = (year: number) => db.availableYear.findUnique({ where: { year } });
const activeYears = async () =>
  (await db.availableYear.findMany({ where: { isActive: true } })).map((row) => row.year);

beforeAll(async () => {
  const active = await db.availableYear.findFirst({ where: { isActive: true } });
  if (active?.year == null) throw new Error('no active season; run scripts/seed-e2e.mjs');
  original = active.year;
  const rows = await db.availableYear.findMany({
    where: { year: { in: [original + 1, original + 2] } },
  });
  preexisting = new Set(rows.flatMap((row) => (row.year == null ? [] : [row.year])));
});

beforeEach(() => {
  currentUser.mockReset();
  revalidatePath.mockClear();
});

afterEach(async () => {
  await db.availableYear.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });
  await db.availableYear.updateMany({
    where: { year: original },
    data: { isActive: true },
  });
  const created = [original + 1, original + 2].filter((year) => !preexisting.has(year));
  await db.availableYear.deleteMany({ where: { year: { in: created } } });
  await db.user.deleteMany({ where: { email: { contains: `${TAG}-` } } });
});

afterAll(async () => {
  await db.$disconnect();
});

describe('startNextSeason', () => {
  it('creates the next season and makes it the only active one', async () => {
    signInAs(await makeUser('admin'));

    const result = await startNextSeason(original + 1);

    expect(result).toMatchObject({
      ok: true,
      data: { started: true, season: { year: original + 1, isActive: true } },
    });
    // The one-active invariant: the new year, and nothing else.
    expect(await activeYears()).toEqual([original + 1]);
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('a second press of the same button is a no-op, not the year after', async () => {
    signInAs(await makeUser('admin'));

    await startNextSeason(original + 1);
    revalidatePath.mockClear();
    const again = await startNextSeason(original + 1);

    expect(again).toMatchObject({
      ok: true,
      data: { started: false, season: { year: original + 1 } },
    });
    expect(await rowFor(original + 2)).toBeNull();
    expect(await activeYears()).toEqual([original + 1]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('refuses any year but the one after the active season', async () => {
    signInAs(await makeUser('admin'));

    const result = await startNextSeason(original + 2);

    expect(result).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(await rowFor(original + 2)).toBeNull();
    expect(await activeYears()).toEqual([original]);
  });

  it('refuses a signed-in non-admin and writes nothing', async () => {
    signInAs(await makeUser('user'));

    const result = await startNextSeason(original + 1);

    expect(result.ok).toBe(false);
    if (!preexisting.has(original + 1)) expect(await rowFor(original + 1)).toBeNull();
    expect(await activeYears()).toEqual([original]);
  });

  it('refuses a signed-out caller and writes nothing', async () => {
    signInAs(null);

    const result = await startNextSeason(original + 1);

    expect(result.ok).toBe(false);
    expect(await activeYears()).toEqual([original]);
  });
});

// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ currentUser }));

import { db } from '@/lib/db';
import { broadcastNotification } from './broadcast';

/**
 * Admin broadcast (T45).
 *
 * 🔴 This writes one row per user in `notifications` — the restored
 * production table `lib/db.test.ts` counts other rows in, and a successful
 * send here really does touch every real account in the test database, not
 * only the synthetic ones this file creates.
 *
 * Cleanup is a high-water mark on `id`, not a filter on the tagged message: a
 * mutation that breaks the validation this suite exists to catch writes rows
 * whose content is whatever the mutation let through — an empty-message
 * mutation run while developing this suite left 61 rows reading `'   '`
 * behind, invisible to a tag-based `deleteMany` because they never carried
 * the tag. Recording the highest `id` before each test and sweeping
 * everything above it after catches a leak regardless of what it wrote.
 *
 * Three synthetic users (plus the sender) is deliberate: fewer, and "one row"
 * would be indistinguishable from "one row per user".
 */
const TAG = 'broadcast-action';
const DOMAIN = '@example.test';

async function createUser(role: 'admin' | 'user') {
  const now = new Date();
  return db.user.create({
    data: {
      uuid: randomUUID(),
      email: `${TAG}-${role}-${randomUUID().slice(0, 8)}${DOMAIN}`,
      clerkId: `user_${TAG}_${role}_${randomUUID().slice(0, 8)}`,
      role,
      createdAt: now,
      updatedAt: now,
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

async function highWaterMark(): Promise<number> {
  const top = await db.notification.aggregate({ _max: { id: true } });
  return top._max.id ?? 0;
}

async function cleanupUsers() {
  await db.user.deleteMany({ where: { email: { contains: `${TAG}-` } } });
}

let mark = 0;

beforeEach(async () => {
  currentUser.mockReset();
  await cleanupUsers();
  mark = await highWaterMark();
});

afterEach(async () => {
  // Every row this run could have written has an id above `mark`, whatever
  // its content — the leak a content-based filter cannot see.
  await db.notification.deleteMany({ where: { id: { gt: mark } } });
  await cleanupUsers();
});

afterAll(async () => {
  await db.$disconnect();
});

describe('broadcastNotification', () => {
  it('🔴 writes one row per user, in one statement, to every account in the table', async () => {
    const admin = await createUser('admin');
    await createUser('user');
    await createUser('user');
    signInAs(admin);

    const totalUsers = await db.user.count();
    const message = `${TAG} the season starts tonight`;

    const result = await broadcastNotification({ message, icon: null, link: null });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(totalUsers);
    expect(await db.notification.count({ where: { message } })).toBe(totalUsers);
  });

  it('🔴 refuses a signed-in non-admin and writes nothing', async () => {
    const member = await createUser('user');
    signInAs(member);
    const message = `${TAG} an attacker's message`;

    const result = await broadcastNotification({ message, icon: null, link: null });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('FORBIDDEN');
    expect(await db.notification.count({ where: { message } })).toBe(0);
  });

  it('🔴 refuses a signed-out caller and writes nothing', async () => {
    signInAs(null);
    const message = `${TAG} anonymous`;

    const result = await broadcastNotification({ message, icon: null, link: null });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('FORBIDDEN');
    expect(await db.notification.count({ where: { message } })).toBe(0);
  });

  it('rejects an empty message and writes nothing', async () => {
    const admin = await createUser('admin');
    signInAs(admin);

    const before = await db.notification.count();

    const result = await broadcastNotification({
      message: '   ',
      icon: null,
      link: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID');
    expect(await db.notification.count()).toBe(before);
  });

  it('treats icon and link as optional', async () => {
    const admin = await createUser('admin');
    signInAs(admin);
    const message = `${TAG} no icon or link`;

    const result = await broadcastNotification({ message });

    expect(result.ok).toBe(true);
    const row = await db.notification.findFirst({ where: { message } });
    expect(row?.icon).toBeNull();
    expect(row?.link).toBeNull();
  });
});

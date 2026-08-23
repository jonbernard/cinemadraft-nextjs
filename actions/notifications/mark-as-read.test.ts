// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ currentUser }));

import { db } from '@/lib/db';
import { markNotificationsRead } from './mark-as-read';

/**
 * Mark-as-read (T44).
 *
 * 🔴 **Two users, each with an unread notification, is this row's only
 * adequate fixture.** The intruder's notification starts `read: false`
 * deliberately: if it started `read: true`, dropping the `userId` clause in
 * `notificationRepository.markAsRead` would change nothing observable and
 * this suite would pass against the vulnerability it exists to catch (the
 * live trap named in the brief).
 */
const TAG = 'mark-as-read';
const DOMAIN = '@example.test';

type Fixture = Awaited<ReturnType<typeof seed>>;

async function createUser(role: string) {
  const now = new Date();
  return db.user.create({
    data: {
      uuid: randomUUID(),
      email: `${TAG}-${role}-${randomUUID().slice(0, 8)}${DOMAIN}`,
      clerkId: `user_${TAG}_${role}_${randomUUID().slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true, email: true, clerkId: true },
  });
}

async function addNotification(userId: number, message: string, read: boolean) {
  const now = new Date();
  const row = await db.notification.create({
    data: { userId: BigInt(userId), message, read, createdAt: now, updatedAt: now },
    select: { id: true },
  });
  return row.id;
}

async function seed() {
  const owner = await createUser('owner');
  const intruder = await createUser('intruder');

  const ownerUnread = await addNotification(owner.id, `${TAG} owner unread`, false);
  const ownerRead = await addNotification(owner.id, `${TAG} owner already read`, true);
  // Starts unread — the fixture requirement above.
  const intruderUnread = await addNotification(
    intruder.id,
    `${TAG} intruder unread`,
    false,
  );

  return { owner, intruder, ownerUnread, ownerRead, intruderUnread };
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

async function readFlagOf(id: number) {
  const row = await db.notification.findUnique({ where: { id }, select: { read: true } });
  return row?.read ?? null;
}

async function cleanup() {
  const users = await db.user.findMany({
    where: { email: { contains: `${TAG}-` } },
    select: { id: true },
  });
  await db.notification.deleteMany({
    where: { userId: { in: users.map((user) => BigInt(user.id)) } },
  });
  await db.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
}

let fixture: Fixture;

beforeEach(async () => {
  currentUser.mockReset();
  await cleanup();
  fixture = await seed();
});

afterEach(cleanup);

afterAll(async () => {
  await db.$disconnect();
});

describe('markNotificationsRead', () => {
  it('🔴 marks the caller’s own notification read and leaves the intruder’s unread', async () => {
    signInAs(fixture.owner);

    const result = await markNotificationsRead([
      fixture.ownerUnread,
      fixture.intruderUnread,
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(1);
    expect(await readFlagOf(fixture.ownerUnread)).toBe(true);
    expect(await readFlagOf(fixture.intruderUnread)).toBe(false);
  });

  it('still matches an already-read notification — the count is rows matched, not rows changed', async () => {
    signInAs(fixture.owner);

    const result = await markNotificationsRead([fixture.ownerRead]);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(1);
    expect(await readFlagOf(fixture.ownerRead)).toBe(true);
  });

  it('🔴 refuses a signed-out caller and writes nothing', async () => {
    signInAs(null);

    const result = await markNotificationsRead([fixture.ownerUnread]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('FORBIDDEN');
    expect(await readFlagOf(fixture.ownerUnread)).toBe(false);
  });

  it('rejects a non-array payload', async () => {
    signInAs(fixture.owner);

    // @ts-expect-error — exactly the untyped-at-runtime input the brief warns about
    const result = await markNotificationsRead('not-an-array');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID');
  });

  it('rejects an empty array rather than treating it as "nothing to do"', async () => {
    signInAs(fixture.owner);

    const result = await markNotificationsRead([]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID');
  });

  it('rejects ids that are not positive integers', async () => {
    signInAs(fixture.owner);

    const result = await markNotificationsRead([-1, 1.5]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID');
    expect(await readFlagOf(fixture.ownerUnread)).toBe(false);
  });
});

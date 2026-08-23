// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ currentUser }));

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath }));

import { db } from '@/lib/db';
import { deleteFeedItem } from './delete-feed-item';
import { postFeedItem } from './post-feed-item';

/**
 * Posting to your own feed and removing a post (P10.T41, T42).
 *
 * 🔴 **Two members with a post each, and the posts read differently.** The
 * delete is scoped by `(id, userUuid)`; a lost `userUuid` clause would still
 * remove a row of the right shape, so every assertion below names whose row it
 * expects to survive by its text, not by counting rows.
 *
 * `profile_feeds` has 125 restored rows. Nothing here reads or deletes the table
 * unqualified: seeded rows are keyed to uuids minted for the run, and the one
 * row deliberately seeded with no uuid is tracked by id and removed by id.
 */
const TAG = 'feed-actions';
const DOMAIN = '@example.test';

type Fixture = Awaited<ReturnType<typeof seed>>;

async function createUser(role: string, uuid: string | null) {
  const now = new Date();
  return db.user.create({
    data: {
      uuid,
      email: `${TAG}-${role}-${randomUUID().slice(0, 8)}${DOMAIN}`,
      clerkId: `user_${TAG}_${role}_${randomUUID().slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true, uuid: true, email: true, clerkId: true },
  });
}

async function addRow(userUuid: string | null, message: string) {
  const now = new Date();
  const row = await db.profileFeed.create({
    data: { userUuid, message, components: '[]', createdAt: now, updatedAt: now },
    select: { id: true },
  });
  return row.id;
}

async function seed() {
  const author = await createUser('author', randomUUID());
  const intruder = await createUser('intruder', randomUUID());
  // A restored account that never got a uuid. `userUuid: null` is a real value
  // in this column, so it must not be usable as a key.
  const unclaimed = await createUser('unclaimed', null);

  const authorPost = await addRow(author.uuid, `${TAG} the author wrote this`);
  const intruderPost = await addRow(intruder.uuid, `${TAG} the intruder wrote this`);
  const orphanPost = await addRow(null, `${TAG} this row belongs to nobody`);

  return { author, intruder, unclaimed, authorPost, intruderPost, orphanPost };
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

async function messagesFor(uuid: string | null) {
  const rows = await db.profileFeed.findMany({
    where: { userUuid: uuid },
    select: { message: true },
    orderBy: { id: 'asc' },
  });
  return rows.map((row) => row.message);
}

async function messageOf(id: number) {
  const row = await db.profileFeed.findUnique({
    where: { id },
    select: { message: true },
  });
  return row?.message ?? null;
}

async function cleanup() {
  const users = await db.user.findMany({
    where: { email: { contains: `${TAG}-` } },
    select: { id: true, uuid: true },
  });
  const uuids = users.flatMap((user) => (user.uuid === null ? [] : [user.uuid]));

  await db.profileFeed.deleteMany({ where: { userUuid: { in: uuids } } });
  // Every message this file writes carries the tag, so a row that ends up with
  // no uuid — which is exactly what the guard under test would allow if it were
  // removed — is still reachable for cleanup. `lib/db.test.ts` asserts the
  // restored row count, so a leak fails the suite rather than accumulating.
  await db.profileFeed.deleteMany({ where: { message: { startsWith: `${TAG} ` } } });
  await db.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
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

describe('postFeedItem', () => {
  it('🔴 refuses an anonymous caller and writes nothing', async () => {
    signInAs(null);

    const result = await postFeedItem({
      message: `${TAG} I should not be able to say this.`,
    });

    expect(result.ok).toBe(false);
    expect(await messagesFor(fixture.author.uuid)).toEqual([
      `${TAG} the author wrote this`,
    ]);
  });

  it('refuses an empty message', async () => {
    signInAs(fixture.author);

    const result = await postFeedItem({ message: '   ' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID');
    expect(await messagesFor(fixture.author.uuid)).toEqual([
      `${TAG} the author wrote this`,
    ]);
  });

  it('🔴 posts to the caller’s own feed and to no one else’s', async () => {
    signInAs(fixture.author);

    const result = await postFeedItem({ message: `${TAG} the author posted just now` });

    expect(result.ok).toBe(true);
    expect(await messagesFor(fixture.author.uuid)).toEqual([
      `${TAG} the author wrote this`,
      `${TAG} the author posted just now`,
    ]);
    expect(await messagesFor(fixture.intruder.uuid)).toEqual([
      `${TAG} the intruder wrote this`,
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(`/members/${fixture.author.uuid}`);
  });

  it('🔴 refuses an account with no uuid rather than writing an unreachable row', async () => {
    signInAs(fixture.unclaimed);

    const result = await postFeedItem({ message: `${TAG} nowhere to put this` });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('FORBIDDEN');
    expect(await messagesFor(null)).toEqual([`${TAG} this row belongs to nobody`]);
  });
});

describe('deleteFeedItem', () => {
  it('🔴 will not remove another member’s post', async () => {
    signInAs(fixture.intruder);

    const result = await deleteFeedItem({ id: fixture.authorPost });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NOT_FOUND');
    expect(await messageOf(fixture.authorPost)).toBe(`${TAG} the author wrote this`);
  });

  it('removes the caller’s own post and leaves the other member’s alone', async () => {
    signInAs(fixture.author);

    const result = await deleteFeedItem({ id: fixture.authorPost });

    expect(result.ok).toBe(true);
    expect(await messageOf(fixture.authorPost)).toBeNull();
    expect(await messageOf(fixture.intruderPost)).toBe(`${TAG} the intruder wrote this`);
    expect(revalidatePath).toHaveBeenCalledWith(`/members/${fixture.author.uuid}`);
  });

  it('reports a missing post as not found, not as a refusal', async () => {
    signInAs(fixture.author);

    const result = await deleteFeedItem({ id: 2_147_483_647 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NOT_FOUND');
  });

  it('refuses an id that is not a positive integer', async () => {
    signInAs(fixture.author);

    const result = await deleteFeedItem({ id: -1 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID');
    expect(await messageOf(fixture.authorPost)).toBe(`${TAG} the author wrote this`);
  });

  it('🔴 refuses an account with no uuid rather than matching every row that has none', async () => {
    signInAs(fixture.unclaimed);

    const result = await deleteFeedItem({ id: fixture.orphanPost });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('FORBIDDEN');
    expect(await messageOf(fixture.orphanPost)).toBe(`${TAG} this row belongs to nobody`);
  });

  it('🔴 refuses an anonymous caller', async () => {
    signInAs(null);

    const result = await deleteFeedItem({ id: fixture.authorPost });

    expect(result.ok).toBe(false);
    expect(await messageOf(fixture.authorPost)).toBe(`${TAG} the author wrote this`);
  });
});

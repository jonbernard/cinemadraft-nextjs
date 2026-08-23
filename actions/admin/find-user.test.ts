// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ currentUser }));

import { db } from '@/lib/db';
import { findUserForRelink } from './find-user';

/**
 * The first step of the relink page (T49): looking an account up by email
 * before the admin can decide anything. It returns a member's Clerk identity,
 * so it is gated the same as the write it precedes.
 */
const DOMAIN = '@example.test';

async function makeUser(role: 'admin' | 'user', over: Record<string, unknown> = {}) {
  return db.user.create({
    data: {
      uuid: randomUUID(),
      email: `find-user-${role}-${randomUUID().slice(0, 8)}${DOMAIN}`,
      clerkId: `user_find-user_${role}_${randomUUID().slice(0, 8)}`,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...over,
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

async function cleanup() {
  await db.user.deleteMany({ where: { email: { contains: DOMAIN } } });
}

beforeEach(async () => {
  currentUser.mockReset();
  await cleanup();
});
afterEach(cleanup);
afterAll(async () => {
  await db.$disconnect();
});

describe('findUserForRelink — refusals', () => {
  it('🔴 refuses a signed-out caller', async () => {
    const target = await makeUser('user');
    signInAs(null);

    const result = await findUserForRelink(target.email);
    expect(result.ok).toBe(false);
  });

  it('🔴 refuses a signed-in non-admin', async () => {
    const target = await makeUser('user');
    const other = await makeUser('user');
    signInAs(other);

    const result = await findUserForRelink(target.email);
    expect(result.ok).toBe(false);
  });
});

describe('findUserForRelink', () => {
  it('finds an account by email', async () => {
    const target = await makeUser('user');
    const admin = await makeUser('admin');
    signInAs(admin);

    const result = await findUserForRelink(target.email);

    expect(result).toMatchObject({
      ok: true,
      data: { id: target.id, email: target.email },
    });
  });

  it('reports NOT_FOUND for an address no account uses', async () => {
    const admin = await makeUser('admin');
    signInAs(admin);

    const result = await findUserForRelink(`nobody-${randomUUID()}${DOMAIN}`);
    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });
});

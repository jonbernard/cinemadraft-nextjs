import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ currentUser }));

import { db } from '@/lib/db';
import { relinkUser } from './relink';

/**
 * 🔴 This action can transfer an account between people. The assertion that
 * matters is not that it works — it is that nobody but an admin can reach it.
 */
const DOMAIN = '@example.test';

async function makeUser(over: Record<string, unknown> = {}) {
  return db.user.create({
    data: {
      uuid: randomUUID(),
      email: `relink-${randomUUID().slice(0, 8)}${DOMAIN}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...over,
    },
    select: { id: true, email: true, clerkId: true },
  });
}

/** Signs in as a user with the given role by pointing Clerk at their row. */
async function signInAs(role: 'admin' | 'user') {
  const actor = await makeUser({ clerkId: `user_actor_${role}`, role });
  currentUser.mockResolvedValue({
    id: `user_actor_${role}`,
    emailAddresses: [{ emailAddress: actor.email, verification: { status: 'verified' } }],
    firstName: null,
    lastName: null,
    imageUrl: null,
  });
  return actor;
}

async function cleanup() {
  await db.user.deleteMany({ where: { email: { contains: DOMAIN } } });
}

describe('relinkUser', () => {
  beforeEach(async () => {
    currentUser.mockReset();
    await cleanup();
  });

  afterEach(cleanup);

  it('🔴 refuses a signed-in non-admin', async () => {
    await signInAs('user');
    const victim = await makeUser({ clerkId: 'user_owner' });

    await expect(relinkUser(victim.id, 'user_attacker')).rejects.toThrow('admin only');

    const row = await db.user.findUnique({ where: { id: victim.id } });
    expect(row?.clerkId).toBe('user_owner');
  });

  it('🔴 refuses a signed-out caller', async () => {
    currentUser.mockResolvedValue(null);
    const victim = await makeUser({ clerkId: 'user_owner' });

    await expect(relinkUser(victim.id, 'user_attacker')).rejects.toThrow('not signed in');

    const row = await db.user.findUnique({ where: { id: victim.id } });
    expect(row?.clerkId).toBe('user_owner');
  });

  it('lets an admin repair a mismatched account', async () => {
    await signInAs('admin');
    const stranded = await makeUser();

    const updated = await relinkUser(stranded.id, 'user_their_real_identity');

    expect(updated.clerkId).toBe('user_their_real_identity');
  });

  it('lets an admin detach an identity, so a mistake is recoverable', async () => {
    await signInAs('admin');
    const wrong = await makeUser({ clerkId: 'user_wrongly_linked' });

    const updated = await relinkUser(wrong.id, null);

    expect(updated.clerkId).toBeNull();
  });

  it('logs who did it — an account changing hands must be accountable', async () => {
    const logged = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const admin = await signInAs('admin');
    const target = await makeUser();

    await relinkUser(target.id, 'user_new');

    expect(logged).toHaveBeenCalledWith(
      '[auth] admin relink',
      expect.objectContaining({ by: admin.id, userId: target.id, to: 'user_new' }),
    );
    logged.mockRestore();
  });
});

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ currentUser }));

import { db } from '@/lib/db';
import { AccountLinkError, getCurrentUser, requireAdmin, requireUser } from './auth';

/**
 * Only Clerk itself is mocked. The sync underneath runs for real against the
 * local database, because the guarantees being checked here — that an
 * unverified address resolves to nothing, that a collision does not return
 * somebody else's account — are enforced by that code and its unique index,
 * not by this layer.
 */
const DOMAIN = '@example.test';

/** Shapes a Clerk user the way `currentUser()` returns one. */
function clerkUser(over: Record<string, unknown> = {}) {
  return {
    id: 'user_session',
    emailAddresses: [
      { emailAddress: `session${DOMAIN}`, verification: { status: 'verified' } },
    ],
    firstName: 'Grace',
    lastName: 'Hopper',
    imageUrl: null,
    ...over,
  };
}

async function cleanup() {
  await db.user.deleteMany({ where: { email: { contains: DOMAIN } } });
}

describe('getCurrentUser', () => {
  beforeEach(async () => {
    currentUser.mockReset();
    await cleanup();
  });

  afterEach(cleanup);

  it('returns null when signed out', async () => {
    currentUser.mockResolvedValue(null);
    expect(await getCurrentUser()).toBeNull();
  });

  it('returns the linked account without writing anything', async () => {
    await db.user.create({
      data: {
        uuid: randomUUID(),
        email: `session${DOMAIN}`,
        clerkId: 'user_session',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    currentUser.mockResolvedValue(clerkUser());
    const before = await db.user.count();

    const user = await getCurrentUser();

    expect(user?.clerkId).toBe('user_session');
    expect(await db.user.count()).toBe(before);
  });

  it('syncs lazily when the webhook has not landed', async () => {
    // The race this exists for: sign-in completes and the member reaches a
    // page before Clerk's webhook arrives. Without this they would be treated
    // as brand new.
    currentUser.mockResolvedValue(clerkUser({ id: 'user_lazy' }));

    const user = await getCurrentUser();

    expect(user?.clerkId).toBe('user_lazy');
    expect(user?.provider).toBe('clerk');
  });

  it('claims a legacy account on the lazy path too', async () => {
    const legacy = await db.user.create({
      data: {
        uuid: randomUUID(),
        email: `Session${DOMAIN}`, // mixed case, as one production row is
        provider: 'auth0',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      select: { id: true },
    });
    currentUser.mockResolvedValue(clerkUser({ id: 'user_claims_lazily' }));

    const user = await getCurrentUser();

    expect(user?.id).toBe(legacy.id);
  });

  it('🔴 treats an unverified Clerk address as no account, not as a claim', async () => {
    await db.user.create({
      data: {
        uuid: randomUUID(),
        email: `session${DOMAIN}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    currentUser.mockResolvedValue(
      clerkUser({
        emailAddresses: [
          { emailAddress: `session${DOMAIN}`, verification: { status: 'unverified' } },
        ],
      }),
    );

    expect(await getCurrentUser()).toBeNull();
    const row = await db.user.findFirst({ where: { email: `session${DOMAIN}` } });
    expect(row?.clerkId).toBeNull();
  });

  it('treats a missing verification object as unverified', async () => {
    currentUser.mockResolvedValue(
      clerkUser({ emailAddresses: [{ emailAddress: `session${DOMAIN}` }] }),
    );
    expect(await getCurrentUser()).toBeNull();
  });

  it('🔴 raises AccountLinkError on a collision rather than returning the wrong account', async () => {
    await db.user.create({
      data: {
        uuid: randomUUID(),
        email: `session${DOMAIN}`,
        clerkId: 'user_owner',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    currentUser.mockResolvedValue(clerkUser({ id: 'user_intruder' }));

    await expect(getCurrentUser()).rejects.toBeInstanceOf(AccountLinkError);
  });
});

describe('requireUser', () => {
  beforeEach(() => currentUser.mockReset());
  afterEach(cleanup);

  it('throws when signed out', async () => {
    currentUser.mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow('not signed in');
  });
});

describe('requireAdmin', () => {
  beforeEach(async () => {
    currentUser.mockReset();
    await cleanup();
  });

  afterEach(cleanup);

  it('🔴 refuses a signed-in non-admin', async () => {
    await db.user.create({
      data: {
        uuid: randomUUID(),
        email: `session${DOMAIN}`,
        clerkId: 'user_session',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    currentUser.mockResolvedValue(clerkUser());

    await expect(requireAdmin()).rejects.toThrow('admin only');
  });

  it('allows an admin', async () => {
    await db.user.create({
      data: {
        uuid: randomUUID(),
        email: `session${DOMAIN}`,
        clerkId: 'user_session',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    currentUser.mockResolvedValue(clerkUser());

    expect((await requireAdmin()).role).toBe('admin');
  });

  it('🔴 refuses a newly created account, which defaults to the user role', async () => {
    // A fresh Clerk signup must never arrive as an admin — createFromClerk
    // sets the role explicitly rather than relying on a column default.
    currentUser.mockResolvedValue(clerkUser({ id: 'user_brand_new' }));

    await expect(requireAdmin()).rejects.toThrow('admin only');
  });
});

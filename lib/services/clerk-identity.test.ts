import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/lib/db';
import { type ClerkIdentity, syncClerkIdentity } from './clerk-identity';

/**
 * 🔴 The security suite for this project.
 *
 * Two rules are load-bearing, and both protect the same thing: a member's
 * leagues, drafts and history must never end up attached to someone else.
 *
 *   1. Only a **verified** email may claim a legacy account.
 *   2. A row that is already claimed is **never** reassigned.
 *
 * If either fails, the implementation is wrong. Do not adjust these to match
 * new behaviour — the whole phase exists to make them true.
 *
 * These run against real rows in the local Docker database rather than a mocked
 * repository, because part of the guarantee is enforced by a unique index on
 * `clerk_id`. A mock would prove the code agrees with itself and nothing about
 * the constraint that actually holds the line.
 */

/** Every fixture address ends in @example.test so cleanup can be exact. */
const DOMAIN = '@example.test';

function identity(over: Partial<ClerkIdentity> = {}): ClerkIdentity {
  return {
    clerkId: 'user_test_aaa',
    emails: [{ address: `claimme${DOMAIN}`, verified: true }],
    firstName: 'Ada',
    lastName: 'Lovelace',
    image: null,
    ...over,
  };
}

async function cleanup() {
  await db.user.deleteMany({ where: { email: { contains: DOMAIN } } });
}

describe('syncClerkIdentity', () => {
  let legacyId: number;

  beforeEach(async () => {
    await cleanup();
    const row = await db.user.create({
      data: {
        uuid: randomUUID(),
        // Deliberately mixed case: one restored production account is stored
        // this way, and Clerk hands back lower-cased addresses.
        email: `ClaimMe${DOMAIN}`,
        provider: 'auth0',
        providerId: 'auth0|legacy',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      select: { id: true },
    });
    legacyId = row.id;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanup();
  });

  it('claims a legacy account on a verified email', async () => {
    const result = await syncClerkIdentity(identity());

    expect(result.status).toBe('claimed');
    expect(result.user?.id).toBe(legacyId);
    expect(result.user?.clerkId).toBe('user_test_aaa');
  });

  it('matches case-insensitively, because Clerk lower-cases addresses', async () => {
    // The stored address is `ClaimMe@…`; Clerk reports `claimme@…`. An exact
    // match would leave that member permanently unable to claim their own
    // account, with no error anyone would notice.
    const result = await syncClerkIdentity(identity());
    expect(result.user?.id).toBe(legacyId);
  });

  it('🔴 NEVER claims on an unverified email', async () => {
    // The account-takeover case: sign up with someone else's address, inherit
    // their leagues. Clerk's enabled methods are verified by construction
    // (D26), so this is defence in depth — enabling one more connection must
    // not silently reopen it.
    const result = await syncClerkIdentity(
      identity({ emails: [{ address: `claimme${DOMAIN}`, verified: false }] }),
    );

    expect(result.status).toBe('unverified');
    expect(result.user).toBeUndefined();

    const row = await db.user.findUnique({ where: { id: legacyId } });
    expect(row?.clerkId).toBeNull();
  });

  it('🔴 NEVER reassigns a row already claimed by a different identity', async () => {
    await syncClerkIdentity(identity({ clerkId: 'user_first' }));

    const result = await syncClerkIdentity(identity({ clerkId: 'user_second' }));

    expect(result.status).toBe('collision');
    expect(result.user).toBeUndefined();

    const row = await db.user.findUnique({ where: { id: legacyId } });
    expect(row?.clerkId).toBe('user_first');
  });

  it('🔴 does not create a second account when a claim collides', async () => {
    // The subtle failure: refusing the claim but then falling through to the
    // create path would hand the intruder a fresh account on an address that
    // is not theirs, and `email` is unique so it would fail confusingly — or,
    // worse, succeed on a different verified address.
    await syncClerkIdentity(identity({ clerkId: 'user_first' }));
    const before = await db.user.count();

    await syncClerkIdentity(identity({ clerkId: 'user_second' }));

    expect(await db.user.count()).toBe(before);
  });

  it('is idempotent — Clerk redelivers webhooks', async () => {
    const first = await syncClerkIdentity(identity());
    const second = await syncClerkIdentity(identity());

    expect(second.status).toBe('linked');
    expect(second.user?.id).toBe(first.user?.id);
  });

  it('creates a new account when no legacy row matches', async () => {
    const result = await syncClerkIdentity(
      identity({
        clerkId: 'user_new',
        emails: [{ address: `nobody${DOMAIN}`, verified: true }],
      }),
    );

    expect(result.status).toBe('created');
    expect(result.user?.provider).toBe('clerk');
    // Nullable column with no database default — a null here yields a user
    // with no public profile URL.
    expect(result.user?.uuid).toBeTruthy();
    expect(result.user?.createdAt).toBeTruthy();
  });

  it('ignores an unverified address but still claims via a verified one', async () => {
    const result = await syncClerkIdentity(
      identity({
        emails: [
          { address: `attacker${DOMAIN}`, verified: false },
          { address: `claimme${DOMAIN}`, verified: true },
        ],
      }),
    );

    expect(result.status).toBe('claimed');
    expect(result.user?.id).toBe(legacyId);
  });

  it('does nothing when the identity has no addresses at all', async () => {
    const result = await syncClerkIdentity(identity({ emails: [] }));
    expect(result.status).toBe('unverified');
  });

  it('logs a collision so an admin can repair it', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    await syncClerkIdentity(identity({ clerkId: 'user_first' }));

    await syncClerkIdentity(identity({ clerkId: 'user_second' }));

    // A silent refusal leaves the member locked out with nothing to act on.
    expect(logged).toHaveBeenCalled();
  });
});

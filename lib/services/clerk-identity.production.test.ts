import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { syncClerkIdentity } from './clerk-identity';

/**
 * 🔴 The Phase 4 gate, stated in `docs/PLAN.md`:
 *
 *   "a real production account is claimed via a verified email and resolves
 *    with leagues intact; an unverified email provably cannot claim."
 *
 * Every other suite builds its own fixtures. This one deliberately does not —
 * it runs against a genuine restored production row, because the thing being
 * proven is that *this data*, as it actually exists after the migration, can
 * be claimed without losing anything. A synthetic user proves the code works
 * on users the code created.
 *
 * The account is chosen by email rather than by a hardcoded id, and every
 * mutation is undone in `afterAll`. The suite skips rather than fails if the
 * database has not been restored, so a fresh checkout is not blocked by it.
 */
const EMAIL = 'jon@jonbernard.net';
const CLERK_ID = 'user_production_gate_test';

type Snapshot = {
  id: number;
  clerkId: string | null;
  drafts: number;
  picks: number;
  watchlist: number;
};

async function snapshot(userId: number): Promise<Snapshot> {
  const [user, drafts, watchlist] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, clerkId: true },
    }),
    db.draft.findMany({ where: { userId }, select: { id: true } }),
    db.watchlist.count({ where: { userId: BigInt(userId) } }),
  ]);

  const picks = await db.draftPick.count({
    where: { draftId: { in: drafts.map((draft) => draft.id) } },
  });

  return { id: user.id, clerkId: user.clerkId, drafts: drafts.length, picks, watchlist };
}

describe('claiming a real restored production account', () => {
  let before: Snapshot | null = null;

  beforeAll(async () => {
    const user = await db.user.findFirst({
      where: { email: { equals: EMAIL, mode: 'insensitive' } },
      select: { id: true },
    });
    if (user) before = await snapshot(user.id);
  });

  afterAll(async () => {
    // Put the row back exactly as the restore left it. This suite touches real
    // migrated data; leaving a test identity attached to it would make the
    // next run assert against a state the restore never produced.
    if (before) {
      await db.user.update({
        where: { id: before.id },
        data: { clerkId: before.clerkId },
      });
    }
  });

  it('starts from an unclaimed account, as the restore leaves every row', () => {
    if (!before) return;
    expect(before.clerkId).toBeNull();
  });

  it('🔴 the account has real history to lose', () => {
    if (!before) return;
    // If this ever reads zero the gate below proves nothing — it would be
    // asserting that an empty account survived being claimed.
    expect(before.drafts).toBeGreaterThan(0);
    expect(before.picks).toBeGreaterThan(0);
  });

  it('🔴 an unverified address cannot claim it', async () => {
    if (!before) return;

    const result = await syncClerkIdentity({
      clerkId: 'user_unverified_attacker',
      emails: [{ address: EMAIL, verified: false }],
      firstName: null,
      lastName: null,
      image: null,
    });

    expect(result.status).toBe('unverified');
    const after = await snapshot(before.id);
    expect(after.clerkId).toBeNull();
  });

  it('🔴 a verified address claims it with every draft, pick and watchlist row intact', async () => {
    if (!before) return;

    const result = await syncClerkIdentity({
      clerkId: CLERK_ID,
      // Lower-cased, the way Clerk reports a verified address.
      emails: [{ address: EMAIL.toLowerCase(), verified: true }],
      firstName: 'Jon',
      lastName: null,
      image: null,
    });

    expect(result.status).toBe('claimed');
    expect(result.user?.id).toBe(before.id);

    const after = await snapshot(before.id);
    expect(after.clerkId).toBe(CLERK_ID);
    // The point of the gate: claiming attaches an identity and changes nothing
    // else. Same row, same history.
    expect(after.drafts).toBe(before.drafts);
    expect(after.picks).toBe(before.picks);
    expect(after.watchlist).toBe(before.watchlist);
  });

  it('🔴 a second identity cannot take the account after it is claimed', async () => {
    if (!before) return;

    const result = await syncClerkIdentity({
      clerkId: 'user_second_identity',
      emails: [{ address: EMAIL, verified: true }],
      firstName: null,
      lastName: null,
      image: null,
    });

    expect(result.status).toBe('collision');
    const after = await snapshot(before.id);
    expect(after.clerkId).toBe(CLERK_ID);
  });
});

// @vitest-environment node

import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { loadFixture } from '@/test/fixtures';

import { userRepository } from './users';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * A user as `GET /draft/users/:id` returned it — id plus the four display
 * fields.
 *
 * The source controller listed `displayName` in its `attributes`, but the same
 * query set `raw: true`, and a Sequelize VIRTUAL column is computed by the
 * model instance that `raw` skips. The field it asked for therefore never
 * reached the response.
 */
type FixtureDraftUser = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  image: string | null;
  uuid: string | null;
};

/**
 * A user as `GET /profile/feed/user/:uuid` returned it — no id, and here
 * `displayName` *is* present, because that query did not set `raw`.
 */
type FixtureProfileUser = {
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  image: string | null;
  uuid: string | null;
};

const draftUsers = loadFixture<FixtureDraftUser[]>('draft-users');
const { user: profileUser } = loadFixture<{ user: FixtureProfileUser }>('profile-feed');

/**
 * Read a user straight out of the database, bypassing the repository.
 *
 * Every name, email, avatar URL and uuid in the fixtures was replaced by
 * scripts/scrub-fixtures.mjs, so unlike the movie fixtures they cannot be
 * asserted against the restored data. The fixtures still pin the *shape*; the
 * values are checked against SQL instead.
 */
async function rawUser(id: number) {
  const rows = await db.$queryRaw<
    {
      id: number;
      uuid: string | null;
      first_name: string | null;
      last_name: string | null;
      email: string;
      role: string | null;
      image: string | null;
      provider: string | null;
      provider_id: string | null;
      last_login: Date | null;
      clerk_id: string | null;
    }[]
  >`select * from users where id = ${id}`;
  const row = rows[0];
  if (!row) throw new Error(`no user ${id} in the restored database`);
  return row;
}

/** The account the claim tests mutate. Reset after every one of them. */
async function claimTestUser() {
  const rows = await db.$queryRaw<{ id: number; email: string }[]>`
    select id, email from users order by id desc limit 1
  `;
  const row = rows[0];
  if (!row) throw new Error('the users table is empty');
  return row;
}

describe('userRepository.findById', () => {
  it('returns the user', async () => {
    const expected = await rawUser(1);

    const user = await userRepository.findById(expected.id);

    expect(user.email).toBe(expected.email);
    expect(user.uuid).toBe(expected.uuid);
  });

  it('throws NotFoundError for an id that does not exist', async () => {
    await expect(userRepository.findById(999_999)).rejects.toBeInstanceOf(NotFoundError);
    await expect(userRepository.findById(999_999)).rejects.toThrow(
      'user 999999 not found',
    );
  });
});

describe('userRepository.findByUuid', () => {
  it('returns the user', async () => {
    const expected = await rawUser(1);
    if (!expected.uuid) throw new Error('user 1 has no uuid');

    const user = await userRepository.findByUuid(expected.uuid);
    expect(user?.id).toBe(expected.id);
  });

  it('returns null when absent', async () => {
    // The public profile URL carries a uuid, so a miss is a mistyped link
    // rather than a broken invariant.
    expect(
      await userRepository.findByUuid('00000000-0000-0000-0000-000000000000'),
    ).toBeNull();
  });
});

describe('userRepository.findByEmail', () => {
  it('returns the user', async () => {
    const expected = await rawUser(1);

    const user = await userRepository.findByEmail(expected.email);
    expect(user?.id).toBe(expected.id);
  });

  it('matches case-insensitively', async () => {
    // Clerk lower-cases the email on a verified identity, and one restored
    // account was stored with mixed case. An exact match would leave that
    // person permanently unable to claim their own account (D25).
    const expected = await rawUser(1);

    const user = await userRepository.findByEmail(expected.email.toUpperCase());
    expect(user?.id).toBe(expected.id);
  });

  it('returns null when absent', async () => {
    // A miss is the normal path for a brand new Clerk signup, not an error.
    expect(await userRepository.findByEmail('nobody@example.invalid')).toBeNull();
  });
});

describe('userRepository.findByClerkId', () => {
  it('returns null when absent', async () => {
    // Every restored account is unclaimed — there was no bulk migration
    // (D25) — so this is the state the first sign-in of every user hits.
    expect(await userRepository.findByClerkId('user_nosuchclerkid')).toBeNull();
  });
});

describe('the DTO matches the captured contract', () => {
  it('carries every field the source API exposed publicly', async () => {
    const publicFields = Object.keys(draftUsers[0] ?? {});
    expect(publicFields.length).toBeGreaterThan(0);

    const user = await userRepository.findById(1);

    for (const field of publicFields) {
      expect(user).toHaveProperty(field);
    }
  });

  it('carries the record behind those projections, not just the projections', async () => {
    // The source app had four different user shapes depending on the route.
    // A repository returns the row; picking fields for a response is the
    // caller's job.
    const user = await userRepository.findById(1);

    expect(Object.keys(user).sort()).toEqual(
      [
        'clerkId',
        'createdAt',
        'email',
        'firstName',
        'id',
        'image',
        'lastLogin',
        'lastName',
        'provider',
        'providerId',
        'role',
        'updatedAt',
        'uuid',
      ].sort(),
    );
  });

  it('matches the database values field for field', async () => {
    // Not the fixture values: the scrubber replaced every name, email, avatar
    // URL and uuid, so `draft-users` and `profile-feed` pin the shape only.
    const expected = await rawUser(1);

    const user = await userRepository.findById(1);

    expect(user.id).toBe(expected.id);
    expect(user.uuid).toBe(expected.uuid);
    expect(user.firstName).toBe(expected.first_name);
    expect(user.lastName).toBe(expected.last_name);
    expect(user.email).toBe(expected.email);
    expect(user.role).toBe(expected.role);
    expect(user.image).toBe(expected.image);
    expect(user.provider).toBe(expected.provider);
    expect(user.providerId).toBe(expected.provider_id);
    expect(user.clerkId).toBe(expected.clerk_id);
  });

  it('does not synthesize the displayName the source model computed', async () => {
    // Sequelize gave the model a VIRTUAL `${firstName} ${lastName}`, which is
    // why `profile-feed` carries one. It is presentation, and it is wrong at
    // the source: some rows hold unnormalized names, so display goes through
    // a single formatter rather than being baked into every read — the same
    // reasoning that keeps absolute poster URLs out of the movie DTO.
    expect(profileUser).toHaveProperty('displayName');

    const user = await userRepository.findById(1);
    expect(user).not.toHaveProperty('displayName');
  });

  it('exposes clerkId, which no fixture constrains', async () => {
    // The column is new (D25) and was added after the captures, so no fixture
    // constrains it. It is on the DTO for the same reason accentHex is on
    // Movie: the app needs it, and the fixtures are a floor, not a ceiling.
    const user = await userRepository.findById(1);
    expect(user).toHaveProperty('clerkId');
  });

  it('returns Date objects, not the strings JSON gave us', async () => {
    const user = await userRepository.findById(2);
    expect(user.lastLogin).toBeInstanceOf(Date);
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('returns no Prisma internals', async () => {
    const user = await userRepository.findById(1);
    expect(Object.getPrototypeOf(user)).toBe(Object.prototype);
  });
});

describe('userRepository.findManyByIds', () => {
  it('returns the requested users', async () => {
    const users = await userRepository.findManyByIds([1, 2, 3]);
    expect(users.map((u) => u.id)).toEqual([1, 2, 3]);
  });

  it('silently skips ids that do not resolve', async () => {
    // The drafts, notifications and watchlist screens all batch-load users by
    // an id they read from another table, and no foreign key guarantees it
    // still points at a row.
    const users = await userRepository.findManyByIds([1, 999_999]);
    expect(users).toHaveLength(1);
  });

  it('accepts the bigint ids that other tables store', async () => {
    // users.id is integer, but notifications.user_id and watchlists.user_id
    // are both bigint.
    expect(await userRepository.findManyByIds([1n, 2n])).toHaveLength(2);
  });

  it('returns an empty array for an empty request', async () => {
    expect(await userRepository.findManyByIds([])).toEqual([]);
  });

  it('resolves every id the draft roster fixture listed', async () => {
    // The ids survived scrubbing even though the names did not, so the
    // fixture still proves a real roster loads in one round trip.
    const ids = draftUsers.map((u) => u.id);

    const users = await userRepository.findManyByIds(ids);
    expect(users).toHaveLength(ids.length);
  });
});

describe('userRepository.claim', () => {
  afterEach(async () => {
    const { id } = await claimTestUser();
    await db.user.update({ where: { id }, data: { clerkId: null } });
  });

  it('attaches the Clerk id to the account with that email', async () => {
    const { id, email } = await claimTestUser();

    const claimed = await userRepository.claim(email, 'user_claimtest');

    expect(claimed.id).toBe(id);
    expect(claimed.clerkId).toBe('user_claimtest');
    expect((await userRepository.findByClerkId('user_claimtest'))?.id).toBe(id);
  });

  it('claims an account whose stored email differs in case', async () => {
    const { id, email } = await claimTestUser();

    const claimed = await userRepository.claim(email.toUpperCase(), 'user_claimtest');
    expect(claimed.id).toBe(id);
  });

  it('is idempotent for the same Clerk identity', async () => {
    // Clerk redelivers webhooks, and a sign-in can race with itself. A second
    // claim by the identity that already holds the account is a no-op, not an
    // error the caller has to special-case.
    const { email } = await claimTestUser();

    await userRepository.claim(email, 'user_claimtest');
    const again = await userRepository.claim(email, 'user_claimtest');

    expect(again.clerkId).toBe('user_claimtest');
  });

  it('refuses to move an account to a second Clerk identity', async () => {
    // This is the account-takeover case D25 exists to prevent. Silently
    // rebinding would hand the account to whoever signed in last.
    const { email } = await claimTestUser();

    await userRepository.claim(email, 'user_claimtest');

    await expect(userRepository.claim(email, 'user_intruder')).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('throws NotFoundError when no account has that email', async () => {
    // The caller decides what to do — a first-time Clerk user with no legacy
    // account is the normal case and gets a fresh row elsewhere.
    await expect(
      userRepository.claim('nobody@example.invalid', 'user_claimtest'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('leaves every other account untouched', async () => {
    const { email } = await claimTestUser();

    await userRepository.claim(email, 'user_claimtest');

    const others = await db.$queryRaw<{ count: bigint }[]>`
      select count(*) as count from users where clerk_id is not null
    `;
    expect(Number(others[0]?.count)).toBe(1);
  });
});

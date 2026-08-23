// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { loadFixture } from '@/test/fixtures';

import { NOTIFICATION_FEED_SIZE, notificationRepository } from './notifications';

afterAll(async () => {
  await db.$disconnect();
});

/** `GET /notifications`, captured as user 3 — the 10 most recent. */
type FixtureNotification = {
  id: number;
  message: string;
  icon: string;
  link: string;
  userId: number;
  read: boolean;
  createdAt: string;
  updatedAt: string;
};

const notifications = loadFixture<FixtureNotification[]>('notifications');

const USER = 3;

describe('notificationRepository.findById', () => {
  it('returns the notification', async () => {
    const expected = notifications[0];
    if (!expected) throw new Error('notifications fixture is empty');

    const notification = await notificationRepository.findById(expected.id);
    expect(notification.message).toBe(expected.message);
  });

  it('throws NotFoundError for an id that does not exist', async () => {
    await expect(notificationRepository.findById(999_999)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(notificationRepository.findById(999_999)).rejects.toThrow(
      'notification 999999 not found',
    );
  });
});

describe('notificationRepository.findByUser', () => {
  it('returns the same feed the source API did', async () => {
    const feed = await notificationRepository.findByUser(USER);

    expect(feed.map((n) => n.id)).toEqual(notifications.map((n) => n.id));
  });

  it('returns the newest first, using the database ordering', async () => {
    const feed = await notificationRepository.findByUser(USER);

    const ordered = await db.$queryRaw<{ id: number }[]>`
      select id from notifications
      where user_id = ${USER}
      order by created_at desc, id desc
      limit ${NOTIFICATION_FEED_SIZE}
    `;

    expect(feed.map((n) => n.id)).toEqual(ordered.map((r) => r.id));
  });

  it('caps the feed at the size the source app used', async () => {
    // The user has far more than a screenful; the API took the latest 10.
    expect(
      await db.notification.count({ where: { userId: BigInt(USER) } }),
    ).toBeGreaterThan(NOTIFICATION_FEED_SIZE);
    expect(await notificationRepository.findByUser(USER)).toHaveLength(
      NOTIFICATION_FEED_SIZE,
    );
  });

  it('honours an explicit limit', async () => {
    expect(await notificationRepository.findByUser(USER, 3)).toHaveLength(3);
  });

  it('accepts the bigint user ids this column stores', async () => {
    // notifications.user_id is bigint while users.id is integer, and no
    // foreign key ties them, so callers hold both widths.
    const feed = await notificationRepository.findByUser(BigInt(USER), 1);
    expect(feed).toHaveLength(1);
  });

  it('returns an empty array for a user id that does not resolve', async () => {
    // No foreign keys: a notification row can reference a deleted user, and
    // asking about one must not throw.
    expect(await notificationRepository.findByUser(999_999)).toEqual([]);
  });
});

describe('notificationRepository.countUnreadByUser', () => {
  it('counts only the unread ones', async () => {
    const [{ count }] = await db.$queryRaw<{ count: bigint }[]>`
      select count(*) as count from notifications
      where user_id = ${USER} and read is not true
    `;

    expect(await notificationRepository.countUnreadByUser(USER)).toBe(Number(count));
  });

  it('returns 0 for a user with no notifications', async () => {
    expect(await notificationRepository.countUnreadByUser(999_999)).toBe(0);
  });

  it('counts a null read the same as an explicit false — both are unread', async () => {
    // `read` is nullable, and the restored 2,000-plus rows may or may not
    // happen to hold a null one for user 3 today. A synthetic user with one
    // of each value is the only way this claim is actually exercised: a
    // fixture holding only `false` rows cannot catch `{ equals: false }`
    // silently dropping every null.
    const SYNTHETIC = 900_301;
    const now = new Date();
    await db.notification.deleteMany({ where: { userId: BigInt(SYNTHETIC) } });
    await db.notification.createMany({
      data: [
        {
          userId: BigInt(SYNTHETIC),
          message: 'null read',
          read: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          userId: BigInt(SYNTHETIC),
          message: 'false read',
          read: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          userId: BigInt(SYNTHETIC),
          message: 'true read',
          read: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    expect(await notificationRepository.countUnreadByUser(SYNTHETIC)).toBe(2);

    await db.notification.deleteMany({ where: { userId: BigInt(SYNTHETIC) } });
  });
});

describe('the DTO matches the captured contract', () => {
  it('carries exactly the fields the source API returned', async () => {
    const expected = notifications[0];
    if (!expected) throw new Error('notifications fixture is empty');

    const notification = await notificationRepository.findById(expected.id);

    expect(Object.keys(notification).sort()).toEqual(Object.keys(expected).sort());
  });

  it('matches the captured values field for field', async () => {
    const expected = notifications[0];
    if (!expected) throw new Error('notifications fixture is empty');

    const notification = await notificationRepository.findById(expected.id);

    expect(notification.id).toBe(expected.id);
    expect(notification.message).toBe(expected.message);
    expect(notification.icon).toBe(expected.icon);
    expect(notification.link).toBe(expected.link);
    expect(notification.userId).toBe(expected.userId);
    expect(notification.read).toBe(expected.read);
    expect(notification.createdAt?.toISOString()).toBe(expected.createdAt);
    expect(notification.updatedAt?.toISOString()).toBe(expected.updatedAt);
  });

  it('normalizes the bigint user id to number', async () => {
    // user_id is bigint. A bigint in the DTO throws on JSON.stringify the
    // moment the notification bell renders on the client.
    const expected = notifications[0];
    if (!expected) throw new Error('notifications fixture is empty');

    const notification = await notificationRepository.findById(expected.id);

    expect(typeof notification.userId).toBe('number');
    expect(() => JSON.stringify(notification)).not.toThrow();
  });

  it('returns Date objects, not the strings JSON gave us', async () => {
    const expected = notifications[0];
    if (!expected) throw new Error('notifications fixture is empty');

    const notification = await notificationRepository.findById(expected.id);
    expect(notification.createdAt).toBeInstanceOf(Date);
  });

  it('returns no Prisma internals', async () => {
    const expected = notifications[0];
    if (!expected) throw new Error('notifications fixture is empty');

    const notification = await notificationRepository.findById(expected.id);
    expect(Object.getPrototypeOf(notification)).toBe(Object.prototype);
  });
});

/**
 * The writes (T44, T45). Synthetic user ids, never the restored ones: this
 * table declares no foreign key on `user_id`, so a synthetic id needs no
 * parent row — the same shape `lists.writes.test.ts` relies on to stay out of
 * `vitest.ci.config.mts`'s blanket `lib/repositories/` exclusion... except
 * this file isn't in that carve-out, so it only runs locally. The scoping
 * claim that matters for CI is covered again, against a real signed-in
 * caller, in `actions/notifications/mark-as-read.test.ts`.
 */
describe('notificationRepository.markAsRead', () => {
  const WRITER = 900_101;
  const STRANGER = 900_102;

  async function clearWrites() {
    await db.notification.deleteMany({
      where: { userId: { in: [BigInt(WRITER), BigInt(STRANGER)] } },
    });
  }

  beforeEach(clearWrites);
  afterAll(clearWrites);

  it('scopes the update to the given user and leaves another user’s row alone', async () => {
    const now = new Date();
    const mine = await db.notification.create({
      data: {
        userId: BigInt(WRITER),
        message: 'mine',
        read: false,
        createdAt: now,
        updatedAt: now,
      },
      select: { id: true },
    });
    // Starts unread, deliberately: if the `userId` clause were dropped, this
    // row would flip to read too, and only an unread starting value can show
    // that.
    const theirs = await db.notification.create({
      data: {
        userId: BigInt(STRANGER),
        message: 'theirs',
        read: false,
        createdAt: now,
        updatedAt: now,
      },
      select: { id: true },
    });

    const count = await notificationRepository.markAsRead([mine.id, theirs.id], WRITER);

    expect(count).toBe(1);
    expect((await db.notification.findUnique({ where: { id: mine.id } }))?.read).toBe(
      true,
    );
    expect((await db.notification.findUnique({ where: { id: theirs.id } }))?.read).toBe(
      false,
    );
  });

  it('returns 0 for an empty id list', async () => {
    expect(await notificationRepository.markAsRead([], WRITER)).toBe(0);
  });
});

describe('notificationRepository.broadcast', () => {
  const RECIPIENTS = [900_201, 900_202, 900_203];

  afterAll(async () => {
    await db.notification.deleteMany({
      where: { userId: { in: RECIPIENTS.map(BigInt) } },
    });
  });

  it('writes one row per user, in one statement', async () => {
    const count = await notificationRepository.broadcast(RECIPIENTS, {
      message: 'hello everyone',
      icon: null,
      link: null,
    });

    expect(count).toBe(RECIPIENTS.length);
    expect(
      await db.notification.count({
        where: { userId: { in: RECIPIENTS.map(BigInt) }, message: 'hello everyone' },
      }),
    ).toBe(RECIPIENTS.length);
  });

  it('gives every row the same createdAt — the tiebreak findByUser relies on', async () => {
    await notificationRepository.broadcast(RECIPIENTS, {
      message: 'tie-break check',
      icon: null,
      link: null,
    });

    const rows = await db.notification.findMany({
      where: { userId: { in: RECIPIENTS.map(BigInt) }, message: 'tie-break check' },
    });
    const timestamps = new Set(rows.map((row) => row.createdAt?.getTime()));

    expect(rows).toHaveLength(RECIPIENTS.length);
    expect(timestamps.size).toBe(1);
  });

  it('returns 0 and writes nothing for an empty recipient list', async () => {
    expect(
      await notificationRepository.broadcast([], {
        message: 'x',
        icon: null,
        link: null,
      }),
    ).toBe(0);
  });
});

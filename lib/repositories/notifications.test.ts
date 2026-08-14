// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

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

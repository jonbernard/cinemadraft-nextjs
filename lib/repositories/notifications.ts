import type { NotificationModel } from '@/generated/prisma/models';
import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';

/**
 * One line in a user's notification bell.
 *
 * The field list is explicit so a new column cannot silently widen the DTO;
 * the types come from the generated model, except `userId`, normalized below.
 */
export type Notification = Omit<
  Pick<
    NotificationModel,
    'id' | 'message' | 'icon' | 'link' | 'userId' | 'read' | 'createdAt' | 'updatedAt'
  >,
  'userId'
> & {
  /**
   * Normalized from bigint. `notifications.user_id` is bigint while `users.id`
   * is integer, and no foreign key ties them. A bigint here would throw on
   * `JSON.stringify` as soon as the bell rendered on the client, and would
   * compare unequal to the integer id every caller already holds.
   *
   * Nullable because the column is.
   */
  userId: number | null;
};

/** What the source API returned: the latest ten, and no pagination at all. */
export const NOTIFICATION_FEED_SIZE = 10;

const SELECT = {
  id: true,
  message: true,
  icon: true,
  link: true,
  userId: true,
  read: true,
  createdAt: true,
  updatedAt: true,
} as const;

type Row = Omit<Notification, 'userId'> & { userId: bigint | null };

function toDto(row: Row): Notification {
  return { ...row, userId: row.userId === null ? null : Number(row.userId) };
}

export const notificationRepository = {
  /** Throws NotFoundError rather than returning null — callers would forget to check. */
  async findById(id: number): Promise<Notification> {
    const notification = await db.notification.findUnique({
      where: { id },
      select: SELECT,
    });
    if (!notification) throw new NotFoundError('notification', id);
    return toDto(notification);
  },

  /**
   * A user's most recent notifications, newest first.
   *
   * Capped rather than paged, because the source app never paged this and the
   * bell has nowhere to put a second page. `id` breaks ties so the same
   * request renders the same list — the bulk-add path writes one row per user
   * in a single statement, so identical timestamps are the norm here, not the
   * exception.
   *
   * A user id that resolves to nobody returns an empty list rather than
   * throwing: there are no foreign keys, so a caller can hold an id whose user
   * is gone.
   */
  async findByUser(
    userId: number | bigint,
    limit = NOTIFICATION_FEED_SIZE,
  ): Promise<Notification[]> {
    const rows = await db.notification.findMany({
      where: { userId: BigInt(userId) },
      select: SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows.map(toDto);
  },

  /**
   * The bell's badge. `read` is nullable, and a null has never been read.
   *
   * 🔴 Written as `OR: [{ read: false }, { read: null }]`, not
   * `read: { not: true }`. Prisma compiles `not: true` on a nullable Boolean
   * to SQL `<> true`, and three-valued SQL logic makes `null <> true`
   * evaluate to `null` rather than true — so that filter silently excludes
   * every null row instead of including it. Measured directly against this
   * column: a null and a `false` row must count the same, and only the `OR`
   * form does.
   */
  async countUnreadByUser(userId: number | bigint): Promise<number> {
    return db.notification.count({
      where: { userId: BigInt(userId), OR: [{ read: false }, { read: null }] },
    });
  },

  /**
   * Mark some of a user's own notifications read (T44).
   *
   * 🔴 `userId` is in the `where`, not checked beforehand and then trusted —
   * a check-then-write can be got around by a request that lands between the
   * two, a scoped write cannot. Ids in `ids` that belong to someone else, or
   * to nobody, simply match zero rows; the caller never learns which.
   *
   * Returns the count of rows the `where` matched — Prisma's `updateMany`
   * count, not a count of rows whose value actually changed — rather than the
   * ids requested, so a caller cannot tell "all of these were yours" from
   * "some were not" — the one thing this method must not leak. An
   * already-read row still counts here; it is not distinguishable from one
   * this call newly marked.
   */
  async markAsRead(ids: readonly number[], userId: number | bigint): Promise<number> {
    if (ids.length === 0) return 0;
    const { count } = await db.notification.updateMany({
      where: { id: { in: [...ids] }, userId: BigInt(userId) },
      data: { read: true },
    });
    return count;
  },

  /**
   * Admin broadcast: one row per user, in a single statement (T45).
   *
   * One `createMany` rather than a loop of `create` calls, matching the
   * source's single `bulkCreate` — `findByUser`'s `id` tiebreak exists
   * because this path writes every recipient's row with the *same*
   * `createdAt`, and a loop of individual writes would give each its own
   * timestamp and quietly stop exercising that tiebreak.
   */
  async broadcast(
    userIds: readonly number[],
    input: { message: string; icon: string | null; link: string | null },
  ): Promise<number> {
    if (userIds.length === 0) return 0;
    const now = new Date();
    const { count } = await db.notification.createMany({
      data: userIds.map((userId) => ({
        userId: BigInt(userId),
        message: input.message,
        icon: input.icon,
        link: input.link,
        read: false,
        createdAt: now,
        updatedAt: now,
      })),
    });
    return count;
  },
};

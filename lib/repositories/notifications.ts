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

  /** The bell's badge. `read` is nullable, and a null has never been read. */
  async countUnreadByUser(userId: number | bigint): Promise<number> {
    return db.notification.count({
      where: { userId: BigInt(userId), read: { not: true } },
    });
  },
};

import { Prisma } from '@prisma/client';

import { database } from '..';

export const bulkAddNotifications = async (
  notifications: Prisma.NotificationCreateManyInput[],
) => {
  return database.notification.createMany({
    data: notifications,
  });
};

export const deleteNotification = async (id: number, userId: number) => {
  if (!userId || !id) {
    throw new Error('Provide valid params');
  }

  return database.notification.delete({
    where: {
      id,
      userId,
    },
  });
};

export const markNotificationsAsRead = async (
  ids: number[],
  userId: number,
) => {
  if (!userId) {
    throw new Error('Provide valid params');
  }

  return database.notification.updateMany({
    where: {
      id: {
        in: ids,
      },
      userId,
    },
    data: {
      read: true,
    },
  });
};

export const getAllNotificationsByUserId = async (userId: number) => {
  if (!userId) {
    throw new Error('Provide valid params');
  }

  return database.notification.findMany({
    where: {
      userId,
    },
    take: 10,
    orderBy: {
      createdAt: 'desc',
    },
  });
};

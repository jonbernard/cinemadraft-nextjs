import { Prisma } from '@prisma/client';

import { database } from '..';

export const bulkAddProfileFeeds = async (
  profileFeeds: Prisma.ProfileFeedCreateManyInput[],
) => {
  return database.profileFeed.createMany({
    data: profileFeeds,
  });
};

export const addProfileFeed = async (body: Prisma.ProfileFeedCreateInput) => {
  return database.profileFeed.create({
    data: body,
  });
};

export const deleteProfileFeed = async (id: number, userUuid: string) => {
  if (!userUuid || !id) {
    throw new Error('Provide valid params');
  }

  return database.profileFeed.delete({
    where: {
      id,
      userUuid,
    },
  });
};

export const getAllProfileFeedsByUserUuid = async (uuid: string) => {
  return database.profileFeed.findMany({
    where: {
      userUuid: uuid,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};

import { Prisma } from "@prisma/client";
import { database } from "..";

export const bulkAddProfileFeeds = async (profileFeeds: Prisma.ProfileFeedsCreateManyInput[]) => {
  return await database.profileFeeds.createMany({
    data: profileFeeds
  });
};

export const addProfileFeed = async (body: Prisma.ProfileFeedsCreateInput) => {
  return await database.profileFeeds.create({
    data: body
  });
};

export const deleteProfileFeed = async (id: number, userUuid: string) => {
  if (!userUuid || !id) {
    throw new Error('Provide valid params');
  }

  return await database.profileFeeds.delete({
    where: {
      id,
      userUuid
    }
  });
};

export const getAllProfileFeedsByUserUuid = async (uuid: string) => {
  return await database.profileFeeds.findMany({
    where: {
      userUuid: uuid
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
}; 
import { Prisma } from "@prisma/client";
import { database } from "..";

export const addList = async (body: Prisma.ListsCreateInput) => {
  return await database.lists.create({
    data: body,
    include: {
      movie: true
    }
  });
};

export const updateList = async (id: number, order: number, userId: number) => {
  return await database.lists.update({
    where: {
      id,
      userId
    },
    data: {
      order
    },
    include: {
      movie: true
    }
  });
};

export const updateListStatus = async (id: number, status: Prisma.ListsUpdateInput['status'], userId: number) => {
  return await database.lists.update({
    where: {
      id,
      userId
    },
    data: {
      status
    },
    include: {
      movie: true
    }
  });
};

export const deleteListById = async (id: number) => {
  return await database.lists.delete({
    where: {
      id
    }
  });
};

export const getListsByYear = async (userId: number, year: number) => {
  if (!userId || !year) {
    throw new Error('Provide valid params');
  }

  return await database.lists.findMany({
    where: {
      userId,
      year
    },
    orderBy: {
      order: 'asc'
    },
    include: {
      movie: true
    }
  });
}; 
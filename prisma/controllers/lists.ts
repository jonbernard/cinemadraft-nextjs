import { Prisma } from '@prisma/client';

import { database } from '..';

export const addList = async (body: Prisma.ListCreateInput) => {
  return database.list.create({
    data: body,
    include: {
      movie: true,
    },
  });
};

export const updateList = async (id: number, order: number, userId: number) => {
  return database.list.update({
    where: {
      id,
      userId,
    },
    data: {
      order,
    },
    include: {
      movie: true,
    },
  });
};

export const updateListStatus = async (
  id: number,
  status: Prisma.ListUpdateInput['status'],
  userId: number,
) => {
  return database.list.update({
    where: {
      id,
      userId,
    },
    data: {
      status,
    },
    include: {
      movie: true,
    },
  });
};

export const deleteListById = async (id: number) => {
  return database.list.delete({
    where: {
      id,
    },
  });
};

export const getListsByYear = async (userId: number, year: number) => {
  if (!userId || !year) {
    throw new Error('Provide valid params');
  }

  return database.list.findMany({
    where: {
      userId,
      year,
    },
    orderBy: {
      order: 'asc',
    },
    include: {
      movie: true,
    },
  });
};

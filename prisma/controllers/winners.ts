import { Prisma } from '@prisma/client';

import { database } from '..';

export const addWinner = async (data: Prisma.WinnerCreateInput) => {
  return database.winner.create({
    data,
    include: {
      movie: true,
      award: true,
    },
  });
};

export const deleteWinner = async (awardId: number, year: number) => {
  if (!awardId || !year) {
    throw new Error('Provide valid params');
  }

  const winner = await database.winner.findFirst({
    where: {
      award: {
        id: awardId,
      },
      year,
    },
  });

  return database.winner.delete({
    where: {
      id: winner?.id,
    },
  });
};

export const getAllWinners = async () => {
  return database.winner.findMany({
    include: {
      movie: true,
      award: true,
    },
  });
};

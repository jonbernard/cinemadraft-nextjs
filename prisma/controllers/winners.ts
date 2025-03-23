import { Prisma } from "@prisma/client";
import { database } from "..";

export const addWinner = async (data: Prisma.WinnersCreateInput) => {
  return await database.winners.create({
    data,
    include: {
      movie: true,
      award: true
    }
  });
};

export const deleteWinner = async (awardId: number, year: number) => {
  if (!awardId || !year) {
    throw new Error('Provide valid params');
  }

  const winner = await database.winners.findFirst({
    where: {
      award: {
        id: awardId
      },
      year
    }
  });

  return await database.winners.delete({
    where: {
      id: winner?.id
    }
  });
};

export const getAllWinners = async () => {
  return await database.winners.findMany({
    include: {
      movie: true,
      award: true
    }
  });
}; 
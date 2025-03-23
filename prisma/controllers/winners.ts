import { Prisma } from "@prisma/client";
import { database } from "..";

export const addWinner = async (data: Prisma.WinnersCreateInput) => {
  return await database.winners.upsert({
    where: {
      awardId_year: {
        awardId: data.awardId,
        year: data.year
      }
    },
    create: data,
    update: data,
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

  return await database.winners.delete({
    where: {
      awardId_year: {
        awardId,
        year
      }
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
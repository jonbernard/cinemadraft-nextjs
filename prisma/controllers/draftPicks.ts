import { Prisma } from "@prisma/client";
import { database } from "..";

export const addDraftPick = async (pick: Prisma.DraftPicksCreateInput) => {
  return await database.draftPicks.create({
    data: pick
  });
};

export const updateDraftPick = async (id: number, order: number) => {
  return await database.draftPicks.update({
    where: {
      id
    },
    data: {
      order
    }
  });
};

export const getDraftPickById = async (id: number) => {
  return await database.draftPicks.findUnique({
    where: {
      id
    },
    include: {
      draft: {
        include: {
          league: true
        }
      }
    }
  });
};

export const getDraftPicksByMovieId = async (movieId: number) => {
  return await database.draftPicks.findMany({
    where: {
      movieId
    }
  });
};

export const deleteDraftPickById = async (id: number) => {
  return await database.draftPicks.delete({
    where: {
      id
    }
  });
}; 
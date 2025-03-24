import { Prisma } from '@prisma/client';

import { database } from '..';

export const addDraftPick = async (pick: Prisma.DraftPickCreateInput) => {
  return database.draftPick.create({
    data: pick,
  });
};

export const updateDraftPick = async (id: number, order: number) => {
  return database.draftPick.update({
    where: {
      id,
    },
    data: {
      order,
    },
  });
};

export const getDraftPickById = async (id: number) => {
  return database.draftPick.findUnique({
    where: {
      id,
    },
    include: {
      draft: {
        include: {
          league: true,
        },
      },
    },
  });
};

export const getDraftPicksByMovieId = async (movieId: number) => {
  return database.draftPick.findMany({
    where: {
      movieId,
    },
  });
};

export const deleteDraftPickById = async (id: number) => {
  return database.draftPick.delete({
    where: {
      id,
    },
  });
};

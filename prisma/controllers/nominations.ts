import { Prisma } from '@prisma/client';

import { database } from '..';

export const addNomination = async (
  nomination: Prisma.NominationCreateInput,
) => {
  return database.nomination.create({
    data: nomination,
  });
};

export const deleteNominationById = async (id: number) => {
  return database.nomination.delete({
    where: {
      id,
    },
  });
};

export const getAllNominations = async () => {
  return database.nomination.findMany();
};

export const getWatchlistByYear = async (year: number, userId: number) => {
  return database.nomination.findMany({
    where: {
      year: year.toString() || process.env.NEXT_PUBLIC_ACTIVE_YEAR,
    },
    select: {
      id: true,
      detailName: true,
      award: {
        select: {
          id: true,
          name: true,
          points: true,
          event: {
            select: {
              name: true,
              abbreviation: true,
            },
          },
        },
      },
      movie: {
        select: {
          id: true,
          sortTitle: true,
          title: true,
          watchlists: {
            where: {
              userId,
            },
            select: {
              id: true,
            },
          },
        },
      },
    },
  });
};

export const getWatchlistNomsByYear = async (year: number, userId: number) => {
  return database.nomination.findMany({
    where: {
      year: year.toString() || process.env.NEXT_PUBLIC_ACTIVE_YEAR,
    },
    select: {
      id: true,
      detailName: true,
      movie: {
        select: {
          id: true,
          sortTitle: true,
          title: true,
          watchlists: {
            where: {
              userId,
            },
            select: {
              id: true,
            },
          },
        },
      },
    },
  });
};

export const getNomResults = async (movieIds: number[]) => {
  return database.nomination.findMany({
    where: {
      movieId: {
        in: movieIds,
      },
    },
    select: {
      id: true,
      awardId: true,
      movieId: true,
      year: true,
      movie: {
        select: {
          id: true,
          tmdbId: true,
          sortTitle: true,
          title: true,
        },
      },
      award: {
        select: {
          id: true,
          points: true,
          // pointsData: {
          //   select: {
          //     points: true
          //   }
          // },
          event: {
            select: {
              id: true,
              name: true,
              abbreviation: true,
              awardsDate: true,
            },
          },
          winners: {
            where: {
              movieId: {
                in: movieIds,
              },
            },
            select: {
              id: true,
              awardId: true,
              movieId: true,
            },
          },
        },
      },
    },
  });
};

export const getNomResultsByYear = async (year: number) => {
  return database.nomination.findMany({
    where: {
      year: year.toString(),
    },
    select: {
      id: true,
      awardId: true,
      movieId: true,
      year: true,
      movie: {
        select: {
          id: true,
          tmdbId: true,
          sortTitle: true,
          title: true,
        },
      },
      award: {
        select: {
          id: true,
          points: true,
          // pointsData: {
          //   select: {
          //     points: true
          //   }
          // },
          event: {
            select: {
              id: true,
              name: true,
              abbreviation: true,
              awardsDate: true,
            },
          },
          winners: {
            // where: {
            //   movieId: {
            //     equals: Prisma.sql`Nominations.movieId`
            //   }
            // },
            select: {
              id: true,
              awardId: true,
              movieId: true,
            },
          },
        },
      },
    },
  });
};

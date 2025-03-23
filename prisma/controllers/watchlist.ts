import { Prisma } from "@prisma/client";
import { database } from "..";

const PAGE_SIZE = 40;

export const addToWatchlist = async (movieId: number, userId: number, data: Prisma.WatchlistsCreateInput) => {
  if (!userId) {
    throw new Error('Provide valid params');
  }

  return await database.watchlists.create({
    data: {
      ...data,
      movie: {
        connect: {
          id: movieId
        }
      },
      user: {
        connect: {
          id: userId
        }
      }
    },
  });
};

export const deleteFromWatchlist = async (id: number, userId: number) => {
  if (!userId || !id) {
    throw new Error('Provide valid params');
  }

  return await database.watchlists.delete({
    where: {
      id,
      userId
    }
  });
};

export const getAllWatchlistByTmdbIds = async (tmdbIds: string[], userId: number) => {
  if (!userId) {
    throw new Error('Provide valid params');
  }

  return await database.watchlists.findMany({
    where: {
      movieId: {
        not: null
      },
      movie: {
        tmdbId: {
          in: tmdbIds
        }
      },
      userId
    },
    select: {
      id: true,
      movie: {
        select: {
          tmdbId: true
        }
      }
    }
  });
};

export const getWatchlistByAwards = async (year: number) => {
  if (!year) {
    throw new Error('Provide valid params');
  }

  return await database.watchlists.findMany({
    where: {
      movieId: {
        not: null
      }
    },
    include: {
      movie: {
        select: {
          title: true,
          poster: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
};

export const searchWatchlist = async (
  userId: number,
  page?: number,
  columnName?: string,
  direction: 'asc' | 'desc' = 'desc'
) => {
  if (!userId) {
    throw new Error('Provide valid params');
  }

  const skip = page ? PAGE_SIZE * (page - 1) : undefined;
  const take = page ? PAGE_SIZE : undefined;

  return await database.watchlists.findMany({
    where: {
      userId
    },
    select: {
      id: true,
      createdAt: true,
      movie: {
        select: {
          id: true,
          tmdbId: true,
          sortTitle: true,
          title: true,
          poster: true,
          releaseDate: true,
          reviews: {
            where: {
              userId
            },
            select: {
              id: true
            }
          }
        }
      }
    },
    skip,
    take,
    orderBy: columnName === 'releaseDate' 
      ? {
          movie: {
            releaseDate: direction
          }
        }
      : {
          [columnName || 'createdAt']: direction
        }
  });
}; 
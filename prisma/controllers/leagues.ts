import { Prisma } from '@prisma/client';

import { database } from '..';

export const addLeague = async (
  data: Prisma.LeagueCreateInput & { owner: number[] },
) => {
  return database.league.create({
    data: {
      ...data,
      draftingStatus: 'pending',
    },
  });
};

export const getAllLeagues = async () => {
  return database.league.findMany();
};

export const getLeagueById = async (id: number, year?: number) => {
  return database.league.findUnique({
    where: {
      id,
    },
    include: {
      drafts: {
        where: {
          year: year || Number(process.env.NEXT_PUBLIC_ACTIVE_YEAR),
        },
        include: {
          picks: {
            include: {
              movie: true,
            },
            orderBy: {
              order: 'asc',
            },
          },
          user: {
            select: {
              // displayName: true,
              firstName: true,
              lastName: true,
              uuid: true,
            },
          },
        },
        orderBy: [
          { order: 'asc' },
          // { picks: { order: 'asc' } }
        ],
      },
    },
  });
};

export const getLeagueByIdRaw = async (id: number) => {
  return database.league.findUnique({
    where: {
      id,
    },
  });
};

export const getLeagueByUuid = async (uuid: string, userId: number) => {
  return database.league.findFirst({
    where: {
      uuid,
    },
    include: {
      drafts: {
        where: {
          userId,
        },
      },
    },
  });
};

export const getLeaguesByUserId = async (userId: number) => {
  if (!userId) {
    throw new Error('Provide valid params');
  }

  return database.league.findMany({
    where: {
      drafts: {
        some: {
          userId,
        },
      },
    },
    include: {
      drafts: {
        orderBy: {
          year: 'desc',
        },
      },
    },
  });
};

export const getLeaguesByUser = async (userId: number, year: number) => {
  if (!userId || !year) {
    throw new Error('Provide valid params');
  }

  return database.league.findMany({
    where: {
      drafts: {
        some: {
          userId,
        },
      },
    },
    include: {
      drafts: {
        where: {
          userId,
          year,
        },
      },
    },
  });
};

export const updateLeague = async (
  id: number,
  data: Prisma.LeagueUpdateInput,
) => {
  return database.league.update({
    where: {
      id,
    },
    data,
  });
};

export const updateLeagueStatus = async (
  id: number,
  draftingStatus: Prisma.LeagueUpdateInput['draftingStatus'],
) => {
  return database.league.update({
    where: {
      id,
    },
    data: {
      draftingStatus,
    },
  });
};

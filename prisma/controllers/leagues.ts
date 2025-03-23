import { Prisma } from "@prisma/client";
import { database } from "..";

export const addLeague = async (data: Prisma.LeaguesCreateInput & { owner: number[] }) => {
  return await database.leagues.create({
    data: {
      ...data,
      draftingStatus: 'pending'
    }
  });
};

export const getAllLeagues = async () => {
  return await database.leagues.findMany();
};

export const getLeagueById = async (id: number, year?: number) => {
  return await database.leagues.findUnique({
    where: {
      id
    },
    include: {
      drafts: {
        where: {
          year: year || Number(process.env.NEXT_PUBLIC_ACTIVE_YEAR)
        },
        include: {
          picks: {
            include: {
              movie: true
            },
            orderBy: {
              order: 'asc'
            }
          },
          user: {
            select: {
              // displayName: true,
              firstName: true,
              lastName: true,
              uuid: true
            }
          }
        },
        orderBy: [
          { order: 'asc' },
          // { picks: { order: 'asc' } }
        ]
      }
    }
  });
};

export const getLeagueByIdRaw = async (id: number) => {
  return await database.leagues.findUnique({
    where: {
      id
    }
  });
};

export const getLeagueByUuid = async (uuid: string, userId: number) => {
  return await database.leagues.findFirst({
    where: {
      uuid
    },
    include: {
      drafts: {
        where: {
          userId
        }
      }
    }
  });
};

export const getLeaguesByUserId = async (userId: number) => {
  if (!userId) {
    throw new Error('Provide valid params');
  }

  return await database.leagues.findMany({
    where: {
      drafts: {
        some: {
          userId
        }
      }
    },
    include: {
      drafts: {
        orderBy: {
          year: 'desc'
        }
      }
    }
  });
};

export const getLeaguesByUser = async (userId: number, year: number) => {
  if (!userId || !year) {
    throw new Error('Provide valid params');
  }

  return await database.leagues.findMany({
    where: {
      drafts: {
        some: {
          userId
        }
      }
    },
    include: {
      drafts: {
        where: {
          userId,
          year
        }
      }
    }
  });
};

export const updateLeague = async (id: number, data: Prisma.LeaguesUpdateInput) => {
  return await database.leagues.update({
    where: {
      id
    },
    data
  });
};

export const updateLeagueStatus = async (id: number, draftingStatus: Prisma.LeaguesUpdateInput['draftingStatus']) => {
  return await database.leagues.update({
    where: {
      id
    },
    data: {
      draftingStatus
    }
  });
}; 
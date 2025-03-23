import { Prisma } from "@prisma/client";
import { database } from "..";

export const addDraft = async (data: Prisma.DraftsCreateInput) => {
  return await database.drafts.create({
    data
  });
};

export const updateDraft = async (id: number, data: Prisma.DraftsUpdateInput) => {
  return await database.drafts.update({
    where: {
      id
    },
    data
  });
};

export const deleteDraftById = async (id: number) => {
  return await database.drafts.delete({
    where: {
      id
    }
  });
};

export const getDraftById = async (id: number) => {
  return await database.drafts.findUnique({
    where: {
      id
    },
    include: {
      picks: true
    }
  });
};

export const getDraftByIdExtended = async (id: number) => {
  return await database.drafts.findUnique({
    where: {
      id
    },
    select: {
      id: true,
      leagueId: true,
      year: true,
      group: true,
      order: true,
      picks: {
        include: {
          movie: true
        }
      }
    }
  });
};

export const getDraftsByYear = async (leagueId: number, year: number) => {
  return await database.drafts.findMany({
    where: {
      leagueId,
      year
    },
    include: {
      picks: {
        include: {
          movie: {
            select: {
              id: true,
              sortTitle: true,
              title: true,
              poster: true,
              tmdbId: true
            }
          }
        }
      },
      user: {
        select: {
          firstName: true,
          lastName: true,
          image: true,
          // displayName: true,
          uuid: true
        }
      }
    },
    orderBy: [
      { group: 'asc' },
      { order: 'asc' },
      // { picks: { order: 'asc' } }
    ]
  });
};

export const getDraftsByUser = async (userId: number) => {
  if (!userId) {
    throw new Error('Provide valid params');
  }

  return await database.drafts.findMany({
    where: {
      userId
    },
    include: {
      league: true
    },
    orderBy: {
      year: 'desc'
    }
  });
};

export const getDraftsByLeagueId = async (leagueId: number) => {
  return await database.drafts.findMany({
    where: {
      leagueId
    },
    include: {
      league: true
    },
    orderBy: {
      year: 'desc'
    }
  });
};

export const getUsersByLeagueId = async (leagueId: number) => {
  return await database.drafts.findMany({
    where: {
      leagueId
    },
    select: {
      userId: true
    }
  });
};

export const getDraftsByLeagueIds = async (leagueIds: number[], year: number, userId: number) => {
  return await database.drafts.findMany({
    where: {
      leagueId: {
        in: leagueIds
      },
      year
    },
    select: {
      leagueId: true,
      year: true,
      league: {
        select: {
          name: true
        }
      },
      picks: {
        select: {
          id: true,
          movieId: true,
          movie: {
            select: {
              id: true,
              sortTitle: true,
              title: true,
              poster: true,
              watchlists: {
                where: {
                  userId
                },
                select: {
                  id: true
                }
              }
            }
          }
        }
      }
    }
  });
}; 
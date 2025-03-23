import { Prisma } from "@prisma/client";
import { database } from "..";

const getEventConfig = (abbreviation: string | null, year: number): Prisma.EventsFindManyArgs => {
  const where = abbreviation ? { abbreviation } : {};
  
  return {
    where,
    include: {
      awards: {
        include: {
          // pointsData: {
          //   select: {
          //     points: true
          //   }
          // },
          nominations: {
            where: {
              year: year.toString()
            },
            include: {
              movie: true
            }
          },
          winners: {
            where: {
              year
            }
          }
        }
      }
    }
  };
};

export const getAllEvents = async () => {
  return await database.events.findMany({
    orderBy: {
      name: 'asc'
    },
    ...getEventConfig(null, Number(process.env.NEXT_PUBLIC_ACTIVE_YEAR))
  });
};

export const getLiveEvent = async () => {
  return await database.events.findFirst({
    where: {
      OR: [
        { nomActive: true },
        { awardsActive: true }
      ]
    }
  });
};

export const updateEventByAbbr = async (abbreviation: string, data: Prisma.EventsUpdateInput) => {
  return await database.events.updateMany({
    where: {
      abbreviation
    },
    data
  });
};

export const resetActiveEvents = async () => {
  return await database.events.updateMany({
    where: {
      OR: [
        { nomActive: true },
        { awardsActive: true }
      ]
    },
    data: {
      nomActive: false,
      awardsActive: false
    }
  });
};

export const getEventByAbbr = async (abbreviation: string) => {
  return await database.events.findFirst(
    getEventConfig(abbreviation, Number(process.env.NEXT_PUBLIC_ACTIVE_YEAR))
  );
};

export const getEventByAbbrAndYear = async (abbreviation: string, year: number) => {
  return await database.events.findFirst(
    getEventConfig(abbreviation, year)
  );
}; 
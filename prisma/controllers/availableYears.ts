// server/controllers/availableYears.js
import { Prisma } from '@prisma/client';

import { database } from '..';

export const getAllAvailableYears = async () => {
  const years = await database.availableYear.findMany({
    orderBy: { year: 'desc' },
  });
  return years.map((item) => item.year);
};

export const addAvailableYear = async (
  body: Prisma.AvailableYearCreateInput,
) => {
  return database.availableYear.create({
    data: body,
  });
};

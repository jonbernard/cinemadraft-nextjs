// server/controllers/availableYears.js

import { Prisma } from "@prisma/client";
import { database } from "..";

export const getAllAvailableYears = async () => {
  const years = await database.availableYears.findMany({
    orderBy: { year: "desc" },
  });
  return years.map((item) => item.year);
};

export const addAvailableYear = async (body: Prisma.AvailableYearsCreateInput) => {
  return await database.availableYears.create({
    data: body,
  });
}

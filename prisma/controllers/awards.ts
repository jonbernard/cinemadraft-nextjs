import { database } from '..';

export const getAllAwards = async () => {
  return database.award.findMany();
};

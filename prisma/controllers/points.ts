import { database } from '..';

export const getAllPoints = async () => {
  return database.point.findMany();
};

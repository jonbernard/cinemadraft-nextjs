
import { database } from "..";

export const getAllPoints = async () => {
  return await database.points.findMany();
}; 
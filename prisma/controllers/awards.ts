
import { database } from "..";

export const getAllAwards = async () => {
  return await database.awards.findMany();
}; 
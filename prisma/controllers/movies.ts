import { Prisma } from "@prisma/client";
import { database } from "..";

export const getAllMovies = async () => {
  return await database.movies.findMany();
};

export const addMovie = async (body: Prisma.MoviesCreateInput) => {
  return await database.movies.create({
    data: body
  });
};

export const getMovieByTmdbId = async (tmdbId: string | number) => {
  const stringTmdbId = typeof tmdbId === 'number' ? tmdbId.toString() : tmdbId;
  
  return await database.movies.findFirst({
    where: {
      tmdbId: stringTmdbId
    }
  });
};

export const updateMovie = async (id: string | number, data: Prisma.MoviesUpdateInput) => {
  const tmdbId = typeof id === 'number' ? id.toString() : id;
  
  return await database.movies.updateMany({
    where: {
      tmdbId
    },
    data
  });
}; 
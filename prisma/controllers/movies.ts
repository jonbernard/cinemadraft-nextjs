import { Prisma } from '@prisma/client';

import { database } from '..';

export const getAllMovies = async () => {
  return database.movie.findMany();
};

export const addMovie = async (body: Prisma.MovieCreateInput) => {
  return database.movie.create({
    data: body,
  });
};

export const getMovieByTmdbId = async (tmdbId: string | number) => {
  const stringTmdbId = typeof tmdbId === 'number' ? tmdbId.toString() : tmdbId;

  return database.movie.findFirst({
    where: {
      tmdbId: stringTmdbId,
    },
  });
};

export const updateMovie = async (
  id: string | number,
  data: Prisma.MovieUpdateInput,
) => {
  const tmdbId = typeof id === 'number' ? id.toString() : id;

  return database.movie.updateMany({
    where: {
      tmdbId,
    },
    data,
  });
};

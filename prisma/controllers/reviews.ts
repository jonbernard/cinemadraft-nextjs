
import { Prisma } from "@prisma/client";
import { database } from "..";

export const addReview = async (movieId: number, userId: number, data: Prisma.ReviewsCreateInput) => {
  if (!userId || !movieId) {
    throw new Error('Provide valid params');
  }

  return await database.reviews.create({
    data: {
      ...data,
      movie: {
        connect: {
          id: movieId,
        }
      },
      user: {
        connect: {
          id: userId,
        }
      }
    },
    include: {
      movie: true
    }
  });
};

export const getReviewById = async (id: number, userId: number) => {
  if (!userId || !id) {
    throw new Error('Provide valid params');
  }

  return await database.reviews.findFirst({
    where: {
      id
    },
    include: {
      movie: true
    }
  });
};

export const getReviewByTmdbId = async (movieId: number, userId: number) => {
  if (!userId || !movieId) {
    throw new Error('Provide valid params');
  }

  return await database.reviews.findFirst({
    where: {
      movieId
    },
    include: {
      movie: true
    }
  });
}; 
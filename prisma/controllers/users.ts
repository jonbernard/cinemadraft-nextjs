import { Prisma } from "@prisma/client";
import { database } from "..";
import moment from "moment";

export const createUser = async (data: Prisma.UsersCreateInput) => {
  return await database.users.upsert({
    where: {
      email: data.email
    },
    create: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      image: data.image,
      provider: 'auth0',
      providerId: data.providerId,
      uuid: data.uuid,
      lastLogin: moment().format()
    },
    update: {
      firstName: data.firstName,
      lastName: data.lastName,
      image: data.image,
      lastLogin: moment().format()
    }
  });
};

export const getUser = async (providerId: string) => {
  return await database.users.findFirst({
    where: {
      providerId
    }
  });
};

export const getUserByEmail = async (email: string) => {
  return await database.users.findUnique({
    where: {
      email
    }
  });
};

export const getUsersByIds = async (ids: number[]) => {
  return await database.users.findMany({
    where: {
      id: {
        in: ids
      }
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      image: true,
      // displayName: true,
      uuid: true
    }
  });
};

export const getPublicUserByUuid = async (uuid: string) => {
  return await database.users.findUnique({
    where: {
      uuid
    },
    select: {
      firstName: true,
      lastName: true,
      image: true,
      // displayName: true,
      uuid: true
    }
  });
};

export const updateUserImage = async (id: number, image: string) => {
  return await database.users.update({
    where: {
      id
    },
    data: {
      image
    }
  });
};

export const updateUserLastLogin = async (id: number) => {
  if (!id) {
    throw new Error('Provide valid params');
  }

  return await database.users.update({
    where: {
      id
    },
    data: {
      lastLogin: moment().format()
    }
  });
};

export const getAllUsers = async () => {
  return await database.users.findMany();
};

export const getUserDrafts = async (id: number) => {
  if (!id) {
    throw new Error('Provide valid params');
  }

  return await database.users.findUnique({
    where: {
      id
    },
    include: {
      drafts: {
        include: {
          league: true
        }
      }
    }
  });
}; 
import { Prisma } from "@prisma/client";
import { database } from "..";
import moment from "moment";

interface CreateUserInput {
  values: {
    firstName: string;
    lastName: string;
    uuid: string;
  };
  auth0: {
    email: string;
    picture: string;
    sub: string;
  };
}

export const createUser = async (data: CreateUserInput) => {
  return await database.users.upsert({
    where: {
      email: data.auth0.email
    },
    create: {
      firstName: data.values.firstName,
      lastName: data.values.lastName,
      email: data.auth0.email,
      image: data.auth0.picture,
      provider: 'auth0',
      providerId: data.auth0.sub,
      uuid: data.values.uuid,
      lastLogin: moment().format()
    },
    update: {
      firstName: data.values.firstName,
      lastName: data.values.lastName,
      image: data.auth0.picture,
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
import { Prisma } from "@prisma/client";
import { database } from "..";

export const getAllUsers = async () => {
  return await database.users.findMany();
};

export const getUserById = async (id: number) => {
  return await database.users.findUnique({
    where: { id }
  });
};

export const createUser = async (body: Prisma.UsersCreateInput) => {
  return await database.users.create({
    data: body
  });
};

export const updateUser = async (id: number, data: Prisma.UsersUpdateInput) => {
  return await database.users.update({
    where: { id },
    data
  });
};

export const deleteUser = async (id: number) => {
  return await database.users.delete({
    where: { id }
  });
}; 
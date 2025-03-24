import { PrismaAdapter } from '@auth/prisma-adapter';
import NextAuth from 'next-auth';
import Sendgrid from 'next-auth/providers/sendgrid';

import { database } from '../prisma';

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(database),
  providers: [
    Sendgrid({
      from: 'email@cinemadraft.com',
    }),
  ],
});

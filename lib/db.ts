import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

/**
 * The driver adapter is chosen by connection target, not by environment name
 * (D32).
 *
 * `@neondatabase/serverless` speaks Neon's WebSocket/HTTP protocol rather than
 * the Postgres wire protocol, so it cannot connect to a plain Postgres server
 * at all — including the Docker container used for local development and every
 * test. Keying off the hostname rather than NODE_ENV means a developer pointing
 * at Neon, or a test accidentally pointing at Docker, still gets a working
 * client instead of an opaque driver error.
 */
const isNeon = /\.neon\.tech/.test(connectionString);

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * The adapter is constructed lazily inside the singleton guard rather than
 * beside it. Prisma's own example builds one per module evaluation, which
 * leaks a connection pool on every hot reload in development.
 */
function createClient(): PrismaClient {
  const adapter = isNeon
    ? new PrismaNeon({ connectionString })
    : new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

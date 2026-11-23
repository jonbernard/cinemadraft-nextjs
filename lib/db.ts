import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';
import { DB_TAG, dbCacheEnabled, expireCached } from '@/lib/external/cache';

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

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof withCachePurge>;
  prismaBase?: PrismaClient;
};

/**
 * The adapter is constructed lazily inside the singleton guard rather than
 * beside it. Prisma's own example builds one per module evaluation, which
 * leaks a connection pool on every hot reload in development.
 */
/**
 * Under test, the client emits a `query` event so a test can count round
 * trips (`test/query-count.ts`).
 *
 * 🔴 It has to be *this* client, not a throwaway one. The first version of the
 * query-count guard constructed its own client and passed it to the callback —
 * but every service imports `db` directly and ignored it, so the counter saw
 * zero queries and the page-level assertions passed while measuring nothing.
 * A guard that cannot fail is worse than no guard, because it is believed.
 *
 * Enabled only under Vitest so production pays nothing, not even the cost of
 * emitting events nobody listens to.
 */
const isTest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

function createClient(): PrismaClient {
  const adapter = isNeon
    ? new PrismaNeon({ connectionString })
    : new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    ...(isTest ? { log: [{ emit: 'event' as const, level: 'query' as const }] } : {}),
  });
}

/** Every operation that changes a row. Anything else is a read. */
const WRITES = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
  '$executeRaw',
  '$executeRawUnsafe',
]);

/**
 * Expire the public-read cache (`cachedFromDb`) after every write.
 *
 * 🔴 **One choke point, not one call per action.** Every write in the app —
 * 38 server actions, the Clerk webhook, the route handlers — goes through this
 * client, so purging here cannot be forgotten by the next action somebody
 * adds. The award-import script writes through a client of its own and purges
 * through `/api/revalidate` instead.
 *
 * After the write resolves, so a reader that misses cannot refill the cache
 * from the row as it was before.
 *
 * ponytail: inside an interactive or batch `$transaction` (available-years,
 * drafts, draft-picks, winners) "resolved" is before COMMIT, so a public read
 * landing in that gap can cache the pre-transaction row until the next write
 * or the hour's TTL. Upgrade path: purge again after those `$transaction`
 * calls return, if a stale public page is ever seen.
 */
function withCachePurge(base: PrismaClient) {
  return base.$extends({
    query: {
      async $allOperations({ operation, args, query }) {
        const result = await query(args);
        if (WRITES.has(operation) && dbCacheEnabled()) await expireCached(DB_TAG);
        return result;
      },
    },
  });
}

const base = globalForPrisma.prismaBase ?? createClient();

export const db = globalForPrisma.prisma ?? withCachePurge(base);

/**
 * The unextended client, for `test/query-count.ts` only: an extended client
 * has no `$on`. It shares `db`'s engine, so it sees every query `db` makes.
 */
export const dbQueryEvents = base;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaBase = base;
  globalForPrisma.prisma = db;
}

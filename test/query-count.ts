import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';

/**
 * Count the queries a piece of work issues.
 *
 * 🔴 **The guard that makes "compute scores on read" safe (D59).**
 *
 * Scores are not materialized, and measurement says that is fine: a full
 * league board costs 8 ms, and scoring all 1,355 films at once costs 14 ms.
 * But those numbers hold for one reason — every score read is **batched**.
 * The cost is round trips, not arithmetic:
 *
 *   1 film     2.3 ms
 *   123 films  5.6 ms
 *   1355 films 14.2 ms
 *
 * So the failure mode is not volume, it is an **N+1**. A page that scores one
 * film at a time turns a 5 ms season leaderboard into 123 round trips, and
 * nothing about the code would look wrong — it would simply be slow, on a page
 * nobody profiles until a member complains during a ceremony.
 *
 * A timing assertion cannot catch that: 280 ms passes a "is it under a second"
 * test on a developer's machine and falls over on a cold Neon connection.
 * Counting queries catches it exactly, and states the intent — *this work is
 * batched* — in a way a duration never can.
 *
 * Uses its own client, because the event hook has to be attached at
 * construction and the shared singleton is deliberately built without logging.
 */
export async function countQueries<T>(
  work: (client: PrismaClient) => Promise<T>,
): Promise<{ result: T; queries: number }> {
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }),
    log: [{ emit: 'event', level: 'query' }],
  });

  let queries = 0;
  // The generated client types `$on` per log level; the event payload is not
  // needed here, only the fact of it.
  (client as unknown as { $on: (e: 'query', cb: () => void) => void }).$on(
    'query',
    () => {
      queries += 1;
    },
  );

  try {
    const result = await work(client);
    // Query events are emitted asynchronously, so a count read immediately
    // after the last await can miss the final one.
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { result, queries };
  } finally {
    await client.$disconnect();
  }
}

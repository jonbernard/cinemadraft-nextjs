import { db } from '@/lib/db';

/**
 * Count the database round trips a piece of work makes.
 *
 * 🔴 **The guard that makes "compute scores on read" safe (D59).**
 *
 * Scores are not materialized, and measurement says that is fine: a full
 * league board costs ~8 ms, and scoring all 1,355 films at once costs 14 ms.
 * Those numbers hold for one reason — every score read is **batched**. The
 * cost is round trips, not arithmetic:
 *
 *   1 film     2.3 ms
 *   123 films  5.6 ms
 *   1355 films 14.2 ms
 *
 * So the failure mode is not volume, it is an **N+1**. A page that scores one
 * film at a time turns a 5 ms leaderboard into 123 round trips, and nothing
 * about the code looks wrong — it is simply slow, on a page nobody profiles
 * until a member complains during a ceremony.
 *
 * A timing assertion cannot catch that: 280 ms passes "is it under a second"
 * on a developer's laptop and falls over on a cold Neon connection. Counting
 * queries catches it exactly, and states the intent — *this work is batched* —
 * in a way a duration never can.
 *
 * 🔴 **It listens to the shared `db` singleton, deliberately.** The first
 * version built its own client and handed it to the callback; every service
 * imports `db` directly and ignored it, so the counter observed **zero**
 * queries and the page-level assertions passed while measuring nothing at all.
 * `lib/db.ts` enables query events under Vitest for this reason.
 */
export async function countQueries<T>(work: () => Promise<T>): Promise<{
  result: T;
  queries: number;
}> {
  let queries = 0;
  const onQuery = () => {
    queries += 1;
  };

  // The generated client types `$on` per log level; only the fact of the event
  // is needed here, not its payload.
  const emitter = db as unknown as {
    $on: (event: 'query', cb: () => void) => void;
  };
  emitter.$on('query', onQuery);

  const result = await work();
  // Query events are emitted asynchronously, so a count read immediately after
  // the last await can miss the final one.
  await new Promise((resolve) => setTimeout(resolve, 50));

  return { result, queries };
}

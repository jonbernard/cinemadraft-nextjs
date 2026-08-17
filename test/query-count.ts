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
/**
 * 🔴 One listener for the whole file, not one per call.
 *
 * Prisma's `$on` has no counterpart to remove a subscriber, so the obvious
 * shape — subscribe on entry, count, return — leaks a listener per call and
 * Node warns at eleven: *"Possible EventEmitter memory leak detected. 11 query
 * listeners added"*. That surfaced as soon as this file's ninth surface was
 * pinned, and it gets worse with every page Phase 10 adds.
 *
 * So the subscription happens once and every measurement shares it, with the
 * counter switched on and off around the work. It also means a stray query from
 * elsewhere cannot be attributed to a caller that is not currently measuring.
 */
let counting: { queries: number } | null = null;
let subscribed = false;

function subscribeOnce(): void {
  if (subscribed) return;
  subscribed = true;
  // The generated client types `$on` per log level; only the fact of the event
  // is needed here, not its payload.
  const emitter = db as unknown as {
    $on: (event: 'query', cb: () => void) => void;
  };
  emitter.$on('query', () => {
    if (counting) counting.queries += 1;
  });
}

export async function countQueries<T>(work: () => Promise<T>): Promise<{
  result: T;
  queries: number;
}> {
  subscribeOnce();

  // Nesting would make the inner call's queries vanish from the outer count,
  // and the outer assertion would silently measure less than it claims to.
  if (counting) throw new Error('countQueries cannot be nested');

  const active = { queries: 0 };
  counting = active;
  try {
    const result = await work();
    // Query events are emitted asynchronously, so a count read immediately
    // after the last await can miss the final one.
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { result, queries: active.queries };
  } finally {
    counting = null;
  }
}

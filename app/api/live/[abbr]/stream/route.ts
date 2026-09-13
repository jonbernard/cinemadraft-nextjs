import type { NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import { getLiveShow, pinnedLeague } from '@/lib/services/live';
import { getActiveYear } from '@/lib/services/season';

/**
 * The live show as a Server-Sent Events stream (P14.T3, D102).
 *
 * 🔴 **Every event's `data` is the complete `LiveShowView`, never a delta** —
 * the first frame of a connection and every frame after it. That single rule is
 * the whole reconnection story. Vercel kills a function at 300s, so a
 * three-hour ceremony is ~36 forced disconnects per viewer; a *delta* announced
 * inside one of those gaps would be lost forever, while a full frame makes the
 * gap unmissable. It is also why no broker is needed: there is nothing to
 * replay and nothing to merge.
 *
 * 🔴 **The stream is exactly as generous as the page and no more.** It calls
 * `getCurrentUser()` and `getLiveShow()` with the same four arguments
 * `app/(app)/live/[abbr]/page.tsx` passes, off the same `?year=` and `?league=`
 * — `pinnedLeague` is imported from the service rather than re-typed, so the
 * two doors cannot drift. A signed-out reader with no pin therefore gets
 * `league: null` and `leagueOptions: []`, which is what keeps sixty people's
 * seat names off a URL a stranger was handed; a signed-out reader *with* a pin
 * gets that league, because `/leagues/[id]` is public (D44/D45) and shows them
 * strictly more. `route.test.ts` pins both directions.
 *
 * ponytail: polls Postgres every 2s; the DB is the bus. ~20 viewers, ~1 event
 * per 4 minutes. Swap the sleep for a pub/sub await if concurrent viewers pass
 * ~200 — the full-state-on-connect contract already covers the reconnect gap.
 */

/** The default already, and stated because the spec forbids the alternative: a stream must not run on `edge`. */
export const runtime = 'nodejs';

/**
 * The platform ceiling, declared rather than inherited. The 290s self-close
 * below is only graceful if the function is actually allowed to live to 290s.
 */
export const maxDuration = 300;

/** Two seconds is a latency decision, not a cost one — the compute is awake either way. */
const POLL_MS = 2_000;

/**
 * Ten quiet polls — 20s — then an SSE comment, so an idle connection is not
 * dropped by an intermediary that sees no bytes. A comment, not an event: a
 * client parses it as nothing at all, which is the point.
 */
const HEARTBEAT_BEATS = 10;

/**
 * 🔴 Ten seconds short of `maxDuration`. Closing ourselves means the client
 * sees a clean end and `EventSource` reconnects on its own; being killed means
 * a truncated frame mid-write.
 */
const LIFETIME_MS = 290_000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ abbr: string }> },
) {
  const { abbr } = await params;
  const { searchParams } = request.nextUrl;

  // The same `?year=` idiom as the page and the five other season-scoped
  // routes: a safe positive integer, or the active season.
  const requested = Number(searchParams.get('year'));
  const year =
    Number.isSafeInteger(requested) && requested > 0 ? requested : await getActiveYear();

  // 🔴 `getCurrentUser()`, not Clerk's `auth()`, which throws when
  // `clerkMiddleware` is absent — and under `E2E_TEST_AUTH` it is (D82/D84).
  // Resolved once per connection, like the page resolves it once per render.
  const user = await getCurrentUser();
  const league = pinnedLeague(searchParams.get('league'));
  const read = () => getLiveShow(abbr, year, user?.id ?? null, league);

  let view: Awaited<ReturnType<typeof getLiveShow>>;
  try {
    view = await read();
  } catch (error) {
    // A show that does not exist is a 404 once, not a connection that retries
    // forever: `EventSource` gives up on any non-200.
    if (error instanceof NotFoundError) return new Response('not found', { status: 404 });
    throw error;
  }

  /**
   * 🔴 Off air, no stream — and this is the free-tier guard, not politeness.
   * Neon bills awake-time, so one forgotten monitor left on a finished show
   * reconnecting every 290s spends 180 CU-hrs against a 100 CU-hr allowance and
   * exhausts the tier by itself. 204 rather than an empty stream because
   * `EventSource` *fails* a connection whose status is not 200 and does not
   * retry, which is the only way a server can say "stop asking".
   */
  if (!view.onAir) return new Response(null, { status: 204 });

  const encoder = new TextEncoder();
  let sent = JSON.stringify(view);

  // Assigned by `start` and called by `cancel`. A consumer that cancels the
  // stream without aborting the request would otherwise leave the interval
  // running, which is the leak that costs money one abandoned tab at a time.
  let dispose: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      let quiet = 0;
      let poll: ReturnType<typeof setInterval>;
      let life: ReturnType<typeof setTimeout>;

      const write = (chunk: string) => {
        if (!open) return;
        controller.enqueue(encoder.encode(chunk));
      };

      const stop = () => {
        if (!open) return;
        open = false;
        clearInterval(poll);
        clearTimeout(life);
        request.signal.removeEventListener('abort', stop);
        try {
          controller.close();
        } catch {
          // Already closed or errored by the platform. Nothing left to do, and
          // throwing out of a teardown would skip the timers above.
        }
      };
      dispose = stop;

      // The first frame, before any poll: a reconnecting client is correct
      // immediately rather than up to two seconds later.
      write(`data: ${sent}\n\n`);

      poll = setInterval(async () => {
        let next: string;
        try {
          next = JSON.stringify(await read());
        } catch {
          // Neon briefly unreachable is a skipped beat, not an error path: the
          // client keeps showing its last good state (`lib/external/cache.ts`
          // takes the same posture).
          return;
        }
        if (!open) return;
        if (next !== sent) {
          sent = next;
          quiet = 0;
          write(`data: ${next}\n\n`);
          return;
        }
        if (++quiet >= HEARTBEAT_BEATS) {
          quiet = 0;
          write(':\n\n');
        }
      }, POLL_MS);

      life = setTimeout(stop, LIFETIME_MS);
      request.signal.addEventListener('abort', stop);
      // A client that gave up while `getLiveShow` was still reading would
      // otherwise never fire the listener we just attached.
      if (request.signal.aborted) stop();
    },
    cancel() {
      dispose?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      // `no-transform` as well as `no-store`: a proxy that "optimises" the body
      // buffers it, and a buffered stream is not a stream.
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

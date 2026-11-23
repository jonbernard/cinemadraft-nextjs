import type { NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import { getActiveYear } from '@/lib/services/season';
import { getStandingsView } from '@/lib/services/season-ledger';

/**
 * The standings tab as a Server-Sent Events stream, while a ceremony is being
 * entered (P16.T20, D135).
 *
 * 🔴 **A third copy of the D110 route, on purpose.** Copied verbatim from
 * `app/api/leagues/[id]/board/stream/route.ts` — read that file and
 * `app/api/live/[abbr]/stream/route.ts` for the transport's reasoning — with
 * two changes and no others: the frame is `getStandingsView` (the page's own
 * assembly, so the stream is exactly as generous as the page, D110), and the
 * 204 gate is D135's. A shared helper would be a refactor with its own risk.
 *
 * 🔴 **Only while a show is on air, in the active season (D135).** The board
 * stream answers 204 during a ceremony (D116) and must not be widened; this
 * one answers 204 at every other time, which is the months between ceremonies
 * that D116 refused to hold a connection open for.
 */

/** The default already, and stated because the spec forbids the alternative: a stream must not run on `edge`. */
export const runtime = 'nodejs';

/**
 * The platform ceiling, declared rather than inherited — the self-close below
 * is only graceful if the function is actually allowed to live that long.
 *
 * 🔴 **60, because the ceiling is per-plan and Hobby's is 60 seconds.**
 * This said 300 until Vercel refused the deployment outright: "Serverless
 * Functions must have a maxDuration between 1 and 60 for plan hobby". The 300s
 * figure is the Pro/Enterprise default and is what the transport spec and D102
 * were sized against; it is wrong here, and it failed at deploy rather than at
 * build, test or review, because no local check knows what plan the project is
 * on. Raising this above 60 requires a paid plan, not an edit.
 */
export const maxDuration = 60;

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
 *
 * At Hobby's 60s ceiling that is a reconnect roughly every 53s (50s here plus
 * the browser's 3s retry) rather than every 293s. The cost of that is a
 * handshake, not a stall: every frame is complete state (D110), so the gap is
 * invisible to a reader and there is nothing to replay.
 */
const LIFETIME_MS = 50_000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const leagueId = Number(id);
  // Validated, not trusted, and not handed to the database as NaN.
  if (!Number.isSafeInteger(leagueId) || leagueId <= 0) {
    return new Response('not found', { status: 404 });
  }

  const { searchParams } = request.nextUrl;

  // The same `?year=` idiom as the page and the five other season-scoped
  // routes: a safe positive integer, or the active season.
  const requested = Number(searchParams.get('year'));
  const activeYear = await getActiveYear();
  const year = Number.isSafeInteger(requested) && requested > 0 ? requested : activeYear;

  // 🔴 D135's first half, before any board is read: only the site's active
  // season is ever on air. A past season's page opens nothing, and costs one
  // query to say so. 204, not an empty stream, because `EventSource` retries
  // a closed 200 forever (D110).
  if (year !== activeYear) return new Response(null, { status: 204 });

  // 🔴 `getCurrentUser()`, not Clerk's `auth()`, which throws when
  // `clerkMiddleware` is absent — and under `E2E_TEST_AUTH` it is (D82/D84).
  // Resolved once per connection, like the page resolves it once per render.
  const user = await getCurrentUser();
  const read = () => getStandingsView(leagueId, year, user?.id ?? null);

  let view: Awaited<ReturnType<typeof getStandingsView>>;
  try {
    view = await read();
  } catch (error) {
    // A league that does not exist is a 404 once, not a connection that retries
    // forever: `EventSource` gives up on any non-200.
    if (error instanceof NotFoundError) return new Response('not found', { status: 404 });
    throw error;
  }

  // 🔴 D135's second half: a show of this season is being entered. Each half
  // has its own test (D116's lesson). `onAir` also implies the first — a past
  // season's ceremony is never `live` (P16.T13) — and the route does not rely
  // on the service for it.
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
        } catch (error) {
          // Neon briefly unreachable is a skipped beat, not a closed stream:
          // the client keeps showing its last good state (`lib/external/cache.ts`
          // takes the same posture). 🔴 But it is logged — a poll that fails is
          // a real fault, and swallowing it silently meant an outage mid-
          // ceremony left nothing in the log but viewers on a frozen frame.
          console.error('[standings stream] poll failed; keeping the last frame', error);
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
      // A client that gave up while `getStandingsView` was still reading would
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

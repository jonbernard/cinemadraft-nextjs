import type { NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import { getLeagueBoardView } from '@/lib/services/league-view';
import { getActiveYear } from '@/lib/services/season';

/**
 * The league board as a Server-Sent Events stream (P14.T10, D48/D102).
 *
 * The same transport as `app/api/live/[abbr]/stream/route.ts`, one door
 * further in — D48's second surface. Read that file for the transport's
 * reasoning; everything below is copied from it deliberately.
 *
 * 🔴 **Every event's `data` is the complete `LeagueBoardView`, never a delta**
 * — the first frame of a connection and every frame after it. That single rule
 * is the whole reconnection story. Vercel kills a function at this plan's
 * ceiling — 60s on Hobby — so a two-hour draft is ~140 forced disconnects per
 * viewer; a *delta* announced inside one of those gaps would be lost forever,
 * while a full frame makes the gap unmissable. It is also why no broker is
 * needed: there is nothing to replay and nothing to merge.
 *
 * 🔴 **The stream is exactly as generous as the page and no more.** It calls
 * `getCurrentUser()` and `getLeagueBoardView()` with the same three arguments
 * `app/(app)/leagues/[id]/page.tsx` passes — the derivation itself lives in the
 * service rather than in either door, so the two cannot drift. A signed-out
 * reader therefore gets `viewerSeatId: null`, `viewerRoster: []`,
 * `viewerSeated: false` and no `isViewer` row, which is precisely what the
 * public page gives them. `route.test.ts` pins both directions.
 *
 * ponytail: the frame is the whole board including every pick's ledger — around
 * 100KB for a sixteen-seat league. Fine for a league-sized audience at one
 * write per pick; if a ceremony-sized audience ever reads a board, diff on a
 * cheap digest before serialising.
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
  const year =
    Number.isSafeInteger(requested) && requested > 0 ? requested : await getActiveYear();

  // 🔴 `getCurrentUser()`, not Clerk's `auth()`, which throws when
  // `clerkMiddleware` is absent — and under `E2E_TEST_AUTH` it is (D82/D84).
  // Resolved once per connection, like the page resolves it once per render.
  const user = await getCurrentUser();
  const read = () => getLeagueBoardView(leagueId, year, user?.id ?? null);

  let view: Awaited<ReturnType<typeof getLeagueBoardView>>;
  try {
    view = await read();
  } catch (error) {
    // A league that does not exist is a 404 once, not a connection that retries
    // forever: `EventSource` gives up on any non-200.
    if (error instanceof NotFoundError) return new Response('not found', { status: 404 });
    throw error;
  }

  /**
   * 🔴 Only while the draft is running. A league is `active` for an hour or two
   * a season; every other state answers 204 and holds nothing. The parity row is
   * "live board updates while the draft runs" (PARITY.md:136), and widening it
   * to a finished season would hold a connection open for months of a forgotten
   * tab against a 100 CU-hr allowance, to move numbers that already move on
   * reload. 204 rather than an empty stream because `EventSource` retries a
   * closed 200 forever and stops only on a non-200 (D110).
   */
  if (!view.isDrafting) return new Response(null, { status: 204 });

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
      // A client that gave up while `getLeagueBoardView` was still reading would
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

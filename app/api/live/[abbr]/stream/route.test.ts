// @vitest-environment node

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '@/lib/errors';
import type { LiveLeague, LiveShowView } from '@/lib/services/live';

/**
 * The stream's own half of the contract, with the service standing in.
 *
 * 🔴 **What is real here and what is not**, because the difference is the
 * difference between a test and a comment. `pinnedLeague` is the *real* one —
 * the mock spreads the actual module and replaces only `getLiveShow` — so the
 * rule that decides a signed-out reader's league is under test rather than
 * mocked away. `getLiveShow` itself is a stand-in that reproduces its
 * documented rule (a pin wins, else the reader's own, else none); the service's
 * half of that is `lib/services/live.test.ts`'s job, against real rows.
 *
 * What this file therefore proves is exactly what the route decides: which four
 * arguments reach the service, that the frame is the service's view verbatim
 * and complete, that a second frame appears only when the state changed, and
 * that every timer is gone when the reader goes away.
 */
const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getLiveShow: vi.fn() }));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: (...args: unknown[]) => mocks.getCurrentUser(...args),
}));
vi.mock('@/lib/services/live', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/services/live')>()),
  getLiveShow: (...args: unknown[]) => mocks.getLiveShow(...args),
}));

import { GET } from './route';

const BASE: LiveShowView = {
  eventId: 1,
  abbreviation: 'oscars',
  name: 'Academy Awards',
  year: 2026,
  imageUrl: null,
  startsAt: null,
  startsOn: null,
  onAir: true,
  resolved: 0,
  total: 1,
  categories: [
    {
      awardId: 10,
      name: 'Best Picture',
      points: 10,
      nominees: [
        {
          nominationId: 5,
          movieId: 7,
          title: 'Arrival',
          posterUrl: null,
          detailName: null,
          isWinner: false,
        },
      ],
      winner: null,
    },
  ],
  league: null,
  leagueOptions: [],
};

/** A league with a seat in it — the thing a stranger must not be handed unasked. */
const league = (id: number): LiveLeague => ({
  id,
  name: `League ${id}`,
  total: 3,
  seats: [{ draftId: 1, name: 'Ada Lovelace', isViewer: false, earned: 3, films: [] }],
  standings: [
    { userId: 42, name: 'Ada Lovelace', total: 3, position: 1, isViewer: false },
  ],
});

/** `getLiveShow`'s documented rule: a pin wins, else the reader's own, else none. */
const service = async (
  _abbr: string,
  _year: number,
  userId: number | null,
  leagueId: number | null,
): Promise<LiveShowView> => ({
  ...BASE,
  league: leagueId != null ? league(leagueId) : userId != null ? league(99) : null,
  leagueOptions: userId != null ? [{ id: 99, name: 'League 99' }] : [],
});

function request(query = '', signal?: AbortSignal) {
  return new NextRequest(`https://next.cinemadraft.com/api/live/oscars/stream${query}`, {
    signal,
  });
}

const params = { params: Promise.resolve({ abbr: 'oscars' }) };

/** Everything the client has received, and whether the server has closed. */
function collect(response: Response) {
  const frames: string[] = [];
  const stream = { frames, closed: false };
  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  void (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        stream.closed = true;
        return;
      }
      frames.push(decoder.decode(value));
    }
  })();
  return stream;
}

/** Let the reader above drain what is already enqueued. */
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  mocks.getCurrentUser.mockResolvedValue(null);
  mocks.getLiveShow.mockImplementation(service);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('GET /api/live/[abbr]/stream', () => {
  it('opens with the complete view, as one event, before any poll', async () => {
    mocks.getLiveShow.mockResolvedValue(BASE);

    const response = await GET(request('?year=2026'), params);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store, no-transform');
    expect(response.headers.get('x-accel-buffering')).toBe('no');

    const stream = collect(response);
    await settle();

    // 🔴 The whole view, not a summary of it: a reconnecting client is correct
    // from this frame alone, which is what makes the self-close survivable.
    expect(stream.frames).toEqual([`data: ${JSON.stringify(BASE)}\n\n`]);
    expect(JSON.parse(stream.frames[0].slice('data: '.length))).toEqual(BASE);
  });

  it('writes nothing more while the state is unchanged, then a heartbeat', async () => {
    mocks.getLiveShow.mockResolvedValue(BASE);

    const stream = collect(await GET(request('?year=2026'), params));
    await settle();

    await vi.advanceTimersByTimeAsync(4_000);
    // Two polls have happened and neither said anything.
    expect(mocks.getLiveShow).toHaveBeenCalledTimes(3);
    expect(stream.frames).toHaveLength(1);

    // 🔴 A comment, not an event — it keeps an intermediary from dropping an
    // idle connection and a client parses it as nothing at all.
    await vi.advanceTimersByTimeAsync(16_000);
    expect(stream.frames).toEqual([`data: ${JSON.stringify(BASE)}\n\n`, ':\n\n']);
  });

  it('writes a frame when the state changes, and it is complete state again', async () => {
    const won: LiveShowView = {
      ...BASE,
      resolved: 1,
      categories: [
        {
          ...BASE.categories[0],
          winner: { movieId: 7, title: 'Arrival', posterUrl: null },
        },
      ],
    };
    mocks.getLiveShow.mockResolvedValueOnce(BASE).mockResolvedValue(won);

    const stream = collect(await GET(request('?year=2026'), params));
    await settle();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(stream.frames).toHaveLength(2);
    expect(JSON.parse(stream.frames[1].slice('data: '.length))).toEqual(won);

    // And it does not repeat itself once the change has been sent.
    await vi.advanceTimersByTimeAsync(4_000);
    expect(stream.frames).toHaveLength(2);
  });

  it('clears its timers and closes when the reader disconnects', async () => {
    mocks.getLiveShow.mockResolvedValue(BASE);

    const aborter = new AbortController();
    const stream = collect(await GET(request('?year=2026', aborter.signal), params));
    await settle();

    await vi.advanceTimersByTimeAsync(2_000);
    const polled = mocks.getLiveShow.mock.calls.length;
    expect(polled).toBe(2);

    aborter.abort();
    await settle();
    expect(stream.closed).toBe(true);

    // 🔴 The failure mode this exists for: one leaked interval per abandoned
    // connection is what pins Neon awake and ends the free tier.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.getLiveShow).toHaveBeenCalledTimes(polled);
  });

  it('closes itself at 50s, ahead of the platform kill, and stops polling', async () => {
    mocks.getLiveShow.mockResolvedValue(BASE);

    const stream = collect(await GET(request('?year=2026'), params));
    await settle();

    await vi.advanceTimersByTimeAsync(49_000);
    expect(stream.closed).toBe(false);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(stream.closed).toBe(true);

    const polled = mocks.getLiveShow.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.getLiveShow).toHaveBeenCalledTimes(polled);
  });

  it('gives a signed-out reader with no pin no league and no options', async () => {
    const stream = collect(await GET(request('?year=2026'), params));
    await settle();

    // The four arguments the page passes, for a reader with no session.
    expect(mocks.getLiveShow).toHaveBeenCalledWith('oscars', 2026, null, null);

    const view = JSON.parse(stream.frames[0].slice('data: '.length)) as LiveShowView;
    expect(view.league).toBeNull();
    expect(view.leagueOptions).toEqual([]);
    // Said the blunt way too: no seat name reaches a stranger through here.
    expect(stream.frames[0]).not.toContain('Ada Lovelace');
  });

  it('gives a signed-out reader who was handed a pinned link that league', async () => {
    // 🔴 Deliberate, not an oversight: `/leagues/[id]` is public (D44/D45) and
    // shows a stranger strictly more than this does. The stream is neither more
    // generous than the page nor less.
    const stream = collect(await GET(request('?year=2026&league=7'), params));
    await settle();

    expect(mocks.getLiveShow).toHaveBeenCalledWith('oscars', 2026, null, 7);
    const view = JSON.parse(stream.frames[0].slice('data: '.length)) as LiveShowView;
    expect(view.league?.id).toBe(7);
    expect(view.league?.seats[0].name).toBe('Ada Lovelace');
  });

  it('ignores a pin that is not a league id', async () => {
    collect(await GET(request('?year=2026&league=7x'), params));
    await settle();
    expect(mocks.getLiveShow).toHaveBeenCalledWith('oscars', 2026, null, null);
  });

  it('passes a signed-in reader their own id, and the pin when there is one', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 42 });

    const stream = collect(await GET(request('?year=2026'), params));
    await settle();

    expect(mocks.getLiveShow).toHaveBeenCalledWith('oscars', 2026, 42, null);
    const view = JSON.parse(stream.frames[0].slice('data: '.length)) as LiveShowView;
    expect(view.league?.id).toBe(99);
  });

  it('answers 204 and holds no connection when the show is off air', async () => {
    mocks.getLiveShow.mockResolvedValue({ ...BASE, onAir: false });

    const response = await GET(request('?year=2026'), params);

    // 🔴 Not an empty stream: `EventSource` retries a closed 200 forever and
    // gives up on any other status. 204 is how the server says "stop asking",
    // and it is what stops a forgotten tab spending the Neon allowance.
    expect(response.status).toBe(204);
    expect(response.body).toBeNull();

    const polled = mocks.getLiveShow.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.getLiveShow).toHaveBeenCalledTimes(polled);
  });

  it('answers 404 for a show that does not exist', async () => {
    mocks.getLiveShow.mockRejectedValue(new NotFoundError('award show', 'nope'));

    const response = await GET(request('?year=2026'), params);
    expect(response.status).toBe(404);
  });

  it('keeps the last good state when a poll throws', async () => {
    mocks.getLiveShow
      .mockResolvedValueOnce(BASE)
      .mockRejectedValueOnce(new Error('Neon is asleep'))
      .mockResolvedValue(BASE);

    const stream = collect(await GET(request('?year=2026'), params));
    await settle();

    await vi.advanceTimersByTimeAsync(4_000);
    // The beat was skipped, the connection is still open, nothing was re-sent.
    expect(stream.closed).toBe(false);
    expect(stream.frames).toHaveLength(1);
  });
});

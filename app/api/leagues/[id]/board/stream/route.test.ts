// @vitest-environment node

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '@/lib/errors';
import type { LeagueBoardView } from '@/lib/services/league-view';

/**
 * The board stream's own half of the contract, with the service standing in.
 *
 * The same shape as `app/api/live/[abbr]/stream/route.test.ts`, and for the
 * same reason: what this file proves is exactly what the *route* decides —
 * which three arguments reach `getLeagueBoardView`, that the frame is the
 * service's view verbatim and complete, that a second frame appears only when
 * the state changed, that a league which is not drafting holds no connection,
 * and that every timer is gone when the reader goes away. The service's own
 * half is `lib/services/league-view.test.ts`'s job, against real rows.
 */
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getLeagueBoardView: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: (...args: unknown[]) => mocks.getCurrentUser(...args),
}));
vi.mock('@/lib/services/league-view', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/services/league-view')>()),
  getLeagueBoardView: (...args: unknown[]) => mocks.getLeagueBoardView(...args),
}));

import { GET } from './route';

const BASE: LeagueBoardView = {
  leagueId: 1,
  leagueName: 'The League',
  year: 2026,
  status: 'active',
  isPending: false,
  isDrafting: true,
  isComplete: false,
  ownerIds: [42],
  uuid: 'league-uuid',
  viewerSeatId: null,
  viewerRoster: [],
  viewerSeated: false,
  standings: [
    { userId: 42, name: 'Ada Lovelace', total: 3, position: 1, isViewer: false },
  ],
  groups: [
    {
      group: 1,
      rounds: 4,
      seats: [
        {
          draftId: 1,
          name: 'Ada Lovelace',
          isDummy: false,
          uuid: 'seat-uuid',
          total: 3,
          order: 1,
          picks: [
            {
              pickId: 5,
              round: 1,
              title: 'Arrival',
              posterUrl: null,
              points: 3,
              ledger: [],
            },
          ],
        },
      ],
    },
  ],
};

/** The view a signed-in reader who holds seat 1 sees — their own seat resolved. */
const seated: LeagueBoardView = {
  ...BASE,
  viewerSeatId: 1,
  viewerRoster: [
    { id: 5, title: 'Arrival', posterUrl: null, round: 1, points: 3, share: 1 },
  ],
  viewerSeated: true,
  standings: [
    { userId: 42, name: 'Ada Lovelace', total: 3, position: 1, isViewer: true },
  ],
};

/** `getLeagueBoardView`'s documented rule: no reader, no seat of their own. */
const service = async (
  _leagueId: number,
  _year: number,
  userId: number | null,
): Promise<LeagueBoardView> => (userId == null ? BASE : seated);

function request(query = '', signal?: AbortSignal, id = '1') {
  return new NextRequest(
    `https://next.cinemadraft.com/api/leagues/${id}/board/stream${query}`,
    { signal },
  );
}

const params = { params: Promise.resolve({ id: '1' }) };

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
  mocks.getLeagueBoardView.mockImplementation(service);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('GET /api/leagues/[id]/board/stream', () => {
  it('opens with the complete view, as one event, before any poll', async () => {
    mocks.getLeagueBoardView.mockResolvedValue(BASE);

    const response = await GET(request('?year=2026'), params);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store, no-transform');
    expect(response.headers.get('x-accel-buffering')).toBe('no');

    const stream = collect(response);
    await settle();

    // 🔴 The whole board, not a summary of it: a reconnecting client is correct
    // from this frame alone, which is what makes the self-close survivable.
    expect(stream.frames).toEqual([`data: ${JSON.stringify(BASE)}\n\n`]);
    expect(JSON.parse(stream.frames[0].slice('data: '.length))).toEqual(BASE);
  });

  it('writes nothing more while the state is unchanged, then a heartbeat', async () => {
    mocks.getLeagueBoardView.mockResolvedValue(BASE);

    const stream = collect(await GET(request('?year=2026'), params));
    await settle();

    await vi.advanceTimersByTimeAsync(4_000);
    // Two polls have happened and neither said anything.
    expect(mocks.getLeagueBoardView).toHaveBeenCalledTimes(3);
    expect(stream.frames).toHaveLength(1);

    // 🔴 A comment, not an event — it keeps an intermediary from dropping an
    // idle connection and a client parses it as nothing at all.
    await vi.advanceTimersByTimeAsync(16_000);
    expect(stream.frames).toEqual([`data: ${JSON.stringify(BASE)}\n\n`, ':\n\n']);
  });

  it('writes a frame when a pick lands, and it is complete state again', async () => {
    const picked: LeagueBoardView = {
      ...BASE,
      groups: [
        {
          ...BASE.groups[0],
          seats: [
            {
              ...BASE.groups[0].seats[0],
              total: 6,
              picks: [
                ...BASE.groups[0].seats[0].picks,
                {
                  pickId: 6,
                  round: 2,
                  title: 'Dune',
                  posterUrl: null,
                  points: 3,
                  ledger: [],
                },
              ],
            },
          ],
        },
      ],
    };
    mocks.getLeagueBoardView.mockResolvedValueOnce(BASE).mockResolvedValue(picked);

    const stream = collect(await GET(request('?year=2026'), params));
    await settle();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(stream.frames).toHaveLength(2);
    expect(JSON.parse(stream.frames[1].slice('data: '.length))).toEqual(picked);

    // And it does not repeat itself once the change has been sent.
    await vi.advanceTimersByTimeAsync(4_000);
    expect(stream.frames).toHaveLength(2);
  });

  it('clears its timers and closes when the reader disconnects', async () => {
    mocks.getLeagueBoardView.mockResolvedValue(BASE);

    const aborter = new AbortController();
    const stream = collect(await GET(request('?year=2026', aborter.signal), params));
    await settle();

    await vi.advanceTimersByTimeAsync(2_000);
    const polled = mocks.getLeagueBoardView.mock.calls.length;
    expect(polled).toBe(2);

    aborter.abort();
    await settle();
    expect(stream.closed).toBe(true);

    // 🔴 The failure mode this exists for: one leaked interval per abandoned
    // connection is what pins Neon awake and ends the free tier.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.getLeagueBoardView).toHaveBeenCalledTimes(polled);
  });

  it('closes itself at 50s, ahead of the platform kill, and stops polling', async () => {
    mocks.getLeagueBoardView.mockResolvedValue(BASE);

    const stream = collect(await GET(request('?year=2026'), params));
    await settle();

    await vi.advanceTimersByTimeAsync(49_000);
    expect(stream.closed).toBe(false);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(stream.closed).toBe(true);

    const polled = mocks.getLeagueBoardView.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.getLeagueBoardView).toHaveBeenCalledTimes(polled);
  });

  it('answers 204 and holds no connection when the league is not drafting', async () => {
    mocks.getLeagueBoardView.mockResolvedValue({
      ...BASE,
      status: 'complete',
      isDrafting: false,
      isComplete: true,
    });

    const response = await GET(request('?year=2026'), params);

    // 🔴 Not an empty stream: `EventSource` retries a closed 200 forever. 204 is
    // how the server says stop asking, and a league is `active` for an hour a
    // season — every other day of the year must cost nothing (D110).
    expect(response.status).toBe(204);
    expect(response.body).toBeNull();

    const polled = mocks.getLeagueBoardView.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.getLeagueBoardView).toHaveBeenCalledTimes(polled);
  });

  it('answers 404 for a league that does not exist', async () => {
    mocks.getLeagueBoardView.mockRejectedValue(new NotFoundError('league', '9999'));

    const response = await GET(request('?year=2026'), params);
    expect(response.status).toBe(404);
  });

  it('keeps the last good state when a poll throws', async () => {
    mocks.getLeagueBoardView
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

  it('gives a signed-out reader no seat of their own', async () => {
    const stream = collect(await GET(request('?year=2026'), params));
    await settle();

    expect(mocks.getLeagueBoardView).toHaveBeenCalledWith(1, 2026, null);

    const view = JSON.parse(stream.frames[0].slice('data: '.length)) as LeagueBoardView;
    expect(view.viewerSeatId).toBeNull();
    expect(view.viewerRoster).toEqual([]);
    expect(view.viewerSeated).toBe(false);
    expect(view.standings.every((row) => row.isViewer === false)).toBe(true);
  });

  it('passes a signed-in reader their own id', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 42 });

    const stream = collect(await GET(request('?year=2026'), params));
    await settle();

    expect(mocks.getLeagueBoardView).toHaveBeenCalledWith(1, 2026, 42);
    const view = JSON.parse(stream.frames[0].slice('data: '.length)) as LeagueBoardView;
    expect(view.viewerSeatId).toBe(1);
    expect(view.standings[0].isViewer).toBe(true);
  });

  it('answers 404 for a league id that is not a positive integer', async () => {
    // `/api/leagues/7x/board/stream` — validated, not passed to the database.
    const response = await GET(request('?year=2026', undefined, '7x'), {
      params: Promise.resolve({ id: '7x' }),
    });

    expect(response.status).toBe(404);
    expect(mocks.getLeagueBoardView).not.toHaveBeenCalled();
  });
});

// @vitest-environment node

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '@/lib/errors';
import type { StandingsView } from '@/lib/services/season-ledger';

/**
 * The standings stream's own half of the contract (P16.T20, D135), with the
 * service standing in: which three arguments reach `getStandingsView`, that
 * the frame is the service's view verbatim, that a frame appears only when
 * the state changed, that nothing streams off air or for a past season, and
 * that every timer is gone when the reader goes away. A copy of the board
 * stream's test, as the route is a copy of the board stream.
 */
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getStandingsView: vi.fn(),
  getActiveYear: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: (...args: unknown[]) => mocks.getCurrentUser(...args),
}));
vi.mock('@/lib/services/season-ledger', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/services/season-ledger')>()),
  getStandingsView: (...args: unknown[]) => mocks.getStandingsView(...args),
}));
vi.mock('@/lib/services/season', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/services/season')>()),
  getActiveYear: () => mocks.getActiveYear(),
}));

import { GET } from './route';

const MOMENT = {
  key: '9-ceremony',
  abbreviation: 'oscars',
  name: 'Academy Awards',
  phase: 'ceremony' as const,
  date: Date.UTC(2026, 2, 15),
  state: 'live' as const,
  winners: 3,
  categories: 24,
};

const BASE: StandingsView = {
  leagueId: 1,
  leagueName: 'The League',
  year: 2026,
  onAir: true,
  shows: [{ abbreviation: 'oscars', name: 'Academy Awards' }],
  rows: [
    {
      draftId: 1,
      name: 'Ada Lovelace',
      isViewer: false,
      position: 1,
      byShow: { oscars: 3 },
      last: 3,
      move: 0,
      total: 3,
    },
  ],
  whatMoved: {
    moment: MOMENT,
    leaders: ['Ada Lovelace'],
    previousLeader: null,
    leadChanged: false,
    gains: [{ draftId: 1, name: 'Ada Lovelace', points: 3 }],
    movers: [],
    films: [],
  },
  firstDate: Date.UTC(2026, 0, 22),
};

/** The view a signed-in reader who holds seat 1 sees. */
const seated: StandingsView = {
  ...BASE,
  rows: BASE.rows.map((row) => ({ ...row, isViewer: true })),
};

const service = async (
  _leagueId: number,
  _year: number,
  userId: number | null,
): Promise<StandingsView> => (userId == null ? BASE : seated);

function request(query = '', signal?: AbortSignal, id = '1') {
  return new NextRequest(
    `https://next.cinemadraft.com/api/leagues/${id}/standings/stream${query}`,
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
  mocks.getActiveYear.mockResolvedValue(2026);
  mocks.getCurrentUser.mockResolvedValue(null);
  mocks.getStandingsView.mockImplementation(service);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('GET /api/leagues/[id]/standings/stream', () => {
  it('opens with the complete view, as one event, before any poll', async () => {
    const response = await GET(request('?year=2026'), params);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store, no-transform');
    expect(response.headers.get('x-accel-buffering')).toBe('no');

    const stream = collect(response);
    await settle();

    // The first frame is the service's view for the page's own parameters,
    // verbatim: the stream is exactly as generous as the page (D110).
    expect(mocks.getStandingsView).toHaveBeenCalledWith(1, 2026, null);
    expect(stream.frames).toEqual([`data: ${JSON.stringify(BASE)}\n\n`]);
    expect(JSON.parse(stream.frames[0].slice('data: '.length))).toEqual(BASE);
  });

  it('writes nothing more while the state is unchanged, then a heartbeat', async () => {
    const stream = collect(await GET(request('?year=2026'), params));
    await settle();

    await vi.advanceTimersByTimeAsync(4_000);
    expect(mocks.getStandingsView).toHaveBeenCalledTimes(3);
    expect(stream.frames).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(16_000);
    expect(stream.frames).toEqual([`data: ${JSON.stringify(BASE)}\n\n`, ':\n\n']);
  });

  it('writes a frame when a winner is entered, and it is complete state again', async () => {
    const won: StandingsView = {
      ...BASE,
      rows: BASE.rows.map((row) => ({ ...row, last: 13, total: 13 })),
    };
    mocks.getStandingsView.mockResolvedValueOnce(BASE).mockResolvedValue(won);

    const stream = collect(await GET(request('?year=2026'), params));
    await settle();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(stream.frames).toHaveLength(2);
    expect(JSON.parse(stream.frames[1].slice('data: '.length))).toEqual(won);

    await vi.advanceTimersByTimeAsync(4_000);
    expect(stream.frames).toHaveLength(2);
  });

  it('clears its timers and closes when the reader disconnects', async () => {
    const aborter = new AbortController();
    const stream = collect(await GET(request('?year=2026', aborter.signal), params));
    await settle();

    await vi.advanceTimersByTimeAsync(2_000);
    const polled = mocks.getStandingsView.mock.calls.length;
    expect(polled).toBe(2);

    aborter.abort();
    await settle();
    expect(stream.closed).toBe(true);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.getStandingsView).toHaveBeenCalledTimes(polled);
  });

  it('closes itself at 50s, ahead of the platform kill, and stops polling', async () => {
    const stream = collect(await GET(request('?year=2026'), params));
    await settle();

    await vi.advanceTimersByTimeAsync(49_000);
    expect(stream.closed).toBe(false);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(stream.closed).toBe(true);

    const polled = mocks.getStandingsView.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.getStandingsView).toHaveBeenCalledTimes(polled);
  });

  it('answers 204 and holds no connection when no show is on air', async () => {
    mocks.getStandingsView.mockResolvedValue({ ...BASE, onAir: false });

    const response = await GET(request('?year=2026'), params);

    // The months between ceremonies, which D116 refused to stream through.
    expect(response.status).toBe(204);
    expect(response.body).toBeNull();

    const polled = mocks.getStandingsView.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.getStandingsView).toHaveBeenCalledTimes(polled);
  });

  it('answers 204 for a past year even while a show is on air', async () => {
    // The service says on air (tonight's show); the season asked for is not
    // the one it is on air in. The route does not take the service's word.
    const response = await GET(request('?year=2025'), params);

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.getStandingsView).not.toHaveBeenCalled();
  });

  it('reads the active season when no year is given', async () => {
    collect(await GET(request(), params));
    await settle();
    expect(mocks.getStandingsView).toHaveBeenCalledWith(1, 2026, null);
  });

  it('answers 404 for a league that does not exist', async () => {
    mocks.getStandingsView.mockRejectedValue(new NotFoundError('league', '9999'));

    const response = await GET(request('?year=2026'), params);
    expect(response.status).toBe(404);
  });

  it('keeps the last good state when a poll throws', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      mocks.getStandingsView
        .mockResolvedValueOnce(BASE)
        .mockRejectedValueOnce(new Error('Neon is asleep'))
        .mockResolvedValue(BASE);

      const stream = collect(await GET(request('?year=2026'), params));
      await settle();

      await vi.advanceTimersByTimeAsync(4_000);
      expect(stream.closed).toBe(false);
      expect(stream.frames).toHaveLength(1);
      expect(logged).toHaveBeenCalledWith(
        expect.stringContaining('poll failed'),
        expect.any(Error),
      );
    } finally {
      logged.mockRestore();
    }
  });

  it('gives a signed-out reader no row of their own, and a member theirs', async () => {
    const out = collect(await GET(request('?year=2026'), params));
    await settle();
    const stranger = JSON.parse(out.frames[0].slice('data: '.length)) as StandingsView;
    expect(stranger.rows.every((row) => row.isViewer === false)).toBe(true);

    mocks.getCurrentUser.mockResolvedValue({ id: 42 });
    const inside = collect(await GET(request('?year=2026'), params));
    await settle();
    expect(mocks.getStandingsView).toHaveBeenLastCalledWith(1, 2026, 42);
    const member = JSON.parse(inside.frames[0].slice('data: '.length)) as StandingsView;
    expect(member.rows[0]?.isViewer).toBe(true);
  });

  it('answers 404 for a league id that is not a positive integer', async () => {
    const response = await GET(request('?year=2026', undefined, '7x'), {
      params: Promise.resolve({ id: '7x' }),
    });

    expect(response.status).toBe(404);
    expect(mocks.getStandingsView).not.toHaveBeenCalled();
  });
});

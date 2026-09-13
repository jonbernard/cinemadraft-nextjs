// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import type { BoardView } from './draft';

/**
 * The league page's own derivation, with `getLeagueBoard` mocked out — the
 * board itself is `draft.test.ts`'s job (D41), and this file exists to prove
 * the four things the page used to derive inline and the stream (P14.T10) now
 * shares: the reader's seat, their roster with each film's share, the dense
 * standings, and the three status flags.
 *
 * 🔴 The fixture carries a seat with picks, a seat with none, and a dummy seat
 * whose `userId` is null — the three cases the guards below exist for. A
 * fixture of one seated reader cannot tell a null guard from its absence.
 */

const getLeagueBoard = vi.fn();

vi.mock('./draft', () => ({
  getLeagueBoard: (...args: unknown[]) => getLeagueBoard(...args),
}));

const { getLeagueBoardView } = await import('./league-view');

function pick(pickId: number, round: number, points: number, poster: string | null) {
  return {
    pickId,
    round,
    points,
    movie: { id: pickId * 10, title: `Film ${pickId}`, poster },
    ledger: [],
  };
}

const BOARD: BoardView = {
  year: 2026,
  leagueId: 1,
  leagueName: 'The League',
  status: 'active',
  ownerIds: [42],
  uuid: 'league-uuid',
  groups: [
    {
      group: 1,
      rounds: 2,
      seats: [
        {
          draftId: 1,
          userId: 42,
          uuid: 'member-42',
          name: 'Forty Two',
          isDummy: false,
          order: 1,
          total: 40,
          picks: [pick(1, 1, 30, '/a.jpg'), pick(2, 2, 10, null)],
        },
        {
          draftId: 2,
          userId: 43,
          uuid: 'member-43',
          name: 'Forty Three',
          isDummy: false,
          order: 2,
          total: 0,
          picks: [],
        },
      ],
    },
    {
      group: 2,
      rounds: 1,
      seats: [
        {
          draftId: 9,
          userId: null,
          uuid: null,
          name: 'Unclaimed seat',
          isDummy: true,
          order: 1,
          total: 40,
          picks: [pick(3, 1, 40, '/c.jpg')],
        },
        {
          draftId: 4,
          userId: 44,
          uuid: 'member-44',
          name: 'Forty Four',
          isDummy: false,
          order: 2,
          total: 0,
          picks: [pick(4, 1, 0, null)],
        },
      ],
    },
  ],
} as unknown as BoardView;

function board(overrides: Partial<BoardView> = {}) {
  getLeagueBoard.mockResolvedValue({ ...BOARD, ...overrides });
}

describe('getLeagueBoardView', () => {
  it('gives the reader their own seat, their roster, and each film as a share of the seat', async () => {
    board();
    const view = await getLeagueBoardView(1, 2026, 42);

    expect(view.viewerSeatId).toBe(1);
    expect(view.viewerSeated).toBe(true);
    expect(view.viewerRoster.map((film) => film.share)).toEqual([0.75, 0.25]);
    expect(view.viewerRoster.map((film) => film.posterUrl)).toEqual([
      'https://image.tmdb.org/t/p/w185/a.jpg',
      null,
    ]);
  });

  it('says a seat with no picks is still a seat', async () => {
    // 🔴 The bug P19.T2 caught: a seated owner told they hold no seat, with
    // their own name in the standings beside the message.
    board();
    const view = await getLeagueBoardView(1, 2026, 43);

    expect(view.viewerSeatId).toBe(2);
    expect(view.viewerSeated).toBe(true);
    expect(view.viewerRoster).toEqual([]);
  });

  it('divides by a zero total as zero rather than NaN', async () => {
    board();
    const view = await getLeagueBoardView(1, 2026, 44);

    expect(view.viewerRoster).toHaveLength(1);
    expect(view.viewerRoster.every((film) => film.share === 0)).toBe(true);
  });

  it('ranks the standings densely and gives a dummy seat a negative key', async () => {
    board();
    const view = await getLeagueBoardView(1, 2026, null);

    expect(view.standings.map((row) => row.position)).toEqual([1, 1, 3, 3]);
    expect(view.standings.some((row) => row.userId < 0)).toBe(true);
    // 🔴 No reader, so no seat is theirs — including the dummy seat, whose
    // `userId` is null and would match a null reader on a bare `===`.
    expect(view.standings.every((row) => row.isViewer === false)).toBe(true);
  });

  it('marks only the reader’s own row in the standings', async () => {
    board();
    const view = await getLeagueBoardView(1, 2026, 42);

    expect(view.standings.filter((row) => row.isViewer).map((row) => row.name)).toEqual([
      'Forty Two',
    ]);
  });

  it('is drafting only while the league says active', async () => {
    board();
    await expect(getLeagueBoardView(1, 2026, null)).resolves.toMatchObject({
      isDrafting: true,
      isPending: false,
      isComplete: false,
    });

    board({ status: 'pending' });
    await expect(getLeagueBoardView(1, 2026, null)).resolves.toMatchObject({
      isDrafting: false,
      isPending: true,
      isComplete: false,
    });

    board({ status: 'complete' });
    await expect(getLeagueBoardView(1, 2026, null)).resolves.toMatchObject({
      isDrafting: false,
      isPending: false,
      isComplete: true,
    });
  });

  it('carries the groups through with the board cells the page renders', async () => {
    board();
    const view = await getLeagueBoardView(1, 2026, null);

    expect(view.groups.map((group) => group.group)).toEqual([1, 2]);
    expect(view.groups[0]?.seats[0]?.picks[0]).toMatchObject({
      pickId: 1,
      round: 1,
      title: 'Film 1',
      points: 30,
      posterUrl: 'https://image.tmdb.org/t/p/w185/a.jpg',
    });
    expect(getLeagueBoard).toHaveBeenCalledWith(1, 2026);
  });
});

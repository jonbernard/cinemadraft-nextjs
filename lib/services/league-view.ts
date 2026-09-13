import { posterUrl } from '@/lib/utils/poster';
import { denseRank } from '@/lib/utils/rank';
import type { StandingsRow } from './dashboard';
import { getLeagueBoard } from './draft';
import type { LedgerLine } from './scoring';

export type LeagueRosterFilm = {
  id: number;
  title: string;
  posterUrl: string | null;
  round: number;
  points: number;
  /** This film's slice of the seat's total. Zero when the seat has scored nothing. */
  share: number;
};

export type LeagueBoardSeat = {
  draftId: number;
  name: string;
  isDummy: boolean;
  uuid: string | null;
  total: number;
  order: number;
  /**
   * 🔴 Not `readonly`: `components/draft/DraftBoard`'s `BoardSeat.picks` is a
   * mutable array, and the page passes these seats straight to it (D33 — the
   * component declares the shape structurally and the page holds both types).
   * A `readonly` here would make that assignment fail, and widening the
   * component to suit a service is the wrong direction.
   */
  picks: {
    pickId: number;
    round: number;
    title: string;
    posterUrl: string | null;
    points: number;
    ledger: LedgerLine[];
  }[];
};

export type LeagueBoardGroup = {
  group: number;
  rounds: number;
  seats: readonly LeagueBoardSeat[];
};

export type LeagueBoardView = {
  leagueId: number;
  leagueName: string | null;
  year: number;
  status: string | null;
  /** `status === 'pending'` — the running order exists, the board does not. */
  isPending: boolean;
  /** `status === 'active'` — 🔴 the ONLY state that streams (see P14.T10). */
  isDrafting: boolean;
  isComplete: boolean;
  ownerIds: number[];
  uuid: string | null;
  /** The signed-in reader's own seat in this league-year, or null. */
  viewerSeatId: number | null;
  viewerRoster: readonly LeagueRosterFilm[];
  /** True when the reader holds a seat, even one with no picks yet. */
  viewerSeated: boolean;
  standings: readonly StandingsRow[];
  groups: readonly LeagueBoardGroup[];
};

/**
 * Everything `/leagues/[id]` renders, assembled once.
 *
 * 🔴 **Two doors, one definition.** The page and
 * `/api/leagues/[id]/board/stream` (P14.T10) both render this, and the first
 * thing to drift if they each derived it would be the standings — arithmetic a
 * member reads as truth. Same rule, same reason, as `pinnedLeague` in
 * `lib/services/live.ts` (D110): the moment there are two doors, the rule moves
 * out of the page.
 *
 * 🔴 This is a **move**, not a rewrite. Every line below came out of
 * `app/(app)/leagues/[id]/page.tsx` unchanged, including its comments, because
 * a refactor that also improves things cannot be verified by the tests that
 * existed before it.
 */
export async function getLeagueBoardView(
  leagueId: number,
  year: number,
  userId: number | null,
): Promise<LeagueBoardView> {
  const board = await getLeagueBoard(leagueId, year);

  const seats = board.groups.flatMap((group) => group.seats);

  // The viewer's own seat, if they hold one this season. Null for a visitor,
  // which is the ordinary case on a shared link.
  //
  // 🔴 `userId == null` first. A dummy seat's `userId` is null, so a bare
  // `seat.userId === userId` marks every placeholder in the league as the
  // reader's own seat for a reader who has none.
  const viewerSeat =
    userId == null ? null : (seats.find((seat) => seat.userId === userId) ?? null);

  // 🔴 P17.T31: the viewer's own picks, from the seat already resolved above.
  // `share` is this film's slice of the seat's total — the contribution bar's
  // input — derived here rather than added to `getLeagueBoard`, because both
  // numbers it needs are already on the seat and `lib/services/dashboard.ts`
  // derives it the same way. A zero total means nothing has scored, and a bar
  // showing a share of nothing is noise, so it is zero rather than a division
  // by zero.
  const viewerRoster: LeagueRosterFilm[] =
    viewerSeat == null
      ? []
      : viewerSeat.picks.map((pick) => ({
          id: pick.pickId,
          title: pick.movie.title ?? 'Untitled',
          posterUrl: posterUrl(pick.movie.poster, 'w185'),
          round: pick.round,
          points: pick.points,
          share: viewerSeat.total > 0 ? pick.points / viewerSeat.total : 0,
        }));

  // P10.T10: the same seats and totals `getLeagueBoard` already loaded, ranked
  // rather than reused as a second query. `StandingsRow.userId` doubles as the
  // React key and the `isViewer` comparison, so a dummy seat — which has no
  // `userId` — gets a negative sentinel built from its `draftId`, which real
  // user ids (positive DB ids) can never collide with.
  const ranked = [...seats].sort((a, b) => b.total - a.total);
  const positions = denseRank(ranked);
  const standings = ranked.map((seat, index) => ({
    userId: seat.userId ?? -seat.draftId,
    name: seat.name,
    total: seat.total,
    position: positions[index] as number,
    isViewer: userId != null && seat.userId === userId,
  }));

  return {
    leagueId: board.leagueId,
    leagueName: board.leagueName,
    year: board.year,
    status: board.status,
    isPending: board.status === 'pending',
    isDrafting: board.status === 'active',
    // 🔴 `complete` is a real value of `LeagueDraftingStatus` (pending | active |
    // complete) and two production leagues carry it, so the plan's "if the schema
    // has no complete value, fall back to every-seat-claimed" branch is not the
    // one taken — the direct signal exists and is used. A finished season has
    // nobody left to invite, and a standing join credential on screen is then a
    // liability rather than an affordance.
    isComplete: board.status === 'complete',
    ownerIds: board.ownerIds,
    uuid: board.uuid,
    viewerSeatId: viewerSeat?.draftId ?? null,
    viewerRoster,
    viewerSeated: viewerSeat != null,
    standings,
    groups: board.groups.map((group) => ({
      group: group.group,
      rounds: group.rounds,
      seats: group.seats.map((seat) => ({
        draftId: seat.draftId,
        name: seat.name,
        isDummy: seat.isDummy,
        uuid: seat.uuid,
        total: seat.total,
        order: seat.order,
        picks: seat.picks.map((pick) => ({
          pickId: pick.pickId,
          round: pick.round,
          title: pick.movie.title ?? 'Untitled',
          posterUrl: posterUrl(pick.movie.poster, 'w185'),
          points: pick.points,
          ledger: pick.ledger,
        })),
      })),
    })),
  };
}

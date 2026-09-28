import { NotFoundError } from '@/lib/errors';
import { posterUrl } from '@/lib/utils/poster';
import { getLeagueBoard } from './draft';
import { currentRound, nextSeatId } from './draft-order';

export type ConsolePick = {
  pickId: number;
  round: number;
  title: string;
  posterUrl: string | null;
  points: number;
};

export type ConsoleSeat = {
  draftId: number;
  name: string;
  isDummy: boolean;
  order: number;
  total: number;
  picks: ConsolePick[];
};

export type ConsoleView = {
  leagueId: number;
  leagueName: string | null;
  /** Parsed owners (D47) — the page gates the console on these. */
  ownerIds: number[];
  year: number;
  /** The group being drafted, and every group the league has this year. */
  group: number;
  groups: number[];
  seats: ConsoleSeat[];
  /** The longest seat in the group (D34) — never a constant. */
  rounds: number;
  /** The round being drafted: one past the seat that has picked least. */
  round: number;
  /** Whose turn the snake says it is; the owner may overrule it. */
  suggestedSeatId: number | null;
  /** Films already gone in this group, so the owner need not remember. */
  takenMovieIds: number[];
  /** This season's status (D130): the console offers picks only while `active`. */
  status: string | null;
  /**
   * Picks still to make before every seat, in every group, has as many as the
   * longest seat in its group. Roster size is not stored (D34), so "behind the
   * leader" is the only unfilled there is; the finish confirm names it.
   */
  unfilled: number;
};

/**
 * The owner's view of one group, mid-draft.
 *
 * Built on `getLeagueBoard` rather than beside it, so the console and the
 * public board cannot disagree about what has been picked — the thing the
 * league is watching on their phones while the owner types.
 *
 * A group is required because a league drafts several at once and the console
 * runs one at a time; an unknown group is a 404 rather than an empty console,
 * which would look like a group nobody has drafted in yet.
 */
export async function getDraftConsole(
  leagueId: number,
  year: number,
  group?: number,
): Promise<ConsoleView> {
  const board = await getLeagueBoard(leagueId, year);
  const groups = board.groups.map((entry) => entry.group);

  const active = group ?? groups[0];
  if (active == null) {
    throw new NotFoundError('draft for league', `${leagueId}/${year}`);
  }
  const found = board.groups.find((entry) => entry.group === active);
  if (!found) throw new NotFoundError('draft group', `${leagueId}/${year}/${active}`);

  const seats: ConsoleSeat[] = found.seats.map((seat) => ({
    draftId: seat.draftId,
    name: seat.name,
    isDummy: seat.isDummy,
    order: seat.order,
    total: seat.total,
    picks: seat.picks.map((pick) => ({
      pickId: pick.pickId,
      round: pick.round,
      title: pick.movie.title ?? 'Untitled',
      posterUrl: posterUrl(pick.movie.poster, 'w185'),
      points: pick.points,
    })),
  }));

  const ordered = seats.map((seat) => ({
    draftId: seat.draftId,
    order: seat.order,
    pickCount: seat.picks.length,
  }));

  return {
    leagueId: board.leagueId,
    leagueName: board.leagueName,
    ownerIds: board.ownerIds,
    year: board.year,
    group: active,
    groups,
    seats,
    rounds: found.rounds,
    round: currentRound(ordered),
    suggestedSeatId: nextSeatId(ordered),
    takenMovieIds: found.seats.flatMap((seat) => seat.picks.map((pick) => pick.movie.id)),
    status: board.status,
    unfilled: board.groups.reduce(
      (sum, entry) =>
        sum +
        entry.seats.reduce((gap, seat) => gap + entry.rounds - seat.picks.length, 0),
      0,
    ),
  };
}

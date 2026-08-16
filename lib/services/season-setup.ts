import { NotFoundError } from '@/lib/errors';
import { draftRepository } from '@/lib/repositories/drafts';
import { leagueRepository } from '@/lib/repositories/leagues';
import { userRepository } from '@/lib/repositories/users';
import { suggestGroupCount } from './group-assignment';

export type SetupSeat = {
  draftId: number;
  name: string;
  isDummy: boolean;
  /** Null while unassigned. */
  group: number | null;
  order: number | null;
  /** True once the seat has drafted; such a seat cannot be removed. */
  hasPicks: boolean;
};

export type SeasonSetupView = {
  leagueId: number;
  leagueName: string;
  year: number;
  status: string | null;
  ownerIds: number[];
  seats: SetupSeat[];
  /** Groups currently in use, ascending. */
  groups: number[];
  /** A sensible default for the randomiser's control. */
  suggestedGroupCount: number;
  /** Seasons this league has, newest first — for staging the next one. */
  years: number[];
};

/**
 * Everything the owner needs to arrange a season.
 *
 * Batched: one query for the seats, one for their names, one for their pick
 * counts. The console lists every member of the league, so a lookup per seat
 * would be a round trip per person (D59).
 *
 * `hasPicks` is carried because the console has to *show* which seats cannot be
 * removed. Letting the owner click a remove button that always refuses is
 * worse than not offering it — they would assume the app was broken rather
 * than that the seat was protected.
 */
export async function getSeasonSetup(
  leagueId: number,
  year: number,
): Promise<SeasonSetupView> {
  const league = await leagueRepository.findById(leagueId);

  const seats = await draftRepository.findByLeagueIdAndYear(leagueId, year);
  const [users, pickCounts, years] = await Promise.all([
    userRepository.findManyByIds([
      ...new Set(seats.flatMap((seat) => (seat.userId == null ? [] : [seat.userId]))),
    ]),
    draftRepository.countPicksByDraftIds(seats.map((seat) => seat.id)),
    draftRepository.findYearsByLeagueId(leagueId),
  ]);

  const userById = new Map(users.map((user) => [user.id, user]));

  const setupSeats: SetupSeat[] = seats
    .map((seat) => {
      const user = seat.userId == null ? undefined : userById.get(seat.userId);
      const parts = [user?.firstName, user?.lastName].filter(Boolean);

      return {
        draftId: seat.id,
        name: seat.dummy
          ? (seat.dummyName ?? 'Unclaimed seat')
          : parts.length > 0
            ? parts.join(' ')
            : (user?.email.split('@')[0] ?? 'Unknown'),
        isDummy: seat.dummy === true,
        group: seat.group,
        order: seat.order,
        hasPicks: (pickCounts.get(seat.id) ?? 0) > 0,
      };
    })
    // Unassigned last: the owner's job is to empty that pile, so it reads as
    // the work remaining rather than as the first group.
    .sort(
      (a, b) => (a.group ?? 999) - (b.group ?? 999) || (a.order ?? 0) - (b.order ?? 0),
    );

  if (!league.name) throw new NotFoundError('league', leagueId);

  return {
    leagueId: league.id,
    leagueName: league.name,
    year,
    status: league.draftingStatus,
    ownerIds: league.ownerIds,
    seats: setupSeats,
    groups: [
      ...new Set(setupSeats.flatMap((seat) => (seat.group == null ? [] : [seat.group]))),
    ].sort((a, b) => a - b),
    suggestedGroupCount: suggestGroupCount(setupSeats.length),
    years,
  };
}

import { NotFoundError } from '@/lib/errors';
import { isCharacter } from '@/lib/leagues/characters';
import { seasonStatus } from '@/lib/leagues/season';
import { type Draft, draftRepository } from '@/lib/repositories/drafts';
import { leagueRepository } from '@/lib/repositories/leagues';
import { type User, userRepository } from '@/lib/repositories/users';
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
      return {
        draftId: seat.id,
        name: seatName(seat, seat.userId == null ? undefined : userById.get(seat.userId)),
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
    status: seasonStatus(league, year),
    ownerIds: league.ownerIds,
    seats: setupSeats,
    groups: [
      ...new Set(setupSeats.flatMap((seat) => (seat.group == null ? [] : [seat.group]))),
    ].sort((a, b) => a - b),
    suggestedGroupCount: suggestGroupCount(setupSeats.length),
    years,
  };
}

/** What the setup page calls a seat: the placeholder's name, or the member's own. */
function seatName(seat: Draft, user: User | undefined): string {
  if (seat.dummy) return seat.dummyName ?? 'Unclaimed seat';
  const parts = [user?.firstName, user?.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : (user?.email.split('@')[0] ?? 'Unknown');
}

/**
 * The same person across seasons: a member by their account, everyone else by
 * the name the owner typed. Null for a seat with neither, which no one can
 * re-seat.
 */
export function personKey(seat: Pick<Draft, 'userId' | 'dummyName'>): string | null {
  if (seat.userId != null) return `user:${seat.userId}`;
  return seat.dummyName == null ? null : `name:${seat.dummyName}`;
}

export type ReturningPerson = {
  /** Their newest seat before the season being set up: what `seatReturning` copies. */
  fromDraftId: number;
  name: string;
  kind: 'member' | 'unregistered' | 'character';
  lastYear: number;
};

const KIND_ORDER = { member: 0, unregistered: 1, character: 2 } as const;

/**
 * Everyone who played this league before `year` and is not seated in it yet,
 * once each, from their newest seat (D131).
 *
 * Nobody carries forward when a season opens; this is the list the owner
 * re-seats from, one tap per person. Members first, then people who have not
 * registered, then characters (D121), each by name.
 */
export async function getReturningPeople(
  leagueId: number,
  year: number,
): Promise<ReturningPerson[]> {
  const seats = await draftRepository.findByLeagueId(leagueId);

  const seated = new Set(
    seats.filter((seat) => seat.year === year).map((seat) => personKey(seat)),
  );
  const newest = new Map<string, Draft>();
  for (const seat of seats) {
    const key = personKey(seat);
    if (key == null || seat.year == null || seat.year >= year || seated.has(key))
      continue;
    const known = newest.get(key);
    if (known == null || (known.year ?? 0) < seat.year) newest.set(key, seat);
  }

  const users = await userRepository.findManyByIds([
    ...new Set(
      [...newest.values()].flatMap((seat) => (seat.userId == null ? [] : [seat.userId])),
    ),
  ]);
  const userById = new Map(users.map((user) => [user.id, user]));

  return [...newest.values()]
    .map((seat): ReturningPerson => {
      const name = seatName(
        seat,
        seat.userId == null ? undefined : userById.get(seat.userId),
      );
      return {
        fromDraftId: seat.id,
        name,
        kind:
          seat.userId != null
            ? 'member'
            : isCharacter(name)
              ? 'character'
              : 'unregistered',
        lastYear: seat.year as number,
      };
    })
    .sort(
      (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name),
    );
}

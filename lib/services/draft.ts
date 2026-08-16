import { draftPickRepository } from '@/lib/repositories/draft-picks';
import { draftRepository } from '@/lib/repositories/drafts';
import { leagueRepository } from '@/lib/repositories/leagues';
import { type Movie, movieRepository } from '@/lib/repositories/movies';
import { userRepository } from '@/lib/repositories/users';
import { type LedgerLine, ledgerForMovies } from './scoring';

export type BoardPick = {
  pickId: number;
  movie: Movie;
  /** Position in this seat's own order, from 1. */
  round: number;
  points: number;
  /**
   * Why `points` is what it is (§6.7) — award by award.
   *
   * Carried on the pick rather than fetched when someone expands it. The
   * ledger comes from the *same* load as the totals (D41), so having it costs
   * nothing extra; fetching it on demand would turn one query into one per
   * click, which is the N+1 that `scoring.batching.test.ts` exists to prevent.
   */
  ledger: LedgerLine[];
};

export type Seat = {
  draftId: number;
  /** Null for a dummy seat — a placeholder the owner drafts on behalf of. */
  userId: number | null;
  name: string;
  isDummy: boolean;
  order: number;
  picks: BoardPick[];
  total: number;
};

export type BoardGroup = {
  group: number;
  seats: Seat[];
  /**
   * Columns to render: the longest seat in this group.
   *
   * 🔴 Never a constant (D34). The source app computed exactly this as
   * `maxLength`, and a group where one seat holds 7 picks and another 5 shows
   * 7 columns with two empty cells.
   */
  rounds: number;
};

export type BoardView = {
  year: number;
  leagueId: number;
  leagueName: string | null;
  /** `pending` means the league is still assigning order and groups. */
  status: string | null;
  ownerIds: number[];
  groups: BoardGroup[];
};

/**
 * A seat's label.
 *
 * Dummy seats are real: 17 exist in production, 3 of them in league 1's 2026
 * season. They are placeholders the owner drafts on behalf of, and dropping
 * them would silently remove seats from a league — changing both the board and
 * the standings.
 */
function seatName(
  draft: { dummy: boolean | null; dummyName: string | null; userId: number | null },
  user: { firstName: string | null; lastName: string | null; email: string } | undefined,
): string {
  if (draft.dummy) return draft.dummyName ?? 'Unclaimed seat';
  if (!user) return 'Unknown';
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : (user.email.split('@')[0] ?? user.email);
}

/**
 * The whole draft board for a league-year: groups, their seats, their picks.
 *
 * A league drafts in groups — league 1's 2026 season is 4 groups of 4 seats —
 * which is why the source app's league URL carries an `activeGroup`.
 *
 * Scoring goes through `ledgerForMovies` (D41) rather than a second
 * implementation, and runs once for the entire league rather than per seat.
 * The ledger is the same load as the totals, so the board carries the
 * explanation of every number it shows without a second query.
 *
 * Throws `NotFoundError` for a league that does not exist, rather than
 * returning an empty board — the page turns that into a 404. An empty board
 * would render as a real league that nobody has drafted in yet, which is a
 * state that genuinely occurs, so the two must not look alike.
 */
export async function getLeagueBoard(leagueId: number, year: number): Promise<BoardView> {
  const [league, drafts] = await Promise.all([
    leagueRepository.findById(leagueId),
    draftRepository.findByLeagueIdAndYear(leagueId, year),
  ]);

  const picks = await draftPickRepository.findManyByDraftIds(
    drafts.map((draft) => draft.id),
  );

  const movieIds = [
    ...new Set(picks.flatMap((pick) => (pick.movieId == null ? [] : [pick.movieId]))),
  ];
  const [ledgers, movies, users] = await Promise.all([
    ledgerForMovies(movieIds, year),
    movieRepository.findManyByIds(movieIds),
    userRepository.findManyByIds([
      ...new Set(drafts.flatMap((draft) => (draft.userId == null ? [] : [draft.userId]))),
    ]),
  ]);

  const movieById = new Map(movies.map((movie) => [movie.id, movie]));
  const userById = new Map(users.map((user) => [user.id, user]));

  const seats: (Seat & { group: number })[] = drafts
    .map((draft) => {
      const own = picks
        .filter((pick) => pick.draftId === draft.id && pick.movieId != null)
        // The seat's own order. Nullable in the restored data, so the index is
        // the fallback — a null must not collapse every pick onto round 0.
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      const boardPicks = own.flatMap((pick, index) => {
        const movie = movieById.get(pick.movieId as number);
        if (!movie) return [];
        return [
          {
            pickId: pick.id,
            movie,
            round: pick.order ?? index + 1,
            points: ledgers.get(movie.id)?.total ?? 0,
            ledger: ledgers.get(movie.id)?.lines ?? [],
          },
        ];
      });

      return {
        group: draft.group ?? 1,
        draftId: draft.id,
        userId: draft.userId,
        name: seatName(
          draft,
          draft.userId == null ? undefined : userById.get(draft.userId),
        ),
        isDummy: draft.dummy === true,
        order: draft.order ?? 0,
        picks: boardPicks,
        total: boardPicks.reduce((sum, pick) => sum + pick.points, 0),
      };
    })
    .sort((a, b) => a.order - b.order);

  const byGroup = new Map<number, Seat[]>();
  for (const { group, ...seat } of seats) {
    const existing = byGroup.get(group);
    if (existing) existing.push(seat);
    else byGroup.set(group, [seat]);
  }

  const groups: BoardGroup[] = [...byGroup.entries()]
    .map(([group, groupSeats]) => ({
      group,
      seats: groupSeats,
      // The longest seat in this group, never a constant (D34).
      rounds: groupSeats.reduce(
        (longest, seat) => Math.max(longest, seat.picks.length),
        0,
      ),
    }))
    .sort((a, b) => a.group - b.group);

  return {
    year,
    leagueId,
    leagueName: league.name,
    status: league.draftingStatus,
    ownerIds: league.ownerIds,
    groups,
  };
}

/**
 * The seasons a league has drafted, newest first — its year switcher.
 *
 * Separate from `getLeagueBoard` because it answers a different question: that
 * one is "what happened in this season", this one is "which seasons exist".
 * The board would otherwise carry a list it never uses on the console path.
 */
export async function getLeagueSeasons(leagueId: number): Promise<number[]> {
  return draftRepository.findYearsByLeagueId(leagueId);
}

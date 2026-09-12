import { NotFoundError } from '@/lib/errors';
import { draftRepository } from '@/lib/repositories/drafts';
import { eventRepository } from '@/lib/repositories/events';
import { posterUrl } from '@/lib/utils/poster';
import { type Category, getAwardShow } from './award-show';
import { getLeagueBoard } from './draft';

/**
 * The live surface for one award show (P17.T16).
 *
 * 🔴 **Composition, not computation.** Every number on this page comes from
 * `getAwardShow` and `getLeagueBoard`, which already go through
 * `lib/services/scoring.ts`. There is exactly one definition of the scoring
 * rule (D19/D41) and this file does not become a second one: narrowing a
 * season to one show is `line.eventAbbreviation === abbreviation`, an in-memory
 * filter over a ledger the board already loaded (see `BoardPick.ledger`).
 *
 * 🔴 **It does not close P14.T0–T3.** There is no transport here and no
 * subscription. The page renders the state at request time; a reload is what
 * advances it. That is enough to stop `/live/[abbr]` being a 404 during a
 * ceremony, which is what this task is for. Phase 14 still owes making it move
 * on its own.
 */

export type LiveCategory = {
  awardId: number;
  name: string;
  /** What a nomination here is worth. A win is worth it twice (D41). */
  points: number;
  nomineeCount: number;
  /** The winning film, once one is marked. Null while the category is open. */
  winner: { movieId: number; title: string; posterUrl: string | null } | null;
};

export type LiveFilm = {
  movieId: number;
  title: string;
  posterUrl: string | null;
  /** Points earned at THIS show only, not the season total. */
  earned: number;
  /**
   * 🔴 Only `'won'` or `'nominated'` can occur here — a film with no line at
   * this show is dropped, so `'none'` is unreachable. It stays in the union so
   * the type matches `PosterFrame`'s `PosterStatus` and `LiveBoard` does not
   * need a narrower one. Do not delete it.
   */
  status: 'none' | 'nominated' | 'won';
};

export type LiveSeat = {
  draftId: number;
  name: string;
  isViewer: boolean;
  /** The sum of `films[].earned` — this seat's take from this show. */
  earned: number;
  /** Only the seat's films that are in play here. A seat may have none. */
  films: LiveFilm[];
};

export type LiveLeague = {
  id: number;
  name: string | null;
  /** 🔴 Always the sum of `seats[].earned`, never computed a second way. */
  total: number;
  seats: LiveSeat[];
};

export type LiveShowView = {
  eventId: number;
  abbreviation: string;
  name: string;
  year: number;
  imageUrl: string | null;
  /**
   * Epoch ms of the ceremony start — the true instant, for a countdown and for
   * a machine-readable `<time datetime>`.
   */
  startsAt: number | null;
  /**
   * 🔴 Epoch ms of UTC midnight on the ceremony **day**, which is the value to
   * print, and it is not `startsAt` rounded down.
   *
   * `events.awards_time` is milliseconds past `awards_date`'s midnight and it
   * routinely exceeds a day: the 2026 Oscars store 91,800,000 — 25.5 hours —
   * because the ceremony is a Sunday evening in America and the instant lands
   * on the Monday in UTC. Formatting the *sum* in UTC therefore prints the day
   * after the ceremony, on the page whose one job is saying when it starts.
   * `SeasonStepper` avoids this by formatting `awards_date` alone; so does this.
   */
  startsOn: number | null;
  /** The source's own `awards_active` flag: the broadcast window is open. */
  onAir: boolean;
  resolved: number;
  total: number;
  categories: LiveCategory[];
  /** Empty for a reader with no leagues, and for a reader signed out. */
  leagues: LiveLeague[];
};

function toCategory(category: Category): LiveCategory {
  const winner = category.nominees.find((nominee) => nominee.isWinner);
  return {
    awardId: category.awardId,
    name: category.name,
    points: category.points,
    nomineeCount: category.nominees.length,
    winner: winner
      ? { movieId: winner.movieId, title: winner.title, posterUrl: winner.posterUrl }
      : null,
  };
}

/**
 * One show as it resolves, plus the reader's own seats in it.
 *
 * 🔴 `userId` is `number | null`, and a null does not become a sentinel it then
 * queries with: `seatsForReader` is behind the null check below, so a
 * signed-out reader's request never asks the database about a league at all.
 * That is the same rule `getDashboard(null)` follows (D44), and it is the
 * reason this page can be public — there is no code path on which a stranger
 * resolves somebody else's team. `scoring.batching.test.ts` pins it as an
 * equality against the show's own query cost, because a sentinel query would
 * add exactly one and slip past a ceiling.
 */
export async function getLiveShow(
  abbreviation: string,
  year: number,
  userId: number | null,
): Promise<LiveShowView> {
  // The schedule columns are on the event row and `getAwardShow` does not
  // return them, so the event is read directly. It is also what answers
  // "is this even a show" before anything else is loaded.
  const event = await eventRepository.findByAbbreviation(abbreviation);
  if (!event) throw new NotFoundError('award show', abbreviation);

  const show = await getAwardShow(abbreviation, year);
  const categories = show.categories.map(toCategory);

  return {
    eventId: event.id,
    abbreviation: event.abbreviation,
    name: event.name,
    year,
    imageUrl: event.image,
    // 🔴 `?? 0`, not `|| 0`: `awardsTime` is nullable and midnight is 0, which
    // is a meaningful value a truthiness check would throw away — the same way
    // it would throw away a genuine zero duration elsewhere in this repository.
    // `?? 0` rather than `|| 0` to match the repository's convention, though
    // here the two cannot differ: the fallback and the only falsy value are
    // both 0. The distinction matters for durations, not for this sum.
    startsAt:
      event.awardsDate == null ? null : event.awardsDate + (event.awardsTime ?? 0),
    startsOn: event.awardsDate,
    onAir: event.awardsActive === true,
    // 🔴 From `hasWinner`, not from `winner != null`. A `winners` row whose
    // film has no `nominations` row for the season leaves `isWinner` unset on
    // every nominee, so `winner` is null while the category is genuinely
    // decided. The counter is the honest number; the chip below it still needs
    // a nominee to name, and says "N nominees" when it has none.
    resolved: show.categories.filter((category) => category.hasWinner).length,
    total: categories.length,
    categories,
    leagues: userId == null ? [] : await seatsForReader(abbreviation, year, userId),
  };
}

/**
 * What the reader's seats have taken at this show.
 *
 * 🔴 **The board's ledger, narrowed — not a second scoring rule.**
 * `BoardPick.ledger` already carries every award a film earned this season,
 * each line naming its show, so "what has this seat taken tonight" is a filter
 * over numbers `getLeagueBoard` has already computed (D19/D41). Writing a
 * `pointsForEvent(...)` here would be the second definition of the rule, and
 * the first thing to disagree with the standings.
 *
 * Reached only when `userId != null`, which is what makes the public page safe:
 * a signed-out reader's request never asks the database about a league at all
 * (D44).
 */
async function seatsForReader(
  abbreviation: string,
  year: number,
  userId: number,
): Promise<LiveLeague[]> {
  const leagueIds = await draftRepository.findLeagueIdsByUserId(userId);
  const boards = await Promise.all(
    leagueIds.map((leagueId) => getLeagueBoard(leagueId, year)),
  );

  return boards.map((board) => {
    const seats = board.groups
      .flatMap((group) => group.seats)
      .map((seat) => {
        const films = seat.picks.flatMap((pick) => {
          const lines = pick.ledger.filter(
            (line) => line.eventAbbreviation === abbreviation,
          );
          // A film with no line at this show is not on this page. The seat's
          // other picks are real and are on the dashboard; here they are noise.
          if (lines.length === 0) return [];
          return [
            {
              movieId: pick.movie.id,
              title: pick.movie.title ?? 'Untitled',
              posterUrl: posterUrl(pick.movie.poster, 'w342'),
              earned: lines.reduce((sum, line) => sum + line.earned, 0),
              status: lines.some((line) => line.won)
                ? ('won' as const)
                : ('nominated' as const),
            },
          ];
        });

        return {
          draftId: seat.draftId,
          name: seat.name,
          isViewer: seat.userId === userId,
          earned: films.reduce((sum, film) => sum + film.earned, 0),
          films,
        };
      })
      // What the seat took tonight, biggest first — then by name, so the order
      // is total and does not shuffle between two seats on the same score.
      .sort((a, b) => b.earned - a.earned || a.name.localeCompare(b.name));

    return {
      id: board.leagueId,
      name: board.leagueName,
      // 🔴 The sum of the seats, never a separate reduction over the picks: a
      // league total that did not add up to the seats printed under it would
      // be worse than showing no total at all (the `MovieLedger` rule).
      total: seats.reduce((sum, seat) => sum + seat.earned, 0),
      seats,
    };
  });
}

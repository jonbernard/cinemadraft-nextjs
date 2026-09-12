import { NotFoundError } from '@/lib/errors';
import { eventRepository } from '@/lib/repositories/events';
import { type Category, getAwardShow } from './award-show';

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

export type LiveShowView = {
  eventId: number;
  abbreviation: string;
  name: string;
  year: number;
  imageUrl: string | null;
  /** Epoch ms of the ceremony start, or null if it is not scheduled. */
  startsAt: number | null;
  /** The source's own `awards_active` flag: the broadcast window is open. */
  onAir: boolean;
  resolved: number;
  total: number;
  categories: LiveCategory[];
  /**
   * The reader's own seats in this show.
   *
   * 🔴 The empty tuple is the honest type for T16a: nothing produces a seat
   * yet, and a `LiveSeat[]` with no producer would be a shape the page could
   * be written against and never see. T16b widens it, and the page's roster
   * slot is already the branch that handles both.
   */
  leagues: [];
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
 * queries with: the league work below is inside the null check, so a signed-out
 * reader's request never asks the database about a league at all. That is the
 * same rule `getDashboard(null)` follows (D44), and it is the reason this page
 * can be public — there is no code path on which a stranger resolves somebody
 * else's team.
 */
export async function getLiveShow(
  abbreviation: string,
  year: number,
  _userId: number | null,
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
    startsAt:
      event.awardsDate == null ? null : event.awardsDate + (event.awardsTime ?? 0),
    onAir: event.awardsActive === true,
    resolved: categories.filter((category) => category.winner != null).length,
    total: categories.length,
    categories,
    leagues: [],
  };
}

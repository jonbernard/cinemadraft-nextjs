import { NotFoundError } from '@/lib/errors';
import { draftRepository } from '@/lib/repositories/drafts';
import { eventRepository } from '@/lib/repositories/events';
import { leagueRepository } from '@/lib/repositories/leagues';
import { posterUrl } from '@/lib/utils/poster';
import { denseRank } from '@/lib/utils/rank';
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

/**
 * One nominee, with the artwork that makes the category readable from a sofa
 * (P14.T1).
 *
 * 🔴 `getAwardShow` has already loaded every one of these and `toCategory` used
 * to collapse them to a count and a single winner. Carrying them costs no
 * query at all — `scoring.batching.test.ts` pins that as an equality — and
 * without them the page is a list of category names, which is what Phase 14
 * exists to stop being on a television.
 */
export type LiveNominee = {
  nominationId: number;
  movieId: number;
  title: string;
  /**
   * `w342`, not the `w185` `getAwardShow` builds for its own grid. TMDB is on
   * `PASS_THROUGH_HOSTS`, so the bucket in the path IS the delivered pixel
   * width — nothing downstream resamples it — and a 160px frame fed w185 is
   * 1.16x, which is soft on any 2x panel and on the 224px frame this page uses
   * above 1536px it is 0.83x, i.e. upscaled.
   */
  posterUrl: string | null;
  /**
   * The person, where the category nominates one. Without it an acting
   * category is four posters and no names.
   */
  detailName: string | null;
  isWinner: boolean;
};

export type LiveCategory = {
  awardId: number;
  name: string;
  /** What a nomination here is worth. A win is worth it twice (D41). */
  points: number;
  /**
   * Every nominee, in `getAwardShow`'s order. May be empty: a category can be
   * entered before its nominations are, and the page says so in words rather
   * than rendering an empty row.
   */
  nominees: LiveNominee[];
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

/**
 * One row of the league table — the SEASON's standings, not tonight's.
 *
 * 🔴 Structurally `dashboard.ts`'s `StandingsRow`, and that is the point:
 * `components/StandingsPanel` is rendered with these, so the table a pinned
 * reader sees on `/live` is the same component fed the same numbers as the one
 * on `/leagues/[id]`. `total` is `Seat.total` straight off `getLeagueBoard` and
 * `position` is the shared `denseRank`, so there is no second arithmetic and no
 * second definition of a tie.
 */
export type LiveStanding = {
  /** A dummy seat has no user, so it takes `-draftId`, as the league page does. */
  userId: number;
  name: string;
  total: number;
  position: number;
  isViewer: boolean;
};

export type LiveLeague = {
  id: number;
  name: string | null;
  /** 🔴 Always the sum of `seats[].earned`, never computed a second way. */
  total: number;
  seats: LiveSeat[];
  /** The season table, ranked. Tonight's take is `seats[].earned`. */
  standings: LiveStanding[];
};

/** A league the reader could switch to. Only ever the reader's own. */
export type LiveLeagueOption = { id: number; name: string | null };

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
  /**
   * The one league whose standings this page is showing, or null (P14.T2).
   *
   * 🔴 One, not a list. `?league=<id>` pins it for whoever opens the link;
   * with no parameter it is the reader's own, and a reader with several gets
   * `leagueOptions` to choose from. Null for a stranger who was handed the
   * bare URL, and for a member with no seat anywhere.
   */
  league: LiveLeague | null;
  /**
   * The reader's own leagues, for the picker — **empty unless there is an
   * actual choice to make**, which is what the picker renders on. Never
   * populated for a signed-out reader: a pinned league is one league, not a
   * door to the rest.
   */
  leagueOptions: LiveLeagueOption[];
};

function toCategory(category: Category): LiveCategory {
  const nominees: LiveNominee[] = category.nominees.map((nominee) => ({
    nominationId: nominee.nominationId,
    movieId: nominee.movieId,
    title: nominee.title,
    posterUrl: posterUrl(nominee.posterPath, 'w342'),
    detailName: nominee.detailName,
    isWinner: nominee.isWinner,
  }));
  const winner = nominees.find((nominee) => nominee.isWinner);
  return {
    awardId: category.awardId,
    name: category.name,
    points: category.points,
    nominees,
    winner: winner
      ? { movieId: winner.movieId, title: winner.title, posterUrl: winner.posterUrl }
      : null,
  };
}

/**
 * One show as it resolves, plus one league's standings beside it.
 *
 * 🔴 **Which league, in three cases** (P14.T2, the owner's ruling):
 * `leagueId` pins one for whoever opens the link; with no pin a signed-in
 * reader gets their own (the first, with `leagueOptions` to switch when they
 * hold more than one); a signed-out reader with no pin gets none.
 *
 * 🔴 **A pinned league is readable by whoever opens the link, and that grants
 * nothing.** `/leagues/[id]` is already public (D44/D45) and shows a stranger
 * more than this does: the whole draft board, every seat's every pick, and the
 * same standings table from the same `getLeagueBoard` call. What this page adds
 * for a stranger is a narrowing — the seats' films that are in play at *this*
 * show. `live.test.ts` proves the subset rather than asserting it, and
 * `e2e/live.spec.ts` proves it against the rendered league page.
 *
 * 🔴 `userId` is `number | null` and still never becomes a sentinel it queries
 * with. Two things follow from a null and they are separate: no league is
 * resolved *from the reader* (D44 — `scoring.batching.test.ts` pins the
 * unpinned signed-out path as an equality against the show's own query cost),
 * and no seat is ever `isViewer`. The second is not decoration: `seat.userId`
 * is null on a dummy seat, so a bare `seat.userId === userId` would mark every
 * placeholder in the league "your seat" for a reader who has no seat at all.
 */
export async function getLiveShow(
  abbreviation: string,
  year: number,
  userId: number | null,
  leagueId: number | null = null,
): Promise<LiveShowView> {
  // The schedule columns are on the event row and `getAwardShow` does not
  // return them, so the event is read directly. It is also what answers
  // "is this even a show" before anything else is loaded.
  const event = await eventRepository.findByAbbreviation(abbreviation);
  if (!event) throw new NotFoundError('award show', abbreviation);

  const show = await getAwardShow(abbreviation, year);
  const categories = show.categories.map(toCategory);

  // The reader's own leagues. Not consulted for a signed-out reader at all —
  // and note this runs even when a league is pinned, because the picker is how
  // a member switches back to theirs.
  const own = userId == null ? [] : await draftRepository.findLeagueIdsByUserId(userId);
  const chosen = leagueId ?? own[0] ?? null;

  const [league, leagueOptions] = await Promise.all([
    chosen == null ? null : liveLeague(abbreviation, year, chosen, userId),
    // 🔴 Only when there is a choice. One league is not a picker, and asking
    // for its name would be a query spent on a control that never renders.
    own.length > 1
      ? leagueRepository
          .findManyByIds(own)
          .then((leagues) => leagues.map((row) => ({ id: row.id, name: row.name })))
      : [],
  ]);

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
    league,
    leagueOptions,
  };
}

/**
 * One league at this show: what each seat has taken tonight, and the season
 * table beside it.
 *
 * 🔴 **The board's ledger, narrowed — not a second scoring rule.**
 * `BoardPick.ledger` already carries every award a film earned this season,
 * each line naming its show, so "what has this seat taken tonight" is a filter
 * over numbers `getLeagueBoard` has already computed (D19/D41). Writing a
 * `pointsForEvent(...)` here would be the second definition of the rule, and
 * the first thing to disagree with the standings.
 *
 * 🔴 Returns null for a league id that is not one. `?league=` is a number in a
 * URL and a stranger can type anything into it — 404ing the ceremony because
 * the query string was wrong would take the show off the television over a
 * typo, so a league that does not exist is simply no league.
 */
async function liveLeague(
  abbreviation: string,
  year: number,
  leagueId: number,
  userId: number | null,
): Promise<LiveLeague | null> {
  let board: Awaited<ReturnType<typeof getLeagueBoard>>;
  try {
    board = await getLeagueBoard(leagueId, year);
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }

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
        // 🔴 `userId != null` first. A dummy seat's `userId` is null, so
        // without it every placeholder in a pinned league is "your seat" to
        // a reader who is signed out — which is both wrong and a claim about
        // somebody's identity on a page anyone can open.
        isViewer: userId != null && seat.userId === userId,
        earned: films.reduce((sum, film) => sum + film.earned, 0),
        films,
      };
    })
    // What the seat took tonight, biggest first — then by name, so the order
    // is total and does not shuffle between two seats on the same score.
    .sort((a, b) => b.earned - a.earned || a.name.localeCompare(b.name));

  // The season table, exactly as `/leagues/[id]` builds it: the board's own
  // seats sorted by their season total and dense-ranked by the shared util.
  // 🔴 Nothing here re-adds a score. `Seat.total` is `getLeagueBoard`'s, and
  // a dummy seat — which has no user — takes `-draftId` as its key, which no
  // real (positive) user id can collide with.
  const ranked = [...board.groups.flatMap((group) => group.seats)].sort(
    (a, b) => b.total - a.total,
  );
  const positions = denseRank(ranked);

  return {
    id: board.leagueId,
    name: board.leagueName,
    // 🔴 The sum of the seats, never a separate reduction over the picks: a
    // league total that did not add up to the seats printed under it would
    // be worse than showing no total at all (the `MovieLedger` rule).
    total: seats.reduce((sum, seat) => sum + seat.earned, 0),
    seats,
    standings: ranked.map((seat, index) => ({
      userId: seat.userId ?? -seat.draftId,
      name: seat.name,
      total: seat.total,
      position: positions[index] as number,
      isViewer: userId != null && seat.userId === userId,
    })),
  };
}

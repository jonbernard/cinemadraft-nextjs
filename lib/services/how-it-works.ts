import { awardRepository } from '@/lib/repositories/awards';
import { eventRepository } from '@/lib/repositories/events';
import { movieRepository } from '@/lib/repositories/movies';
import { pointRepository } from '@/lib/repositories/points';
import { posterUrl } from '@/lib/utils/poster';
import { availableSeasons, getLeaderboard } from './leaderboard';
import { ledgerForMovies, type MovieLedger } from './scoring';
import { groupPointsByLevel } from './scoring-table';
import { getActiveYear } from './season';

export type ExampleLine = {
  nominationId: number;
  awardName: string;
  eventName: string;
  points: number;
  won: boolean;
  earned: number;
};

export type Example = {
  movieId: number;
  title: string;
  posterUrl: string | null;
  /**
   * 🔴 Always `MovieLedger.total`, which is by construction the sum of
   * `lines` (lib/services/scoring.ts). Never the leaderboard row's own
   * figure and never a re-sum here: a second computation of the same number
   * is a second thing that can be wrong, and this page's whole claim is that
   * it cannot be.
   */
  total: number;
  lines: ExampleLine[];
};

export type WorkedExample = {
  /** The season these numbers are from. May not be the active season. */
  year: number;
  /** Whether `year` is the season the app is currently showing. */
  isActiveSeason: boolean;
  best: Example;
  /** Present only when the lowest-scoring film of the season is on a minus. */
  worst: Example | null;
};

/**
 * One real film, its real nominations and its real total — the thing
 * `/how-it-works` is built around (P18.T2).
 *
 * 🔴 **Nothing here computes a score.** The season is picked, two films are
 * chosen out of an already-sorted board, and their ledgers are handed back as
 * `lib/services/scoring.ts` produced them. That is the entire contract, and it
 * is what lets the page promise that every number on it traces to the scoring
 * rule.
 *
 * The board is reused rather than re-derived (`getLeaderboard` already scores
 * the season through `ledgerForMovies` and sorts by total) so the example's
 * total is *structurally* the same number the dashboard's leaderboard prints
 * for that film. The cost is scoring the season twice per request on this one
 * page; the benefit is that the two surfaces cannot disagree.
 *
 * Walks seasons newest-first from the active year down, because in October the
 * active season has no nominations yet and an empty front door is worse than
 * last season's. A future season is never reached for: showing 2027's empty
 * board as though it were live would be a lie the data does not tell.
 *
 * 🔴 Returns null on a database that has been migrated and not filled —
 * exactly what CI and a fresh deploy look like. The page renders its prose
 * without an example rather than a zero, and nothing here throws.
 */
export async function getWorkedExample(): Promise<WorkedExample | null> {
  const seasons = await availableSeasons();
  // `getActiveYear` throws when `available_years` is empty, which is a real
  // state on a freshly migrated database. Asking it only once there is a
  // season to ask about keeps that from becoming a 500 on the front door.
  if (seasons.length === 0) return null;

  const activeYear = await getActiveYear();
  const candidates = seasons.filter((year) => year <= activeYear).sort((a, b) => b - a);

  for (const year of candidates) {
    const board = await getLeaderboard(year);
    const top = board.rows[0];
    const bottom = board.rows[board.rows.length - 1];
    if (!top || !bottom) continue;

    const ids = [...new Set([top.movieId, bottom.movieId])];
    const [ledgers, movies] = await Promise.all([
      ledgerForMovies(ids, year),
      movieRepository.findManyByIds(ids),
    ]);

    const posterById = new Map(
      movies.map((movie) => [movie.id, posterUrl(movie.poster, 'w342')]),
    );

    const best = toExample(top.title, posterById, ledgers.get(top.movieId));
    if (!best) continue;

    const lowest = toExample(bottom.title, posterById, ledgers.get(bottom.movieId));

    return {
      year,
      isActiveSeason: year === activeYear,
      best,
      // A film on +5 is not a cautionary tale. Only a negative total earns the
      // Razzie section its example; otherwise the section keeps its prose and
      // the point table's own negative rows carry the claim.
      worst: lowest && lowest.total < 0 ? lowest : null,
    };
  }

  return null;
}

function toExample(
  title: string,
  posterById: ReadonlyMap<number, string | null>,
  ledger: MovieLedger | undefined,
): Example | null {
  if (!ledger || ledger.lines.length === 0) return null;

  return {
    movieId: ledger.movieId,
    title,
    posterUrl: posterById.get(ledger.movieId) ?? null,
    total: ledger.total,
    lines: ledger.lines.map((line) => ({
      nominationId: line.nominationId,
      awardName: line.awardName,
      eventName: line.eventName,
      points: line.points,
      won: line.won,
      earned: line.earned,
    })),
  };
}

/** A show, as `ShowsWall` renders it. */
export type ShowGroupShow = {
  eventId: number;
  name: string | null;
  abbreviation: string | null;
  imageUrl: string | null;
};

/** One scoring level with the shows that pay at it. */
export type ShowGroup = {
  level: string;
  tiers: { tier: number; points: number }[];
  shows: ShowGroupShow[];
};

/**
 * The twelve shows, grouped by what they pay (P18.T4).
 *
 * 🔴 **The join is awards, not events.** An event carries no level of its own:
 * `awards.points` is a foreign key into `points.id` (D41, and the reason the
 * repository renames it `pointsId`), and `points.level` is the group's name. So
 * a show's level is the level of the point rows its own categories reference —
 * which is why this is a service and not a repository method, and why the
 * plan's "events → points.level" phrasing was under-specified enough that
 * `ShowsWall` refused to guess it.
 *
 * A show whose awards reference several levels is counted under each — that
 * does not happen in the restored data and it is not this function's business
 * to declare it impossible.
 *
 * Groups come back in `groupPointsByLevel`'s order, which is most valuable
 * first, so the Razzies land last — where the page wants them.
 */
export async function getShowGroups(): Promise<ShowGroup[]> {
  const [points, events, awards] = await Promise.all([
    pointRepository.findAll(),
    eventRepository.findAll(),
    awardRepository.findAll(),
  ]);

  const levelByPointId = new Map<number, string>();
  for (const point of points) {
    if (point.level != null) levelByPointId.set(point.id, point.level);
  }

  const levelsByEventId = new Map<number, Set<string>>();
  for (const award of awards) {
    const level = award.pointsId == null ? undefined : levelByPointId.get(award.pointsId);
    if (level == null) continue;
    const levels = levelsByEventId.get(award.eventId);
    if (levels) levels.add(level);
    else levelsByEventId.set(award.eventId, new Set([level]));
  }

  return groupPointsByLevel(points).map((group) => ({
    level: group.level,
    tiers: group.tiers,
    shows: events
      .filter((event) => levelsByEventId.get(event.id)?.has(group.level))
      .map((event) => ({
        eventId: event.id,
        name: event.name,
        abbreviation: event.abbreviation,
        imageUrl: event.image,
      })),
  }));
}

/** A film the hero shows, with its poster and what it has scored so far. */
export type LandingFilm = {
  movieId: number;
  title: string;
  posterUrl: string | null;
  total: number;
};

/**
 * The figures and the artwork the front door opens with.
 *
 * 🔴 **Every one of these is counted, not claimed** (PRODUCT.md § Evidence on
 * Hand forbids inventing a metric, and this is the page a stranger judges the
 * product by). `shows` is the events table; `seasons` is how many seasons have
 * actually been played; `filmsScored` is how many films have scored in the
 * season being shown. There is no user count, no "trusted by", and no growth
 * figure, because none of those exist to count.
 *
 * The films are the season's highest scorers, in order, for the poster strip —
 * real artwork for real teams' picks rather than stock photography.
 */
export type LandingFacts = {
  year: number;
  isActiveSeason: boolean;
  shows: number;
  seasons: number;
  filmsScored: number;
  films: LandingFilm[];
};

export async function getLandingFacts(limit = 5): Promise<LandingFacts | null> {
  const seasons = await availableSeasons();
  if (seasons.length === 0) return null;

  const activeYear = await getActiveYear().catch(() => null);
  const year =
    activeYear != null && seasons.includes(activeYear)
      ? activeYear
      : (seasons[0] ?? null);
  if (year == null) return null;

  const [board, events] = await Promise.all([
    getLeaderboard(year),
    eventRepository.findAll(),
  ]);

  const top = board.rows.slice(0, limit);
  const posters = await movieRepository.findManyByIds(top.map((row) => row.movieId));
  const posterById = new Map(
    posters.map((movie) => [movie.id, posterUrl(movie.poster, 'w342')]),
  );

  return {
    year,
    isActiveSeason: year === activeYear,
    shows: events.length,
    seasons: seasons.length,
    filmsScored: board.rows.length,
    films: top.map((row) => ({
      movieId: row.movieId,
      title: row.title,
      posterUrl: posterById.get(row.movieId) ?? null,
      total: row.total,
    })),
  };
}

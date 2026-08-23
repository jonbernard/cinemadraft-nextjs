import { availableYearRepository } from '@/lib/repositories/available-years';
import { eventRepository } from '@/lib/repositories/events';
import { movieRepository } from '@/lib/repositories/movies';
import { nominationRepository } from '@/lib/repositories/nominations';
import { ledgerForMovies } from './scoring';

/** One award show, as a column of the grid. */
export type LeaderboardEvent = {
  abbreviation: string;
  name: string;
};

export type LeaderboardRow = {
  movieId: number;
  title: string;
  /**
   * One entry per column in `Leaderboard.events`, always — never only the
   * shows this film scored at. A missing key would read as "unknown" where
   * zero means "nominated elsewhere, not here" (the source's `defaultEvents`
   * exists for exactly this).
   */
  events: Record<string, number>;
  /** By construction the sum of `events`. */
  total: number;
};

export type Leaderboard = {
  year: number;
  events: LeaderboardEvent[];
  rows: LeaderboardRow[];
};

/**
 * The season leaderboard: one row per film nominated that year, one column
 * per award show, sorted by total descending (D41, P10.T4).
 *
 * Ported from `formatPointsForEventGrid`
 * (`server/routes/points.js:54-79`), but scored through `ledgerForMovies`
 * rather than a second implementation of the rule — grouping its lines by
 * `eventAbbreviation` is the same grid the source built by re-deriving points
 * per award inline, and it keeps this grid unable to disagree with any other
 * total in the app.
 */
export async function getLeaderboard(year: number): Promise<Leaderboard> {
  const nominations = await nominationRepository.findByYear(year);
  const movieIds = [...new Set(nominations.map((nomination) => nomination.movieId))];
  if (movieIds.length === 0) return { year, events: [], rows: [] };

  const [ledgers, movies, shows] = await Promise.all([
    ledgerForMovies(movieIds, year),
    movieRepository.findManyByIds(movieIds),
    // Column order needs each show's awards date, which a ledger line does
    // not carry (it only names the show). One extra query, not one per film.
    eventRepository.findAll(),
  ]);

  const dateByAbbreviation = new Map(
    shows.flatMap((show) =>
      show.abbreviation ? [[show.abbreviation, show.awardsDate]] : [],
    ),
  );

  const nameByAbbreviation = new Map<string, string>();
  for (const ledger of ledgers.values()) {
    for (const line of ledger.lines) {
      nameByAbbreviation.set(line.eventAbbreviation, line.eventName);
    }
  }

  // Undated shows sort last rather than to 1970, matching the dashboard's own
  // convention for a show with no scheduled date.
  const events: LeaderboardEvent[] = [...nameByAbbreviation.entries()]
    .map(([abbreviation, name]) => ({
      abbreviation,
      name,
      date: dateByAbbreviation.get(abbreviation) ?? null,
    }))
    .sort(
      (a, b) =>
        (a.date ?? Number.POSITIVE_INFINITY) - (b.date ?? Number.POSITIVE_INFINITY),
    )
    .map(({ abbreviation, name }) => ({ abbreviation, name }));

  const movieById = new Map(movies.map((movie) => [movie.id, movie]));

  const rows: LeaderboardRow[] = movieIds.flatMap((movieId) => {
    const movie = movieById.get(movieId);
    if (!movie) return [];

    const ledger = ledgers.get(movieId);
    const columns: Record<string, number> = {};
    for (const event of events) columns[event.abbreviation] = 0;
    for (const line of ledger?.lines ?? []) {
      columns[line.eventAbbreviation] =
        (columns[line.eventAbbreviation] ?? 0) + line.earned;
    }

    return [
      {
        movieId,
        title: movie.title ?? 'Untitled',
        events: columns,
        total: ledger?.total ?? 0,
      },
    ];
  });

  rows.sort((a, b) => b.total - a.total);

  return { year, events, rows };
}

/**
 * The seasons the year selector offers (D65's `?year=`), newest first.
 *
 * A thin pass-through, kept here rather than read from a repository
 * directly on the page: the page assembles no data of its own, it only
 * decides layout.
 */
export async function availableSeasons(): Promise<number[]> {
  return availableYearRepository.listYears();
}

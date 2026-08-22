import { movieRepository } from '@/lib/repositories/movies';
import {
  type SortDirection,
  type WatchlistProgressFilm,
  type WatchlistSortColumn,
  watchlistRepository,
} from '@/lib/repositories/watchlists';
import { posterUrl } from '@/lib/utils/poster';

/**
 * The watchlist page's four reads (P10.T33, T35, T36, T37).
 *
 * 🔴 **A watchlist here is films you have *watched*** (D64), so all three
 * progress views answer one question: how much of the season have you seen —
 * of every nominee, show by show; of the year's nominated films, most
 * nominated first; and of what your leagues actually drafted.
 *
 * Nothing on this page shows a score, deliberately. Seeing a film is not
 * scoring one, and a point total beside a nominee would read as a prediction of
 * what it will win.
 */

export type WatchlistFilm = {
  movieId: number;
  tmdbId: string | null;
  title: string;
  posterUrl: string | null;
  releaseDate: Date | null;
  watched: boolean;
};

export type WatchedEntry = WatchlistFilm & { entryId: number; markedAt: Date | null };

export type WatchedPage = {
  films: WatchedEntry[];
  count: number;
  page: number;
  pageCount: number;
};

export type ShowProgress = {
  show: string;
  awards: { award: string; nominees: (WatchlistFilm & { nominationId: number })[] }[];
  seenFilms: number;
  films: number;
  seenNominations: number;
  nominations: number;
};

export type NominatedProgress = {
  films: (WatchlistFilm & { nominations: number })[];
  seen: number;
  total: number;
};

export type LeagueProgress = {
  leagueId: number;
  league: string;
  films: WatchlistFilm[];
  seen: number;
  total: number;
};

/**
 * Ordering happens here rather than in SQL because sorting titles is a locale
 * question: Postgres would answer it with whatever collation the cluster was
 * created with, and "Emilia Pérez" would land after "Zootopia" under C.
 */
const byName = new Intl.Collator('en', { sensitivity: 'base' }).compare;

function toFilm(row: WatchlistProgressFilm): WatchlistFilm {
  return {
    movieId: row.movieId,
    tmdbId: row.tmdbId,
    title: row.title ?? 'Untitled',
    posterUrl: posterUrl(row.poster, 'w185'),
    releaseDate: row.releaseDate,
    watched: row.watched,
  };
}

/** The film's own sort key, falling back to its title where the column is null. */
function sortKey(row: WatchlistProgressFilm): string {
  return row.sortTitle ?? row.title ?? '';
}

/**
 * One page of the films this reader has marked watched.
 *
 * Two queries, whatever the page size: the entries, then the movies behind
 * them in one batch. The repository returns ids in the sorted order and that
 * order is preserved here — `findManyByIds` does not promise one.
 */
export async function loadWatchedFilms(input: {
  userId: number;
  page: number;
  sortBy: WatchlistSortColumn;
  direction: SortDirection;
}): Promise<WatchedPage> {
  const { entries, pagination } = await watchlistRepository.findPageByUser(input.userId, {
    page: input.page,
    sortBy: input.sortBy,
    direction: input.direction,
  });

  const movieIds = entries.flatMap((entry) =>
    entry.movieId === null ? [] : [entry.movieId],
  );
  const movies = await movieRepository.findManyByIds(movieIds);
  const byId = new Map(movies.map((movie) => [movie.id, movie]));

  const films = entries.flatMap((entry) => {
    // A watchlist row whose movie is gone is dropped rather than rendered as a
    // blank: this schema has no foreign keys, so the dangling row is possible
    // and there is nothing a reader could do with it.
    const movie = entry.movieId === null ? undefined : byId.get(entry.movieId);
    if (!movie) return [];

    return [
      {
        entryId: entry.id,
        movieId: movie.id,
        tmdbId: movie.tmdbId,
        title: movie.title ?? 'Untitled',
        posterUrl: posterUrl(movie.poster, 'w185'),
        releaseDate: movie.releaseDate,
        markedAt: entry.createdAt,
        watched: true,
      },
    ];
  });

  return {
    films,
    count: pagination.count,
    page: pagination.page,
    pageCount: pagination.pageCount,
  };
}

/**
 * Progress against a season's nominees, show by show.
 *
 * Two totals per show, because they answer different questions: 20 of 26
 * *nominations* is how much of the show's field you have seen, while 8 of 11
 * *films* is how many titles you would have to watch to close the gap. The
 * source computed both and it was right to.
 */
export async function loadShowProgress(
  userId: number,
  year: number,
): Promise<ShowProgress[]> {
  const rows = await watchlistRepository.findNomineeProgressByUser(userId, year);

  const shows = new Map<string, Map<string, typeof rows>>();
  for (const row of rows) {
    const awards = shows.get(row.showName) ?? new Map<string, typeof rows>();
    awards.set(row.awardName, [...(awards.get(row.awardName) ?? []), row]);
    shows.set(row.showName, awards);
  }

  return [...shows.entries()]
    .map(([show, awards]) => {
      const nominees = [...awards.values()].flat();
      const seenFilms = new Set(
        nominees.filter((row) => row.watched).map((row) => row.movieId),
      );

      return {
        show,
        awards: [...awards.entries()]
          .map(([award, group]) => ({
            award,
            nominees: group
              .slice()
              .sort((a, b) => byName(sortKey(a), sortKey(b)))
              .map((row) => ({ ...toFilm(row), nominationId: row.nominationId })),
          }))
          .sort((a, b) => byName(a.award, b.award)),
        seenFilms: seenFilms.size,
        films: new Set(nominees.map((row) => row.movieId)).size,
        seenNominations: nominees.filter((row) => row.watched).length,
        nominations: nominees.length,
      };
    })
    .sort((a, b) => byName(a.show, b.show));
}

/** The season's nominated films, most nominated first — ties broken by title. */
export async function loadNominatedProgress(
  userId: number,
  year: number,
): Promise<NominatedProgress> {
  const rows = await watchlistRepository.findNominatedFilmProgressByUser(userId, year);

  const films = rows
    .slice()
    .sort((a, b) => b.nominations - a.nominations || byName(sortKey(a), sortKey(b)))
    .map((row) => ({ ...toFilm(row), nominations: row.nominations }));

  return {
    films,
    seen: films.filter((film) => film.watched).length,
    total: films.length,
  };
}

/** What each of the reader's leagues drafted this season, and how much of it they have seen. */
export async function loadDraftedProgress(
  userId: number,
  year: number,
): Promise<LeagueProgress[]> {
  const rows = await watchlistRepository.findDraftedFilmProgressByUser(userId, year);

  const leagues = new Map<number, { name: string; rows: typeof rows }>();
  for (const row of rows) {
    const league = leagues.get(row.leagueId) ?? { name: row.leagueName, rows: [] };
    league.rows.push(row);
    leagues.set(row.leagueId, league);
  }

  return [...leagues.entries()]
    .map(([leagueId, league]) => {
      const films = league.rows
        .slice()
        .sort((a, b) => byName(sortKey(a), sortKey(b)))
        .map(toFilm);

      return {
        leagueId,
        league: league.name,
        films,
        seen: films.filter((film) => film.watched).length,
        total: films.length,
      };
    })
    .sort((a, b) => byName(a.league, b.league));
}

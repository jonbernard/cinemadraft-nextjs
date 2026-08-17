import { type BrowseWhen, discoverFilms } from '@/lib/external/tmdb-discover';
import { movieRepository } from '@/lib/repositories/movies';
import { watchlistRepository } from '@/lib/repositories/watchlists';
import { posterUrl } from '@/lib/utils/poster';

/**
 * The browse shelf: films grouped by release month, marked with what the reader
 * has already seen.
 *
 * The grouping is the page's whole structure — `MM/YYYY` in a card beside its
 * films, as the screenshot shows — and it belongs here rather than in the
 * component because the *order* of the groups is a judgement: looking back, the
 * newest month is the top of the page; looking forward, the soonest is.
 */

export type BrowseFilm = {
  tmdbId: string;
  title: string;
  posterUrl: string;
  releaseDate: Date | null;
  /** Whether this reader has marked it watched (D64). Always false when logged out. */
  watched: boolean;
};

export type BrowseMonth = {
  /** `08/2026`, or `Undated`. */
  label: string;
  films: BrowseFilm[];
};

export type BrowsePage = {
  when: BrowseWhen;
  page: number;
  pageCount: number;
  months: BrowseMonth[];
};

/** Films TMDB has announced without a date, kept rather than hidden. */
const UNDATED = 'Undated';

/**
 * `MM/YYYY`, in UTC.
 *
 * 🔴 The time zone is explicit and load-bearing. Without it a film released on
 * the 1st falls into the previous month for every reader west of UTC — so the
 * page would group differently depending on who was looking at it, and would
 * disagree with the release date printed on the film's own page.
 */
function monthLabel(date: Date | null): string {
  if (!date) return UNDATED;
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${month}/${date.getUTCFullYear()}`;
}

/**
 * A label back into a sortable number, so the groups can be ordered without
 * carrying a second field.
 */
function monthOrder(label: string): number {
  if (label === UNDATED) return Number.POSITIVE_INFINITY;
  const [month, year] = label.split('/');
  return Number(year) * 12 + Number(month);
}

/**
 * Which of these films the reader has marked watched.
 *
 * 🔴 **Two queries at most, never one per film**, and none at all for an
 * anonymous reader. The ids in hand are *TMDB* ids while `watchlists` stores
 * local ones, so this resolves the local rows first and then asks about all of
 * them together. The naive shape — `isFilmWatched` per poster — would be forty
 * round trips for one shelf, which is the N+1 that `countQueries` exists to
 * catch (D59).
 */
async function watchedTmdbIds(
  tmdbIds: readonly string[],
  userId: number | null,
): Promise<Set<string>> {
  if (userId == null || tmdbIds.length === 0) return new Set();

  const movies = await movieRepository.findManyByTmdbIds(tmdbIds);
  if (movies.length === 0) return new Set();

  const localToTmdb = new Map<number, string>();
  for (const movie of movies) {
    if (movie.tmdbId) localToTmdb.set(movie.id, movie.tmdbId);
  }

  const entries = await watchlistRepository.findByUserAndMovieIds(userId, [
    ...localToTmdb.keys(),
  ]);

  return new Set(
    entries.flatMap((entry) => {
      const tmdbId = entry.movieId == null ? undefined : localToTmdb.get(entry.movieId);
      return tmdbId ? [tmdbId] : [];
    }),
  );
}

/**
 * One page of the browse shelf.
 *
 * Groups are ordered to match the direction the reader is looking: newest first
 * on the past side, soonest first on the future side. Undated films always sort
 * last — they are announcements, not releases, and they would otherwise land at
 * an arbitrary end of the page.
 */
export async function loadBrowse(input: {
  when: BrowseWhen;
  page: number;
  userId: number | null;
}): Promise<BrowsePage> {
  const discovered = await discoverFilms({ when: input.when, page: input.page });
  const watched = await watchedTmdbIds(
    discovered.films.map((film) => film.tmdbId),
    input.userId,
  );

  const byMonth = new Map<string, BrowseFilm[]>();
  for (const film of discovered.films) {
    const label = monthLabel(film.releaseDate);
    const entry: BrowseFilm = {
      tmdbId: film.tmdbId,
      title: film.title,
      // Non-null: `discoverFilms` drops posterless films, so this cannot be null
      // — and the shelf is artwork, so a grid of grey placeholders would fail it.
      posterUrl: posterUrl(film.posterPath, 'w342') as string,
      releaseDate: film.releaseDate,
      watched: watched.has(film.tmdbId),
    };
    const existing = byMonth.get(label);
    if (existing) existing.push(entry);
    else byMonth.set(label, [entry]);
  }

  const direction = input.when === 'past' ? -1 : 1;
  const months = [...byMonth.entries()]
    .map(([label, films]) => ({ label, films }))
    .sort((a, b) => {
      const left = monthOrder(a.label);
      const right = monthOrder(b.label);
      // Undated last on both sides, so the comparison cannot be a plain
      // multiply — Infinity × -1 would put it first when looking back.
      if (left === Number.POSITIVE_INFINITY) return 1;
      if (right === Number.POSITIVE_INFINITY) return -1;
      return (left - right) * direction;
    });

  return {
    when: input.when,
    page: discovered.page,
    pageCount: discovered.pageCount,
    months,
  };
}

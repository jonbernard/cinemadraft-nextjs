import { ConflictError, NotFoundError } from '@/lib/errors';
import { availableYearRepository } from '@/lib/repositories/available-years';
import { type ListStatus, listRepository } from '@/lib/repositories/lists';
import { movieRepository } from '@/lib/repositories/movies';
import { posterUrl } from '@/lib/utils/poster';
import { resolveFilm } from './film-ingest';

export type DraftListEntry = {
  entryId: number;
  movieId: number | null;
  title: string;
  posterUrl: string | null;
  releaseYear: number | null;
  status: ListStatus;
};

/**
 * A member's private ranked shortlist for one season.
 *
 * Nobody else reads it and it has no bearing on scoring, which is why every
 * function here is keyed on `userId` first: there is no such thing as somebody
 * else's row being relevant, so ownership is a parameter rather than a check.
 *
 * The join to `movies` is manual. `lists` declares no foreign keys — nothing in
 * this schema does — so the films are fetched in one batched read and matched
 * in memory, the same shape every other service here uses.
 */
export async function getDraftList(
  userId: number,
  year: number,
): Promise<DraftListEntry[]> {
  const entries = await listRepository.findByUserAndYear(userId, year);
  if (entries.length === 0) return [];

  const movieIds = entries.flatMap((entry) =>
    entry.movieId == null ? [] : [entry.movieId],
  );
  const movies = await movieRepository.findManyByIds(movieIds);
  const byId = new Map(movies.map((movie) => [movie.id, movie]));

  return entries.map((entry) => {
    const movie = entry.movieId == null ? undefined : byId.get(entry.movieId);
    return {
      entryId: entry.id,
      movieId: entry.movieId,
      // 🔴 A row whose film is missing is kept, not dropped. `lists.movie_id`
      // has no foreign key, so a film deleted out from under an entry leaves
      // one — and a row that does not render is a row nobody can remove.
      title: movie?.title ?? 'Film no longer in the catalogue',
      posterUrl: posterUrl(movie?.poster ?? null, 'w185'),
      releaseYear: movie?.releaseDate?.getUTCFullYear() ?? null,
      status: entry.status ?? 'none',
    };
  });
}

/**
 * A year this app has a season for.
 *
 * 🔴 Source bug 10: `POST /lists/:year` took whatever single path segment it
 * was given, ignored it, and wrote `req.body.year` instead — so `/lists/banana`
 * was a valid request and the year that landed in the row was whatever the
 * client claimed. Here the year is checked against `available_years`, which is
 * the same table the season picker reads, so a list can only ever be written
 * for a season the app knows about.
 */
async function requireSeason(year: number): Promise<void> {
  const seasons = await availableYearRepository.listYears();
  if (!seasons.includes(year)) throw new NotFoundError('season', year);
}

/**
 * Put a film at the end of the list.
 *
 * Accepts either identifier because search returns both kinds of result, and a
 * TMDB-only film is ingested on the way through — this is a logged-in member
 * pressing a button, which is the case D63 permits.
 */
export async function addToDraftList(input: {
  userId: number;
  year: number;
  movieId?: number | null;
  tmdbId?: string | null;
}): Promise<DraftListEntry> {
  await requireSeason(input.year);

  const movie = await resolveFilm({ movieId: input.movieId, tmdbId: input.tmdbId });

  const existing = await listRepository.findByUserYearAndMovie(
    input.userId,
    input.year,
    movie.id,
  );
  if (existing) {
    throw new ConflictError(`${movie.title ?? 'that film'} is already on your list`);
  }

  const current = await listRepository.findByUserAndYear(input.userId, input.year);
  // The highest stored position rather than the row count: legacy rows are
  // 0-based and a list that has never been reordered may start at 0, so
  // counting would collide with the last entry.
  const last = current.reduce((highest, entry) => Math.max(highest, entry.order), 0);

  const created = await listRepository.create({
    userId: input.userId,
    movieId: movie.id,
    year: input.year,
    order: last + 1,
  });

  return {
    entryId: created.id,
    movieId: movie.id,
    title: movie.title ?? 'Untitled',
    posterUrl: posterUrl(movie.poster, 'w185'),
    releaseYear: movie.releaseDate?.getUTCFullYear() ?? null,
    status: created.status ?? 'none',
  };
}

export async function removeFromDraftList(
  userId: number,
  entryId: number,
): Promise<void> {
  await listRepository.deleteByIdForUser(entryId, userId);
}

export async function setDraftListStatus(
  userId: number,
  entryId: number,
  status: ListStatus,
): Promise<void> {
  await listRepository.setStatus(entryId, userId, status);
}

/**
 * Rewrite the ordering.
 *
 * 🔴 **The list must be a permutation of the member's own entries for that
 * season** — every entry present, exactly once, nothing from anywhere else.
 * Checked against the stored rows rather than trusted: a partial list would
 * renumber some entries and leave the rest at their old positions, which is the
 * duplicate-`order` state the page cannot render in a single sequence.
 */
export async function reorderDraftList(input: {
  userId: number;
  year: number;
  entryIds: readonly number[];
}): Promise<void> {
  await requireSeason(input.year);

  const current = await listRepository.findByUserAndYear(input.userId, input.year);
  const wanted = new Set(input.entryIds);
  const isPermutation =
    wanted.size === input.entryIds.length &&
    wanted.size === current.length &&
    current.every((entry) => wanted.has(entry.id));

  if (!isPermutation) {
    throw new ConflictError('that ordering does not match your list');
  }

  await listRepository.reorder(input.userId, input.year, input.entryIds);
}

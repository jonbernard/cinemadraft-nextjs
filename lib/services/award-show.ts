import { NotFoundError } from '@/lib/errors';
import { awardRepository } from '@/lib/repositories/awards';
import { type Event, eventRepository } from '@/lib/repositories/events';
import { type Movie, movieRepository } from '@/lib/repositories/movies';
import { nominationRepository } from '@/lib/repositories/nominations';
import { pointRepository } from '@/lib/repositories/points';
import { winnerRepository } from '@/lib/repositories/winners';
import { posterUrl } from '@/lib/utils/poster';

export type Nominee = {
  nominationId: number;
  movieId: number;
  title: string;
  posterUrl: string | null;
  /** The person, for categories that nominate one. */
  detailName: string | null;
  detailCharacter: string | null;
  isWinner: boolean;
};

export type Category = {
  awardId: number;
  name: string;
  /**
   * What a nomination in this category is worth. A win is worth it a second
   * time, so the category is worth `2 × points` to whoever wins it (D41).
   */
  points: number;
  /** True where the nomination names a person, not just a film. */
  requiresNomineeName: boolean;
  nominees: Nominee[];
  /** True once someone has been marked the winner. */
  hasWinner: boolean;
};

export type AwardShowView = {
  eventId: number;
  abbreviation: string;
  name: string;
  year: number;
  categories: Category[];
  /** The source's own flags for "this show still needs entering". */
  needsNominations: boolean;
  needsWinners: boolean;
};

export type AwardShowSummary = {
  eventId: number;
  abbreviation: string;
  name: string;
  categoryCount: number;
  needsNominations: boolean;
  needsWinners: boolean;
};

/**
 * 🔴 What a category is worth.
 *
 * `awards.points` is **not** a point value — it is a foreign key into
 * `points.id`, which the repository exposes as `pointsId` for exactly this
 * reason (D41). "Performance by an Ensemble" stores `1`, which is the
 * Alphabet tier-3 row, worth **5**.
 *
 * A page that printed `award.points` would print `1` beside a category worth
 * five, and every reader would take it as fact. This is the same trap that
 * would have corrupted scoring; it is resolved in exactly one way, here and in
 * `scoring.ts`, and nowhere else.
 */
async function resolvePoints(
  pointsIds: readonly (number | null)[],
): Promise<Map<number, number>> {
  const ids = [...new Set(pointsIds.flatMap((id) => (id == null ? [] : [id])))];
  const rows = await pointRepository.findManyByIds(ids);
  return new Map(rows.map((row) => [row.id, row.points ?? 0]));
}

function toNominee(
  nomination: {
    id: number;
    movieId: number;
    detailName: string | null;
    detailCharacter: string | null;
  },
  movie: Movie | undefined,
  winningMovieIds: ReadonlySet<number>,
): Nominee {
  return {
    nominationId: nomination.id,
    movieId: nomination.movieId,
    title: movie?.title ?? 'Untitled',
    posterUrl: posterUrl(movie?.poster ?? null, 'w185'),
    detailName: nomination.detailName,
    detailCharacter: nomination.detailCharacter,
    isWinner: winningMovieIds.has(nomination.movieId),
  };
}

/**
 * One award show for one season: its categories, nominees and winners.
 *
 * This is the page the whole scoring pipeline reads from, so it is assembled
 * from the repositories that already exist rather than a second query path —
 * whatever the standings say a film earned, this page has to explain.
 *
 * 🔴 `nominations.year` is TEXT while `winners.year` is INTEGER. That is not a
 * quirk to paper over here; it is the actual schema, and each repository is
 * given the type its column has. A single "year" variable passed to both would
 * work in Postgres by implicit cast and fail the moment either side is
 * type-checked.
 */
export async function getAwardShow(
  abbreviation: string,
  year: number,
): Promise<AwardShowView> {
  const event = await eventRepository.findByAbbreviation(abbreviation);
  if (!event) throw new NotFoundError('award show', abbreviation);

  const awards = await awardRepository.findByEventId(event.id);
  const awardIds = awards.map((award) => award.id);

  const [nominations, winners, pointsById] = await Promise.all([
    nominationRepository.findManyByAwardIds(awardIds, String(year)),
    winnerRepository.findManyByAwardIds(awardIds, year),
    resolvePoints(awards.map((award) => award.pointsId)),
  ]);

  const movies = await movieRepository.findManyByIds([
    ...new Set(nominations.map((nomination) => nomination.movieId)),
  ]);
  const movieById = new Map(movies.map((movie) => [movie.id, movie]));

  const winnersByAward = new Map<number, Set<number>>();
  for (const winner of winners) {
    const existing = winnersByAward.get(winner.awardId);
    if (existing) existing.add(winner.movieId);
    else winnersByAward.set(winner.awardId, new Set([winner.movieId]));
  }

  const nominationsByAward = new Map<number, typeof nominations>();
  for (const nomination of nominations) {
    const existing = nominationsByAward.get(nomination.awardId);
    if (existing) existing.push(nomination);
    else nominationsByAward.set(nomination.awardId, [nomination]);
  }

  const categories: Category[] = awards
    .map((award) => {
      const winning = winnersByAward.get(award.id) ?? new Set<number>();
      const own = nominationsByAward.get(award.id) ?? [];

      return {
        awardId: award.id,
        name: award.name,
        points: award.pointsId == null ? 0 : (pointsById.get(award.pointsId) ?? 0),
        requiresNomineeName: award.requiresNomineeName === true,
        nominees: own.map((nomination) =>
          toNominee(nomination, movieById.get(nomination.movieId), winning),
        ),
        hasWinner: winning.size > 0,
      };
    })
    // By name, as the source page did — the order categories are announced in
    // is not recorded anywhere, so alphabetical is at least predictable.
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    eventId: event.id,
    abbreviation: event.abbreviation,
    name: event.name,
    year,
    categories,
    needsNominations: event.nomActive === true,
    needsWinners: event.awardsActive === true,
  };
}

/** Every award show, for the index page. */
export async function getAwardShows(): Promise<AwardShowSummary[]> {
  const events = await eventRepository.findAll();
  const awards = await awardRepository.findAll();

  const countByEvent = new Map<number, number>();
  for (const award of awards) {
    countByEvent.set(award.eventId, (countByEvent.get(award.eventId) ?? 0) + 1);
  }

  return events.map((event: Event) => ({
    eventId: event.id,
    abbreviation: event.abbreviation,
    name: event.name,
    categoryCount: countByEvent.get(event.id) ?? 0,
    needsNominations: event.nomActive === true,
    needsWinners: event.awardsActive === true,
  }));
}

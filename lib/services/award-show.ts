import { NotFoundError } from '@/lib/errors';
import { awardRepository } from '@/lib/repositories/awards';
import { type Event, eventRepository } from '@/lib/repositories/events';
import { type Movie, movieRepository } from '@/lib/repositories/movies';
import { nominationRepository } from '@/lib/repositories/nominations';
import { pointRepository } from '@/lib/repositories/points';
import { winnerRepository } from '@/lib/repositories/winners';
import { posterUrl } from '@/lib/utils/poster';
import { entryStatus } from './entry-status';

export type Nominee = {
  nominationId: number;
  movieId: number;
  title: string;
  posterUrl: string | null;
  /**
   * The bare TMDB path, so a renderer that needs a different bucket can build
   * its own URL. `lib/utils/poster.ts` says outright that the host and the size
   * belong to the renderer rather than to the row, and the `posterUrl` above is
   * this page's own choice of `w185`. `/live/[abbr]` is read from across a room
   * and picks `w342`; without this it would have to string-edit a URL.
   */
  posterPath: string | null;
  /** The person, for categories that nominate one. */
  detailName: string | null;
  detailCharacter: string | null;
  /** TMDB's person id, so the admin's picker can tell who is already up. */
  detailId: number | null;
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
  /**
   * `events.awards_active`: the ceremony is being broadcast now, so `/live`
   * streams it. Not "needs winners" — that is derived, on the index page.
   */
  onAir: boolean;
  /** The show's mark, a Blob URL since Phase 11. */
  imageUrl: string | null;
};

export type AwardShowSummary = {
  eventId: number;
  abbreviation: string;
  name: string;
  categoryCount: number;
  /**
   * Derived from the show's dates and this season's entries
   * (`./entry-status.ts`) — never from `nom_active`, which nothing sets.
   */
  needsNominations: boolean;
  needsWinners: boolean;
  /** The show's mark, a Blob URL since Phase 11. */
  imageUrl: string | null;
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
    detailId: number | null;
  },
  movie: Movie | undefined,
  winningNominationIds: ReadonlySet<number>,
): Nominee {
  return {
    nominationId: nomination.id,
    movieId: nomination.movieId,
    title: movie?.title ?? 'Untitled',
    posterUrl: posterUrl(movie?.poster ?? null, 'w185'),
    posterPath: movie?.poster ?? null,
    detailName: nomination.detailName,
    detailCharacter: nomination.detailCharacter,
    detailId: nomination.detailId,
    isWinner: winningNominationIds.has(nomination.id),
  };
}

/**
 * One award show for one season: its categories, nominees and winners.
 *
 * This is the page the whole scoring pipeline reads from, so it is assembled
 * from the repositories that already exist rather than a second query path —
 * whatever the standings say a film earned, this page has to explain.
 *
 * Both repositories take the season as a number. `nominations.year` was TEXT
 * until `20260816120000_nominations_year_integer` — the one year column in the
 * schema that was — and this function used to convert on the way in.
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
    nominationRepository.findManyByAwardIds(awardIds, year),
    winnerRepository.findManyByAwardIds(awardIds, year),
    resolvePoints(awards.map((award) => award.pointsId)),
  ]);

  const movies = await movieRepository.findManyByIds([
    ...new Set(nominations.map((nomination) => nomination.movieId)),
  ]);
  const movieById = new Map(movies.map((movie) => [movie.id, movie]));

  // 🔴 By nomination, not by film. One film can hold two nominations in one
  // category — *One Battle After Another* for Benicio del Toro and for Sean
  // Penn — and matching the win on `movieId` crowned both. `nomination_id` is
  // measured sound in the restored data: all 734 point at a nomination with the
  // winner's own award, film and year, so there is no by-film fallback to keep.
  const winnersByAward = new Map<number, Set<number>>();
  for (const winner of winners) {
    const existing = winnersByAward.get(winner.awardId);
    if (existing) existing.add(winner.nominationId);
    else winnersByAward.set(winner.awardId, new Set([winner.nominationId]));
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
    onAir: event.awardsActive === true,
    imageUrl: event.image,
  };
}

/**
 * Every award show, for the index page, with what is still to enter for
 * `season`.
 *
 * Two season-wide reads rather than one per show: the index lists all twelve,
 * and the question for each is only "any nominations yet?" and "any category
 * with nominees but no winner?".
 */
export async function getAwardShows(
  season: number,
  now: number = Date.now(),
): Promise<AwardShowSummary[]> {
  const [events, awards, nominations, winners] = await Promise.all([
    eventRepository.findAll(),
    awardRepository.findAll(),
    nominationRepository.findByYear(season),
    winnerRepository.findByYear(season),
  ]);

  const eventOfAward = new Map(awards.map((award) => [award.id, award.eventId]));
  const countByEvent = new Map<number, number>();
  for (const award of awards) {
    countByEvent.set(award.eventId, (countByEvent.get(award.eventId) ?? 0) + 1);
  }

  const nominated = new Set(nominations.map((nomination) => nomination.awardId));
  const decided = new Set(winners.map((winner) => winner.awardId));
  const entries = new Map<
    number,
    { nominations: number; categoriesWithNominees: number; categoriesDecided: number }
  >();
  const entriesOf = (eventId: number) => {
    let entry = entries.get(eventId);
    if (!entry) {
      entry = { nominations: 0, categoriesWithNominees: 0, categoriesDecided: 0 };
      entries.set(eventId, entry);
    }
    return entry;
  };
  for (const nomination of nominations) {
    const eventId = eventOfAward.get(nomination.awardId);
    if (eventId != null) entriesOf(eventId).nominations += 1;
  }
  for (const awardId of nominated) {
    const eventId = eventOfAward.get(awardId);
    if (eventId == null) continue;
    entriesOf(eventId).categoriesWithNominees += 1;
    if (decided.has(awardId)) entriesOf(eventId).categoriesDecided += 1;
  }

  return events.map((event: Event) => ({
    eventId: event.id,
    abbreviation: event.abbreviation,
    name: event.name,
    categoryCount: countByEvent.get(event.id) ?? 0,
    ...entryStatus(event, season, entriesOf(event.id), now),
    imageUrl: event.image,
  }));
}

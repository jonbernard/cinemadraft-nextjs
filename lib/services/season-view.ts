import { awardRepository } from '@/lib/repositories/awards';
import { eventRepository } from '@/lib/repositories/events';
import { movieRepository } from '@/lib/repositories/movies';
import { nominationRepository } from '@/lib/repositories/nominations';
import { winnerRepository } from '@/lib/repositories/winners';
import { getSeasonMoments, type Moment } from './moments';
import { getActiveYear } from './season';

/** "Up next" names at most this many films, then "and N more" (owner, §4). */
export const UP_NEXT_FILMS = 8;

export type SeasonMoment = Moment & {
  /** Categories in play this season: those with nominees, or the show's own count before any. */
  categories: number;
  /** The most-nominated film at a finished nominations moment, the most wins at a finished ceremony; only a clear standout. */
  highlight: { title: string; count: number } | null;
};

export type UpNextFilm = { title: string; tmdbId: string | null; count: number };

export type SeasonView = {
  year: number;
  /** True when the active year has nothing yet: the view shows `year` (the finished season) and says dates come in the autumn. */
  offSeason: boolean;
  activeYear: number;
  months: { label: string; moments: SeasonMoment[] }[];
  next:
    | (SeasonMoment & { films: UpNextFilm[]; more: number; imageUrl: string | null })
    | null;
};

const monthLabel = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export const NOT_SCHEDULED = 'Not yet scheduled';
export const NOT_RECORDED = 'Date not recorded';

/** The active season has begun once one of its moments is dated or has nominations. */
function hasBegun(moments: readonly Moment[]): boolean {
  return moments.some((m) => m.date != null || m.nominations > 0);
}

/**
 * `/award-shows`' season: every moment in date order, grouped by month, and
 * what is up next (P16.T15). Public (D44), and it names no seat and no
 * league: the per-league lines are `getSeasonViewer`'s, signed in only.
 *
 * 🔴 **Which year.** `?year=` when given (any positive year, as the show page
 * takes it). Otherwise the active year, unless it has not begun: then the
 * season before, with `offSeason`, because October's reader wants the season
 * that just finished, not twelve undated rows.
 */
export async function getSeasonView(requestedYear: number | null): Promise<SeasonView> {
  const activeYear = await getActiveYear();
  let year = requestedYear ?? activeYear;
  let moments = await getSeasonMoments(year);
  let offSeason = false;
  if (requestedYear == null && !hasBegun(moments)) {
    year = activeYear - 1;
    moments = await getSeasonMoments(year);
    offSeason = true;
  }

  const [awards, nominations, winners] = await Promise.all([
    awardRepository.findAll(),
    nominationRepository.findByYear(year),
    winnerRepository.findByYear(year),
  ]);
  const eventOfAward = new Map(awards.map((award) => [award.id, award.eventId]));
  const movies = await movieRepository.findManyByIds([
    ...new Set(nominations.map((n) => n.movieId)),
  ]);
  const movieById = new Map(movies.map((movie) => [movie.id, movie]));

  /** eventId → movieId → count. */
  const tally = (rows: readonly { awardId: number; movieId: number }[]) => {
    const byEvent = new Map<number, Map<number, number>>();
    for (const row of rows) {
      const eventId = eventOfAward.get(row.awardId);
      if (eventId == null) continue;
      const films = byEvent.get(eventId) ?? new Map<number, number>();
      films.set(row.movieId, (films.get(row.movieId) ?? 0) + 1);
      byEvent.set(eventId, films);
    }
    return byEvent;
  };
  const nominated = tally(nominations);
  const won = tally(winners);

  const showCategories = new Map<number, number>();
  for (const award of awards) {
    showCategories.set(award.eventId, (showCategories.get(award.eventId) ?? 0) + 1);
  }
  const categoriesInPlay = new Map<number, number>();
  for (const awardId of new Set(nominations.map((n) => n.awardId))) {
    const eventId = eventOfAward.get(awardId);
    if (eventId != null)
      categoriesInPlay.set(eventId, (categoriesInPlay.get(eventId) ?? 0) + 1);
  }

  /** Films at a show, most first, then by title. */
  const ranked = (films: ReadonlyMap<number, number> | undefined): UpNextFilm[] =>
    [...(films ?? [])]
      .map(([movieId, count]) => {
        const movie = movieById.get(movieId);
        return {
          title: movie?.title ?? 'Untitled',
          tmdbId: movie?.tmdbId ?? null,
          count,
        };
      })
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));

  const view: SeasonMoment[] = moments.map((moment) => {
    // A headline only when one film stands out: more than one, and alone at
    // the top. "Most nominated: X, 1" among ten films with one each says nothing.
    const [top, second] =
      moment.state === 'finished'
        ? ranked((moment.phase === 'ceremony' ? won : nominated).get(moment.eventId))
        : [];
    const standout = top && top.count > 1 && (second?.count ?? 0) < top.count;
    return {
      ...moment,
      categories:
        categoriesInPlay.get(moment.eventId) ?? showCategories.get(moment.eventId) ?? 0,
      highlight: standout ? { title: top.title, count: top.count } : null,
    };
  });

  const months: SeasonView['months'] = [];
  const undated = new Map<string, SeasonMoment[]>();
  for (const moment of view) {
    if (moment.date == null) {
      const label = moment.state === 'upcoming' ? NOT_SCHEDULED : NOT_RECORDED;
      undated.set(label, [...(undated.get(label) ?? []), moment]);
      continue;
    }
    const label = monthLabel.format(moment.date);
    const month = months.at(-1);
    if (month?.label === label) month.moments.push(moment);
    else months.push({ label, moments: [moment] });
  }
  for (const label of [NOT_RECORDED, NOT_SCHEDULED]) {
    const list = undated.get(label);
    if (list) months.push({ label, moments: list });
  }

  // The next dated moment still to come; an undated one only when none is dated.
  const pending = view.filter((m) => m.state !== 'finished');
  const upcoming = pending.find((m) => m.date != null) ?? pending[0];
  let next: SeasonView['next'] = null;
  if (upcoming) {
    // Before its nominations are out a moment has no films to name.
    const films =
      upcoming.phase === 'ceremony' ? ranked(nominated.get(upcoming.eventId)) : [];
    const event = await eventRepository.findByAbbreviation(upcoming.abbreviation);
    next = {
      ...upcoming,
      imageUrl: event?.image ?? null,
      films: films.slice(0, UP_NEXT_FILMS),
      more: Math.max(0, films.length - UP_NEXT_FILMS),
    };
  }

  return { year, offSeason, activeYear, months, next };
}

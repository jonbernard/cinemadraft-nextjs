import { awardRepository } from '@/lib/repositories/awards';
import { draftRepository } from '@/lib/repositories/drafts';
import { eventRepository } from '@/lib/repositories/events';
import { movieRepository } from '@/lib/repositories/movies';
import { nominationRepository } from '@/lib/repositories/nominations';
import { winnerRepository } from '@/lib/repositories/winners';
import { getLeagueBoard } from './draft';
import { getSeasonMoments, type Moment } from './moments';
import { getActiveYear } from './season';
import { buildSeasonLedger } from './season-ledger';

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

/** The next dated moment still to come; an undated one only when none is dated. */
function nextMoment<M extends Moment>(moments: readonly M[]): M | undefined {
  const pending = moments.filter((m) => m.state !== 'finished');
  return pending.find((m) => m.date != null) ?? pending[0];
}

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

  const upcoming = nextMoment(view);
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

export type SeasonViewer = {
  leagues: {
    leagueId: number;
    name: string;
    /** moment.key → { points, position, move } for the reader's seat; finished moments only. */
    byMoment: ReadonlyMap<string, { points: number; position: number; move: number }>;
  }[];
  /** For the next ceremony: the reader's nominations at stake. */
  atStake: {
    films: { title: string; tmdbId: string | null; category: string }[];
    points: number;
    more: number;
  } | null;
};

// ponytail: one board load per league; raise when someone plays in more than five
export const MAX_LEAGUES = 5;

/**
 * What each moment did to the reader, league by league (P16.T16).
 *
 * The leagues where the reader holds a seat in `year` and that have a rival
 * (two seats or more), newest league first, up to `MAX_LEAGUES`. Every figure
 * is `buildSeasonLedger`'s, so a line here cannot disagree with the board.
 *
 * 🔴 **Finished moments only** (owner, §4). A live ceremony is half entered,
 * and a line would announce a rank the next winner changes; `/live` is where
 * the night is followed. Signed in only: the page never calls this without a
 * user, so a stranger's request costs none of these board loads.
 */
export async function getSeasonViewer(
  userId: number,
  year: number,
): Promise<SeasonViewer> {
  const drafts = await draftRepository.findByUserId(userId);
  const candidates = [
    ...new Set(
      drafts.flatMap((d) => (d.year === year && d.leagueId != null ? [d.leagueId] : [])),
    ),
  ].sort((a, b) => b - a);
  const moments = await getSeasonMoments(year);

  const leagues: SeasonViewer['leagues'] = [];
  /** The reader's undecided nominations, each once across leagues: nominationId → line. */
  const held = new Map<
    number,
    {
      title: string;
      tmdbId: string | null;
      category: string;
      show: string;
      points: number;
    }
  >();
  for (const leagueId of candidates) {
    if (leagues.length === MAX_LEAGUES) break;
    const board = await getLeagueBoard(leagueId, year);
    const seats = board.groups.flatMap((group) => group.seats);
    const mine = seats.find((seat) => seat.userId === userId);
    if (!mine || seats.length < 2) continue;

    const ledger = buildSeasonLedger(seats, moments, userId);
    const byMoment = new Map<
      string,
      { points: number; position: number; move: number }
    >();
    for (const step of ledger.steps) {
      if (step.moment.state !== 'finished') continue;
      byMoment.set(step.moment.key, {
        points: step.delta.get(mine.draftId) ?? 0,
        position: step.standings.find((row) => row.isViewer)?.position ?? 0,
        move: step.moves.get(mine.draftId) ?? 0,
      });
    }
    leagues.push({ leagueId, name: board.leagueName ?? `League ${leagueId}`, byMoment });

    for (const pick of mine.picks) {
      for (const line of pick.ledger) {
        if (line.won) continue;
        held.set(line.nominationId, {
          title: pick.movie.title ?? 'Untitled',
          tmdbId: pick.movie.tmdbId,
          category: line.awardName,
          show: line.eventAbbreviation,
          points: line.points,
        });
      }
    }
  }

  const next = nextMoment(moments);
  let atStake: SeasonViewer['atStake'] = null;
  if (next?.phase === 'ceremony' && next.state === 'upcoming' && leagues.length > 0) {
    // A win is worth a nomination's points a second time: that is what is at stake.
    const lines = [...held.values()].filter((line) => line.show === next.abbreviation);
    atStake = {
      films: lines
        .slice(0, UP_NEXT_FILMS)
        .map(({ title, tmdbId, category }) => ({ title, tmdbId, category })),
      points: lines.reduce((sum, line) => sum + line.points, 0),
      more: Math.max(0, lines.length - UP_NEXT_FILMS),
    };
  }

  return { leagues, atStake };
}

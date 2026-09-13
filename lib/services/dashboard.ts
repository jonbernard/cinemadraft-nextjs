import { getNowPlaying } from '@/lib/external/tmdb-now-playing';
import { draftPickRepository } from '@/lib/repositories/draft-picks';
import { draftRepository } from '@/lib/repositories/drafts';
import { eventRepository } from '@/lib/repositories/events';
import { leagueRepository } from '@/lib/repositories/leagues';
import { type Movie, movieRepository } from '@/lib/repositories/movies';
import { userRepository } from '@/lib/repositories/users';
import { posterUrl } from '@/lib/utils/poster';
import { denseRank } from '@/lib/utils/rank';
import { ledgerForMovies, sumTotals } from './scoring';
import { getActiveYear, type SeasonPhase, toSeasonPhases } from './season';

/** One drafted film on the viewer's own strip. */
export type RosterEntry = {
  movie: Movie;
  /**
   * The film's artwork at the roster bucket, or null when the row has no
   * stored path.
   *
   * 🔴 Built here rather than in the page. `movies.poster` is a bare TMDB path
   * and the host and size are a presentation decision that lives in exactly one
   * place (`lib/utils/poster.ts`); `components/` may not reach a service (D33),
   * so a page that built the URL itself would be the second place.
   *
   * `w342`, not `w185`: RosterStrip's frames are 10rem — 160px CSS, 320px at
   * 2× — and the draft-board bucket is visibly soft at that size.
   */
  posterUrl: string | null;
  /**
   * Whether this film has been nominated this season, and whether it won.
   *
   * 🔴 Read out of the ledger, never computed here. `MovieLedger.lines` each
   * carry `won`, and the ledger is the same load as the totals (D41) — so this
   * costs nothing and, more importantly, cannot disagree with the number beside
   * it. The string union matches `PosterFrame`'s `PosterStatus`, re-declared
   * there rather than imported because `components/` may not reach a service
   * (D33).
   */
  status: 'none' | 'nominated' | 'won';
  /** Draft round, from 1. There is no roster size (D34). */
  round: number;
  points: number;
  /** This film's share of the seat's total, 0–1. Zero when nothing has scored. */
  share: number;
  /**
   * When the pick was made, in epoch milliseconds, or `null` if the row has no
   * timestamp.
   *
   * 🔴 The one ordering that is comparable **across** leagues. A draft
   * round is not: round 3 in one league and round 3 in another say nothing
   * about which came first, so anything cross-league that wants "recent" has
   * to use this. Within one seat the two agree — the 2026 picks are minutes
   * apart and monotonic in `order` — which is why `round` still orders the
   * roster strip and this exists only for the cross-league shelves.
   *
   * Epoch milliseconds rather than a `Date`, matching `SeasonPhase.date`: the
   * dashboard's DTOs cross the RSC boundary and this file normalizes every
   * temporal column the same way.
   *
   * Nullable because `draft_picks.created_at` is. No row in the restored data
   * is null today, but the column allows it and a sort that assumes otherwise
   * would put an unknown pick at the epoch, i.e. first.
   */
  pickedAt: number | null;
};

export type StandingsRow = {
  userId: number;
  name: string;
  total: number;
  /** Dense position: a tie shares a number and the next row skips. */
  position: number;
  isViewer: boolean;
};

export type LeagueView = {
  id: number;
  name: string | null;
  roster: RosterEntry[];
  total: number;
  standings: StandingsRow[];
  /** The viewer's own position, or null if they have no seat this season. */
  position: number | null;
};

/**
 * 🔴 Re-exported, not re-declared. `lib/services/season.ts` owns the shape and
 * the rule that builds it (P18.T5) — `/how-it-works` renders the same season
 * calendar for a signed-out stranger, and two copies of "one box per scoring
 * moment" would drift the first time either page learned something.
 */
export type { SeasonPhase } from './season';

/** One film in cinemas now, for the "In cinemas now" shelf (P10.T2). */
export type NowPlayingFilm = {
  tmdbId: string;
  title: string;
  posterUrl: string | null;
};

/**
 * The show handing out awards at this moment, or null — the dashboard's one
 * route into a ceremony (P10.T3).
 *
 * 🔴 `awardsActive` only, **not** the source's `nomActive || awardsActive`.
 * `LiveCTA` showed a banner reading "the results are coming in now" for a show
 * that was merely announcing nominations, linking to a live page whose stream
 * answers 204 off air (D110) — an invitation into a dead end. A nominations
 * announcement is a different event and, if it is ever worth a banner, it is
 * worth different words.
 *
 * The first, if two shows are somehow live at once. `findActive` orders by
 * name, so the choice is stable rather than arbitrary; two simultaneous
 * ceremonies has never happened and a banner listing both would be a design
 * for a case that does not occur.
 */
export type LiveNow = { abbreviation: string; name: string; year: number };

export type DashboardView = {
  year: number;
  leagues: LeagueView[];
  events: SeasonPhase[];
  /**
   * Empty rather than an error when TMDB is unconfigured or unreachable —
   * `getNowPlaying` absorbs both into an empty list, and the dashboard is a
   * signed-out visitor's first page: it must not degrade into a broken panel
   * because a preview deploy has no TMDB key.
   */
  nowPlaying: NowPlayingFilm[];
  /** The ceremony on air right now, or null for most of the year. */
  liveNow: LiveNow | null;
};

/**
 * A display name from the parts a `User` actually has.
 *
 * The Sequelize model carried a VIRTUAL `${firstName} ${lastName}`, which is
 * why the profile fixture has one, but the repository deliberately does not
 * (some rows hold unnormalized names). Formatting belongs in one place, and
 * this is it. Falls back to the email local part rather than rendering an
 * empty cell in the standings.
 */
function displayName(user: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return user.email.split('@')[0] ?? user.email;
}

/**
 * Everything the dashboard renders, assembled once.
 *
 * The page does no data assembly of its own. That is what keeps the RSC
 * readable and, more importantly, keeps the number of queries countable — the
 * source dashboard fetched per movie inside a render loop, which is invisible
 * with three films and painful with a twelve-member league.
 *
 * Every lookup here is batched by id for the same reason.
 */
export async function getDashboard(userId: number | null): Promise<DashboardView> {
  const year = await getActiveYear();

  const [leagueIds, events, nowPlaying, active] = await Promise.all([
    // A signed-out visitor has no leagues by definition. Skipping the query
    // rather than passing a sentinel id keeps it impossible for the public
    // page to accidentally resolve somebody else's leagues (D44).
    userId == null ? Promise.resolve([]) : draftRepository.findLeagueIdsByUserId(userId),
    eventRepository.findAll(),
    getNowPlaying(),
    // Batched, not awaited in sequence: the banner must not cost the dashboard
    // a serial round trip for a row that is empty most of the year.
    eventRepository.findActive(),
  ]);
  const onAir = active.filter((event) => event.awardsActive === true);

  const leagues =
    userId == null
      ? []
      : await Promise.all(
          leagueIds.map((leagueId) => buildLeague(leagueId, userId, year)),
        );

  return {
    year,
    // A league the viewer has no seat in this season still belongs on the
    // page — they may be mid-draft, or the season may not have started.
    leagues: leagues.filter((league) => league !== null),
    events: toSeasonPhases(events),
    nowPlaying: nowPlaying.map((film) => ({
      tmdbId: film.tmdbId,
      title: film.title,
      posterUrl: posterUrl(film.posterPath, 'w342'),
    })),
    liveNow:
      onAir[0] == null
        ? null
        : { abbreviation: onAir[0].abbreviation, name: onAir[0].name, year },
  };
}

async function buildLeague(
  leagueId: number,
  viewerId: number,
  year: number,
): Promise<LeagueView | null> {
  const [league, drafts] = await Promise.all([
    leagueRepository.findById(leagueId),
    draftRepository.findByLeagueIdAndYear(leagueId, year),
  ]);
  if (!league) return null;

  const picksByDraft = await draftPickRepository.findManyByDraftIds(
    drafts.map((d) => d.id),
  );

  // One scoring pass for the whole league. Scoring per seat would re-query
  // the same nominations once per member.
  const allMovieIds = [
    ...new Set(
      picksByDraft.flatMap((pick) => (pick.movieId == null ? [] : [pick.movieId])),
    ),
  ];
  // 🔴 The ledger rather than the totals, because the roster needs to know
  // which films won and the ledger already does. Same rule, same load, same
  // inputs — `ledgerForMovies` and `pointsForMovieIds` both go through
  // `loadScoringInputs`, and `MovieLedger.total` is by construction the sum of
  // its lines (D41). One extra batched query names the shows; it does not grow
  // with seats, which is the property scoring.batching.test.ts guards.
  const [ledgers, users] = await Promise.all([
    ledgerForMovies(allMovieIds, year),
    userRepository.findManyByIds([
      ...new Set(drafts.flatMap((draft) => (draft.userId == null ? [] : [draft.userId]))),
    ]),
  ]);
  const totals: ReadonlyMap<number, number> = new Map(
    [...ledgers].map(([id, ledger]) => [id, ledger.total]),
  );
  const userById = new Map(users.map((user) => [user.id, user]));

  const rows = drafts
    .flatMap((draft) => {
      const user = draft.userId == null ? undefined : userById.get(draft.userId);
      if (!user) return [];
      const movieIds = picksByDraft
        .filter((pick) => pick.draftId === draft.id)
        .flatMap((pick) => (pick.movieId == null ? [] : [pick.movieId]));
      return [
        { userId: user.id, name: displayName(user), total: sumTotals(totals, movieIds) },
      ];
    })
    .sort((a, b) => b.total - a.total);

  const positions = denseRank(rows);
  const standings: StandingsRow[] = rows.map((row, index) => ({
    ...row,
    position: positions[index] as number,
    isViewer: row.userId === viewerId,
  }));

  return {
    id: league.id,
    name: league.name,
    ...(await buildRoster(drafts, picksByDraft, totals, ledgers, viewerId)),
    standings,
    position: standings.find((row) => row.isViewer)?.position ?? null,
  };
}

async function buildRoster(
  drafts: { id: number; userId: number | null }[],
  picks: {
    draftId: number;
    movieId: number | null;
    order: number | null;
    createdAt: Date | null;
  }[],
  totals: ReadonlyMap<number, number>,
  ledgers: ReadonlyMap<number, { lines: readonly { won: boolean }[] }>,
  viewerId: number,
): Promise<{ roster: RosterEntry[]; total: number }> {
  const seat = drafts.find((draft) => draft.userId === viewerId);
  if (!seat) return { roster: [], total: 0 };

  const mine = picks
    .filter((pick) => pick.draftId === seat.id && pick.movieId != null)
    // Ordered by draft round, never by points. Snake order is real
    // information — round 1 cost more than the last round (§6.7).
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const movies = await movieRepository.findManyByIds(
    mine.map((pick) => pick.movieId as number),
  );
  const movieById = new Map(movies.map((movie) => [movie.id, movie]));

  const total = mine.reduce(
    (sum, pick) => sum + (totals.get(pick.movieId as number) ?? 0),
    0,
  );

  const roster = mine.flatMap((pick, index) => {
    const movie = movieById.get(pick.movieId as number);
    if (!movie) return [];
    const points = totals.get(movie.id) ?? 0;
    return [
      {
        movie,
        posterUrl: posterUrl(movie.poster, 'w342'),
        status: statusOf(ledgers.get(movie.id)),
        // The stored `order` is the draft round, but it is nullable and has
        // gaps in the restored data; the index is the reliable sequence.
        round: pick.order ?? index + 1,
        points,
        // Guarded: before anything has been awarded every seat is on zero,
        // and dividing by it would make every bar NaN on opening day.
        share: total > 0 ? points / total : 0,
        pickedAt: pick.createdAt?.getTime() ?? null,
      },
    ];
  });

  return { roster, total };
}

/**
 * What a film's poster should be marked with.
 *
 * 🔴 Three states from one source. A film with no ledger entry was not
 * nominated this season; one with lines was; one with a winning line won. Any
 * other derivation — a second query, a separate winners lookup — could
 * disagree with the points printed under the same poster.
 */
function statusOf(
  ledger: { lines: readonly { won: boolean }[] } | undefined,
): RosterEntry['status'] {
  if (!ledger || ledger.lines.length === 0) return 'none';
  return ledger.lines.some((line) => line.won) ? 'won' : 'nominated';
}

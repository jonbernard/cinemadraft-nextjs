import { getNowPlaying } from '@/lib/external/tmdb-now-playing';
import { draftRepository } from '@/lib/repositories/drafts';
import { eventRepository } from '@/lib/repositories/events';
import type { Movie } from '@/lib/repositories/movies';
import { posterUrl } from '@/lib/utils/poster';
import { rankSeats, type StandingsRow } from '@/lib/utils/rank';
import { getLeagueBoard, type Seat } from './draft';
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

/** Re-exported: `lib/utils/rank.ts` owns the league table (`rankSeats`). */
export type { StandingsRow };

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
    leagues,
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

/**
 * One league on the dashboard: the viewer's roster and the league table.
 *
 * 🔴 Read off `getLeagueBoard`, the league page's own load, not assembled a
 * second time. The dashboard used to build its own seats and skip any seat
 * with no user, so placeholders vanished from its table and nine members of
 * league 1 saw a different position here than on `/leagues/1` (Jon Bernard
 * 13th against 16th in 2026). Same seats, same totals, same `rankSeats`: the
 * two cannot disagree. The board is one batched load, so this costs no more
 * queries than the old assembly did (`scoring.batching.test.ts`).
 */
async function buildLeague(
  leagueId: number,
  viewerId: number,
  year: number,
): Promise<LeagueView> {
  const board = await getLeagueBoard(leagueId, year);
  const seats = board.groups.flatMap((group) => group.seats);
  const standings = rankSeats(seats, viewerId);
  const seat = seats.find((entry) => entry.userId === viewerId);

  return {
    id: board.leagueId,
    name: board.leagueName,
    ...(seat ? roster(seat) : { roster: [], total: 0 }),
    standings,
    position: standings.find((row) => row.isViewer)?.position ?? null,
  };
}

function roster(seat: Seat): { roster: RosterEntry[]; total: number } {
  // The board's picks are already in draft-round order, never by points —
  // snake order is real information: round 1 cost more than the last (§6.7).
  return {
    total: seat.total,
    roster: seat.picks.map((pick) => ({
      movie: pick.movie,
      posterUrl: posterUrl(pick.movie.poster, 'w342'),
      status: statusOf(pick.ledger),
      round: pick.round,
      points: pick.points,
      // Guarded: before anything has been awarded every seat is on zero,
      // and dividing by it would make every bar NaN on opening day.
      share: seat.total > 0 ? pick.points / seat.total : 0,
      pickedAt: pick.createdAt?.getTime() ?? null,
    })),
  };
}

/**
 * What a film's poster should be marked with.
 *
 * 🔴 Three states from one source. A film with no ledger entry was not
 * nominated this season; one with lines was; one with a winning line won. Any
 * other derivation — a second query, a separate winners lookup — could
 * disagree with the points printed under the same poster.
 */
function statusOf(lines: readonly { won: boolean }[]): RosterEntry['status'] {
  if (lines.length === 0) return 'none';
  return lines.some((line) => line.won) ? 'won' : 'nominated';
}

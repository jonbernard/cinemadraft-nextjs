import { posterUrl } from '@/lib/utils/poster';
import { rankSeats, type StandingsRow } from '@/lib/utils/rank';
import { getLeagueBoard, type Seat } from './draft';
import { getSeasonMoments, type Moment } from './moments';

/**
 * A league's season, moment by moment (P16.T14).
 *
 * 🔴 Nothing is scored here. Every figure is a regrouping of the board's own
 * ledger lines (`getLeagueBoard`, D125), so the season cannot disagree with
 * the board: a nomination's `points` land on its show's nominations moment,
 * and a won line's `points` land a second time on its ceremony. The tests
 * hold the invariant that both regroupings sum to `seat.total`.
 */
export type SeatSeason = {
  draftId: number;
  userId: number | null;
  uuid: string | null;
  name: string;
  isDummy: boolean;
  /** moment.key → points earned at that moment. */
  byMoment: ReadonlyMap<string, number>;
  /** abbreviation → { nom, win }. nom = Σ line.points; win = Σ (line.won ? line.points : 0). */
  byShow: ReadonlyMap<string, { nom: number; win: number }>;
  /** The board's `seat.total`, never re-summed. */
  total: number;
};

export type MomentStep = {
  moment: Moment;
  /** draftId → points at this moment. */
  delta: ReadonlyMap<number, number>;
  /** `rankSeats` over cumulative totals, after it. */
  standings: StandingsRow[];
  /** draftId → previous position − new position (0 at the first step). */
  moves: ReadonlyMap<number, number>;
  films: {
    title: string;
    posterUrl: string | null;
    points: number;
    won: number;
    holders: number;
  }[];
};

export type SeasonLedger = {
  seats: SeatSeason[];
  steps: MomentStep[];
  latest: MomentStep | null;
};

/** `rankSeats`' own identity for a row: the user, or `-draftId` for a placeholder. */
const rowKey = (seat: { userId: number | null; draftId: number }) =>
  seat.userId ?? -seat.draftId;

/**
 * Where a ledger line's points land. 🔴 A show with no ceremony has no
 * ceremony moment, so its (stray) win lands on its nominations moment:
 * otherwise a win would vanish from the sum.
 */
function momentKeys(moments: readonly Moment[]) {
  const byShow = new Map<string, { nominations?: string; ceremony?: string }>();
  for (const m of moments) {
    const entry = byShow.get(m.abbreviation) ?? {};
    entry[m.phase] = m.key;
    byShow.set(m.abbreviation, entry);
  }
  return (abbreviation: string) => {
    const entry = byShow.get(abbreviation);
    return { nom: entry?.nominations, win: entry?.ceremony ?? entry?.nominations };
  };
}

/** `seats` in draft order, as `getLeagueBoard` gives them (rankSeats relies on it). */
export function buildSeasonLedger(
  seats: readonly Seat[],
  moments: readonly Moment[],
  viewerId: number | null,
): SeasonLedger {
  const keysOf = momentKeys(moments);

  const seasons: SeatSeason[] = seats.map((seat) => {
    const byMoment = new Map<string, number>();
    const byShow = new Map<string, { nom: number; win: number }>();
    const add = (key: string | undefined, points: number) => {
      if (key) byMoment.set(key, (byMoment.get(key) ?? 0) + points);
    };
    for (const pick of seat.picks) {
      for (const line of pick.ledger) {
        const keys = keysOf(line.eventAbbreviation);
        const show = byShow.get(line.eventAbbreviation) ?? { nom: 0, win: 0 };
        show.nom += line.points;
        add(keys.nom, line.points);
        if (line.won) {
          show.win += line.points;
          add(keys.win, line.points);
        }
        byShow.set(line.eventAbbreviation, show);
      }
    }
    return {
      draftId: seat.draftId,
      userId: seat.userId,
      uuid: seat.uuid,
      name: seat.name,
      isDummy: seat.isDummy,
      byMoment,
      byShow,
      total: seat.total,
    };
  });

  const running = new Map(seats.map((seat) => [seat.draftId, 0]));
  let previous: Map<number, number> | null = null;
  const steps: MomentStep[] = [];

  for (const moment of moments) {
    if (moment.state === 'upcoming') continue;

    const delta = new Map<number, number>();
    for (const season of seasons) {
      const points = season.byMoment.get(moment.key) ?? 0;
      delta.set(season.draftId, points);
      running.set(season.draftId, (running.get(season.draftId) ?? 0) + points);
    }

    const standings = rankSeats(
      seats.map((seat) => ({
        draftId: seat.draftId,
        userId: seat.userId,
        name: seat.name,
        total: running.get(seat.draftId) ?? 0,
      })),
      viewerId,
    );
    const positionByKey = new Map(standings.map((row) => [row.userId, row.position]));
    const position = new Map(
      seats.map((seat) => [seat.draftId, positionByKey.get(rowKey(seat)) ?? 0]),
    );
    const moves = new Map(
      seats.map((seat) => [
        seat.draftId,
        previous
          ? (previous.get(seat.draftId) ?? 0) - (position.get(seat.draftId) ?? 0)
          : 0,
      ]),
    );
    previous = position;

    steps.push({
      moment,
      delta,
      standings,
      moves,
      films: filmsAt(seats, moment, keysOf),
    });
  }

  return {
    seats: seasons,
    steps,
    latest: steps.find((step) => step.moment.state === 'live') ?? steps.at(-1) ?? null,
  };
}

/** The films that scored at one moment, each once, with how many seats hold it. */
function filmsAt(
  seats: readonly Seat[],
  moment: Moment,
  keysOf: ReturnType<typeof momentKeys>,
): MomentStep['films'] {
  const films = new Map<number, MomentStep['films'][number]>();
  for (const seat of seats) {
    for (const pick of seat.picks) {
      let points = 0;
      let won = 0;
      for (const line of pick.ledger) {
        if (line.eventAbbreviation !== moment.abbreviation) continue;
        const keys = keysOf(line.eventAbbreviation);
        if (keys.nom === moment.key) points += line.points;
        if (line.won && keys.win === moment.key) {
          points += line.points;
          won += 1;
        }
      }
      if (points === 0 && won === 0) continue;
      const existing = films.get(pick.movie.id);
      if (existing) existing.holders += 1;
      else
        films.set(pick.movie.id, {
          title: pick.movie.title ?? 'Untitled',
          posterUrl: posterUrl(pick.movie.poster, 'w92'),
          points,
          won,
          holders: 1,
        });
    }
  }
  return [...films.values()].sort(
    (a, b) => b.points - a.points || a.title.localeCompare(b.title),
  );
}

/** One board load and the season's moments. */
export async function getSeasonLedger(
  leagueId: number,
  year: number,
  viewerId: number | null,
): Promise<SeasonLedger> {
  const [board, moments] = await Promise.all([
    getLeagueBoard(leagueId, year),
    getSeasonMoments(year),
  ]);
  return buildSeasonLedger(
    board.groups.flatMap((group) => group.seats),
    moments,
    viewerId,
  );
}

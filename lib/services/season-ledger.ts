import { awardRepository } from '@/lib/repositories/awards';
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

/** A moment as the standings tab names it: enough to say which, when and how far along. */
export type StandingsMoment = Pick<
  Moment,
  'key' | 'abbreviation' | 'name' | 'phase' | 'date' | 'state' | 'winners'
> & {
  /** The show's categories, for "14 of 24 decided". Only read while live, else null. */
  categories: number | null;
};

/** "What moved" at one moment (P16.T19), about `ledger.latest`. */
export type WhatMovedView = {
  moment: StandingsMoment;
  /** Everyone at position 1 after it, in draft order. */
  leaders: string[];
  /** Who led before it (`standings[0]`), or null at the season's first moment. */
  previousLeader: string | null;
  /** `standings[0]` is a different seat from the step before (T22's rule). */
  leadChanged: boolean;
  /** The three biggest gains at this moment, largest first; nobody on zero. */
  gains: { draftId: number; name: string; points: number }[];
  /** Everyone who changed places, most places gained first. */
  movers: { draftId: number; name: string; from: number; to: number }[];
  films: MomentStep['films'];
};

export type StandingsSeatRow = {
  draftId: number;
  name: string;
  /** The member's profile uuid, null for a placeholder seat. */
  uuid: string | null;
  isViewer: boolean;
  /** `rankSeats` over the season totals. */
  position: number;
  /** abbreviation → nom + win. */
  byShow: Record<string, number>;
  /** Points at the latest moment. */
  last: number;
  /** Places gained at the latest moment. */
  move: number;
  /** The board's `seat.total`, never re-summed (D125). */
  total: number;
};

/**
 * Everything `/leagues/[id]/standings` renders, and every frame of its stream
 * (P16.T19/T20). 🔴 Plain JSON, no `Map`: the stream sends it with
 * `JSON.stringify`, which writes a `Map` as `{}`.
 */
export type StandingsView = {
  leagueId: number;
  leagueName: string | null;
  year: number;
  /** A ceremony of this season is on air (live), which is the only time the stream answers (D135). */
  onAir: boolean;
  /** The shows that scored anywhere in the league, in moment order. */
  shows: { abbreviation: string; name: string }[];
  /** Standings order. */
  rows: StandingsSeatRow[];
  whatMoved: WhatMovedView | null;
  /** The season's first dated moment, for the empty state's "nominations start". */
  firstDate: number | null;
};

/** The pure half of `getStandingsView`. `seats` in draft order. */
export function toStandingsView(input: {
  leagueId: number;
  leagueName: string | null;
  year: number;
  ledger: SeasonLedger;
  moments: readonly Moment[];
  viewerId: number | null;
  categories: number | null;
}): StandingsView {
  const { ledger, moments } = input;
  const latest = ledger.latest;
  const nameOf = new Map(ledger.seats.map((seat) => [seat.draftId, seat.name]));
  const draftOf = new Map(ledger.seats.map((seat) => [rowKey(seat), seat.draftId]));

  const scored = new Set(
    ledger.seats.flatMap((seat) =>
      [...seat.byShow].filter(([, v]) => v.nom + v.win !== 0).map(([abbr]) => abbr),
    ),
  );
  const shows: StandingsView['shows'] = [];
  for (const moment of moments) {
    if (
      scored.has(moment.abbreviation) &&
      !shows.some((s) => s.abbreviation === moment.abbreviation)
    )
      shows.push({ abbreviation: moment.abbreviation, name: moment.name });
  }

  const bySeat = new Map(ledger.seats.map((seat) => [seat.draftId, seat]));
  const rows = rankSeats(ledger.seats, input.viewerId).map((row) => {
    const draftId = draftOf.get(row.userId) ?? 0;
    const seat = bySeat.get(draftId);
    return {
      draftId,
      name: row.name,
      uuid: seat?.uuid ?? null,
      isViewer: row.isViewer,
      position: row.position,
      byShow: Object.fromEntries(
        [...(seat?.byShow ?? [])].map(([abbr, v]) => [abbr, v.nom + v.win]),
      ),
      last: latest?.delta.get(draftId) ?? 0,
      move: latest?.moves.get(draftId) ?? 0,
      total: row.total,
    };
  });

  let whatMoved: WhatMovedView | null = null;
  if (latest) {
    const index = ledger.steps.indexOf(latest);
    const before = index > 0 ? ledger.steps[index - 1] : undefined;
    const leaderKey = latest.standings[0]?.userId;
    const positionOf = (step: MomentStep | undefined, draftId: number) =>
      step?.standings.find((row) => draftOf.get(row.userId) === draftId)?.position ?? 0;
    whatMoved = {
      moment: {
        key: latest.moment.key,
        abbreviation: latest.moment.abbreviation,
        name: latest.moment.name,
        phase: latest.moment.phase,
        date: latest.moment.date,
        state: latest.moment.state,
        winners: latest.moment.winners,
        categories: latest.moment.state === 'live' ? input.categories : null,
      },
      leaders: latest.standings
        .filter((row) => row.position === 1)
        .map((row) => row.name),
      previousLeader: before?.standings[0]?.name ?? null,
      leadChanged: before != null && before.standings[0]?.userId !== leaderKey,
      gains: [...latest.delta]
        .filter(([, points]) => points !== 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([draftId, points]) => ({
          draftId,
          name: nameOf.get(draftId) ?? '',
          points,
        })),
      movers: [...latest.moves]
        .filter(([, move]) => move !== 0)
        .sort((a, b) => b[1] - a[1])
        .map(([draftId]) => ({
          draftId,
          name: nameOf.get(draftId) ?? '',
          from: positionOf(before, draftId),
          to: positionOf(latest, draftId),
        })),
      films: latest.films,
    };
  }

  return {
    leagueId: input.leagueId,
    leagueName: input.leagueName,
    year: input.year,
    onAir: moments.some((moment) => moment.state === 'live'),
    shows,
    rows,
    whatMoved,
    firstDate: moments.find((moment) => moment.date != null)?.date ?? null,
  };
}

/**
 * The standings tab, assembled once (P16.T19). 🔴 Shared by the page and
 * `/api/leagues/[id]/standings/stream` (P16.T20), so the two cannot disagree —
 * the reason `league-view.ts` exists. One board load, the season's moments,
 * and, only while a ceremony is live, the show's categories.
 */
export async function getStandingsView(
  leagueId: number,
  year: number,
  viewerId: number | null,
): Promise<StandingsView> {
  const [board, moments] = await Promise.all([
    getLeagueBoard(leagueId, year),
    getSeasonMoments(year),
  ]);
  const ledger = buildSeasonLedger(
    board.groups.flatMap((group) => group.seats),
    moments,
    viewerId,
  );
  const live = ledger.latest?.moment.state === 'live' ? ledger.latest.moment : null;
  const categories = live
    ? (await awardRepository.findByEventId(live.eventId)).length
    : null;
  return toStandingsView({
    leagueId: board.leagueId,
    leagueName: board.leagueName,
    year: board.year,
    ledger,
    moments,
    viewerId,
    categories,
  });
}

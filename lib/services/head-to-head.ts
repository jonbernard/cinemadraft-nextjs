import type { StandingsRow } from '@/lib/utils/rank';

/**
 * Head-to-head (P16.T24, D136): two seats of one league-season, split into
 * what both drafted and what only one did.
 *
 * Pure, and built on the board view the page already loaded — no query. The
 * client room calls it too, so the comparison moves with the board during a
 * live draft rather than sitting beside it as a stale snapshot.
 *
 * 🔴 **The arithmetic rests on one fact:** a film scores the same for every
 * seat that holds it (points are the film's, never the seat's). Then the
 * shared films cancel and `margin === uniqueA − uniqueB` exactly. A per-seat
 * multiplier would break that silently, so `head-to-head.test.ts` pins it on a
 * fixture and `head-to-head.production.test.ts` on every restored league 1
 * board.
 *
 * Measured on the restored data: a film is never drafted twice inside one
 * group, so a same-group pair shares nothing, ever. "Shared" is a cross-group
 * idea.
 */
export type H2HFilm = {
  movieId: number;
  title: string;
  tmdbId: string | null;
  posterUrl: string | null;
  points: number;
  status: 'none' | 'nominated' | 'won';
  /** Draft round on each side; null on the side that did not draft it. */
  roundA: number | null;
  roundB: number | null;
};

export type H2HSide = {
  draftId: number;
  name: string;
  uuid: string | null;
  isDummy: boolean;
  group: number;
  total: number;
  /** League-wide, from `rankSeats` (§6). */
  position: number;
  isViewer: boolean;
};

export type HeadToHead = {
  a: H2HSide;
  b: H2HSide;
  sameGroup: boolean;
  shared: H2HFilm[];
  onlyA: H2HFilm[];
  onlyB: H2HFilm[];
  sharedPoints: number;
  uniqueA: number;
  uniqueB: number;
  /** `a.total − b.total`, which is `uniqueA − uniqueB` when the shared films cancel. */
  margin: number;
  /** C's "films that make the gap": each side's two best unique films, by points. */
  gap: (H2HFilm & { side: 'a' | 'b' })[];
};

/** Structurally the board view's seat, with its group. */
export type H2HSeat = {
  draftId: number;
  name: string;
  uuid?: string | null;
  isDummy: boolean;
  total: number;
  group: number;
  picks: readonly {
    movieId: number;
    tmdbId: string | null;
    title: string;
    posterUrl: string | null;
    round: number;
    points: number;
    ledger?: readonly { won: boolean }[];
  }[];
};

/** The seat directly above `draftId` in the table, or directly below for the leader. */
export function seatAbove(
  standings: readonly StandingsRow[],
  draftId: number,
): number | null {
  const index = standings.findIndex((row) => row.draftId === draftId);
  if (index < 0) return null;
  return standings[index === 0 ? 1 : index - 1]?.draftId ?? null;
}

/**
 * 🔴 The "cancels out" pin: the films some holder scores differently from
 * another. Empty, always — if it is not, `margin === uniqueA − uniqueB` is a
 * lie. Only the tests call it, on a fixture and on every restored board.
 */
export function pointsDisagreements(
  seats: readonly { picks: readonly { movieId: number; points: number }[] }[],
): number[] {
  const seen = new Map<number, number>();
  const bad = new Set<number>();
  for (const entry of seats)
    for (const { movieId, points } of entry.picks) {
      const earlier = seen.get(movieId);
      if (earlier !== undefined && earlier !== points) bad.add(movieId);
      seen.set(movieId, points);
    }
  return [...bad];
}

function statusOf(lines: readonly { won: boolean }[] | undefined): H2HFilm['status'] {
  if (!lines || lines.length === 0) return 'none';
  return lines.some((line) => line.won) ? 'won' : 'nominated';
}

/**
 * Who is compared with whom:
 * - `a` is the reader's seat when they hold one this season; otherwise, which
 *   includes every follower, the leader.
 * - `b` is `vs` when it names another seat here. Otherwise (absent, unknown,
 *   or `a` itself) it is the seat above `a`, or below for the leader.
 *
 * The page renders the full comparison only for a valid `vs`; with `vs` null
 * this is the reader's "25 behind Micah Baird" line.
 */
export function compareSeats(
  seats: readonly H2HSeat[],
  standings: readonly StandingsRow[],
  viewerSeatId: number | null,
  vs: number | null,
): HeadToHead | null {
  const byId = new Map(seats.map((seat) => [seat.draftId, seat] as const));
  const a =
    (viewerSeatId == null ? undefined : byId.get(viewerSeatId)) ??
    byId.get(standings[0]?.draftId ?? Number.NaN);
  if (!a) return null;
  const requested = vs == null || vs === a.draftId ? undefined : byId.get(vs);
  const b = requested ?? byId.get(seatAbove(standings, a.draftId) ?? Number.NaN);
  if (!b || b.draftId === a.draftId) return null;

  const positionOf = new Map(standings.map((row) => [row.draftId, row.position]));
  const side = (seat: H2HSeat): H2HSide => ({
    draftId: seat.draftId,
    name: seat.name,
    uuid: seat.uuid ?? null,
    isDummy: seat.isDummy,
    group: seat.group,
    total: seat.total,
    position: positionOf.get(seat.draftId) ?? 0,
    isViewer: seat.draftId === viewerSeatId,
  });

  const film = (
    pick: H2HSeat['picks'][number],
    roundA: number | null,
    roundB: number | null,
  ): H2HFilm => ({
    movieId: pick.movieId,
    title: pick.title,
    tmdbId: pick.tmdbId,
    posterUrl: pick.posterUrl,
    points: pick.points,
    status: statusOf(pick.ledger),
    roundA,
    roundB,
  });

  const bByMovie = new Map(b.picks.map((pick) => [pick.movieId, pick]));
  const aMovies = new Set(a.picks.map((pick) => pick.movieId));
  const shared: H2HFilm[] = [];
  const onlyA: H2HFilm[] = [];
  for (const pick of a.picks) {
    const other = bByMovie.get(pick.movieId);
    if (other) shared.push(film(pick, pick.round, other.round));
    else onlyA.push(film(pick, pick.round, null));
  }
  const onlyB = b.picks
    .filter((pick) => !aMovies.has(pick.movieId))
    .map((pick) => film(pick, null, pick.round));

  const byPoints = (x: H2HFilm, y: H2HFilm) => y.points - x.points;
  for (const list of [shared, onlyA, onlyB]) list.sort(byPoints);
  const sum = (films: readonly H2HFilm[]) =>
    films.reduce((total, entry) => total + entry.points, 0);

  return {
    a: side(a),
    b: side(b),
    sameGroup: a.group === b.group,
    shared,
    onlyA,
    onlyB,
    sharedPoints: sum(shared),
    uniqueA: sum(onlyA),
    uniqueB: sum(onlyB),
    margin: a.total - b.total,
    gap: [
      ...onlyA.slice(0, 2).map((entry) => ({ ...entry, side: 'a' as const })),
      ...onlyB.slice(0, 2).map((entry) => ({ ...entry, side: 'b' as const })),
    ],
  };
}

/** "You’re 25 behind Micah Baird", "James Kinney leads Micah Baird by 25". */
export function headToHeadHeadline({ a, b, margin }: HeadToHead): string {
  const gap = Math.abs(margin);
  if (a.isViewer)
    return margin === 0
      ? `You’re level with ${b.name}`
      : margin < 0
        ? `You’re ${gap} behind ${b.name}`
        : `You lead ${b.name} by ${gap}`;
  return margin === 0
    ? `${a.name} and ${b.name} are level`
    : margin < 0
      ? `${a.name} is ${gap} behind ${b.name}`
      : `${a.name} leads ${b.name} by ${gap}`;
}

const WORDS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
];
const count = (n: number) => WORDS[n] ?? String(n);

/**
 * C's one sentence: "415 of James’s 810 points are films Micah also holds.
 * The gap is the other five picks each." First names, unless they collide.
 */
export function headToHeadSentence(h2h: HeadToHead): string {
  const { a, b, shared, onlyA, onlyB } = h2h;
  let [first, second] = [a.name.split(' ')[0] ?? a.name, b.name.split(' ')[0] ?? b.name];
  if (first === second) [first, second] = [a.name, b.name];
  const ownA = a.isViewer ? 'your' : `${first}’s`;
  const lead =
    shared.length > 0
      ? `${h2h.sharedPoints} of ${ownA} ${a.total} points are films ${second} also holds.`
      : h2h.sameGroup
        ? 'Same group, so no film is on both teams.'
        : 'No film is on both teams.';
  const rest = shared.length > 0 ? 'other ' : '';
  const gap =
    onlyA.length === onlyB.length
      ? `The gap is the ${rest}${count(onlyA.length)} ${onlyA.length === 1 ? 'pick' : 'picks'} each.`
      : `The gap is ${ownA} ${rest}${count(onlyA.length)} against ${second}’s ${rest}${count(onlyB.length)}.`;
  return `${lead} ${gap}`;
}

import type { Moment } from './moments';
import type { SeasonLedger } from './season-ledger';

export type RaceAxis = 'date' | 'order';

export type RaceLine = {
  draftId: number;
  name: string;
  /** Cumulative points after each step. The last is the seat's total. */
  points: number[];
  /** Level first at the season's last step: drawn in primary ink. */
  isLeader: boolean;
  isViewer: boolean;
  /** `rankSeats`' position after the last step. */
  position: number;
};

/**
 * The season as a race (P16.T22): each seat's running total after every
 * finished moment. A regrouping of `SeasonLedger`, which is itself the
 * board's ledger (D125), so nothing here is scored.
 */
export type Race = {
  /** 'date' iff every step's moment has a date (D134); otherwise evenly spaced. */
  axis: RaceAxis;
  /** Per step: the moment's date (epoch ms) on the date axis, else the step index. */
  x: number[];
  moments: Moment[];
  /** In the season's final standings order. */
  lines: RaceLine[];
  /** Per step: the draftId of `standings[0]`, who leads after it. */
  leaderAt: number[];
  /**
   * 🔴 A change is `standings[0]` becoming a different seat from the step
   * before. The first lead is not a change, and neither is a tie that
   * `rankSeats` orders by draft order: the leader has to be passed. (The
   * proposal's 3 and 6 counted changes in the *set* of seats on first place,
   * the first lead included.)
   */
  leadChanges: { stepIndex: number; from: string; to: string; moment: Moment }[];
  /** The three biggest single-moment gains of the season, largest first. */
  biggest: { draftId: number; name: string; points: number; moment: Moment }[];
};

/** `rankSeats`' own identity for a row: the user, or `-draftId` for a placeholder. */
const rowKey = (seat: { userId: number | null; draftId: number }) =>
  seat.userId ?? -seat.draftId;

export function toRace(ledger: SeasonLedger): Race {
  const { steps, seats } = ledger;
  const moments = steps.map((step) => step.moment);
  const axis: RaceAxis =
    steps.length > 0 && moments.every((moment) => moment.date != null) ? 'date' : 'order';

  const draftOf = new Map(seats.map((seat) => [rowKey(seat), seat.draftId]));
  const final = steps.at(-1)?.standings ?? [];
  const finalRow = new Map(final.map((row) => [draftOf.get(row.userId), row]));
  const order = new Map(final.map((row, index) => [draftOf.get(row.userId), index]));

  const lines = seats
    .map((seat) => {
      let running = 0;
      const row = finalRow.get(seat.draftId);
      return {
        draftId: seat.draftId,
        name: seat.name,
        points: steps.map((step) => {
          running += step.delta.get(seat.draftId) ?? 0;
          return running;
        }),
        isLeader: row?.position === 1,
        isViewer: row?.isViewer ?? false,
        position: row?.position ?? 0,
      };
    })
    .sort((a, b) => (order.get(a.draftId) ?? 0) - (order.get(b.draftId) ?? 0));

  const leadChanges: Race['leadChanges'] = [];
  steps.forEach((step, index) => {
    const before = steps[index - 1]?.standings[0];
    const now = step.standings[0];
    if (before && now && before.userId !== now.userId)
      leadChanges.push({
        stepIndex: index,
        from: before.name,
        to: now.name,
        moment: step.moment,
      });
  });

  const nameOf = new Map(seats.map((seat) => [seat.draftId, seat.name]));
  const biggest = steps
    .flatMap((step) =>
      [...step.delta].map(([draftId, points]) => ({
        draftId,
        name: nameOf.get(draftId) ?? '',
        points,
        moment: step.moment,
      })),
    )
    .filter((gain) => gain.points > 0)
    // Stable: a tie keeps the earlier moment, then draft order.
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  return {
    axis,
    x:
      axis === 'date'
        ? moments.map((moment) => moment.date as number)
        : steps.map((_, i) => i),
    moments,
    lines,
    leaderAt: steps.map((step) => draftOf.get(step.standings[0]?.userId ?? 0) ?? 0),
    leadChanges,
    biggest,
  };
}

/**
 * Whose turn it is.
 *
 * The source app had no answer to this: the owner clicked a seat and typed a
 * film, and keeping the order straight was a job for whoever was talking. On a
 * call with a dozen people that is the thing that actually goes wrong, so the
 * console derives it — and lets the owner overrule it, because a call does not
 * run in a straight line (D46).
 *
 * 🔴 **The order is a snake, and that is measured rather than assumed.**
 * Reconstructing every league's pick sequence from `draft_picks.created_at`:
 *
 * | Season | Picks | Match a snake |
 * |---|---|---|
 * | 2024 | 84 | 84 |
 * | 2025 | 108 | 108 |
 * | 2026 | 117 | 116 |
 * | 2017–2022 | 716 | ~25% |
 *
 * The three seasons drafted under the current live-call workflow are a snake
 * to within a single pick. The older seasons are not, and their timestamps do
 * not describe a live draft at all — they arrive in clumps, consistent with
 * being entered or migrated after the fact — so they are evidence about how
 * the rows were loaded, not about how the league drafts.
 *
 * The one 2026 exception is worth more than the 309 matches: it is a pick
 * taken out of sequence, which is exactly the "someone missed their turn" case
 * the owner described. A rule with no override would have made that pick
 * impossible to enter.
 */
export type OrderedSeat = {
  draftId: number;
  /** Position in the group, from 1. */
  order: number;
  /** How many picks the seat already holds. */
  pickCount: number;
};

/**
 * The round the group is on: one past the seat that has picked least.
 *
 * Derived from the picks rather than counted, so a page reload, a removed pick
 * or a seat added mid-draft all land on the same answer. Empty group → round 1.
 */
export function currentRound(seats: readonly OrderedSeat[]): number {
  if (seats.length === 0) return 1;
  return Math.min(...seats.map((seat) => seat.pickCount)) + 1;
}

/**
 * The seat that should pick next, or null when the group has none.
 *
 * Seats that are behind the round come first, in snake order — odd rounds run
 * up the order, even rounds run back down it. That handles the skipped-turn
 * case without a special path: a seat that missed round 3 is simply the only
 * one still on two picks, so it is the only candidate and it is next.
 *
 * A group where every seat is level is the ordinary case, and then this is
 * plainly the snake: first seat, last seat, first seat again.
 */
export function nextSeatId(seats: readonly OrderedSeat[]): number | null {
  const round = currentRound(seats);
  const behind = seats.filter((seat) => seat.pickCount < round);
  if (behind.length === 0) return null;

  const forward = round % 2 === 1;
  const sorted = [...behind].sort((a, b) =>
    forward ? a.order - b.order : b.order - a.order,
  );
  return sorted[0]?.draftId ?? null;
}

/**
 * Dense ranking: equal totals share a position, and the next distinct total
 * skips accordingly (1, 1, 3).
 *
 * Extracted so the dashboard's league standings and the league board's own
 * standings section (P10.T10) share one definition of a tie. A second
 * implementation could disagree with the first about which rows are level,
 * showing two different positions for the same total on two different pages.
 *
 * Assumes `rows` is already sorted by `total` descending — this only assigns
 * positions to that order, it does not sort.
 */
export function denseRank(rows: readonly { total: number }[]): number[] {
  const positions: number[] = [];
  let position = 0;
  let previous: number | null = null;

  rows.forEach((row, index) => {
    if (previous === null || row.total !== previous) position = index + 1;
    positions.push(position);
    previous = row.total;
  });

  return positions;
}

export type StandingsRow = {
  /** A placeholder seat has no user, so it takes `-draftId`, which no real id can be. */
  userId: number;
  name: string;
  total: number;
  /** Dense position: a tie shares a number and the next row skips. */
  position: number;
  isViewer: boolean;
};

/**
 * 🔴 The league table, and the only place it is built. `/leagues/[id]`,
 * `/live` and the dashboard all call this with the board's seats, so a
 * member's position cannot differ between two pages.
 *
 * **Every seat is ranked, placeholders included.** A dummy seat drafts real
 * films and scores real points, so leaving it out moves everyone below it up
 * a place: the dashboard used to, and put Jon Bernard 13th in league 1's 2026
 * season while the league page said 16th.
 *
 * `seats` must arrive in draft order — `getLeagueBoard`'s (group, order) — and
 * the sort is stable, so tied seats stay in draft order and share a number.
 */
export function rankSeats(
  seats: readonly {
    draftId: number;
    userId: number | null;
    name: string;
    total: number;
  }[],
  viewerId: number | null,
): StandingsRow[] {
  const ranked = [...seats].sort((a, b) => b.total - a.total);
  const positions = denseRank(ranked);
  return ranked.map((seat, index) => ({
    userId: seat.userId ?? -seat.draftId,
    name: seat.name,
    total: seat.total,
    position: positions[index] as number,
    // `viewerId != null` first: a dummy seat's `userId` is null, and a bare
    // `===` would make every placeholder the signed-out reader's own seat.
    isViewer: viewerId != null && seat.userId === viewerId,
  }));
}

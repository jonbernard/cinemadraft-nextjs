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

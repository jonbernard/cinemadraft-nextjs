import type { Leaderboard } from '@/lib/services/leaderboard';
import { cn } from '@/lib/utils/cn';

/**
 * The season leaderboard grid (P10.T4): one row per nominated film, one
 * column per award show, a Total column, sorted by total descending.
 *
 * Mobile (D49): the source hid the per-show columns below `lg` and showed
 * title and total only. The honest equivalent is a table that keeps all its
 * columns and scrolls horizontally inside its own container — `overflow-x-auto`
 * here, never on the page body — while `lg:table-cell` restores the per-show
 * columns once there is room for them without scrolling.
 */
export function LeaderboardTable({
  leaderboard,
  className,
}: {
  leaderboard: Leaderboard;
  className?: string;
}) {
  if (leaderboard.rows.length === 0) {
    return (
      <p className={cn('text-text-secondary text-sm', className)}>
        No nominations for {leaderboard.year} yet.
      </p>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <caption className="sr-only">
          Season leaderboard by award show, {leaderboard.year}
        </caption>
        <thead>
          <tr className="border-border-rule border-b">
            <th
              scope="col"
              className="text-text-dim py-2 pr-3 text-left text-xs font-normal"
            >
              Film
            </th>
            {leaderboard.events.map((event) => (
              <th
                key={event.abbreviation}
                scope="col"
                title={event.name}
                className="text-text-dim hidden py-2 px-2 text-right text-xs font-normal lg:table-cell"
              >
                {event.abbreviation.toUpperCase()}
              </th>
            ))}
            <th
              scope="col"
              className="text-text-dim py-2 pl-3 text-right text-xs font-normal"
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.rows.map((row) => (
            <tr key={row.movieId} className="border-border-rule border-b">
              <th
                scope="row"
                className="text-text-primary py-2 pr-3 text-left font-normal"
              >
                {row.title}
              </th>
              {leaderboard.events.map((event) => (
                <td
                  key={event.abbreviation}
                  className="text-text-secondary tabular hidden py-2 px-2 text-right font-mono lg:table-cell"
                >
                  {row.events[event.abbreviation] ?? 0}
                </td>
              ))}
              <td className="text-text-primary tabular py-2 pl-3 text-right font-mono whitespace-nowrap">
                {row.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

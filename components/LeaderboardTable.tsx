'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils/cn';

/** One award show, as a column. Re-declared: `components/` may not import from `lib/services/` (D33). */
export type LeaderboardEventView = { abbreviation: string; name: string };

export type LeaderboardRowView = {
  movieId: number;
  title: string;
  events: Record<string, number>;
  total: number;
};

export type LeaderboardView = {
  year: number;
  events: LeaderboardEventView[];
  rows: LeaderboardRowView[];
};

/** How many rows the table opens with, and how many each press reveals. */
const PAGE = 10;

/**
 * The season leaderboard grid (P10.T4, P15.T1): one row per nominated film,
 * one column per award show, a Total column, sorted by total descending.
 *
 * 🔴 **Ten rows, then a reveal.** A full season is every film anybody was
 * nominated for — dozens of rows above the fold on the app's front page. The
 * data all arrives with the page, so the button reveals rather than fetches:
 * no endpoint, no loading state, no second query.
 *
 * 🔴 **Mobile is Film + Total, not a horizontal scroll (D79, amending D49).**
 * D49 kept every column and scrolled the table sideways. Measured on a 390px
 * phone that puts Total off screen at every width — the reader gets a list of
 * titles and has to scroll to reach the one number the section reports. The
 * per-show columns stay `hidden lg:table-cell`, so nothing changes at `lg`.
 * The columns are hidden, not removed: the markup and its `<caption>` are
 * intact, so a screen reader still reads the whole grid.
 */
export function LeaderboardTable({
  leaderboard,
  className,
}: {
  leaderboard: LeaderboardView;
  className?: string;
}) {
  const [shown, setShown] = useState(PAGE);

  if (leaderboard.rows.length === 0) {
    return (
      <p className={cn('text-text-secondary text-sm', className)}>
        No nominations for {leaderboard.year} yet.
      </p>
    );
  }

  const visible = leaderboard.rows.slice(0, shown);
  const remaining = leaderboard.rows.length - visible.length;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <table className="w-full border-collapse text-sm">
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
          {visible.map((row) => (
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

      {remaining > 0 ? (
        <button
          type="button"
          onClick={() => setShown((current) => current + PAGE)}
          className="bg-bg-raised text-text-primary hover:text-accent-text focus-visible:outline-accent-fill flex min-h-11 items-center justify-center gap-2 self-center rounded-sm px-6 text-sm transition-colors focus-visible:outline-2"
        >
          Show {Math.min(PAGE, remaining)} more
          <span className="text-text-dim tabular font-mono text-xs">
            {remaining} left
          </span>
        </button>
      ) : null}
    </div>
  );
}

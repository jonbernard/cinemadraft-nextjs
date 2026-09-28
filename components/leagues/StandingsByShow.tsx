import Link from 'next/link';

import type { StandingsSeatRow, StandingsView } from '@/lib/services/season-ledger';
import { cn } from '@/lib/utils/cn';
import { seatHref } from '@/lib/utils/league-href';
import { Move, Signed } from './WhatMoved';

/** A seat's name, linked to its season (P16.T21). */
function SeatName({ row, leagueId }: { row: StandingsSeatRow; leagueId: number }) {
  return (
    <>
      <Link
        href={seatHref(leagueId, row.draftId)}
        className="hover:text-accent-text focus-visible:outline-accent-fill focus-visible:outline-2"
      >
        {row.name}
      </Link>
      {row.isViewer ? (
        <span className="text-text-secondary ml-2 font-sans text-xs">You</span>
      ) : null}
    </>
  );
}

/**
 * The season's standings by show (P16.T19): seats down, shows across, each
 * cell a show's nominations plus wins, then the latest moment's gain and move
 * and the total. Below `lg` a list, with the per-show split behind a tap.
 *
 * 🔴 The total is `row.total`, the board's own (D125), never the sum of the
 * cells. That the cells add up to it is `buildSeasonLedger`'s invariant,
 * tested there; a re-sum here would hide a break in it instead of showing it.
 */
export function StandingsByShow({
  rows,
  shows,
  leagueId,
}: Pick<StandingsView, 'rows' | 'shows' | 'leagueId'>) {
  const shared = new Set(
    rows
      .map((row) => row.position)
      .filter((position, index, all) => all.indexOf(position) !== index),
  );
  const pos = (row: StandingsSeatRow) => (
    <>
      {shared.has(row.position) ? <span aria-hidden="true">=</span> : null}
      {row.position}
      {shared.has(row.position) ? <span className="sr-only"> (tied)</span> : null}
    </>
  );

  return (
    <>
      <table className="hidden w-full border-collapse text-sm lg:table">
        <caption className="sr-only">League standings with points by award show</caption>
        <thead>
          <tr className="border-border-rule border-b">
            <th
              scope="col"
              className="text-text-secondary w-10 py-2 pr-3 text-right text-xs font-normal"
            >
              Pos
            </th>
            <th
              scope="col"
              className="text-text-secondary py-2 text-left text-xs font-normal"
            >
              Member
            </th>
            {shows.map((show) => (
              <th
                key={show.abbreviation}
                scope="col"
                className="text-text-secondary px-1 py-2 text-right text-xs font-normal"
              >
                <abbr title={show.name} className="no-underline">
                  {show.abbreviation.toUpperCase()}
                </abbr>
              </th>
            ))}
            <th
              scope="col"
              className="text-text-secondary px-2 py-2 text-right text-xs font-normal"
            >
              Last
            </th>
            <th
              scope="col"
              className="text-text-secondary w-12 py-2 text-right text-xs font-normal"
            >
              Move
            </th>
            <th
              scope="col"
              className="text-text-secondary py-2 pl-3 text-right text-xs font-normal"
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.draftId}
              aria-current={row.isViewer ? true : undefined}
              className={cn(
                'border-border-rule border-b',
                row.isViewer && 'bg-bg-surface border-l-accent-fill border-l-2',
              )}
            >
              <td className="text-text-secondary tabular py-2 pr-3 text-right font-mono">
                {pos(row)}
              </td>
              <th
                scope="row"
                className="text-text-primary py-2 text-left font-serif font-normal"
              >
                <SeatName row={row} leagueId={leagueId} />
              </th>
              {shows.map((show) => {
                const points = row.byShow[show.abbreviation] ?? 0;
                return (
                  <td
                    key={show.abbreviation}
                    className={cn(
                      'tabular px-1 py-2 text-right font-mono',
                      points === 0 ? 'text-text-dim' : 'text-text-secondary',
                    )}
                  >
                    {points}
                  </td>
                );
              })}
              <td className="text-text-primary px-2 py-2 text-right">
                <Signed points={row.last} />
              </td>
              <td className="py-2 text-right text-xs">
                <Move by={row.move} />
              </td>
              <td
                data-total
                className="text-text-primary tabular py-2 pl-3 text-right font-mono font-semibold whitespace-nowrap"
              >
                {row.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ol className="flex flex-col gap-1 lg:hidden" aria-label="League standings">
        {rows.map((row) => (
          <li
            key={row.draftId}
            aria-current={row.isViewer ? true : undefined}
            className={cn('rounded-sm', row.isViewer ? 'bg-bg-surface' : 'bg-bg-panel')}
          >
            <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto_auto_3.5rem] items-baseline gap-2 px-3 pt-3">
              <span className="text-text-secondary tabular text-right font-mono text-sm">
                {pos(row)}
              </span>
              <span className="text-text-primary min-w-0 font-serif leading-tight">
                <SeatName row={row} leagueId={leagueId} />
              </span>
              <span className="text-text-secondary text-xs">
                <Signed points={row.last} />
              </span>
              <span className="w-8 text-right text-xs">
                <Move by={row.move} />
              </span>
              <span className="text-text-primary tabular text-right font-mono font-semibold">
                {row.total}
              </span>
            </div>
            <details className="px-3 pb-2">
              <summary className="text-text-secondary flex min-h-11 cursor-pointer items-center pl-10 text-xs">
                By show
              </summary>
              <ul className="text-text-secondary flex flex-wrap gap-x-3 gap-y-1 pb-2 pl-10 text-xs">
                {shows.map((show) => {
                  const points = row.byShow[show.abbreviation] ?? 0;
                  return points === 0 ? null : (
                    <li key={show.abbreviation}>
                      {show.name}{' '}
                      <span className="text-text-primary tabular font-mono">
                        {points}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </details>
          </li>
        ))}
      </ol>
    </>
  );
}

'use client';

import Link from 'next/link';
import { type PointerEvent, useState } from 'react';

import { Panel } from '@/components/ui/Panel';
import { SectionHead } from '@/components/ui/SectionHead';
import type { Moment } from '@/lib/services/moments';
import type { Race, RaceLine } from '@/lib/services/race';
import { cn } from '@/lib/utils/cn';
import { seatHref } from '@/lib/utils/league-href';
import { ordinal, showDay } from '@/lib/utils/season-words';
import { Signed } from './WhatMoved';

const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

/** "Oscar nominations", "Oscars ceremony": what a step is, in words. */
function momentName(moment: Moment): string {
  return `${moment.name} ${moment.phase === 'nominations' ? 'nominations' : 'ceremony'}`;
}

/** "A and B", "3 seats". */
function names(lines: readonly RaceLine[]): string {
  return lines.length > 2
    ? `${lines.length} seats`
    : lines.map((line) => line.name).join(' and ');
}

/** A 1-2-5 step that splits `span` into about four gridlines. */
function niceStep(span: number): number {
  const raw = span / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

/**
 * The season as a race (P16.T22): every seat's running total after each
 * finished moment, one thin line each in the rule colour, the leader in
 * primary ink and the reader in beam. Hand-drawn SVG, tokens only.
 *
 * 🔴 The chart is `aria-hidden`: the table after it carries the same numbers,
 * and the lead changes say them in words. The hover readout is a convenience
 * for a pointer, never the only way to a value.
 *
 * On the date axis the steps sit at their dates and the ticks are months; on
 * the order axis (a season with no stored dates, D134) they are evenly spaced,
 * ticked by show, and the caption says so.
 */
export function RaceChart({ race, leagueId }: { race: Race; leagueId: number }) {
  const [active, setActive] = useState<number | null>(null);
  const n = race.x.length;
  const first = race.x[0] ?? 0;
  const last = race.x.at(-1) ?? 0;
  const xAt = (i: number) =>
    last === first ? 50 : (((race.x[i] ?? first) - first) / (last - first)) * 100;

  // Razzie points are negative, so the floor is not always zero.
  const all = race.lines.flatMap((line) => line.points);
  const step = niceStep(Math.max(1, Math.max(...all, 0) - Math.min(...all, 0)));
  const lo = Math.floor(Math.min(...all, 0) / step) * step;
  const hi = Math.max(Math.ceil(Math.max(...all, 0) / step) * step, lo + step);
  const yAt = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100;
  const gridlines: number[] = [];
  for (let v = lo; v <= hi; v += step) gridlines.push(v);

  const ticks: { at: number; label: string; key: string }[] = [];
  if (race.axis === 'date') {
    const start = new Date(first);
    for (
      let t = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1);
      t <= last;
      t = Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth() + 1, 1)
    ) {
      ticks.push({
        at: ((t - first) / (last - first)) * 100,
        label: month.format(t),
        key: String(t),
      });
    }
  } else {
    race.moments.forEach((moment, i) => {
      if (race.moments.findIndex((m) => m.abbreviation === moment.abbreviation) === i)
        ticks.push({
          at: xAt(i),
          label: moment.abbreviation.toUpperCase(),
          key: moment.key,
        });
    });
  }

  const path = (line: RaceLine) =>
    line.points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(v)}`).join(' ');
  const leaders = race.lines.filter((line) => line.isLeader);
  const viewer = race.lines.find((line) => line.isViewer && !line.isLeader);
  const drawn = [
    ...race.lines.filter((line) => !line.isLeader && !line.isViewer),
    ...(viewer ? [viewer] : []),
    ...leaders,
  ];

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const at = ((event.clientX - box.left) / box.width) * 100;
    let nearest = 0;
    for (let i = 1; i < n; i++)
      if (Math.abs(xAt(i) - at) < Math.abs(xAt(nearest) - at)) nearest = i;
    setActive(n > 0 ? nearest : null);
  };

  const byDraft = new Map(race.lines.map((line) => [line.draftId, line]));
  const top = (i: number) => byDraft.get(race.leaderAt[i] ?? 0);
  const readout = active == null ? null : race.moments[active];

  return (
    <div className="flex flex-col gap-10">
      <Panel as="section" className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <SectionHead as="h2" className="pb-0">
            The race
          </SectionHead>
          <ul
            aria-label="Key"
            className="text-text-secondary flex flex-wrap gap-4 text-xs"
          >
            <li className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="bg-text-primary inline-block h-0.5 w-5"
              />
              {names(leaders)}, first
            </li>
            {viewer ? (
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="bg-beam inline-block h-1 w-5" />
                You, {ordinal(viewer.position)}
              </li>
            ) : null}
            <li className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="bg-border-rule inline-block h-0.5 w-5"
              />
              Everyone else
            </li>
          </ul>
        </div>

        <div aria-hidden="true" className="ml-10 pb-8">
          <div
            data-race-plot
            data-axis={race.axis}
            className="relative h-64 touch-pan-y sm:h-96"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setActive(null)}
          >
            {gridlines.map((v) => (
              <div key={v} className="absolute inset-x-0" style={{ top: `${yAt(v)}%` }}>
                <div
                  className={cn(
                    'h-px w-full',
                    v === 0 ? 'bg-text-dim' : 'bg-border-rule',
                  )}
                />
                <span className="text-text-dim tabular absolute -left-10 w-8 -translate-y-1/2 text-right font-mono text-xs">
                  {v}
                </span>
              </div>
            ))}
            {ticks.map((tick, i) => (
              <span
                key={tick.key}
                className={cn(
                  'text-text-dim absolute top-full mt-2 -translate-x-1/2 text-xs whitespace-nowrap',
                  race.axis === 'order' && i % 2 === 1 && 'hidden sm:block',
                )}
                style={{ left: `${tick.at}%` }}
              >
                {tick.label}
              </span>
            ))}

            <svg
              aria-hidden="true"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full overflow-visible"
            >
              {drawn.map((line) => (
                <path
                  key={line.draftId}
                  data-seat={line.draftId}
                  d={path(line)}
                  fill="none"
                  stroke={
                    line.isLeader
                      ? 'var(--color-text-primary)'
                      : line.isViewer
                        ? 'var(--color-beam)'
                        : 'var(--color-border-rule)'
                  }
                  strokeWidth={line.isLeader || line.isViewer ? 2.5 : 1.5}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
            </svg>

            {race.leadChanges.map((change) => {
              const leader = top(change.stepIndex);
              return (
                <span
                  key={change.stepIndex}
                  className="bg-text-primary ring-bg-panel absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
                  style={{
                    left: `${xAt(change.stepIndex)}%`,
                    top: `${yAt(leader?.points[change.stepIndex] ?? 0)}%`,
                  }}
                />
              );
            })}

            {active != null && readout ? (
              <>
                <div
                  className="bg-text-dim pointer-events-none absolute inset-y-0 w-px"
                  style={{ left: `${xAt(active)}%` }}
                />
                <div
                  data-race-readout
                  className={cn(
                    'bg-bg-surface text-text-primary pointer-events-none absolute top-0 z-10 flex w-56 flex-col gap-1 rounded-sm p-3 text-xs',
                    xAt(active) > 55 ? '-translate-x-full' : '',
                  )}
                  style={{
                    left: `calc(${xAt(active)}% ${xAt(active) > 55 ? '- 8px' : '+ 8px'})`,
                  }}
                >
                  <span className="text-text-secondary">
                    {momentName(readout)}
                    {readout.date != null ? ` · ${showDay(readout.date)}` : ''}
                  </span>
                  {[...leaders, ...(viewer ? [viewer] : [])].map((line) => (
                    <span
                      key={line.draftId}
                      className="flex items-baseline justify-between gap-2"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className={cn(
                            'inline-block h-0.5 w-3 shrink-0',
                            line.isLeader ? 'bg-text-primary' : 'bg-beam',
                          )}
                        />
                        <span className="text-text-secondary truncate">{line.name}</span>
                      </span>
                      <span className="tabular font-mono font-semibold">
                        {line.points[active]}
                      </span>
                    </span>
                  ))}
                  <span className="text-text-secondary">
                    Leading: {top(active)?.name} · {top(active)?.points[active]}
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <p className="text-text-dim text-xs">
          Each step is one scoring moment, {n} so far this season: nominations and
          ceremonies, in the order they happened.
          {race.axis === 'order'
            ? " This season's dates weren't recorded, so the moments are in this year's order, evenly spaced."
            : ''}
        </p>
      </Panel>

      <div className="grid gap-8 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <SectionHead
            as="h2"
            eyebrow={`${race.leadChanges.length} ${race.leadChanges.length === 1 ? 'change' : 'changes'}`}
          >
            Lead changes
          </SectionHead>
          {race.leadChanges.length === 0 ? (
            <p className="text-text-secondary text-sm">
              {top(0)?.name} has led from the first moment.
            </p>
          ) : (
            <ol className="flex flex-col gap-1">
              {race.leadChanges.map((change) => (
                <li
                  key={change.stepIndex}
                  className="bg-bg-panel flex flex-col gap-1 rounded-sm px-4 py-3 text-sm"
                >
                  <span>
                    <span className="font-serif">{change.to}</span>
                    <span className="text-text-secondary"> takes the lead from </span>
                    <span className="font-serif">{change.from}</span>
                  </span>
                  <span className="text-text-secondary text-xs">
                    {momentName(change.moment)}
                    {change.moment.date != null
                      ? ` · ${showDay(change.moment.date)}`
                      : ''}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <SectionHead as="h2">Biggest single moments</SectionHead>
          <ol className="flex flex-col gap-1">
            {race.biggest.map((gain) => (
              <li
                key={`${gain.moment.key}-${gain.draftId}`}
                className="bg-bg-panel flex items-baseline justify-between gap-3 rounded-sm px-4 py-3"
              >
                <span className="flex flex-col">
                  <span className="font-serif text-sm">{gain.name}</span>
                  <span className="text-text-secondary text-xs">
                    {momentName(gain.moment)}
                  </span>
                </span>
                <Signed points={gain.points} />
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <SectionHead as="h2">The race in numbers</SectionHead>
        <section
          // biome-ignore lint/a11y/noNoninteractiveTabindex: WCAG 2.1.1 requires a scrollable region to be keyboard-reachable, and only a focusable element can be scrolled with the arrow keys (PosterCarousel's reasoning). The named <section> announces the focus stop.
          tabIndex={0}
          aria-label="Running totals, scrollable"
          className="focus-visible:outline-accent-fill overflow-x-auto [contain:inline-size] focus-visible:outline-2"
        >
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Each seat’s running total after every scoring moment
            </caption>
            <thead>
              <tr className="border-border-rule border-b">
                <th
                  scope="col"
                  className="bg-bg-panel text-text-secondary sticky left-0 py-2 pr-3 text-left text-xs font-normal"
                >
                  Member
                </th>
                {race.moments.map((moment) => (
                  <th
                    key={moment.key}
                    scope="col"
                    className="text-text-secondary px-2 py-2 text-right text-xs font-normal whitespace-nowrap"
                  >
                    <abbr title={momentName(moment)} className="no-underline">
                      {moment.abbreviation.toUpperCase()}
                      <span className="text-text-dim block">
                        {moment.phase === 'nominations' ? 'noms' : 'awards'}
                      </span>
                    </abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {race.lines.map((line) => (
                <tr
                  key={line.draftId}
                  aria-current={line.isViewer ? true : undefined}
                  className={cn(
                    'border-border-rule border-b',
                    line.isViewer && 'border-l-accent-fill border-l-2',
                  )}
                >
                  <th
                    scope="row"
                    className="bg-bg-panel text-text-primary sticky left-0 py-2 pr-3 text-left font-serif font-normal whitespace-nowrap"
                  >
                    <Link
                      href={seatHref(leagueId, line.draftId)}
                      className="hover:text-accent-text focus-visible:outline-accent-fill focus-visible:outline-2"
                    >
                      {line.name}
                    </Link>
                  </th>
                  {line.points.map((points, i) => (
                    <td
                      // biome-ignore lint/suspicious/noArrayIndexKey: one cell per step, in step order.
                      key={i}
                      className={cn(
                        'tabular px-2 py-2 text-right font-mono',
                        i === n - 1
                          ? 'text-text-primary font-semibold'
                          : 'text-text-secondary',
                      )}
                    >
                      {points}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </section>
    </div>
  );
}

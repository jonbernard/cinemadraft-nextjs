import Link from 'next/link';
import type { ReactNode } from 'react';

import { SectionHead } from '@/components/ui/SectionHead';
import { StatusChip } from '@/components/ui/StatusChip';
import type { SeasonMoment, SeasonView } from '@/lib/services/season-view';
import { cn } from '@/lib/utils/cn';
import { ordinal, plural, showDay, showWeekday } from '@/lib/utils/season-words';

/** What a moment says it did, in one line: the phase and its count. */
function summary(moment: SeasonMoment): string {
  const phase = moment.phase === 'nominations' ? 'Nominations' : 'Ceremony';
  const decided = `${moment.winners} of ${moment.categories} decided`;
  if (moment.state === 'live') return `${phase} · on air · ${decided}`;
  if (moment.state === 'finished')
    return `${phase} · ${moment.phase === 'nominations' ? plural(moment.nominations, 'nomination') : decided}`;
  return moment.categories > 0
    ? `${phase} · ${plural(moment.categories, 'category', 'categories')}`
    : phase;
}

/**
 * The season as an agenda (P16.T15): every scoring moment, in date order,
 * grouped by month, each linking to its show for the season. It replaced
 * `/award-shows`' logo grid, which carried no date at all.
 *
 * Public and first-class signed out: the counts and each finished moment's
 * headline film are the season's story without anyone's seat in it. `aside`
 * is the signed-in slot (P16.T16), one node per moment key.
 *
 * Nominated films are plain text, not pills (D73: pills are for status).
 */
export function SeasonAgenda({
  months,
  year,
  nextKey,
  aside,
}: {
  months: SeasonView['months'];
  year: number;
  nextKey: string | null;
  aside?: ReadonlyMap<string, ReactNode>;
}) {
  return (
    <div className="flex flex-col gap-8">
      {months.map((month) => (
        <section key={month.label} className="flex flex-col gap-2">
          <SectionHead as="h2" className="pb-1">
            {month.label}
          </SectionHead>
          <ol className="flex flex-col gap-1">
            {month.moments.map((moment) => {
              const isNext = moment.key === nextKey;
              const extra = aside?.get(moment.key);
              return (
                <li key={moment.key}>
                  <Link
                    href={`/award-shows/${moment.abbreviation}?year=${year}`}
                    aria-current={isNext ? 'step' : undefined}
                    className={cn(
                      'hover:bg-bg-surface focus-visible:outline-accent-fill grid min-h-11 grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-x-4 gap-y-2 rounded-sm px-3 py-3 focus-visible:outline-2 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]',
                      isNext ? 'bg-bg-surface' : 'bg-bg-panel',
                    )}
                  >
                    <span className="flex flex-col">
                      {moment.date == null ? (
                        <span className="text-text-dim text-xs">
                          {moment.state === 'upcoming' ? 'Date TBA' : ''}
                        </span>
                      ) : (
                        <>
                          <time
                            dateTime={new Date(moment.date).toISOString().slice(0, 10)}
                            className="text-text-primary tabular font-mono text-sm"
                          >
                            {showDay(moment.date)}
                          </time>
                          <span className="text-text-dim text-xs">
                            {showWeekday(moment.date)}
                          </span>
                        </>
                      )}
                    </span>

                    <span className="flex min-w-0 flex-col gap-1">
                      <span
                        className={cn(
                          'font-serif text-base leading-tight',
                          moment.state === 'finished'
                            ? 'text-text-secondary'
                            : 'text-text-primary',
                        )}
                      >
                        {moment.name}
                      </span>
                      <span className="text-text-secondary text-xs">
                        {summary(moment)}
                      </span>
                      {moment.highlight ? (
                        <span className="text-text-secondary text-xs">
                          {moment.phase === 'ceremony'
                            ? 'Most wins: '
                            : 'Most nominated: '}
                          <span className="text-text-primary font-serif text-sm">
                            {moment.highlight.title}
                          </span>
                          {' · '}
                          {moment.phase === 'ceremony'
                            ? plural(moment.highlight.count, 'win')
                            : plural(moment.highlight.count, 'nomination')}
                        </span>
                      ) : null}
                    </span>

                    {isNext || moment.state === 'live' || extra ? (
                      <span className="col-span-2 flex flex-col items-start gap-1 sm:col-span-1 sm:items-end">
                        {moment.state === 'live' ? (
                          <StatusChip tone="carmine">On air</StatusChip>
                        ) : isNext ? (
                          <StatusChip tone="beam" className="bg-bg-panel">
                            Next
                          </StatusChip>
                        ) : null}
                        {extra}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

/**
 * What one finished moment did to the reader in one league (P16.T16):
 * "Racso award +170 · 16th ▼3". The arrow is decoration; the direction is
 * read out in words.
 */
export function LeagueMomentLine({
  name,
  points,
  position,
  move,
}: {
  name: string;
  points: number;
  position: number;
  move: number;
}) {
  const signed = points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : '0';
  const places = Math.abs(move) === 1 ? 'place' : 'places';
  return (
    <span className="text-text-secondary tabular text-xs sm:text-right">
      <span className="font-serif">{name}</span>{' '}
      <span className="text-text-primary font-mono">{signed}</span>
      {' · '}
      {ordinal(position)}
      {move !== 0 ? (
        <>
          <span aria-hidden="true" className="font-mono">
            {' '}
            {move > 0 ? '▲' : '▼'}
            {Math.abs(move)}
          </span>
          <span className="sr-only">
            , {move > 0 ? 'up' : 'down'} {Math.abs(move)} {places}
          </span>
        </>
      ) : null}
    </span>
  );
}

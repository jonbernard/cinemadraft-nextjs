import { Panel } from '@/components/ui/Panel';
import { SectionHead } from '@/components/ui/SectionHead';
import type { WhatMovedView } from '@/lib/services/season-ledger';
import { ordinal, plural, showDay, showWeekday } from '@/lib/utils/season-words';

/** "+85", "−5", "0". */
export function Signed({ points }: { points: number }) {
  return (
    <span className="tabular font-mono">
      {points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : '0'}
    </span>
  );
}

/** ▲2 to the eye, "up 2 places" to a screen reader; a dash when nothing moved. */
export function Move({ by }: { by: number }) {
  if (by === 0)
    return (
      <span className="text-text-dim">
        <span aria-hidden="true">–</span>
        <span className="sr-only">no change</span>
      </span>
    );
  const places = Math.abs(by) === 1 ? 'place' : 'places';
  return (
    <span className="text-text-primary tabular font-mono">
      <span aria-hidden="true">
        {by > 0 ? '▲' : '▼'}
        {Math.abs(by)}
      </span>
      <span className="sr-only">
        {by > 0 ? 'up' : 'down'} {Math.abs(by)} {places}
      </span>
    </span>
  );
}

/** "A and B", "A, B and C". */
function names(list: readonly string[]): string {
  return list.length <= 1
    ? (list[0] ?? '')
    : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
}

function leaderSentence(moved: WhatMovedView): string {
  if (moved.leaders.length > 1) return `${names(moved.leaders)} share the lead`;
  const [leader] = moved.leaders;
  if (moved.previousLeader == null) return `${leader} leads`;
  return moved.leadChanged
    ? `${leader} takes the lead from ${moved.previousLeader}`
    : `${leader} keeps the lead`;
}

const MOVERS_SHOWN = 5;
const FILMS_SHOWN = 5;

/**
 * "What moved" (P16.T19): the league at its latest scoring moment — the live
 * one during a ceremony, otherwise the last finished one. Always dated: a
 * moment with no stored date says its season instead.
 *
 * "Won" is brass because it is an award outcome (D99); everything else is
 * plain text, never a pill (D73).
 */
export function WhatMoved({ moved, year }: { moved: WhatMovedView; year: number }) {
  const { moment } = moved;
  const phase = moment.phase === 'nominations' ? 'nominations' : 'ceremony';
  const when =
    moment.state === 'live' ? (
      `live · ${moment.winners} of ${moment.categories ?? '?'} decided`
    ) : moment.date == null ? (
      String(year)
    ) : (
      <time dateTime={new Date(moment.date).toISOString().slice(0, 10)}>
        {showWeekday(moment.date)} {showDay(moment.date)}
      </time>
    );

  return (
    <Panel tone="surface" as="section" className="flex flex-col gap-6 p-5">
      <div className="flex flex-col gap-1">
        <SectionHead as="h2" className="pb-0" eyebrow="What moved">
          {moment.name} · {phase} · {when}
        </SectionHead>
        <p className="text-text-secondary text-sm">
          {leaderSentence(moved)}
          {' · '}
          {moved.movers.length === 0
            ? 'nobody changed places'
            : `${plural(moved.movers.length, 'seat')} changed places`}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Panel className="flex flex-col gap-2 p-4">
          <h3 className="text-text-secondary text-xs font-normal">Biggest gains</h3>
          {moved.gains.length === 0 ? (
            <p className="text-text-secondary text-sm">Nobody scored.</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {moved.gains.map((gain) => (
                <li
                  key={gain.draftId}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="font-serif">{gain.name}</span>
                  <Signed points={gain.points} />
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel className="flex flex-col gap-2 p-4">
          <h3 className="text-text-secondary text-xs font-normal">Changed places</h3>
          {moved.movers.length === 0 ? (
            <p className="text-text-secondary text-sm">Nobody changed places.</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {moved.movers.slice(0, MOVERS_SHOWN).map((mover) => (
                <li
                  key={mover.draftId}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="font-serif">{mover.name}</span>
                  <span className="text-text-secondary tabular flex items-baseline gap-2 font-mono text-xs">
                    <span aria-hidden="true">
                      {ordinal(mover.from)} → {ordinal(mover.to)}
                    </span>
                    <Move by={mover.from - mover.to} />
                  </span>
                </li>
              ))}
              {moved.movers.length > MOVERS_SHOWN ? (
                <li className="text-text-secondary text-xs">
                  and {moved.movers.length - MOVERS_SHOWN} more
                </li>
              ) : null}
            </ol>
          )}
        </Panel>

        <Panel className="flex flex-col gap-2 p-4">
          <h3 className="text-text-secondary text-xs font-normal">
            The films that did it
          </h3>
          {moved.films.length === 0 ? (
            <p className="text-text-secondary text-sm">
              Nothing held in this league scored.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {moved.films.slice(0, FILMS_SHOWN).map((film) => (
                <li key={film.title} className="flex flex-col text-sm">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-serif">{film.title}</span>
                    <Signed points={film.points} />
                  </span>
                  <span className="text-text-secondary text-xs">
                    {film.won > 0 ? (
                      <>
                        <span className="text-brass-text font-semibold">
                          won {film.won}
                        </span>
                        {' · '}
                      </>
                    ) : null}
                    {plural(film.holders, 'seat')}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </Panel>
  );
}

import { PointsLedger } from '@/components/awards/PointsLedger';
import { RemoteImage } from '@/components/ui/RemoteImage';
import type { SeatSeasonPick, SeatSeasonView } from '@/lib/services/season-ledger';
import { seatHref } from '@/lib/utils/league-href';

function Poster({ src, width }: { src: string | null; width: 'w-8' | 'w-14' }) {
  return (
    <span
      className={`poster-radius bg-bg-surface relative aspect-[2/3] shrink-0 self-start overflow-hidden ${width}`}
    >
      {src ? (
        <RemoteImage
          src={src}
          alt=""
          fill
          sizes={width === 'w-8' ? '32px' : '56px'}
          className="object-cover"
        />
      ) : null}
    </span>
  );
}

/** "won", "won 2" — an award outcome, so brass (D99), and text, not a pill (D73). */
function Won({ wins }: { wins: number }) {
  return wins > 0 ? (
    <span className="text-brass-text font-sans text-xs font-semibold">
      {wins === 1 ? 'won' : `won ${wins}`}
    </span>
  ) : null;
}

const round = (pick: SeatSeasonPick) => String(pick.round).padStart(2, '0');

/**
 * One seat's season (P16.T21): its picks in draft order down the side, the
 * shows in date order across the top, each cell what that film earned there,
 * and a footer of per-show totals. Each film's total opens the shipped
 * `PointsLedger`. Below `lg`, one card per film, listing only where it scored.
 *
 * 🔴 The grand total is `seat.total`, the board's own, never the footer
 * re-summed; that the footer adds up to it is `buildSeasonLedger`'s invariant.
 */
export function SeatSeason({ view }: { view: SeatSeasonView }) {
  const { seat, picks, shows } = view;
  return (
    <div className="flex flex-col gap-6">
      {/* A GET form, so switching seats needs no JavaScript: the page reads
          `?seat=` and redirects to that seat's own URL. */}
      <form
        method="get"
        action={seatHref(view.leagueId, seat.draftId)}
        className="flex flex-wrap items-center gap-3"
      >
        <label className="text-text-secondary flex items-center gap-3 text-sm">
          Seat
          <select
            name="seat"
            defaultValue={seat.draftId}
            className="border-border-rule bg-bg-panel text-text-primary min-h-11 rounded-sm border px-3 text-sm"
          >
            {view.seats.map((entry) => (
              <option key={entry.draftId} value={entry.draftId}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="border-border-rule text-text-primary hover:bg-bg-surface focus-visible:outline-accent-fill min-h-11 rounded-sm border px-4 text-sm focus-visible:outline-2"
        >
          Open
        </button>
      </form>

      {picks.length === 0 ? (
        <p className="text-text-secondary text-sm">This seat has no picks this season.</p>
      ) : (
        <>
          <table className="hidden w-full border-collapse text-sm lg:table">
            <caption className="sr-only">
              Points for each of {seat.name}’s picks at each award show
            </caption>
            <thead>
              <tr className="border-border-rule border-b">
                <th
                  scope="col"
                  className="text-text-secondary py-2 pr-3 text-left text-xs font-normal"
                >
                  Pick
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
                  className="text-text-secondary py-2 pl-3 text-right text-xs font-normal"
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {picks.map((pick) => (
                <tr key={pick.pickId} className="border-border-rule border-b align-top">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    <span className="flex items-center gap-3">
                      <span className="text-text-dim tabular w-5 font-mono text-xs">
                        {round(pick)}
                      </span>
                      <Poster src={pick.posterUrl} width="w-8" />
                      <span className="text-text-primary font-serif leading-tight">
                        {pick.title}
                      </span>
                    </span>
                  </th>
                  {shows.map((show) => {
                    const cell = pick.byShow[show.abbreviation];
                    return (
                      <td
                        key={show.abbreviation}
                        className="tabular px-1 py-2 text-right font-mono"
                      >
                        {cell ? (
                          <span className="flex flex-col items-end">
                            <span className="text-text-primary">{cell.points}</span>
                            <Won wins={cell.wins} />
                          </span>
                        ) : (
                          <span className="text-text-dim">
                            <span aria-hidden="true">·</span>
                            <span className="sr-only">nothing</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2 pl-3 text-right">
                    <PointsLedger
                      total={pick.points}
                      lines={pick.ledger}
                      label={pick.title}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th
                  scope="row"
                  className="text-text-secondary py-2 pr-3 text-left text-xs font-normal"
                >
                  By show
                </th>
                {shows.map((show) => (
                  <td
                    key={show.abbreviation}
                    data-show-total
                    className="text-text-primary tabular px-1 py-2 text-right font-mono font-semibold"
                  >
                    {view.byShow[show.abbreviation] ?? 0}
                  </td>
                ))}
                <td
                  data-season-total
                  className="text-text-primary tabular py-2 pl-3 text-right font-mono font-semibold"
                >
                  {seat.total}
                </td>
              </tr>
            </tfoot>
          </table>

          <ol
            className="flex flex-col gap-3 lg:hidden"
            aria-label={`${seat.name}’s picks`}
          >
            {picks.map((pick) => {
              const scoredAt = shows.filter((show) => pick.byShow[show.abbreviation]);
              return (
                <li key={pick.pickId} className="bg-bg-panel flex gap-3 rounded-sm p-3">
                  <Poster src={pick.posterUrl} width="w-14" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-text-primary font-serif leading-tight">
                        <span className="text-text-dim tabular mr-2 font-mono text-xs">
                          {round(pick)}
                        </span>
                        {pick.title}
                      </span>
                      <PointsLedger
                        total={pick.points}
                        lines={pick.ledger}
                        label={pick.title}
                      />
                    </div>
                    {scoredAt.length === 0 ? (
                      <span className="text-text-secondary text-xs">
                        Not nominated this season
                      </span>
                    ) : (
                      <ul className="text-text-secondary flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {scoredAt.map((show) => {
                          const cell = pick.byShow[show.abbreviation];
                          return (
                            <li key={show.abbreviation}>
                              {show.name}{' '}
                              <span className="text-text-primary tabular font-mono">
                                {cell?.points}
                              </span>{' '}
                              <Won wins={cell?.wins ?? 0} />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
            <li className="flex items-baseline justify-between px-3 pt-1">
              <span className="text-text-secondary text-sm">Season total</span>
              <span className="text-text-primary tabular font-mono font-semibold">
                {seat.total}
              </span>
            </li>
          </ol>
        </>
      )}
    </div>
  );
}

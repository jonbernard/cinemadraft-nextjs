import { PickCell } from '@/components/PickCell';
import type { LedgerRow } from '@/components/PointsLedger';
import { cn } from '@/lib/utils/cn';

export type BoardSeat = {
  draftId: number;
  name: string;
  isDummy: boolean;
  total: number;
  picks: {
    pickId: number;
    round: number;
    title: string;
    posterUrl: string | null;
    points: number;
    ledger?: readonly LedgerRow[];
  }[];
};

/**
 * One group's draft.
 *
 * The gate for this phase is that **a taken film is unmistakable at a glance
 * from artwork alone** (§6.7), which is why every filled cell carries a poster.
 *
 * **Two presentations, one set of props (D49).** Members watch the draft on
 * their phones while the owner runs the call, so this cannot be a wide table
 * that technically scrolls sideways:
 *
 *   - **Phone** — seats stacked, each with its own scrollable strip of picks.
 *     You read one seat at a time, which is what a narrow screen affords.
 *   - **Desktop** — the aligned grid, seats down and rounds across. Its whole
 *     value is the alignment: you can compare what everyone took in round 4,
 *     which is impossible at phone width no matter how it is squeezed.
 *
 * Deliberately not a squeezed copy of the same layout, and deliberately not
 * two data paths — both render from the same `seats` and `rounds`.
 *
 * `rounds` is the longest seat in this group and comes from the service, never
 * a constant (D34). In the grid a short seat gets explicit empty cells so the
 * columns stay aligned; without them round 5 for one seat would sit under
 * round 4 for another and the board would lie about who picked when.
 */
export function DraftBoard({
  seats,
  rounds,
  viewerSeatId,
  className,
}: {
  seats: readonly BoardSeat[];
  rounds: number;
  /** The signed-in member's own seat, if they have one in this group. */
  viewerSeatId?: number | null;
  className?: string;
}) {
  if (seats.length === 0) {
    return (
      <p className={cn('text-text-secondary text-sm', className)}>
        No seats in this group.
      </p>
    );
  }

  // The rounds as values, not indices. A round number is a real identity —
  // round 4 is round 4 for every seat — so it keys both the header and the
  // cells, and nothing depends on array position.
  const roundNumbers = Array.from({ length: rounds }, (_, index) => index + 1);

  return (
    <div className={className}>
      {/* Phone: one seat at a time. */}
      <ul className="flex flex-col gap-6 md:hidden">
        {seats.map((seat) => {
          const isViewer = viewerSeatId != null && seat.draftId === viewerSeatId;
          return (
            <li
              key={seat.draftId}
              aria-current={isViewer ? true : undefined}
              className={cn(
                'border-border-rule flex flex-col gap-2 border-b pb-4',
                isViewer && 'border-l-accent-fill bg-bg-raised border-l-2 pl-3',
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-text-primary text-sm">
                  {seat.name}
                  {isViewer ? <span className="text-accent-text"> · You</span> : null}
                  {seat.isDummy ? (
                    <span className="text-text-dim"> · unclaimed</span>
                  ) : null}
                </span>
                <span className="text-text-secondary tabular font-mono text-xs">
                  {seat.total}
                </span>
              </div>

              {seat.picks.length === 0 ? (
                <span className="text-text-dim text-xs">No picks yet.</span>
              ) : (
                // Scrolls within the seat rather than the whole page, so a
                // long roster never pushes the next seat off-screen.
                <ul className="flex gap-2 overflow-x-auto pb-1">
                  {seat.picks.map((pick) => (
                    <li key={pick.pickId} className="w-20 shrink-0">
                      <PickCell
                        round={pick.round}
                        film={{
                          title: pick.title,
                          posterUrl: pick.posterUrl,
                          points: pick.points,
                          ledger: pick.ledger,
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {/* Desktop: the aligned grid, where comparing a round across seats is
          the point. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Draft board: one row per seat, one column per round
          </caption>
          <thead>
            <tr className="border-border-rule border-b">
              <th
                scope="col"
                className="text-text-dim w-40 py-2 pr-4 text-left text-xs font-normal uppercase tracking-wide"
              >
                Seat
              </th>
              {roundNumbers.map((round) => (
                <th
                  key={round}
                  scope="col"
                  className="text-text-dim tabular w-24 px-1 py-2 text-left font-mono text-xs font-normal"
                >
                  {String(round).padStart(2, '0')}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {seats.map((seat) => {
              const isViewer = viewerSeatId != null && seat.draftId === viewerSeatId;
              const byRound = new Map(seat.picks.map((pick) => [pick.round, pick]));

              return (
                <tr
                  key={seat.draftId}
                  aria-current={isViewer ? true : undefined}
                  className={cn(
                    'border-border-rule border-b align-top',
                    isViewer && 'bg-bg-raised border-l-accent-fill border-l-2',
                  )}
                >
                  <th scope="row" className="py-3 pr-4 text-left font-normal">
                    <span className="text-text-primary block text-sm">{seat.name}</span>
                    <span className="text-text-secondary tabular block font-mono text-xs">
                      {seat.total}
                      {/* The viewer is named, not just tinted — colour alone
                        would be invisible to a colour-blind reader and in
                        print (a11y: colour-not-only). */}
                      {isViewer ? <span className="text-accent-text"> · You</span> : null}
                      {seat.isDummy ? (
                        <span className="text-text-dim"> · unclaimed</span>
                      ) : null}
                    </span>
                  </th>

                  {roundNumbers.map((round) => {
                    const pick = byRound.get(round);
                    return (
                      <td key={round} className="px-1 py-3">
                        <PickCell
                          round={round}
                          film={
                            pick
                              ? {
                                  title: pick.title,
                                  posterUrl: pick.posterUrl,
                                  points: pick.points,
                                  ledger: pick.ledger,
                                }
                              : undefined
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

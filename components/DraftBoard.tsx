import { PickCell } from '@/components/PickCell';
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
  }[];
};

/**
 * One group's draft, as a grid: seats down the side, rounds across the top.
 *
 * The gate for this phase is that **a taken film is unmistakable at a glance
 * from artwork alone** (§6.7), which is why every filled cell carries a poster
 * and why the grid is dense enough to take in at once.
 *
 * `rounds` comes from the service and is the longest seat in this group —
 * never a constant (D34). A seat with fewer picks gets explicit empty cells so
 * the columns stay aligned; without them, round 5 for one seat would sit under
 * round 4 for another and the board would lie about who picked when.
 *
 * The whole grid scrolls horizontally rather than shrinking cells, for the
 * same reason the roster strip wraps: a cell too small to recognise a poster
 * in defeats the point of showing the poster.
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

  return (
    <div className={cn('overflow-x-auto', className)}>
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
            {Array.from({ length: rounds }, (_, index) => (
              <th
                key={index + 1}
                scope="col"
                className="text-text-dim tabular w-24 px-1 py-2 text-left font-mono text-xs font-normal"
              >
                {String(index + 1).padStart(2, '0')}
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

                {Array.from({ length: rounds }, (_, index) => {
                  const round = index + 1;
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
  );
}

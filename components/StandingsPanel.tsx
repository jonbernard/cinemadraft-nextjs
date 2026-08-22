import type { StandingsRow } from '@/lib/services/dashboard';
import { cn } from '@/lib/utils/cn';

/**
 * The league table (§6.5).
 *
 * Real table semantics, because this is genuinely tabular: three facts about
 * each member, compared down columns. A grid of divs would read to a screen
 * reader as one long run of names and numbers with no way to tell which total
 * belongs to whom, and no way to jump by row.
 *
 * 🔴 **Ties are the normal state, not an edge case.** Before the first award
 * is handed out every member is on zero and shares position 1 — that is what
 * this table looks like on opening day, the day most members will first see
 * it. So the position is printed on EVERY row, never blanked on repeats.
 * Blanking is the newspaper-results convention and it is wrong here: a
 * twelve-member league on opening day would render one "1" and eleven empty
 * cells, which reads as data failing to load. The shared position is instead
 * marked with a leading "=" (the leaderboard convention for a tie), so a
 * repeated number reads as a deliberate statement that they are level rather
 * than as the same row rendered twice.
 *
 * The viewer's row is marked by the word "You" and by `aria-current`, not by
 * colour. The tint and the carmine edge are there to make it findable while
 * scanning twelve rows, but they are the third and fourth signals — remove
 * every colour and the row is still identifiable, which is the a11y rule
 * "color-not-only". `accent-fill` appears as a border only: at 2.96:1 on the
 * dark ground it fails as text, and `theme/contrast.test.ts` pins why.
 */
export function StandingsPanel({
  rows,
  className,
}: {
  rows: readonly StandingsRow[];
  className?: string;
}) {
  if (rows.length === 0) {
    // A league with no seats drafted yet is a real state, not an error. Saying
    // nothing at all would leave a hole where the table belongs and imply
    // something failed.
    return (
      <p className={cn('text-text-secondary text-sm', className)}>
        Standings appear once the league has drafted.
      </p>
    );
  }

  // A position is shared when any other row claims the same number. Computed
  // from the positions the service already assigned rather than by re-ranking
  // totals here: dense ranking has exactly one definition (D19's spirit), and
  // a second implementation in the view could disagree with the first.
  const shared = new Set(
    rows
      .map((row) => row.position)
      .filter((position, index, all) => all.indexOf(position) !== index),
  );

  return (
    <table className={cn('w-full border-collapse text-sm', className)}>
      {/* The table needs a name of its own: on a dashboard carrying a roster
          and a season rail, "table" with no name tells a screen-reader user
          nothing about which one they have landed in. */}
      <caption className="sr-only">League standings, by position</caption>
      <thead>
        <tr className="border-border-rule border-b">
          <th
            scope="col"
            className="text-text-dim w-10 py-2 pr-3 text-right text-xs font-normal"
          >
            Pos
          </th>
          <th scope="col" className="text-text-dim py-2 text-left text-xs font-normal">
            Member
          </th>
          <th
            scope="col"
            className="text-text-dim py-2 pl-3 text-right text-xs font-normal"
          >
            Points
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.userId}
            // Announced, not merely tinted: this is how the viewer's own row is
            // conveyed to anyone who cannot see the tint.
            aria-current={row.isViewer ? true : undefined}
            className={cn(
              'border-border-rule border-b',
              // `bg-raised` rather than `bg-surface`: the panel itself sits on
              // a surface, and a tint the same colour as its own ground is no
              // tint at all.
              row.isViewer && 'bg-bg-raised border-l-accent-fill border-l-2',
            )}
          >
            <td className="text-text-secondary tabular py-2 pr-3 text-right font-mono">
              {/* The marker is decorative for AT — "equals 1" is not how a tie
                  is spoken — so the spoken form is carried by the row header's
                  suffix instead. */}
              {shared.has(row.position) ? <span aria-hidden="true">=</span> : null}
              {row.position}
            </td>
            {/* The member is the row's header: it is what identifies the row,
                so a screen reader reading the points cell says the name. */}
            <th
              scope="row"
              className="text-text-primary py-2 text-left font-normal break-words"
            >
              {row.name}
              {shared.has(row.position) ? (
                <span className="sr-only">, tied for position {row.position}</span>
              ) : null}
              {row.isViewer ? (
                <span className="text-text-secondary ml-2 text-xs">You</span>
              ) : null}
            </th>
            {/* 🔴 `tabular` is not optional (§6.5). Proportional figures make
                this column jitter every time a score changes during a live
                show, which reads as the layout breaking. `whitespace-nowrap`
                keeps a four-digit total on one line however narrow the name
                column has squeezed it. */}
            <td className="text-text-primary tabular py-2 pl-3 text-right font-mono whitespace-nowrap">
              {row.total}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

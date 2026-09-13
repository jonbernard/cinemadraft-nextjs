import { PosterFrame } from '@/components/PosterFrame';
import { StatusChip } from '@/components/StatusChip';
import { cn } from '@/lib/utils/cn';

/**
 * Structurally `LedgerLine` from `lib/services/scoring.ts`, re-declared here
 * because `components/` may not import a service (D33).
 */
export type ExampleRow = {
  /**
   * 🔴 The row's key. `awardId` is not unique within a film's ledger — La La
   * Land held two 2017 Best Original Song nominations — and keying on it
   * dropped one of the two, so the rendered lines summed to less than the
   * total printed beneath them.
   */
  nominationId: number;
  awardName: string;
  eventName: string;
  /** What a nomination in this category is worth. */
  points: number;
  won: boolean;
  /** What this line contributed: `points`, doubled when won. */
  earned: number;
};

/**
 * One film's season, with the arithmetic showing (P18.T2).
 *
 * 🔴 **Nothing here is typed.** `total` arrives from the scoring service and is
 * printed; the per-line multiplier is `earned / points`, so if the rule ever
 * stopped doubling a win this page would say what the rule now does rather
 * than what it used to. There is no numeric literal in this file that
 * describes the game.
 *
 * 🔴 **Flat, not grouped by show.** `PointsLedger` groups because a draft board
 * needs "it got 195 from the Oscars"; a reader learning the game needs a list
 * they can add up. Keeping it flat also means the grouping logic lives in
 * exactly one component rather than two that can drift.
 *
 * A `<table>` because it is one: three columns of aligned figures with a
 * summary row. `<caption>` names the film for a screen reader, and the total
 * is a `<tfoot>` so it is announced as the summary it is.
 *
 * **A win is stated, never only coloured** — the brass chip carries the fact
 * and the word "Won" names it, the same rule as `PointsLedger` and the winner
 * seal. Colour alone is invisible to a colour-blind reader and in print.
 * 🔴 Brass is an award outcome and nothing else (D99): no drafted film, no
 * heading, no decoration wears it.
 *
 * 🔴 **A negative total is a first-class case**, not an edge one — the season's
 * Razzie casualty is half the reason this component exists. Figures are
 * right-aligned and `tabular`, so a minus sign changes no column width and the
 * layout does not move between the winner and the casualty.
 *
 * Sized for a beat in the page's season spine — a content column, not a hero.
 * The poster stacks above the table until `sm`. **Motion is the page's**
 * (P18.T6): this is a Server Component with no state, and `className` is the
 * handle a caller animates it by.
 */
export function WorkedExample({
  title,
  posterUrl,
  total,
  lines,
  className,
}: {
  title: string;
  posterUrl: string | null;
  total: number;
  lines: readonly ExampleRow[];
  className?: string;
}) {
  const won = lines.some((line) => line.won);

  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-start', className)}>
      <PosterFrame
        title={title}
        posterUrl={posterUrl}
        status={won ? 'won' : 'nominated'}
        className="w-32 shrink-0 sm:w-36"
      />

      <div className="min-w-0 flex-1 overflow-x-auto">
        <table className="tabular w-full text-left text-sm">
          <caption className="sr-only">How {title} scored, award by award.</caption>
          <thead>
            <tr className="text-text-dim font-sans text-xs uppercase tracking-[0.06em]">
              <th scope="col" className="py-2 pr-4 font-semibold">
                Nomination
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">
                Worth
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Earned
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.nominationId} className="border-border-rule border-t">
                <th scope="row" className="py-2 pr-4 font-normal">
                  <span className="text-text-primary block leading-tight">
                    {line.awardName}
                  </span>
                  <span className="text-text-dim block text-xs leading-tight">
                    {line.eventName}
                  </span>
                </th>
                <td className="text-text-secondary py-2 pr-4 text-right align-top font-mono">
                  {line.points}
                  {/* 🔴 The multiplier, derived. Guarded against a zero-point
                      line, which would otherwise print NaN. */}
                  {line.won && line.points !== 0 ? (
                    <span className="text-text-dim"> × {line.earned / line.points}</span>
                  ) : null}
                </td>
                <td className="text-text-primary py-2 text-right align-top font-mono">
                  <span className="flex flex-wrap items-center justify-end gap-2">
                    {line.won ? <StatusChip tone="brass">Won</StatusChip> : null}
                    <span>{line.earned}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-border-rule border-t-2">
              <th scope="row" className="text-text-primary py-2 pr-4 font-semibold">
                Total
              </th>
              <td />
              <td
                data-testid="worked-example-total"
                className="text-text-primary py-2 text-right font-mono font-semibold"
              >
                {total}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

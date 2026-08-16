import { cn } from '@/lib/utils/cn';

export type LedgerRow = {
  awardId: number;
  awardName: string;
  eventAbbreviation: string;
  eventName: string;
  points: number;
  won: boolean;
  earned: number;
};

/**
 * Why a film scored what it scored (§6.7).
 *
 * "Default surface shows the movie total only — the board stays scannable. One
 * click deeper reveals per-award line items."
 *
 * A `<details>` element rather than a modal or a link: the explanation belongs
 * *next to* the number it explains. A modal covers the board you were reading,
 * and a separate page loses the comparison that prompted the question. It also
 * costs no JavaScript, works before hydration, and is keyboard-operable
 * without anything being written to make it so.
 *
 * Lines are grouped by award show because that is how the league talks about
 * scores — "it got 195 from the Oscars" — and it is the shape the source API
 * returned (`points-by-movie`).
 *
 * 🔴 **A win is stated, never coloured.** The doubled value carries the fact
 * and the word "won" names it. Same rule as the winner seal (§12): colour
 * alone is invisible to a colour-blind reader and in print, and green in an
 * interface reads as "valid", which makes every other line look wrong.
 */
export function PointsLedger({
  total,
  lines,
  label,
  className,
}: {
  total: number;
  lines: readonly LedgerRow[];
  /** Names the film this ledger belongs to, for screen readers. */
  label: string;
  className?: string;
}) {
  if (lines.length === 0) {
    return (
      <span className={cn('text-text-secondary tabular font-mono text-xs', className)}>
        {total}
      </span>
    );
  }

  // Grouped in one pass, preserving the order the service sorted them into —
  // biggest earner first, which is what someone opening a ledger is looking
  // for.
  const byEvent = new Map<string, { name: string; total: number; lines: LedgerRow[] }>();
  for (const line of lines) {
    const existing = byEvent.get(line.eventAbbreviation);
    if (existing) {
      existing.total += line.earned;
      existing.lines.push(line);
    } else {
      byEvent.set(line.eventAbbreviation, {
        name: line.eventName,
        total: line.earned,
        lines: [line],
      });
    }
  }
  const events = [...byEvent.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <details className={cn('group', className)}>
      <summary className="text-text-secondary tabular hover:text-text-primary cursor-pointer list-none font-mono text-xs">
        {total}
        <span className="sr-only"> points for {label}. Show the breakdown.</span>
        <span aria-hidden="true" className="text-text-dim ml-1 group-open:hidden">
          ▸
        </span>
        <span aria-hidden="true" className="text-text-dim ml-1 hidden group-open:inline">
          ▾
        </span>
      </summary>

      <ul className="border-border-rule mt-2 flex flex-col gap-2 border-l pl-3">
        {events.map(([abbreviation, event]) => (
          <li key={abbreviation} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-text-primary text-xs">{event.name}</span>
              <span className="text-text-secondary tabular font-mono text-xs">
                {event.total}
              </span>
            </div>

            <ul className="flex flex-col">
              {event.lines.map((line) => (
                <li
                  key={line.awardId}
                  className="flex items-baseline justify-between gap-2"
                >
                  <span className="text-text-dim text-xs leading-tight">
                    {line.awardName}
                    {line.won ? <span className="text-accent-text"> · won</span> : null}
                  </span>
                  <span className="text-text-dim tabular font-mono text-xs">
                    {line.earned}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </details>
  );
}

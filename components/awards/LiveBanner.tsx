import Link from 'next/link';

import { StatusChip } from '@/components/ui/StatusChip';

/**
 * The dashboard's route into a ceremony that is happening now (P10.T3).
 *
 * 🔴 **Carmine, never brass.** Brass means an award outcome (D85/D99) and this
 * is not one — it is an invitation to watch, which is the same register as the
 * `Live` chip the live page's own header carries. The two are deliberately the
 * same colour: a member who learns what carmine means on one page reads it on
 * the other.
 *
 * A `Link`, not `components/ui/Button` — `Button` renders a `<button>`, and a
 * control that navigates has to be an anchor so middle-click, open-in-new-tab
 * and the status bar work.
 *
 * `role="status"` rather than `alert`: this is on the page from its first
 * paint, and a member who opened the dashboard during a ceremony is not being
 * interrupted.
 */
export function LiveBanner({
  abbreviation,
  name,
  year,
}: {
  abbreviation: string;
  name: string;
  year: number;
}) {
  return (
    <div
      role="status"
      className="bg-bg-panel flex flex-wrap items-center gap-4 rounded-sm p-6"
    >
      <StatusChip tone="carmine">Live</StatusChip>
      <p className="text-text-primary min-w-0 flex-1 text-sm">
        The {name} results are coming in now.
      </p>
      <Link
        href={`/live/${abbreviation}?year=${year}`}
        className="bg-accent-fill focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Watch it land
      </Link>
    </div>
  );
}

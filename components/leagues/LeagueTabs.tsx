import Link from 'next/link';

import { StatusChip } from '@/components/ui/StatusChip';
import { cn } from '@/lib/utils/cn';
import { leagueTabHref } from '@/lib/utils/league-href';

type Tab = 'board' | 'standings' | 'race';

const TABS: { tab: Tab; label: string }[] = [
  { tab: 'board', label: 'Board' },
  { tab: 'standings', label: 'Standings' },
  { tab: 'race', label: 'Race' },
];

/**
 * A league's views (P16.T19): `/watchlist`'s view nav, one `Link` per tab with
 * `aria-current="page"` on the one being read, the season carried across.
 * Not rendered in TV mode: a television shows the board and nothing else.
 */
export function LeagueTabs({
  leagueId,
  year,
  activeYear,
  current,
}: {
  leagueId: number;
  year: number;
  activeYear: number;
  current: Tab;
}) {
  return (
    <nav aria-label="League views" className="flex flex-wrap items-center gap-2">
      {TABS.map(({ tab, label }) => {
        const isCurrent = tab === current;
        return (
          <Link
            key={tab}
            href={leagueTabHref(leagueId, tab, { year, activeYear })}
            aria-current={isCurrent ? 'page' : undefined}
            className="rounded-pill focus-visible:outline-accent-fill group flex min-h-11 items-center focus-visible:outline-2"
          >
            <StatusChip
              tone={isCurrent ? 'carmine' : 'neutral'}
              className={cn(
                'px-4 py-2 text-sm',
                !isCurrent && 'group-hover:text-text-primary',
              )}
            >
              {label}
            </StatusChip>
          </Link>
        );
      })}
    </nav>
  );
}

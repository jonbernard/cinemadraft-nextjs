import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { LeagueTabs } from '@/components/leagues/LeagueTabs';
import { RaceChart } from '@/components/leagues/RaceChart';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHead } from '@/components/ui/SectionHead';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import { NOINDEX } from '@/lib/seo';
import { getLeagueSeasons } from '@/lib/services/draft';
import { getActiveYear } from '@/lib/services/season';
import { getRaceView } from '@/lib/services/season-ledger';
import { leagueTabHref, parseLeagueSegment } from '@/lib/utils/league-href';

/** `/leagues/[id]/race` and `/leagues/[id]/[year]/race` (D139): one page. */
type Params = Promise<{ id: string; year?: string }>;

/** Public and out of the index, like the board (D44, §7). */
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id, year: segment } = await params;
  const leagueId = Number(id);
  if (!Number.isSafeInteger(leagueId) || leagueId <= 0)
    return { title: 'Not here', robots: NOINDEX };
  try {
    const year = parseLeagueSegment(segment) ?? (await getActiveYear());
    const view = await getRaceView(leagueId, year, null);
    return {
      title: `${view.leagueName ?? `League ${leagueId}`} race`,
      robots: NOINDEX,
    };
  } catch {
    return { title: 'Not here', robots: NOINDEX };
  }
}

/**
 * A league's season as a race (P16.T22): every seat's running total after
 * each scoring moment. Public, like the standings (§7); signing in only
 * marks the reader's own line.
 */
export default async function RacePage({ params }: { params: Params }) {
  const { id, year: segment } = await params;
  const leagueId = Number(id);
  if (!Number.isSafeInteger(leagueId) || leagueId <= 0) notFound();
  // Canonical digits or a 404, as on the board (D139).
  const requested = segment === undefined ? null : parseLeagueSegment(segment);
  if (segment !== undefined && requested == null) notFound();

  const [activeYear, seasons, user] = await Promise.all([
    getActiveYear(),
    getLeagueSeasons(leagueId),
    getCurrentUser(),
  ]);
  // The current season is the bare URL; 307, never 308 (see `leagueHref`).
  if (requested === activeYear) redirect(leagueTabHref(leagueId, 'race'));
  const year = requested ?? activeYear;
  if (year !== activeYear && !seasons.includes(year)) notFound();

  let view: Awaited<ReturnType<typeof getRaceView>>;
  try {
    view = await getRaceView(leagueId, year, user?.id ?? null);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <header className="flex flex-col gap-4">
        <SectionHead as="h1" name eyebrow={`${view.year} · how the season went`}>
          {view.leagueName ?? 'League'}
        </SectionHead>
        <LeagueTabs
          leagueId={leagueId}
          year={view.year}
          activeYear={activeYear}
          current="race"
        />
        {seasons.length > 1 ? (
          <nav aria-label="Seasons" className="flex flex-wrap items-center gap-3 text-sm">
            {seasons.map((entry) => (
              <Link
                key={entry}
                href={leagueTabHref(leagueId, 'race', { year: entry, activeYear })}
                aria-current={entry === view.year ? 'page' : undefined}
                className={
                  entry === view.year
                    ? 'text-accent-text tabular flex min-h-11 items-center font-mono'
                    : 'text-text-secondary tabular flex min-h-11 items-center font-mono underline'
                }
              >
                {entry}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      {view.race.x.length === 0 ? (
        <EmptyState title="Nothing has scored yet">
          The race starts at the season’s first nominations.
        </EmptyState>
      ) : (
        <RaceChart race={view.race} leagueId={leagueId} />
      )}
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { LeagueTabs } from '@/components/leagues/LeagueTabs';
import { StandingsRoom } from '@/components/leagues/StandingsRoom';
import { SectionHead } from '@/components/ui/SectionHead';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import { NOINDEX } from '@/lib/seo';
import { getLeagueSeasons } from '@/lib/services/draft';
import { getActiveYear } from '@/lib/services/season';
import { getStandingsView } from '@/lib/services/season-ledger';
import { leagueTabHref, parseLeagueSegment } from '@/lib/utils/league-href';

type Params = Promise<{ id: string }>;
type Query = Promise<Record<string, string | string[] | undefined>>;

/** `?year=` as canonical digits, or null: a malformed one is the current season. */
function yearOf(query: Record<string, string | string[] | undefined>): number | null {
  const value = query.year;
  return parseLeagueSegment(Array.isArray(value) ? value[0] : value);
}

/** Public and out of the index, like the board (D44, §7). */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Query;
}): Promise<Metadata> {
  const leagueId = Number((await params).id);
  if (!Number.isSafeInteger(leagueId) || leagueId <= 0)
    return { title: 'Not here', robots: NOINDEX };
  try {
    const year = yearOf(await searchParams) ?? (await getActiveYear());
    const view = await getStandingsView(leagueId, year, null);
    return {
      title: `${view.leagueName ?? `League ${leagueId}`} standings`,
      robots: NOINDEX,
    };
  } catch {
    return { title: 'Not here', robots: NOINDEX };
  }
}

/**
 * A league's standings, by show, led by "what moved" (P16.T19). Public: a
 * follower reads what a player reads (§7), and signing in only marks the
 * reader's own row.
 */
export default async function StandingsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Query;
}) {
  const leagueId = Number((await params).id);
  if (!Number.isSafeInteger(leagueId) || leagueId <= 0) notFound();

  const [activeYear, seasons, user] = await Promise.all([
    getActiveYear(),
    getLeagueSeasons(leagueId),
    getCurrentUser(),
  ]);
  const year = yearOf(await searchParams) ?? activeYear;
  // The board's rule (D139): a season this league never had is a 404.
  if (year !== activeYear && !seasons.includes(year)) notFound();

  let view: Awaited<ReturnType<typeof getStandingsView>>;
  try {
    view = await getStandingsView(leagueId, year, user?.id ?? null);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  // The page's own season, so the stream renders what this paint shows.
  const streamUrl = `/api/leagues/${leagueId}/standings/stream?year=${view.year}`;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <header className="flex flex-col gap-4">
        <SectionHead as="h1" name eyebrow={`${view.year} · standings by show`}>
          {view.leagueName ?? 'League'}
        </SectionHead>
        <LeagueTabs
          leagueId={leagueId}
          year={view.year}
          activeYear={activeYear}
          current="standings"
        />
        {seasons.length > 1 ? (
          <nav aria-label="Seasons" className="flex flex-wrap items-center gap-3 text-sm">
            {seasons.map((entry) => (
              <Link
                key={entry}
                href={leagueTabHref(leagueId, 'standings', { year: entry, activeYear })}
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

      {/* 🔴 Keyed on the stream URL, so a season switch is a new connection. */}
      <StandingsRoom key={streamUrl} initial={view} streamUrl={streamUrl} />
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { SeatSeason } from '@/components/leagues/SeatSeason';
import { SectionHead } from '@/components/ui/SectionHead';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import { NOINDEX } from '@/lib/seo';
import { getActiveYear } from '@/lib/services/season';
import { getSeatSeasonView } from '@/lib/services/season-ledger';
import { leagueTabHref, parseLeagueSegment, seatHref } from '@/lib/utils/league-href';
import { ordinal } from '@/lib/utils/season-words';

type Params = Promise<{ id: string; draftId: string }>;

/** Both segments as canonical positive integers, or null. */
async function idsOf(params: Params) {
  const { id, draftId } = await params;
  const leagueId = parseLeagueSegment(id);
  const seat = parseLeagueSegment(draftId);
  return leagueId == null || seat == null ? null : { leagueId, draftId: seat };
}

/** Public and out of the index, like the board (D44, §7). */
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const ids = await idsOf(params);
  const view = ids ? await getSeatSeasonView(ids.leagueId, ids.draftId, null) : null;
  return {
    title: view ? `${view.seat.name}, ${view.year}` : 'Not here',
    robots: NOINDEX,
  };
}

/**
 * One seat's season (P16.T21), linkable, and open to anyone with the link:
 * any member can open any seat, and a follower reads what a player reads
 * (§7). A seat of another league is a 404 (`getSeatSeasonView`).
 */
export default async function SeatPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ids = await idsOf(params);
  if (!ids) notFound();

  // The switcher is a GET form (no JavaScript): `?seat=` is the seat asked
  // for, and its own URL is where it lives. The target 404s if it is not a
  // seat of this league.
  const { seat: asked } = await searchParams;
  const next = parseLeagueSegment(Array.isArray(asked) ? asked[0] : asked);
  if (next != null && next !== ids.draftId) redirect(seatHref(ids.leagueId, next));

  const [user, activeYear] = await Promise.all([getCurrentUser(), getActiveYear()]);
  let view: Awaited<ReturnType<typeof getSeatSeasonView>>;
  try {
    view = await getSeatSeasonView(ids.leagueId, ids.draftId, user?.id ?? null);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  if (!view) notFound();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-4">
        <SectionHead
          as="h1"
          name
          eyebrow={`${view.leagueName ?? 'League'} · ${view.year} · ${ordinal(view.seat.position)} of ${view.seats.length}`}
          right={
            <span className="text-text-primary text-lg">{view.seat.total} points</span>
          }
        >
          {view.seat.name}
        </SectionHead>
        <Link
          href={leagueTabHref(view.leagueId, 'standings', {
            year: view.year,
            activeYear,
          })}
          className="text-text-secondary hover:text-text-primary flex min-h-11 items-center self-start text-sm underline"
        >
          All standings
        </Link>
      </header>
      <SeatSeason view={view} />
    </div>
  );
}

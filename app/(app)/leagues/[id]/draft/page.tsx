import Link from 'next/link';
import { notFound } from 'next/navigation';

import { addPick } from '@/actions/draft/add-pick';
import { searchFilms } from '@/actions/draft/search-films';
import { DraftConsole } from '@/components/DraftConsole';
import { LetterboxRule } from '@/components/LetterboxRule';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import { getDraftConsole } from '@/lib/services/draft-console';
import { canManageLeague } from '@/lib/services/league-access';
import { getActiveYear } from '@/lib/services/season';

/**
 * The owner's draft console.
 *
 * 🔴 **The only page in the app that is not public.** League pages are (D44),
 * and this one sits under the same route on purpose — it is the same league,
 * from the owner's chair. It answers **404, not 403**, to anyone else: a
 * visitor who is not an owner should learn nothing about whether a league is
 * mid-draft, and there is nothing here for them to be told to sign in for.
 *
 * Owner-only means owner-only, not member-only. Members do not enter their own
 * picks (D46).
 */
export default async function DraftConsolePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ group?: string; year?: string }>;
}) {
  const { id } = await params;
  const { group, year } = await searchParams;

  const leagueId = Number(id);
  if (!Number.isSafeInteger(leagueId) || leagueId <= 0) notFound();

  const season = Number(year);
  const activeYear =
    Number.isSafeInteger(season) && season > 0 ? season : await getActiveYear();

  const requestedGroup = Number(group);
  let view: Awaited<ReturnType<typeof getDraftConsole>>;
  try {
    view = await getDraftConsole(
      leagueId,
      activeYear,
      Number.isSafeInteger(requestedGroup) && requestedGroup > 0
        ? requestedGroup
        : undefined,
    );
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const user = await getCurrentUser();
  if (!canManageLeague(view, user?.id)) notFound();

  return (
    <main className="bg-bg-base text-text-primary min-h-dvh p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <LetterboxRule as="h1">{view.leagueName ?? 'Draft'}</LetterboxRule>
          <p className="text-text-secondary text-sm">
            {view.year} · group {view.group} · round {view.round}
            {' · '}
            <Link href={`/leagues/${view.leagueId}`} className="underline">
              the board the league is watching
            </Link>
          </p>

          {view.groups.length > 1 ? (
            <nav aria-label="Groups" className="flex gap-3 text-sm">
              {view.groups.map((entry) => (
                <Link
                  key={entry}
                  href={`/leagues/${view.leagueId}/draft?group=${entry}&year=${view.year}`}
                  aria-current={entry === view.group ? 'page' : undefined}
                  className={
                    entry === view.group
                      ? 'text-accent-text'
                      : 'text-text-secondary underline'
                  }
                >
                  Group {entry}
                </Link>
              ))}
            </nav>
          ) : null}
        </header>

        <DraftConsole
          seats={view.seats}
          suggestedSeatId={view.suggestedSeatId}
          takenMovieIds={view.takenMovieIds}
          onSearch={searchFilms}
          onAssign={addPick}
        />
      </div>
    </main>
  );
}

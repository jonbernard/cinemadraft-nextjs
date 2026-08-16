import Link from 'next/link';
import { notFound } from 'next/navigation';

import { LetterboxRule } from '@/components/LetterboxRule';
import { SeasonSetup } from '@/components/SeasonSetup';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import { canManageLeague } from '@/lib/services/league-access';
import { getActiveYear } from '@/lib/services/season';
import { getSeasonSetup } from '@/lib/services/season-setup';

/**
 * The owner's season setup (P10.T14–T19).
 *
 * 🔴 **404 to everyone else**, exactly like the draft console: a bounce to log
 * in would confirm the league exists and is being arranged. Owner-only means
 * owner-only — a member cannot see this even for their own league.
 */
export default async function SeasonSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { id } = await params;
  const { year } = await searchParams;

  const leagueId = Number(id);
  if (!Number.isSafeInteger(leagueId) || leagueId <= 0) notFound();

  const requested = Number(year);
  const season =
    Number.isSafeInteger(requested) && requested > 0 ? requested : await getActiveYear();

  let view: Awaited<ReturnType<typeof getSeasonSetup>>;
  try {
    view = await getSeasonSetup(leagueId, season);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const user = await getCurrentUser();
  if (!canManageLeague(view, user?.id)) notFound();

  return (
    <main className="text-text-primary p-4 md:p-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <LetterboxRule as="h1">{view.leagueName}</LetterboxRule>
          <p className="text-text-secondary text-sm">
            <span className="tabular font-mono">{view.year}</span> · setting up ·{' '}
            <Link href={`/leagues/${view.leagueId}`} className="underline">
              the board
            </Link>
          </p>
        </header>

        <SeasonSetup
          leagueId={view.leagueId}
          year={view.year}
          seats={view.seats}
          groups={view.groups}
          suggestedGroupCount={view.suggestedGroupCount}
          status={view.status}
        />
      </div>
    </main>
  );
}

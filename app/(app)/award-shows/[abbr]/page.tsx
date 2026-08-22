import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CategoryAdmin } from '@/components/CategoryAdmin';
import { EmptyState } from '@/components/EmptyState';
import { NomineeGrid } from '@/components/NomineeGrid';
import { SectionHead } from '@/components/SectionHead';
import { StatusChip } from '@/components/StatusChip';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import { getAwardShow } from '@/lib/services/award-show';
import { getActiveYear, getSeasons } from '@/lib/services/season';

/**
 * One award show: its categories, what each is worth, and who is nominated
 * (§12).
 *
 * Public (D44). It is the page a member opens mid-ceremony to see what a film
 * is up for, and the source app never guarded it.
 *
 * 🔴 **The point value shown here is resolved, never the raw column.**
 * `awards.points` is a foreign key into `points.id` (D41) — "Performance by an
 * Ensemble" stores `1` and is worth `5`. Printing the column would put a
 * confident wrong number in front of every reader, and this is the page they
 * would check it on.
 */
export default async function AwardShowPage({
  params,
  searchParams,
}: {
  params: Promise<{ abbr: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { abbr } = await params;
  const { year } = await searchParams;

  const requested = Number(year);
  const season =
    Number.isSafeInteger(requested) && requested > 0 ? requested : await getActiveYear();

  let show: Awaited<ReturnType<typeof getAwardShow>>;
  try {
    show = await getAwardShow(abbr, season);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const [seasons, user] = await Promise.all([getSeasons(), getCurrentUser()]);
  // Hidden from non-admins for tidiness, not for security — every action
  // behind these controls checks the session itself.
  const isAdmin = user?.role === 'admin';

  return (
    <main className="bg-bg-base text-text-primary min-h-dvh p-4 md:p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <SectionHead
            as="h1"
            name
            eyebrow={show.abbreviation}
            right={String(show.year)}
            className="pb-0"
          >
            {show.name}
          </SectionHead>

          <p className="text-text-secondary text-sm">
            {show.categories.length}{' '}
            {show.categories.length === 1 ? 'category' : 'categories'}
          </p>

          {seasons.length > 1 ? (
            <nav aria-label="Seasons" className="flex flex-wrap gap-3 text-sm">
              {seasons.map((entry) => (
                <Link
                  key={entry}
                  href={`/award-shows/${show.abbreviation}?year=${entry}`}
                  aria-current={entry === show.year ? 'page' : undefined}
                  className={
                    entry === show.year
                      ? 'text-accent-text tabular font-mono'
                      : 'text-text-secondary tabular font-mono underline'
                  }
                >
                  {entry}
                </Link>
              ))}
            </nav>
          ) : null}
        </header>

        {show.categories.length === 0 ? (
          <EmptyState title="No categories yet">
            Nothing has been entered for this show and season.
          </EmptyState>
        ) : (
          show.categories.map((category) => (
            <section key={category.awardId} className="flex flex-col gap-3">
              {/* A nomination earns the category's points; a win earns them a
                  second time, so it is worth twice this to whoever wins it. */}
              <SectionHead as="h2" right={`${category.points} pts`} className="pb-0">
                {category.name}
              </SectionHead>

              {category.nominees.length > 0 || !category.hasWinner ? (
                <div className="flex flex-wrap items-center gap-2">
                  {category.nominees.length > 0 ? (
                    <StatusChip tone="brass">
                      {category.nominees.length}{' '}
                      {category.nominees.length === 1 ? 'nomination' : 'nominations'}
                    </StatusChip>
                  ) : null}
                  {category.hasWinner ? null : <StatusChip>No winner yet</StatusChip>}
                </div>
              ) : null}

              <NomineeGrid nominees={category.nominees} />

              {isAdmin ? (
                <CategoryAdmin
                  awardId={category.awardId}
                  year={show.year}
                  requiresNomineeName={category.requiresNomineeName}
                  nominees={category.nominees.map((nominee) => ({
                    nominationId: nominee.nominationId,
                    movieId: nominee.movieId,
                    title: nominee.title,
                    isWinner: nominee.isWinner,
                  }))}
                />
              ) : null}
            </section>
          ))
        )}
      </div>
    </main>
  );
}

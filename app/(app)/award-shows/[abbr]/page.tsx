import Link from 'next/link';
import { notFound } from 'next/navigation';

import { LetterboxRule } from '@/components/LetterboxRule';
import { NomineeGrid } from '@/components/NomineeGrid';
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

  const seasons = await getSeasons();

  return (
    <main className="bg-bg-base text-text-primary min-h-dvh p-4 md:p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <LetterboxRule as="h1">{show.name}</LetterboxRule>

          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 text-sm">
            <span className="text-text-secondary tabular font-mono">{show.year}</span>
            <span className="text-text-dim font-mono text-xs uppercase">
              {show.abbreviation}
            </span>
            <span className="text-text-secondary tabular font-mono text-xs">
              {show.categories.length} categories
            </span>
          </div>

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
          <p className="text-text-secondary text-sm">No categories for this show yet.</p>
        ) : (
          show.categories.map((category) => (
            <section key={category.awardId} className="flex flex-col gap-3">
              <div className="border-border-rule flex flex-wrap items-baseline justify-between gap-x-4 border-b pb-2">
                <h2 className="text-text-primary text-sm">{category.name}</h2>
                <span className="text-text-secondary tabular font-mono text-xs">
                  {/* A nomination earns this; a win earns it a second time, so
                      the category is worth twice this to whoever wins it. */}
                  {category.points} pts
                  {category.hasWinner ? null : (
                    <span className="text-text-dim"> · no winner yet</span>
                  )}
                </span>
              </div>

              <NomineeGrid nominees={category.nominees} />
            </section>
          ))
        )}
      </div>
    </main>
  );
}

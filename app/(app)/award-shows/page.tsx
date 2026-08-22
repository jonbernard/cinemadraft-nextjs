import Link from 'next/link';

import { Eyebrow } from '@/components/Eyebrow';
import { Panel } from '@/components/Panel';
import { SectionHead } from '@/components/SectionHead';
import { StatusChip } from '@/components/StatusChip';
import { getCurrentUser } from '@/lib/auth';
import { getAwardShows } from '@/lib/services/award-show';
import { getActiveYear } from '@/lib/services/season';

/**
 * Every award show (§12).
 *
 * Public (D44) — the source app never guarded these, and they are the pages a
 * member opens during a ceremony to see what a film is up for.
 *
 * Admins additionally see which shows still need entering. That list is not
 * derived or guessed: `nom_active` and `awards_active` are the source's own
 * flags for exactly this, set when a show's nominations or winners are being
 * worked on.
 */
export default async function AwardShowsPage() {
  const [shows, year, user] = await Promise.all([
    getAwardShows(),
    getActiveYear(),
    getCurrentUser(),
  ]);

  const isAdmin = user?.role === 'admin';
  const outstanding = shows.filter((show) => show.needsNominations || show.needsWinners);

  return (
    <>
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <SectionHead as="h1" right={String(year)}>
          Award shows
        </SectionHead>

        {isAdmin && outstanding.length > 0 ? (
          <Panel tone="raised" as="section" className="flex flex-col gap-3 p-4">
            <SectionHead as="h2" className="pb-0">
              Still to enter
            </SectionHead>
            <ul className="flex flex-col gap-2">
              {outstanding.map((show) => (
                <li key={show.eventId} className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/award-shows/${show.abbreviation}?year=${year}`}
                    className="text-text-primary hover:text-accent-text font-serif text-base"
                  >
                    {show.name}
                  </Link>
                  {/* Carmine: work outstanding during a ceremony is urgency,
                      not an award. */}
                  {show.needsNominations ? (
                    <StatusChip tone="carmine">Nominations</StatusChip>
                  ) : null}
                  {show.needsWinners ? (
                    <StatusChip tone="carmine">Winners</StatusChip>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4">
          {shows.map((show) => (
            <li key={show.eventId}>
              <Link
                href={`/award-shows/${show.abbreviation}?year=${year}`}
                className="bg-bg-surface hover:bg-bg-raised focus-visible:outline-accent-fill flex h-full flex-col gap-1 rounded-md p-4 focus-visible:outline-2"
              >
                <Eyebrow>{show.abbreviation}</Eyebrow>
                <span className="text-text-primary font-serif text-base tracking-[-0.02em]">
                  {show.name}
                </span>
                <span className="text-text-secondary tabular font-mono text-xs">
                  {show.categoryCount} categories
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

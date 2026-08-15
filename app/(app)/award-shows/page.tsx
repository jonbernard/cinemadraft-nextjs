import Link from 'next/link';

import { LetterboxRule } from '@/components/LetterboxRule';
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
    <main className="bg-bg-base text-text-primary min-h-dvh p-4 md:p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <LetterboxRule as="h1">Award shows</LetterboxRule>
          <p className="text-text-secondary tabular font-mono text-sm">{year}</p>
        </header>

        {isAdmin && outstanding.length > 0 ? (
          <section className="border-border-rule flex flex-col gap-2 border-l-2 border-l-accent-fill bg-bg-raised p-4">
            <h2 className="text-text-dim text-xs font-normal uppercase tracking-wide">
              Still to enter
            </h2>
            <ul className="flex flex-col gap-1">
              {outstanding.map((show) => (
                <li key={show.eventId} className="text-sm">
                  <Link
                    href={`/award-shows/${show.abbreviation}?year=${year}`}
                    className="underline"
                  >
                    {show.name}
                  </Link>
                  <span className="text-text-dim">
                    {show.needsNominations ? ' · nominations' : ''}
                    {show.needsWinners ? ' · winners' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4">
          {shows.map((show) => (
            <li key={show.eventId}>
              <Link
                href={`/award-shows/${show.abbreviation}?year=${year}`}
                className="border-border-rule hover:bg-bg-raised flex h-full flex-col gap-1 border p-4"
              >
                <span className="text-text-primary text-sm">{show.name}</span>
                <span className="text-text-dim font-mono text-xs uppercase">
                  {show.abbreviation}
                </span>
                <span className="text-text-secondary tabular font-mono text-xs">
                  {show.categoryCount} categories
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

import Link from 'next/link';

import { Eyebrow } from '@/components/Eyebrow';
import { InviteLink } from '@/components/InviteLink';
import { Panel } from '@/components/Panel';
import { SectionHead } from '@/components/SectionHead';
import { StatusChip } from '@/components/StatusChip';
import { getCurrentUser } from '@/lib/auth';
import { getAwardShows } from '@/lib/services/award-show';
import { getActiveYear } from '@/lib/services/season';

/**
 * The origin the calendar subscribe URL should carry.
 *
 * Read from the request rather than an env var, the same reasoning as the
 * league invite link: it has to work from localhost, a preview and
 * production without configuration, and a preview deploy must not hand
 * someone a link into production.
 */
async function requestOrigin(): Promise<string> {
  const { headers } = await import('next/headers');
  const list = await headers();
  const host = list.get('x-forwarded-host') ?? list.get('host') ?? '';
  const proto =
    list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

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
 *
 * 🔴 The calendar feed (T25) is reachable from here, not just from a route
 * that happens to exist. `InviteLink` gives it exactly the shape it needs: a
 * URL a person copies into a calendar app, not a link a browser would try to
 * download.
 */
export default async function AwardShowsPage() {
  const [shows, year, user, origin] = await Promise.all([
    getAwardShows(),
    getActiveYear(),
    getCurrentUser(),
    requestOrigin(),
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

        <Panel tone="raised" as="section" className="flex flex-col gap-3 p-4">
          <SectionHead as="h2" className="pb-0">
            Subscribe to ceremony dates
          </SectionHead>
          <p className="text-text-secondary text-sm">
            Add every show's nomination and awards dates to your own calendar app. Paste
            this URL wherever it asks for a calendar subscription, not a file to download.
          </p>
          <InviteLink url={`${origin}/api/ical`} />
        </Panel>
      </div>
    </>
  );
}

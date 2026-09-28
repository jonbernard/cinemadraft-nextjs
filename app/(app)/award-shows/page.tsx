import Link from 'next/link';
import type { ReactNode } from 'react';
import { LeagueMomentLine, SeasonAgenda } from '@/components/awards/SeasonAgenda';
import { AtStake, SeasonUpNext } from '@/components/awards/SeasonUpNext';
import { InviteLink } from '@/components/leagues/InviteLink';
import { Panel } from '@/components/ui/Panel';
import { SectionHead } from '@/components/ui/SectionHead';
import { StatusChip } from '@/components/ui/StatusChip';
import { getCurrentUser } from '@/lib/auth';
import { getAwardShows } from '@/lib/services/award-show';
import { getSeasons } from '@/lib/services/season';
import { getSeasonView, getSeasonViewer } from '@/lib/services/season-view';

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
 * The season, and every award show in it (§12, P16.T15).
 *
 * Public (D44) — the source app never guarded these, and they are the pages a
 * member opens during a ceremony to see what a film is up for. Since P16.T15
 * the page is the season as an agenda: every scoring moment in date order,
 * grouped by month, with what is up next. It replaced a grid of logo cards
 * that carried no date at all. 🔴 Signed out is first-class (owner, §4): the
 * counts, the headline films and Up next are the whole page without anyone's
 * seat in it, and nothing here names a seat or a league.
 *
 * Admins additionally see which shows still need entering for the active
 * season, derived from each show's dates and what is already in
 * (`lib/services/entry-status.ts`) — the source's "Events needing updates"
 * card did the same. It is not `nom_active`: nothing in the port sets that.
 *
 * 🔴 The calendar feed (T25) is reachable from here, not just from a route
 * that happens to exist. `InviteLink` gives it exactly the shape it needs: a
 * URL a person copies into a calendar app, not a link a browser would try to
 * download.
 */
export default async function AwardShowsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year } = await searchParams;
  const requested = Number(year);
  const [view, user, origin, seasons] = await Promise.all([
    // Any positive year, as `/award-shows/[abbr]` takes it.
    getSeasonView(Number.isSafeInteger(requested) && requested > 0 ? requested : null),
    getCurrentUser(),
    requestOrigin(),
    getSeasons(),
  ]);

  // 🔴 Signed in only (P16.T16): a stranger's request loads no board.
  const viewer = user ? await getSeasonViewer(user.id, view.year) : null;
  const aside = new Map<string, ReactNode>();
  for (const moment of view.months.flatMap((month) => month.moments)) {
    const lines = (viewer?.leagues ?? []).flatMap((league) => {
      const line = league.byMoment.get(moment.key);
      return line
        ? [<LeagueMomentLine key={league.leagueId} name={league.name} {...line} />]
        : [];
    });
    if (lines.length > 0) aside.set(moment.key, lines);
  }

  const isAdmin = user?.role === 'admin';
  const shows = isAdmin ? await getAwardShows(view.activeYear) : [];
  const outstanding = shows.filter((show) => show.needsNominations || show.needsWinners);
  const moments = view.months.flatMap((month) => month.moments);
  const done = moments.filter((moment) => moment.state === 'finished').length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <header className="flex flex-col gap-3">
        <SectionHead
          as="h1"
          eyebrow={
            moments.length === 0 ? undefined : `${done} of ${moments.length} moments done`
          }
          right={String(view.year)}
          className="pb-0"
        >
          Award shows
        </SectionHead>
        {seasons.length > 1 ? (
          <nav aria-label="Seasons" className="flex flex-wrap gap-x-3 text-sm">
            {seasons.map((entry) => (
              <Link
                key={entry}
                href={`/award-shows?year=${entry}`}
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

      {isAdmin && outstanding.length > 0 ? (
        <Panel tone="surface" as="section" className="flex flex-col gap-3 p-4">
          <SectionHead as="h2" className="pb-0">
            Still to enter
          </SectionHead>
          <ul className="flex flex-col gap-2">
            {outstanding.map((show) => (
              <li key={show.eventId} className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/award-shows/${show.abbreviation}?year=${view.activeYear}`}
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

      <SeasonUpNext view={view} now={Date.now()}>
        {viewer?.atStake && view.next ? (
          <AtStake
            atStake={viewer.atStake}
            year={view.year}
            abbreviation={view.next.abbreviation}
          />
        ) : null}
      </SeasonUpNext>

      <SeasonAgenda
        months={view.months}
        year={view.year}
        nextKey={view.next?.key ?? null}
        aside={aside}
      />

      <Panel tone="surface" as="section" className="flex flex-col gap-3 p-4">
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
  );
}

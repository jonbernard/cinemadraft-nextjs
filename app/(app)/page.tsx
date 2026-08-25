import Link from 'next/link';

import { EmptyState } from '@/components/EmptyState';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { PosterFrame } from '@/components/PosterFrame';
import { RosterStrip } from '@/components/RosterStrip';
import { SeasonRail } from '@/components/SeasonRail';
import { SectionHead } from '@/components/SectionHead';
import { Shelf } from '@/components/Shelf';
import { StandingsPanel } from '@/components/StandingsPanel';
import { getCurrentUser } from '@/lib/auth';
import { recentPicks, type ShelfView, topScorers } from '@/lib/dashboard/shelves';
import { type DashboardView, getDashboard } from '@/lib/services/dashboard';
import { availableSeasons, getLeaderboard } from '@/lib/services/leaderboard';

/**
 * The dashboard, with a public variant (D44).
 *
 * Replaces a welcome card that told members their own name with the three
 * things they actually open the site to learn: where they stand, what their
 * films have scored, and which show is next.
 *
 * Signed out, it is the season itself — the rail of award shows, and an
 * invitation to register. That is deliberate and matches the source app, where
 * `/` was never guarded: an awards league is worth looking at before you have
 * an account, and a login wall on the front page is the worst possible first
 * impression during awards season.
 *
 * The signed-out path renders no user-scoped data at all. `getDashboard(null)`
 * does not query leagues rather than querying with a sentinel, so there is no
 * code path on which this page can resolve somebody else's team.
 *
 * All data assembly happens in `lib/services/dashboard.ts`. This component
 * only decides layout and which variant applies — which is what keeps the
 * query count countable, and this file readable.
 *
 * 🔴 **The wordmark is not here.** It used to be the page `h1` as well as the
 * top of the nav, so it appeared twice on every screen (spec §1, fault 5).
 * `NavRail` carries it now, so the `h1` is the page's own subject — the
 * season. The "Season 2026" mono line and the separate `LetterboxRule`
 * heading that said the same word both fold into that one `SectionHead`.
 *
 * 🔴 **No `<main>` here.** `AppShell` renders the one content landmark
 * (`Panel as="main"`), and it owns the page's ground and padding too — a
 * second `<main>`, or a repeat of `bg-bg-base`, would fight the panel it is
 * sitting inside.
 */
export default async function DashboardPage({ searchParams }: PageProps<'/'>) {
  const { year: yearParam } = await searchParams;

  const [user, seasons] = await Promise.all([getCurrentUser(), availableSeasons()]);
  const year = toYear(typeof yearParam === 'string' ? yearParam : undefined, seasons);

  const [view, leaderboard] = await Promise.all([
    getDashboard(user?.id ?? null),
    getLeaderboard(year),
  ]);

  const shows = view.events.length;
  const complete = view.events.filter((event) => event.complete).length;

  return (
    <div className="text-text-primary mx-auto flex max-w-6xl flex-col gap-10">
      <section className="flex flex-col gap-4">
        <SectionHead
          as="h1"
          // Real metadata, which is the whole test for an eyebrow: how far
          // through the season the league is. Omitted rather than rendered as
          // "0 of 0" for a year seeded before its calendar is published.
          eyebrow={shows === 0 ? undefined : `${complete} of ${shows} shows complete`}
          right={view.year}
        >
          Season
        </SectionHead>

        {/* Renders nothing when the season has no shows yet, so the heading
            above it is unconditional and the page always has an h1. */}
        <SeasonRail events={view.events} />
      </section>

      <NowPlayingShelf films={view.nowPlaying} />

      <section className="flex flex-col gap-4">
        <SectionHead
          as="h2"
          eyebrow="By award show"
          rightStacksOnMobile
          right={
            seasons.length > 1 ? (
              <nav aria-label="Season" className="flex flex-wrap gap-3 text-sm">
                {seasons.map((entry) => (
                  <Link
                    key={entry}
                    href={`/?year=${entry}`}
                    aria-current={entry === year ? 'page' : undefined}
                    className={
                      entry === year
                        ? 'text-accent-text tabular font-mono'
                        : 'text-text-secondary tabular font-mono underline'
                    }
                  >
                    {entry}
                  </Link>
                ))}
              </nav>
            ) : undefined
          }
        >
          Season leaderboard
        </SectionHead>

        <LeaderboardTable leaderboard={leaderboard} />
      </section>

      {user == null ? (
        <EmptyState
          title="Play the season"
          action={{ label: 'Register', href: '/auth/register' }}
        >
          Draft a team of films before awards season and score points as they pick up
          nominations and wins. Played before? Register with the same email and your
          leagues, drafts and points come with you.
        </EmptyState>
      ) : view.leagues.length === 0 ? (
        <EmptyState
          title="No leagues yet"
          action={{ label: 'Find a league', href: '/leagues' }}
        >
          Join a league to draft a team of films and play the season.
        </EmptyState>
      ) : (
        <>
          {view.leagues.map((league) => (
            <section key={league.id} className="flex flex-col gap-6">
              <SectionHead
                as="h2"
                name
                // Position is stated rather than left to be inferred from the
                // row's place in the table below: on a narrow screen the
                // standings sit far beneath the roster.
                eyebrow={standingLabel(league)}
                right={
                  <span className="flex items-baseline gap-2">
                    <span className="font-sans">Your points</span>
                    <span className="tabular font-mono">{league.total}</span>
                  </span>
                }
              >
                {league.name ?? 'League'}
              </SectionHead>

              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
                <div className="min-w-0 flex-1">
                  {league.roster.length === 0 ? (
                    <EmptyState title="Draft not started">
                      You have not drafted for this season yet. Your roster appears here
                      once the draft opens.
                    </EmptyState>
                  ) : (
                    <RosterStrip
                      films={league.roster.map((entry) => ({
                        id: entry.movie.id,
                        title: entry.movie.title ?? 'Untitled',
                        // Posters arrive in Phase 11 with the media migration;
                        // PosterFrame already renders an initials placeholder.
                        posterUrl: null,
                        round: entry.round,
                        points: entry.points,
                        share: entry.share,
                      }))}
                    />
                  )}
                </div>

                <div className="w-full lg:max-w-sm">
                  <StandingsPanel rows={league.standings} />
                </div>
              </div>
            </section>
          ))}

          <LowerFold leagues={view.leagues} />
        </>
      )}
    </div>
  );
}

/**
 * The leaderboard's own year, from `?year=` (D65).
 *
 * 🔴 `?year=abc` and `?year=-4` both arrive here, the same way `/browse`
 * validates `?page=`. Falls back to the newest season on anything that is not
 * one of the seasons `availableYearRepository` actually reports, rather than
 * merely "a positive integer" — an unknown year would otherwise render an
 * honestly-empty grid that looks like a bug rather than a bad link.
 */
function toYear(raw: string | undefined, seasons: readonly number[]): number {
  const parsed = Number(raw);
  if (Number.isSafeInteger(parsed) && seasons.includes(parsed)) return parsed;
  return seasons[0] ?? new Date().getUTCFullYear();
}

/**
 * "Films in cinemas now" (P10.T2), or nothing at all.
 *
 * Nothing rather than an empty frame: TMDB may be unconfigured in a preview
 * deploy, or the request may have failed, and `getNowPlaying` already
 * absorbed both into an empty list — the dashboard is a signed-out visitor's
 * first page, and it must not degrade into a broken panel over a missing env
 * var.
 */
function NowPlayingShelf({ films }: { films: DashboardView['nowPlaying'] }) {
  if (films.length === 0) return null;

  return (
    <Shelf heading="In cinemas now">
      {films.map((film) => (
        <li key={film.tmdbId} className="w-40">
          <Link
            href={`/films/${film.tmdbId}`}
            className="focus-visible:outline-accent-fill block focus-visible:outline-2"
          >
            <PosterFrame title={film.title} posterUrl={film.posterUrl} />
          </Link>
        </li>
      ))}
    </Shelf>
  );
}

/** The eyebrow above a league name: where the viewer sits, or how big it is. */
function standingLabel(league: DashboardView['leagues'][number]): string {
  const members = league.standings.length;
  if (league.position != null) return `Position ${league.position} of ${members}`;
  return `${members} ${members === 1 ? 'member' : 'members'}`;
}

/**
 * The lower fold (spec §1, fault 5: "Home is ~60% empty below the fold").
 *
 * Two shelves, both a different cut of the same rosters rather than a second
 * copy of them: the strips above are ordered by draft round and must stay that
 * way, so neither "what did I take most recently" nor "what is carrying my
 * team" is answered anywhere else in the product.
 *
 * "Upcoming deadlines" and "the leagues you are in" were the plan's other two
 * candidates and are deliberately absent: `SeasonRail` at the top of this page
 * already renders every show date-sorted with a countdown on the next one, and
 * every league is rendered above in full. A shelf of either would be the same
 * content twice.
 *
 * The ranking lives in `lib/dashboard/shelves.ts` and is unit-tested there;
 * this decides only what the shelves are called and what they say.
 */
function LowerFold({ leagues }: { leagues: DashboardView['leagues'] }) {
  const recent = recentPicks(leagues);
  const best = topScorers(leagues);

  return (
    <>
      <FilmShelf
        heading="Recent picks"
        eyebrow={`${recent.held} ${recent.held === 1 ? 'film' : 'films'} drafted`}
        shelf={recent}
      />
      <FilmShelf
        heading="Top scorers"
        // Both numbers, not just the shelf's: how much of the team is working
        // is the point, and the twelve-frame cap would understate it.
        eyebrow={`${best.matching} of ${best.held} films scoring`}
        shelf={best}
      />
    </>
  );
}

/**
 * One shelf of posters, or nothing.
 *
 * Nothing is the right answer more often than it looks: `topScorers` is empty
 * until something has been awarded, and a row of zeroes on opening day is
 * worse than the space it fills.
 *
 * 🔴 The frames are 10rem wide, matching `RosterStrip`'s measured grid floor.
 * That measurement is in its docstring and it is not arbitrary: at ~130px a
 * 24-character title in a two-line clamp clips — "One Battle After Another"
 * cut off, the exact defect this redesign exists to fix. A `Shelf` scrolls, so
 * a wider frame costs scroll length and nothing else.
 */
function FilmShelf({
  heading,
  eyebrow,
  shelf,
}: {
  heading: string;
  eyebrow: string;
  shelf: ShelfView;
}) {
  if (shelf.films.length === 0) return null;

  return (
    <Shelf eyebrow={eyebrow} heading={heading}>
      {shelf.films.map((film) => (
        <li key={film.id} className="w-40">
          <PosterFrame
            title={film.title}
            // Posters arrive in Phase 11 with the media migration;
            // PosterFrame already renders an initials placeholder.
            posterUrl={null}
            points={film.points}
            share={film.share}
            // No draft round: a film held in two leagues has two of them, and
            // printing whichever survived the dedupe would be wrong half the
            // time. The strips above are where round belongs.
          />
        </li>
      ))}
    </Shelf>
  );
}

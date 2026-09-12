import Link from 'next/link';

import { EmptyState } from '@/components/EmptyState';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { PosterFrame } from '@/components/PosterFrame';
import { RosterStrip } from '@/components/RosterStrip';
import { SeasonPicker } from '@/components/SeasonPicker';
import { SeasonStepper } from '@/components/SeasonStepper';
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

  // `view.events` is one entry per show *phase* (D81), so the eyebrow counts
  // shows through their ids and calls a show complete once its ceremony has
  // passed — otherwise a season would report twice as many "shows" as it has.
  const shows = new Set(view.events.map((phase) => phase.eventId)).size;
  const complete = view.events.filter(
    (phase) => phase.phase === 'ceremony' && phase.complete,
  ).length;

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

        {/* 🔴 The front door, for the only reader who needs one (P17.T5).
            `/` is public during awards season and opened with an h1 reading
            "Season" and a rail of dates — nothing that says what the product
            is, and no way in until four sections further down. One line and
            one action, and it is gone for a member, who does not need to be
            told what the app they are logged into does.

            Below the `SectionHead` rather than above it: content before the
            document's first heading breaks the outline P17.T1 just fixed.

            The action is the same `<Link>` lockup `EmptyState` uses for its
            own — `accent.fill` with white on it, 6.58:1, `rounded-sm` for
            D73's 6px — rather than a second primary-action pattern. */}
        {user == null ? (
          <div
            data-testid="signed-out-lede"
            className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-text-secondary max-w-prose text-sm leading-relaxed">
              Draft a team of films before awards season, and score every nomination and
              win they pick up.
            </p>
            <Link
              href="/auth/register"
              className="bg-accent-fill focus-visible:outline-accent-fill flex min-h-11 shrink-0 items-center rounded-sm px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Register
            </Link>
          </div>
        ) : null}

        {/* Renders nothing when the season has no shows yet, so the heading
            above it is unconditional and the page always has an h1. */}
        <SeasonStepper phases={view.events} />
      </section>

      <NowPlayingShelf films={view.nowPlaying} />

      <section className="flex flex-col gap-4">
        <SectionHead
          as="h2"
          eyebrow="By award show"
          rightStacksOnMobile
          // 🔴 A picker, not a flat row (P17.T4). Ten seasons was ten links
          // measured at 33.6 × 20px, wrapping across this slot. The
          // `seasons.length > 1` guard moved into the component rather than
          // living in both places.
          right={<SeasonPicker year={year} seasons={seasons} />}
        >
          Season leaderboard
        </SectionHead>

        <LeaderboardTable leaderboard={leaderboard} />
      </section>

      {user == null ? (
        /* No action here any more: the lede at the top of the page carries it
           (P17.T5), and two identical Register buttons 2,000px apart is a
           choice a reader has to make twice. What stays is the half the lede
           cannot carry — the returning member's reassurance that their history
           follows their email — which belongs at the end of a page somebody has
           read rather than in a one-line opener. */
        <EmptyState title="Play the season">
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
                        posterUrl: entry.posterUrl,
                        round: entry.round,
                        points: entry.points,
                        share: entry.share,
                        status: entry.status,
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
      {films.map((film, index) => (
        <li key={film.tmdbId} className="w-40">
          <Link
            href={`/films/${film.tmdbId}`}
            className="focus-visible:outline-accent-fill block focus-visible:outline-2"
          >
            {/* 🔴 Two, not twelve. Measured in a production build: this shelf's
                first frame is the dashboard's LCP element at all four widths in
                both schemes, and every TMDB request went out at `Low` because
                `next/image` defaults to `loading="lazy"`. But `priority` is a
                preload link per image — marking the whole shelf would put
                twelve of them in contention and make the metric worse. Two is
                what sits above the fold at 1440px before the shelf scrolls,
                and at 390px the shelf shows two as well. */}
            <PosterFrame
              title={film.title}
              posterUrl={film.posterUrl}
              priority={index < 2}
            />
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
 * candidates and are deliberately absent: `SeasonStepper` at the top of this page
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
            posterUrl={film.posterUrl}
            points={film.points}
            share={film.share}
            status={film.status}
            // No draft round: a film held in two leagues has two of them, and
            // printing whichever survived the dedupe would be wrong half the
            // time. The strips above are where round belongs.
          />
        </li>
      ))}
    </Shelf>
  );
}

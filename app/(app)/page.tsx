import { EmptyState } from '@/components/EmptyState';
import { PosterFrame } from '@/components/PosterFrame';
import { RosterStrip } from '@/components/RosterStrip';
import { SeasonRail } from '@/components/SeasonRail';
import { SectionHead } from '@/components/SectionHead';
import { Shelf } from '@/components/Shelf';
import { StandingsPanel } from '@/components/StandingsPanel';
import { getCurrentUser } from '@/lib/auth';
import { type DashboardView, getDashboard } from '@/lib/services/dashboard';

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
export default async function DashboardPage() {
  const user = await getCurrentUser();
  const view = await getDashboard(user?.id ?? null);

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

          <TopScorers leagues={view.leagues} />
        </>
      )}
    </div>
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
 * 🔴 **A different cut of the roster, not a second copy of it.** The strips
 * above are ordered by draft round and must stay that way — snake order is
 * real information, and `lib/services/dashboard.ts` says so where it builds
 * them. That means nothing on this page answers "what is actually carrying my
 * team", which is the question a member has once the awards start landing.
 * Ranking by points is that answer, and it has nowhere else to live.
 *
 * Deduplicated by film, because one film drafted in two leagues is one film:
 * points are a property of the film and the season (`pointsForMovieIds`), not
 * of the seat, so both entries carry the same score and showing it twice would
 * read as two different films with the same name.
 *
 * The draft round is deliberately not passed to `PosterFrame`: a film held in
 * two leagues has two rounds, and printing whichever one was found first would
 * be a number that is wrong half the time. The contribution bar is rescaled
 * against the best pick here for the same reason — `RosterEntry.share` is a
 * share of *one seat's* total, so two leagues give one film two of them, and
 * the shelf would draw whichever it happened to keep.
 *
 * Nothing renders before anything has scored. A shelf of zeroes on opening day
 * is worse than the empty space it fills. The eyebrow counts every scoring
 * film, not the twelve the shelf shows: it is there to say how much of the
 * team is working, which a capped number would understate.
 */
function TopScorers({ leagues }: { leagues: DashboardView['leagues'] }) {
  const films = [
    ...new Map(
      leagues.flatMap((league) => league.roster).map((entry) => [entry.movie.id, entry]),
    ).values(),
  ];
  const scoring = films
    .filter((entry) => entry.points > 0)
    .sort((a, b) => b.points - a.points);

  if (scoring.length === 0) return null;
  // Guarded by the check above: the list is sorted descending, so [0] exists
  // and its points are greater than zero.
  const best = scoring[0]?.points ?? 1;

  return (
    <Shelf
      eyebrow={`${scoring.length} of ${films.length} films scoring`}
      heading="Top scorers"
    >
      {scoring.slice(0, 12).map((entry) => (
        <li key={entry.movie.id} className="w-28">
          <PosterFrame
            title={entry.movie.title ?? 'Untitled'}
            // Posters arrive in Phase 11 with the media migration.
            posterUrl={null}
            points={entry.points}
            share={entry.points / best}
          />
        </li>
      ))}
    </Shelf>
  );
}

import { EmptyState } from '@/components/EmptyState';
import { LetterboxRule } from '@/components/LetterboxRule';
import { RosterStrip } from '@/components/RosterStrip';
import { SeasonRail } from '@/components/SeasonRail';
import { StandingsPanel } from '@/components/StandingsPanel';
import { getCurrentUser } from '@/lib/auth';
import { getDashboard } from '@/lib/services/dashboard';

/**
 * The dashboard, with a public variant (D44).
 *
 * Replaces a welcome card that told members their own name with the three
 * things they actually open the site to learn: where they stand, what their
 * films have scored, and which show is next.
 *
 * Signed out, it is the season itself — the rail of award shows, and an
 * invitation to sign up. That is deliberate and matches the source app, where
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
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  const view = await getDashboard(user?.id ?? null);

  return (
    <main className="bg-bg-base text-text-primary min-h-dvh p-6 sm:p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-display text-xl font-bold uppercase [font-variation-settings:'wdth'_120]">
            Cinemadraft
          </h1>
          <p className="text-text-secondary tabular font-mono text-xs">
            Season {view.year}
          </p>
        </header>

        {view.events.length > 0 ? (
          <section className="flex flex-col gap-4">
            <LetterboxRule>Season</LetterboxRule>
            <SeasonRail events={view.events} />
          </section>
        ) : null}

        {user == null ? (
          <EmptyState
            title="Play the season"
            action={{ label: 'Sign up', href: '/auth/sign-up' }}
          >
            Draft a team of films before awards season and score points as they pick up
            nominations and wins. Played before? Sign up with the same email and your
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
          view.leagues.map((league) => (
            <section key={league.id} className="flex flex-col gap-6">
              <LetterboxRule>{league.name ?? 'League'}</LetterboxRule>

              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                  <div className="flex items-baseline gap-4">
                    <span className="text-text-secondary text-xs uppercase tracking-wide">
                      Your team
                    </span>
                    <span className="text-text-primary tabular font-mono text-sm">
                      {league.total}
                    </span>
                    {league.position != null ? (
                      <span className="text-text-dim tabular font-mono text-xs">
                        {/* Position is stated rather than implied by the row's
                            place in the table below: on a narrow screen the
                            standings sit far beneath the roster. */}
                        Position {league.position}
                      </span>
                    ) : null}
                  </div>

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
          ))
        )}
      </div>
    </main>
  );
}

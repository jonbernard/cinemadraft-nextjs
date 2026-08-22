import Link from 'next/link';

import { EmptyState } from '@/components/EmptyState';
import { SectionHead } from '@/components/SectionHead';
import { requireUser } from '@/lib/auth';
import { getMyLeagues } from '@/lib/services/my-leagues';

/**
 * The leagues you are in (P10.T12).
 *
 * 🔴 **It shows a list rather than redirecting.** The source app's `/leagues`
 * rendered `null` and bounced to whichever league happened to be first
 * (`src/pages/league/redirect.js`), which meant no page ever answered "which
 * leagues am I in" — and someone in four of them had to guess at URLs to reach
 * the other three. This is one of the few places the port is deliberately
 * better than what it replaces.
 *
 * Private, unlike the individual league boards (D44). A league board is
 * shareable; the list of leagues *you* are in is about you.
 */
export default async function LeaguesPage() {
  const user = await requireUser();
  const leagues = await getMyLeagues(user.id);

  return (
    <>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <SectionHead
          as="h1"
          right={
            <Link
              href="/leagues/new"
              className="border-border-rule text-text-primary hover:bg-bg-raised focus-visible:outline-accent-fill flex min-h-11 items-center border px-4 font-sans text-sm focus-visible:outline-2"
            >
              Start a league
            </Link>
          }
        >
          Leagues
        </SectionHead>

        {leagues.length === 0 ? (
          <EmptyState
            title="You are not in a league yet"
            action={{ label: 'Start a league', href: '/leagues/new' }}
          >
            Start one and send the invite link to whoever is playing, or follow a link
            someone has already sent you.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {leagues.map((league) => (
              <li key={league.id}>
                <Link
                  href={`/leagues/${league.id}`}
                  className="bg-bg-surface hover:bg-bg-raised focus-visible:outline-accent-fill flex flex-col gap-1 rounded-md p-4 focus-visible:outline-2"
                >
                  <span className="flex flex-wrap items-baseline gap-x-3">
                    <span className="text-text-primary text-sm">{league.name}</span>
                    {/* Named, not signalled by colour alone. */}
                    {league.isOwner ? (
                      <span className="text-accent-text text-xs">You run this one</span>
                    ) : null}
                  </span>

                  <span className="text-text-secondary flex flex-wrap gap-x-3 text-xs">
                    <span className="tabular font-mono">{league.years[0] ?? '—'}</span>
                    <span>
                      {league.memberCount}{' '}
                      {league.memberCount === 1 ? 'member' : 'members'}
                    </span>
                    {league.status ? (
                      <span className="text-text-dim">{league.status}</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

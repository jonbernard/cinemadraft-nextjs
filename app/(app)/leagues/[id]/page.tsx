import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { DraftBoard } from '@/components/draft/DraftBoard';
import { InviteAction } from '@/components/leagues/InviteAction';
import { RosterStrip } from '@/components/leagues/RosterStrip';
import { StandingsPanel } from '@/components/leagues/StandingsPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHead } from '@/components/ui/SectionHead';
import { StatusChip } from '@/components/ui/StatusChip';
import { getCurrentUser } from '@/lib/auth';
import { SIGN_IN_URL } from '@/lib/auth-routes';
import { NotFoundError } from '@/lib/errors';
import { NOINDEX } from '@/lib/seo';
import { getLeagueBoard, getLeagueSeasons } from '@/lib/services/draft';
import { canManageLeague } from '@/lib/services/league-access';
import { getLeagueBoardView } from '@/lib/services/league-view';
import { getActiveYear } from '@/lib/services/season';

/**
 * The origin an invite link should carry.
 *
 * Read from the request rather than an env var so the link works from
 * localhost, a Vercel preview and production without configuration — and so a
 * preview deploy cannot hand someone a link into production.
 */
async function inviteBase(): Promise<string> {
  const { headers } = await import('next/headers');
  const list = await headers();
  const host = list.get('x-forwarded-host') ?? list.get('host') ?? '';
  const proto =
    list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/**
 * An owner action that is the act this state calls for (P17.T30).
 *
 * Carmine as a fill with white on it — 6.58:1, the pairing `accent.fill` was
 * measured for; the same colour as text on the ground is 2.96:1 and fails,
 * which is why `EmptyState`'s primary action is spelled exactly this way.
 * 🔴 Never `brass`: brass means an award outcome (D85), and running a draft is
 * not one.
 *
 * A `Link` rather than `components/Button`: `Button` wraps MUI's and renders a
 * `<button>`, and both of these navigate. A control that navigates is an anchor
 * — middle-click, open-in-new-tab and the status bar all depend on it.
 */
function PrimaryAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="bg-accent-fill focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {children}
    </Link>
  );
}

/** The same act, when the page's subject is the board rather than the action. */
function SecondaryAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="border-border-rule text-text-primary hover:bg-bg-surface focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm border px-4 text-sm focus-visible:outline-2"
    >
      {children}
    </Link>
  );
}

/**
 * A league's draft board.
 *
 * 🔴 **Public (D44).** The source app never guarded these routes, and treating
 * them as private would be a parity regression rather than a hardening — the
 * link people share in a group chat has to open for whoever taps it. Signing in
 * changes two things and nothing else: the viewer's own seat is marked, and an
 * owner gets a link to the console.
 *
 * Mobile-first, because this is the page the league reads on their phones while
 * the owner runs the call (D49). `DraftBoard` carries that: stacked seats on a
 * phone, the aligned grid on a desktop.
 */
/**
 * A league's name in the tab, and out of the index (P15.T6).
 *
 * 🔴 `NOINDEX` is not a guard. The page is public on purpose — the link people
 * paste into a group chat has to open for whoever taps it (D44/D45) — but a
 * private league's board has no business in a stranger's search results.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const leagueId = Number(id);
  if (!Number.isSafeInteger(leagueId) || leagueId <= 0)
    return { title: 'Not here', robots: NOINDEX };

  try {
    const board = await getLeagueBoard(leagueId, await getActiveYear());
    return { title: board.leagueName ?? `League ${leagueId}`, robots: NOINDEX };
  } catch {
    return { title: 'Not here', robots: NOINDEX };
  }
}

export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { id } = await params;
  const { year } = await searchParams;

  const leagueId = Number(id);
  if (!Number.isSafeInteger(leagueId) || leagueId <= 0) notFound();

  const requested = Number(year);
  const season =
    Number.isSafeInteger(requested) && requested > 0 ? requested : await getActiveYear();

  const [seasons, user] = await Promise.all([
    getLeagueSeasons(leagueId),
    getCurrentUser(),
  ]);

  // 🔴 One definition of what this page shows (P14.T9). The seat, the
  // roster, the standings and the status flags used to be derived here and
  // would have had to be derived a second time by
  // `/api/leagues/[id]/board/stream` — two doors disagreeing about arithmetic
  // a member reads as truth.
  let view: Awaited<ReturnType<typeof getLeagueBoardView>>;
  try {
    view = await getLeagueBoardView(leagueId, season, user?.id ?? null);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const canManage = canManageLeague(view, user?.id);
  const viewerSeatId = view.viewerSeatId;
  const isPending = view.isPending;

  // Hoisted out of the JSX: `inviteBase()` used to be awaited inside a
  // conditional JSX expression, which is now inside two conditionals.
  const inviteUrl =
    canManage && view.uuid && !view.isComplete
      ? `${await inviteBase()}/join/${view.uuid}`
      : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <header className="flex flex-col gap-4">
        <SectionHead
          as="h1"
          name
          eyebrow={view.status ? `${view.year} · ${view.status}` : String(view.year)}
        >
          {view.leagueName ?? 'League'}
        </SectionHead>

        {/* 🔴 Controls, not metadata (P17.T30). These were `text-accent-text
              underline` inside a baseline row between the year and the status
              word — a footnote treatment on the two most consequential actions
              an owner takes, one of which is the only way into the console.

              Which one is primary comes from state the page already has: no
              seats means there is nothing to draft, so setting up the season is
              the act; a pending draft means the season is set up and the league
              is waiting on the owner to start. Otherwise the page's subject is
              the board, and both step back. */}
        {canManage ? (
          <div className="flex flex-wrap items-center gap-3">
            {view.groups.length === 0 ? (
              <>
                <PrimaryAction href={`/leagues/${view.leagueId}/setup?year=${view.year}`}>
                  Set up the season
                </PrimaryAction>
                <SecondaryAction
                  href={`/leagues/${view.leagueId}/draft?year=${view.year}`}
                >
                  Run the draft
                </SecondaryAction>
              </>
            ) : isPending ? (
              <>
                <PrimaryAction href={`/leagues/${view.leagueId}/draft?year=${view.year}`}>
                  Run the draft
                </PrimaryAction>
                <SecondaryAction
                  href={`/leagues/${view.leagueId}/setup?year=${view.year}`}
                >
                  Set up the season
                </SecondaryAction>
              </>
            ) : (
              <>
                <SecondaryAction
                  href={`/leagues/${view.leagueId}/draft?year=${view.year}`}
                >
                  Run the draft
                </SecondaryAction>
                <SecondaryAction
                  href={`/leagues/${view.leagueId}/setup?year=${view.year}`}
                >
                  Set up the season
                </SecondaryAction>
              </>
            )}

            {/* 🔴 Owners only, and only while there is somebody to invite.
                  The uuid is the join credential — anyone holding it can seat
                  themselves — so showing it to every member would make every
                  member able to re-share the league, and leaving it on a
                  finished season is a standing credential on screen for no
                  reason. Behind a disclosure either way: as a bare `<code>` it
                  was the second element on the page and two mono lines at
                  390px. */}
            {inviteUrl ? <InviteAction url={inviteUrl} /> : null}
          </div>
        ) : null}

        {seasons.length > 1 ? (
          <nav aria-label="Seasons" className="flex flex-wrap gap-3 text-sm">
            {seasons.map((entry) => (
              <Link
                key={entry}
                href={`/leagues/${view.leagueId}?year=${entry}`}
                aria-current={entry === view.year ? 'page' : undefined}
                className={
                  entry === view.year
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

      {/* P10.T10: standings for whoever has this link, signed in or not —
            the deficiency being closed is that the source only showed this on
            the dashboard, to a signed-in member. One view, not a total/event
            toggle: the source's own `:type` segment was ignored by both routes
            it named (PARITY.md source bug 9), so a distinction it never
            actually made is not one to port.

            🔴 The reader's own roster sits beside it (P17.T31). The standings
            table is `max-w-sm`, so at 1440px it used about 45% of the content
            column and left the rest empty — while the reader's own picks were
            inside the board, thousands of pixels down the page. Nothing new is
            queried. Roster first in DOM order, so a phone reads the reader's
            own team before the table.

            🔴 There is no "own roster" for a stranger, and the league page is
            public (D44/D45), so the ordinary case on a shared link is that this
            slot has nothing of the reader's to show. It is then a deliberate
            statement of what the slot is for — the link, and what signing in
            adds — rather than a hole the standings float beside. */}
      {view.standings.length > 0 ? (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
          <section className="flex min-w-0 flex-1 flex-col gap-3">
            <SectionHead as="h2" eyebrow="Yours">
              Your roster
            </SectionHead>
            {view.viewerRoster.length > 0 ? (
              <RosterStrip films={view.viewerRoster} />
            ) : view.viewerSeated ? (
              // 🔴 A seat with no picks is still a seat. This branch used to
              // test `viewerRoster.length` and fall through to "you do not
              // hold a seat this season" — told to a member whose name was
              // listed in the standings table directly beside it. Found by
              // P19.T2's journey on its final frame, where the league owner
              // is seated and has not drafted.
              <EmptyState title="Your seat is empty until the draft">
                You hold a seat this season. Your picks and what each one has scored
                appear here as the draft runs.
              </EmptyState>
            ) : user == null ? (
              <EmptyState
                title="Sign in to see your own roster here"
                action={{ label: 'Sign in', href: SIGN_IN_URL }}
              >
                The board and the standings below are the whole season, and they are open
                to whoever has this link. Your own picks and what each one has scored sit
                here once you are in.
              </EmptyState>
            ) : (
              <EmptyState title="You do not hold a seat this season">
                This is somebody else's league, or a season you sat out — the standings
                and the board are still the whole story.
              </EmptyState>
            )}
          </section>

          <section className="flex w-full flex-col gap-3 lg:max-w-sm">
            <SectionHead as="h2">Standings</SectionHead>
            <StandingsPanel rows={view.standings} />
          </section>
        </div>
      ) : null}

      {view.groups.length === 0 ? (
        <p className="text-text-secondary text-sm">
          No seats in this league for {view.year}.
        </p>
      ) : (
        view.groups.map((group) => (
          <section key={group.group} className="flex flex-col gap-4">
            {/* A heading and a running-order position are content, so
                  `secondary`, not `dim` (P17.T34). */}
            <h2 className="text-text-secondary text-xs font-normal">
              Group {group.group}
            </h2>

            {isPending ? (
              /* Before a draft starts there is nothing to put on a board, and
                   an empty grid would read as a draft in progress that nobody
                   has picked in. What exists at this point is the running
                   order, which is what the source app showed. */
              <ol className="flex flex-col">
                {group.seats.map((seat) => (
                  <li
                    key={seat.draftId}
                    aria-current={seat.draftId === viewerSeatId ? true : undefined}
                    className="border-border-rule flex items-baseline gap-3 border-b px-2 py-2"
                  >
                    <span className="text-text-secondary tabular w-6 font-mono text-xs">
                      {String(seat.order).padStart(2, '0')}
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-text-primary text-sm">
                        {seat.uuid ? (
                          <Link
                            href={`/members/${seat.uuid}`}
                            className="hover:text-accent-text focus-visible:outline-accent-fill focus-visible:outline-2"
                          >
                            {seat.name}
                          </Link>
                        ) : (
                          seat.name
                        )}
                        {seat.draftId === viewerSeatId ? (
                          <span className="text-accent-text"> · You</span>
                        ) : null}
                      </span>
                      {seat.isDummy ? (
                        <StatusChip tone="neutral">Unclaimed</StatusChip>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <DraftBoard
                rounds={group.rounds}
                viewerSeatId={viewerSeatId}
                seats={group.seats}
              />
            )}
          </section>
        ))
      )}
    </div>
  );
}

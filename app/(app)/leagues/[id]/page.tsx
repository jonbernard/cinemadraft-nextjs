import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { InviteDialog } from '@/components/leagues/InviteDialog';
import { LeagueBoardRoom } from '@/components/leagues/LeagueBoardRoom';
import { SectionHead } from '@/components/ui/SectionHead';
import { TvModeLink } from '@/components/ui/TvModeLink';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import { NOINDEX } from '@/lib/seo';
import { getLeagueBoard, getLeagueSeasons } from '@/lib/services/draft';
import { canManageLeague } from '@/lib/services/league-access';
import { getLeagueBoardView } from '@/lib/services/league-view';
import { getActiveYear } from '@/lib/services/season';
import { cn } from '@/lib/utils/cn';

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
  searchParams: Promise<{ year?: string; group?: string; tv?: string }>;
}) {
  const { id } = await params;
  const { year, group, tv } = await searchParams;

  // 🔴 TV mode is a URL, not state (P14.T6/T19): one person opens the link and
  // casts it, and a reload two hours into a draft comes back the same way it
  // went. It reaches three places and no others — the `data-tv-mode` marker
  // that one unlayered rule in globals.css reads, the header below, and what
  // the room puts on the screen. It is deliberately NOT in `streamUrl`.
  const tvMode = tv === '1';

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
  const isPending = view.isPending;

  // 🔴 Built from the page's own `?year=`, so the stream renders the view the
  // first paint already showed. A stream asked for different parameters is a
  // second, disagreeing page (the note on `LiveRoom`'s `streamUrl`).
  const streamUrl = `/api/leagues/${view.leagueId}/board/stream?year=${view.year}`;

  // 🔴 `?group=` validated against the groups this league-year actually has,
  // the way the console validates its own, and defaulting to the first. A
  // remote can land on any number; an unknown one must show a board, not an
  // empty screen.
  const requestedGroup = Number(group);
  const activeGroup =
    Number.isSafeInteger(requestedGroup) &&
    view.groups.some((entry) => entry.group === requestedGroup)
      ? requestedGroup
      : (view.groups[0]?.group ?? null);

  /**
   * This page's own URL, with one thing changed.
   *
   * 🔴 **Every link rendered in TV mode carries `tv=1`.** D114, verbatim: the
   * live room's league picker shipped dropping it and stranded a reader who
   * had a remote and no address bar. The group nav below is the same control
   * in the same trap, so both it and the toggle are built from here rather
   * than assembled twice.
   */
  const pageUrl = (next: { group?: number | null; tv?: boolean }) =>
    `/leagues/${view.leagueId}?year=${view.year}` +
    (next.group == null ? '' : `&group=${next.group}`) +
    (next.tv ? '&tv=1' : '');

  // Hoisted out of the JSX: `inviteBase()` used to be awaited inside a
  // conditional JSX expression, which is now inside two conditionals.
  const inviteUrl =
    canManage && view.uuid && !view.isComplete
      ? `${await inviteBase()}/join/${view.uuid}`
      : null;

  return (
    // 🔴 The marker, and the whole of TV mode's effect on the shell. One
    // unlayered rule in globals.css — `body:has([data-tv-mode])
    // [data-app-chrome]` — hides the rail, the utility strip, the phone top bar
    // and the tab bar while it is present. No CSS was written for this page:
    // the rule is keyed on the attribute, not on `/live`.
    //
    // 🔴 No `max-w-6xl` on a television. 1152px centred inside 1920 is a third
    // of the screen thrown away, and the board is sized from what is left.
    <div
      className={cn('mx-auto flex flex-col gap-10', !tvMode && 'max-w-6xl')}
      data-tv-mode={tvMode ? '' : undefined}
    >
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
        {/* 🔴 Not on a television. These are the owner's two doors into the
              console and the setup wizard — acts you perform at a keyboard, in
              the other tab, while the league watches this one. Every row of
              them is 60px off the board's height budget. */}
        {canManage && !tvMode ? (
          <div className="flex flex-wrap items-center gap-3">
            {view.groups.length === 0 || isPending ? (
              /* 🔴 One action while the season is not running, and it is NOT
                 "Run the draft".

                 With no groups, `getDraftConsole` throws `NotFoundError` and
                 the console is a 404. With groups but `pending`, the draft has
                 not been started and every pick is refused
                 (`actions/draft/guard.ts`) — so the console is a screen that
                 says no to everything. This used to offer "Run the draft" as
                 the loud carmine primary on exactly those states; the owner
                 reported it against a league of theirs reading "2026 ·
                 PENDING".

                 The way in is setup, which is where "Start the draft" lives —
                 and pressing it now lands on the console directly. */
              <PrimaryAction href={`/leagues/${view.leagueId}/setup?year=${view.year}`}>
                Set up the season
              </PrimaryAction>
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
                  reason. Behind a control either way: as a bare `<code>` it
                  was the second element on the page and two mono lines at
                  390px.

                  🔴 A modal dialog since P14.T15, not the `<details>` P17.T30
                  chose. A disclosure expands in flow, and this one is in a row
                  of 44px controls — opening it re-centred "Run the draft" and
                  "Set up the season" against a three-row block, which is the
                  defect the owner reported. The top layer leaves this row
                  alone. */}
            {inviteUrl ? <InviteDialog url={inviteUrl} /> : null}
          </div>
        ) : null}

        {seasons.length > 1 && !tvMode ? (
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

        {/* 🔴 The way out stays on the screen TV mode leaves behind, and the
              group nav stays with it — a reader on a television has a remote
              and no address bar, so a control that goes away with the chrome
              it turned on is a trap (D112). Both hrefs come from `pageUrl`,
              which is what carries `tv=1` through (D114). */}
        <div className="flex flex-wrap items-center gap-3">
          {tvMode && view.groups.length > 1 ? (
            <nav aria-label="Groups" className="flex flex-wrap gap-3 text-sm">
              {view.groups.map((entry) => (
                <Link
                  key={entry.group}
                  href={pageUrl({ group: entry.group, tv: true })}
                  aria-current={entry.group === activeGroup ? 'page' : undefined}
                  className={
                    entry.group === activeGroup
                      ? 'text-accent-text flex min-h-11 items-center'
                      : 'text-text-secondary flex min-h-11 items-center underline'
                  }
                >
                  Group {entry.group}
                </Link>
              ))}
            </nav>
          ) : null}
          <TvModeLink
            href={pageUrl({ group: activeGroup, tv: !tvMode })}
            active={tvMode}
          />
        </div>
      </header>

      <LeagueBoardRoom
        // 🔴 Keyed on the stream URL, so switching season reconciles into a new
        // connection rather than leaving one open to the old one.
        //
        // 🔴 `tv` and `group` are NOT in that URL, and that is the point: a
        // toggle or a group change reconciles rather than remounts, so the
        // `EventSource` is never dropped in the middle of a live draft (D114).
        key={streamUrl}
        initial={view}
        streamUrl={streamUrl}
        signedIn={user != null}
        viewerSeatId={view.viewerSeatId}
        tvMode={tvMode}
        group={activeGroup}
      />
    </div>
  );
}

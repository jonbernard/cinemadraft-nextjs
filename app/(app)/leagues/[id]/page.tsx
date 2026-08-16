import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DraftBoard } from '@/components/DraftBoard';
import { InviteLink } from '@/components/InviteLink';
import { LetterboxRule } from '@/components/LetterboxRule';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import { getLeagueBoard, getLeagueSeasons } from '@/lib/services/draft';
import { canManageLeague } from '@/lib/services/league-access';
import { getActiveYear } from '@/lib/services/season';
import { posterUrl } from '@/lib/utils/poster';

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

  let board: Awaited<ReturnType<typeof getLeagueBoard>>;
  try {
    board = await getLeagueBoard(leagueId, season);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const [seasons, user] = await Promise.all([
    getLeagueSeasons(leagueId),
    getCurrentUser(),
  ]);
  const canManage = canManageLeague(board, user?.id);

  // The viewer's own seat, if they hold one this season. Null for a visitor,
  // which is the ordinary case on a shared link.
  const viewerSeatId =
    user == null
      ? null
      : (board.groups
          .flatMap((group) => group.seats)
          .find((seat) => seat.userId === user.id)?.draftId ?? null);

  const isPending = board.status === 'pending';

  return (
    <main className="bg-bg-base text-text-primary min-h-dvh p-4 md:p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <LetterboxRule as="h1">{board.leagueName ?? 'League'}</LetterboxRule>

          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 text-sm">
            <span className="text-text-secondary tabular font-mono">{board.year}</span>
            {board.status ? (
              <span className="text-text-dim text-xs uppercase tracking-wide">
                {board.status}
              </span>
            ) : null}
            {canManage ? (
              <Link
                href={`/leagues/${board.leagueId}/draft?year=${board.year}`}
                className="text-accent-text underline"
              >
                Run the draft
              </Link>
            ) : null}
          </div>

          {/* 🔴 Owners only. The uuid is the join credential — anyone holding
              it can seat themselves — so showing it to every member would make
              every member able to re-share the league. */}
          {canManage && board.uuid ? (
            <InviteLink url={`${await inviteBase()}/join/${board.uuid}`} />
          ) : null}

          {seasons.length > 1 ? (
            <nav aria-label="Seasons" className="flex flex-wrap gap-3 text-sm">
              {seasons.map((entry) => (
                <Link
                  key={entry}
                  href={`/leagues/${board.leagueId}?year=${entry}`}
                  aria-current={entry === board.year ? 'page' : undefined}
                  className={
                    entry === board.year
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

        {board.groups.length === 0 ? (
          <p className="text-text-secondary text-sm">
            No seats in this league for {board.year}.
          </p>
        ) : (
          board.groups.map((group) => (
            <section key={group.group} className="flex flex-col gap-3">
              <h2 className="text-text-dim text-xs font-normal uppercase tracking-wide">
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
                      <span className="text-text-dim tabular w-6 font-mono text-xs">
                        {String(seat.order).padStart(2, '0')}
                      </span>
                      <span className="text-text-primary text-sm">
                        {seat.name}
                        {seat.draftId === viewerSeatId ? (
                          <span className="text-accent-text"> · You</span>
                        ) : null}
                        {seat.isDummy ? (
                          <span className="text-text-dim"> · unclaimed</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <DraftBoard
                  rounds={group.rounds}
                  viewerSeatId={viewerSeatId}
                  seats={group.seats.map((seat) => ({
                    draftId: seat.draftId,
                    name: seat.name,
                    isDummy: seat.isDummy,
                    total: seat.total,
                    picks: seat.picks.map((pick) => ({
                      pickId: pick.pickId,
                      round: pick.round,
                      title: pick.movie.title ?? 'Untitled',
                      posterUrl: posterUrl(pick.movie.poster, 'w185'),
                      points: pick.points,
                      ledger: pick.ledger,
                    })),
                  }))}
                />
              )}
            </section>
          ))
        )}
      </div>
    </main>
  );
}

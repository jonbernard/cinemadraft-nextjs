'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { type BoardSeat, DraftBoard } from '@/components/draft/DraftBoard';
import { type RosterFilm, RosterStrip } from '@/components/leagues/RosterStrip';
import { StandingsPanel } from '@/components/leagues/StandingsPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHead } from '@/components/ui/SectionHead';
import { StatusChip } from '@/components/ui/StatusChip';
import { SIGN_IN_URL } from '@/lib/auth-routes';
import type { StandingsRow } from '@/lib/services/dashboard';

/**
 * Structurally the part of `lib/services/league-view.ts`'s `LeagueBoardView`
 * this screen reads, composed from the types the three components below already
 * declare rather than re-typed a fourth time. Declared here rather than
 * imported for the reason `LiveRoom` gives: that module reaches the
 * repositories and the db client, and `components/` may not depend on it (D33).
 *
 * 🔴 The drift guard is `app/(app)/leagues/[id]/page.tsx`, which holds both
 * types and passes one as the other. A field renamed in the service fails that
 * assignment at compile time; there is no runtime seam here to be wrong about.
 */
export type LeagueBoardRoomView = {
  year: number;
  /** `status === 'pending'` — the running order exists, the board does not. */
  isPending: boolean;
  /** `status === 'active'` — 🔴 the ONLY state that streams (P14.T10). */
  isDrafting: boolean;
  viewerRoster: readonly RosterFilm[];
  /** True when the reader holds a seat, even one with no picks yet. */
  viewerSeated: boolean;
  standings: readonly StandingsRow[];
  groups: readonly { group: number; rounds: number; seats: readonly BoardSeat[] }[];
};

/**
 * The league board, the standings and the reader's own roster, kept live by one
 * `EventSource` while the draft runs (P14.T11, D48/D102).
 *
 * 🔴 **The server render is the page, and this does not replace it.** `initial`
 * is the view `getLeagueBoardView()` produced for this request, rendered to HTML
 * on the server like any other component here — a stranger, a crawler and a
 * reader whose JavaScript never arrives all get the whole board. What the effect
 * below adds is that it stops being a snapshot.
 *
 * 🔴 **Every frame is the complete view, so there is no merge.** The route emits
 * no `id:` and no delta (see its docstring): `JSON.parse(event.data)` *is* a
 * `LeagueBoardView` and it replaces this one outright. That is what makes the
 * ~53s forced disconnects invisible, and it is why nothing here tracks a cursor.
 *
 * 🔴 **No reveal, and that is deliberate.** A pick landing on a board is not an
 * announcement — `LiveRoom`'s `justDecided` exists because a ceremony hands out
 * a result, and a draft does not. `DraftBoard` renders a keyed grid, so React
 * updates the cells in place and a reader on a screen reader hears nothing new
 * unless something actually changed.
 *
 * 🔴 **The stop conditions are the feature.** Neon bills awake-time, and a
 * league is `active` for an hour or two a season, so a page that only opened
 * connections would spend the whole allowance on boards nobody is watching.
 * Four conditions close or refuse one, and each has a test of its own in
 * `LeagueBoardRoom.test.tsx`:
 *
 *   1. **Not drafting, no connection at all** — not even the first. `isDrafting`
 *      is read from the server's own frame, so every reload of a finished or
 *      pending season costs nothing.
 *   2. **Hidden tab, no connection.** `visibilitychange` closes it and returning
 *      to the tab opens a new one, whose first frame is full state.
 *   3. **Unmount closes it**, which is the navigation case.
 *   4. **A refusal is final.** `EventSource` does not retry a non-200 — it fires
 *      `error` with `readyState === CLOSED` — and neither do we. The 204 the
 *      route answers off draft is the server saying *stop asking*. A clean close
 *      every ~50s is the other thing, and is not an error: `readyState` is
 *      `CONNECTING`, the browser reconnects on its own, and nothing here
 *      interferes.
 *
 * 🔴 **One `EventSource`, including in development.** React double-invokes an
 * effect under StrictMode, and the naive version of this opens a second stream
 * that nothing closes. The guard is the `source !== null` check in `open` plus
 * the cleanup: setup, teardown, setup leaves one connection, never two.
 *
 * 🔴 **The effect must not depend on the view it sets.** `view.isDrafting` in
 * the dependency array would tear the connection down and build a new one on
 * every frame — the whole connection budget spent in seconds, and the bug would
 * look like the page working perfectly. It depends on the *server's* `initial`
 * and on the URL, both of which are stable for the life of the mount.
 */
export function LeagueBoardRoom({
  initial,
  streamUrl,
  signedIn,
  viewerSeatId,
  tvMode = false,
  group = null,
}: {
  initial: LeagueBoardRoomView;
  /**
   * 🔴 Built by the page from the page's own `?year=`, so the stream renders the
   * view the first paint already showed. A stream asked for different parameters
   * is a second, disagreeing page.
   */
  streamUrl: string;
  /** Which of the empty states a reader with no seat is owed (D44). */
  signedIn: boolean;
  /** The signed-in reader's own seat this season, or null for a visitor. */
  viewerSeatId: number | null;
  /**
   * TV mode (P14.T19). 🔴 Deliberately NOT part of `streamUrl`, which the page
   * keys this component on — a toggle would remount the room and drop the
   * `EventSource` in the middle of a live draft (D114).
   *
   * What it changes here is what is on the screen and nothing about the data:
   * one group instead of every group, and the board sized for a television.
   * The standings and the reader's own roster step aside, because 4 seats of
   * poster is already the whole of 1080 and the owner's requirement is that
   * every pick in the group is visible **at once**.
   */
  tvMode?: boolean;
  /** The group TV mode is showing, validated by the page. */
  group?: number | null;
}) {
  const [view, setView] = useState(initial);

  useEffect(() => {
    if (!initial.isDrafting) return;

    let source: EventSource | null = null;
    /** Latched by the two things that mean "do not open another one". */
    let done = false;

    const close = () => {
      source?.close();
      source = null;
    };

    const open = () => {
      if (done || source !== null || document.hidden) return;
      const opened = new EventSource(streamUrl);
      source = opened;

      opened.onmessage = (event) => {
        const next = JSON.parse(event.data) as LeagueBoardRoomView;
        setView(next);

        // The route checks `isDrafting` only when a connection opens, so a
        // draft finishing mid-stream arrives as one last full frame saying so.
        // Closing on it rather than idling out the remaining lifetime is the
        // difference between a draft that stops costing money when it ends and
        // one that stops up to a minute later.
        if (!next.isDrafting) {
          done = true;
          close();
        }
      };

      opened.onerror = () => {
        // `CONNECTING` is the ~50s self-close, or a blip: the browser is
        // already reconnecting and must be left to. `CLOSED` is a non-200 —
        // the 204 off draft, or a 404 — which `EventSource` never retries and
        // nor do we.
        if (opened.readyState === EventSource.CLOSED) {
          done = true;
          close();
        }
      };
    };

    const visibility = () => {
      if (document.hidden) close();
      else open();
    };

    open();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      close();
    };
  }, [streamUrl, initial.isDrafting]);

  /**
   * 🔴 One group on a television, every group otherwise. During a draft call
   * one group is the subject, and stacking the others below it is what makes
   * the one on screen too small to read from a sofa.
   *
   * The fallback is the first group rather than nothing: `?group=` is a number
   * a remote can land on, and a board that answered an unknown one with an
   * empty screen would be worse than one that answered it with a board.
   */
  const chosen = view.groups.find((entry) => entry.group === group) ?? view.groups[0];
  const groups = tvMode ? (chosen ? [chosen] : []) : view.groups;

  return (
    <>
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
      {!tvMode && view.standings.length > 0 ? (
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
            ) : !signedIn ? (
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

      {groups.length === 0 ? (
        <p className="text-text-secondary text-sm">
          No seats in this league for {view.year}.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.group} className="flex flex-col gap-4">
            {/* A heading and a running-order position are content, so
                  `secondary`, not `dim` (P17.T34).

                  🔴 `sr-only` on a television (D124). The heading plus the
                  gap under it is 32px of the 1080, and on a television the
                  group is already named twice over — by the floating group nav,
                  whose current entry carries `aria-current="page"` and the
                  accent colour, and by the URL that was cast. The heading stays
                  in the document so the outline and the section's own name do;
                  only its pixels go. */}
            <h2
              className={tvMode ? 'sr-only' : 'text-text-secondary text-xs font-normal'}
            >
              Group {group.group}
            </h2>

            {view.isPending ? (
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
                tv={tvMode}
              />
            )}
          </section>
        ))
      )}
    </>
  );
}

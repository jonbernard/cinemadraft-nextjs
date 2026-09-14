'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { LiveAward, type LiveAwardNominee } from '@/components/awards/LiveAward';
import { LiveBoard, type LiveLeague } from '@/components/awards/LiveBoard';
import { StandingsPanel } from '@/components/leagues/StandingsPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHead } from '@/components/ui/SectionHead';
import { PITCH, PITCH_HEADLINE } from '@/lib/copy';
import type { StandingsRow } from '@/lib/services/dashboard';

/**
 * Structurally the part of `lib/services/live.ts`'s `LiveShowView` this screen
 * reads, composed from the types the three components below already declare
 * rather than re-typed a fourth time. Declared here rather than imported for
 * the reason `LiveAward` and `LiveBoard` give: that module reaches the
 * repositories and the db client, and `components/` may not depend on it (D33).
 *
 * 🔴 The drift guard is `app/(app)/live/[abbr]/page.tsx`, which holds both
 * types and passes one as the other. A field renamed in the service fails that
 * assignment at compile time; there is no runtime seam here to be wrong about.
 */
export type LiveRoomView = {
  onAir: boolean;
  resolved: number;
  total: number;
  categories: readonly {
    awardId: number;
    name: string;
    points: number;
    nominees: readonly LiveAwardNominee[];
  }[];
  league: (LiveLeague & { standings: readonly StandingsRow[] }) | null;
  leagueOptions: readonly { id: number; name: string | null }[];
  /**
   * The category the admin has put on screen, or null (P14.T12/T13).
   *
   * A pointer on the event row, so this is a comparison and never a join: an
   * id that matches no category — one put up and then deleted — simply marks
   * nothing.
   */
  focusedAwardId: number | null;
};

/** Has this category got a winner in this frame? */
function decided(view: LiveRoomView, awardId: number): boolean {
  return (
    view.categories
      .find((category) => category.awardId === awardId)
      ?.nominees.some((nominee) => nominee.isWinner) ?? false
  );
}

/**
 * The one category that gained a winner between two frames, or null.
 *
 * 🔴 Between two *frames*, never on first render — which is the whole reason
 * `LiveAward`'s `reveal` defaults off. A reload of a finished ceremony has no
 * previous frame to have gained anything against, so it replays nothing; a
 * reveal is only ever the announcement a reader was here for.
 *
 * The first if two arrive together. A ceremony hands out one award at a time,
 * and a frame carrying two means a correction or a gap the reader did not
 * watch — neither is an announcement worth playing twice over.
 */
function justDecided(before: LiveRoomView, after: LiveRoomView): number | null {
  return (
    after.categories.find(
      (category) =>
        category.nominees.some((nominee) => nominee.isWinner) &&
        !decided(before, category.awardId),
    )?.awardId ?? null
  );
}

/**
 * The live room: the server's first paint, kept live by one `EventSource`
 * (P14.T4, D102).
 *
 * 🔴 **The server render is the page, and this does not replace it.** `initial`
 * is the view `getLiveShow()` produced for this request, rendered to HTML on
 * the server like any other component here — a stranger, a crawler and a reader
 * whose JavaScript never arrives all get the whole room. What the effect below
 * adds is that it stops being a snapshot.
 *
 * 🔴 **Every frame is the complete view, so there is no merge.** The route
 * emits no `id:` and no delta (see its docstring): `JSON.parse(event.data)`
 * *is* a `LiveShowView` and it replaces this one outright. That is what makes
 * the ~36 forced disconnects of a three-hour ceremony invisible, and it is why
 * nothing here tracks a cursor.
 *
 * 🔴 **The stop conditions are the feature.** Neon bills awake-time: one
 * forgotten monitor holding a stream open is ~180 CU-hrs a month against a
 * 100 CU-hr allowance, so a page that only opened connections would exhaust the
 * free tier by itself. Four conditions close or refuse one, and each has a test
 * of its own in `LiveRoom.test.tsx`:
 *
 *   1. **Off air, no connection at all** — not even the first. `onAir` is read
 *      from the server's own frame, so a show that has ended costs nothing on
 *      every reload of it.
 *   2. **Hidden tab, no connection.** `visibilitychange` closes it and returning
 *      to the tab opens a new one, whose first frame is full state — so the
 *      reader who comes back sees the current show, not a replayed gap.
 *   3. **Unmount closes it**, which is the navigation case.
 *   4. **A refusal is final.** `EventSource` does not retry a non-200 — it fires
 *      `error` with `readyState === CLOSED` — and neither do we. The 204 the
 *      route answers off air is the server saying *stop asking*, and a backoff
 *      loop written on top of it would reinstate exactly the leak this list
 *      exists to prevent. A clean close every ~50s is the other thing, and is
 *      not an error: `readyState` is `CONNECTING`, the browser reconnects on
 *      its own, and nothing here interferes.
 *
 * 🔴 **One `EventSource`, including in development.** React double-invokes an
 * effect under StrictMode, and the naive version of this opens a second stream
 * that nothing closes. The guard is the `source !== null` check in `open` plus
 * the cleanup: setup, teardown, setup leaves one connection, never two.
 *
 * 🔴 **The effect must not depend on the view it sets.** `view.onAir` in the
 * dependency array would tear the connection down and build a new one on every
 * frame — the whole connection budget spent in seconds, and the bug would
 * look like the page working perfectly. It depends on the *server's* `initial`
 * and on the URL, both of which are stable for the life of the mount.
 */
export function LiveRoom({
  initial,
  streamUrl,
  abbr,
  year,
  tvMode,
  signedIn,
}: {
  initial: LiveRoomView;
  /**
   * 🔴 Built by the page from the page's own `?year=`/`?league=`, so the stream
   * renders the view the first paint already showed. A stream asked for
   * different parameters is a second, disagreeing page.
   */
  streamUrl: string;
  abbr: string;
  year: number;
  /**
   * 🔴 Carried through the league picker's links, and that is the whole of its
   * job here. TV mode is chrome (P14.T6) and this component still knows nothing
   * about it — but the picker builds a URL, and a URL that drops `?tv=1` drops
   * the reader out of full screen for choosing a league. On a television that
   * is a one-way door: the chrome comes back, the remote has no address bar,
   * and the way back is a link the reader has to go looking for. The links
   * below lead to the page the reader is already on.
   *
   * Deliberately NOT part of `streamUrl`, which is what `page.tsx` keys this
   * component on — see the note there. A toggle must not reconnect the stream.
   */
  tvMode: boolean;
  /** Which of the two empty states a reader with no league is owed (D44). */
  signedIn: boolean;
}) {
  const [view, setView] = useState(initial);
  /**
   * The one category whose winner arrived while this page was open. Latched
   * rather than cleared on a timer: every reveal keyframe is `both`, so its
   * end state *is* the settled state, and dropping the classes when the next
   * category resolves changes nothing on screen.
   */
  const [revealed, setRevealed] = useState<number | null>(null);
  /** What the reader is looking at, readable from inside the effect's closure. */
  const shown = useRef(initial);
  /** The selection this page has already moved to, so a re-render does not re-scroll. */
  const scrolled = useRef<number | null>(initial.focusedAwardId);

  useEffect(() => {
    const focused = view.focusedAwardId;
    // 🔴 First render is excluded by seeding the ref with the server's own
    // value: a reader opening the page mid-ceremony already has the selection
    // in their first frame, and yanking their scroll before they have looked
    // at anything is the same defect as replaying every reveal on reload.
    if (focused == null || focused === scrolled.current) return;
    scrolled.current = focused;
    document.getElementById(`award-${focused}`)?.scrollIntoView({
      block: 'start',
      // Honour the reader's own setting rather than deciding for them.
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }, [view.focusedAwardId]);

  useEffect(() => {
    if (!initial.onAir) return;

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
        const next = JSON.parse(event.data) as LiveRoomView;
        const before = shown.current;
        shown.current = next;
        setView(next);

        const announced = justDecided(before, next);
        if (announced !== null) setRevealed(announced);

        // The route checks `onAir` only when a connection opens, so a show
        // going off air mid-stream arrives as one last full frame saying so.
        // Closing on it rather than idling out the remaining lifetime is the
        // difference between a ceremony that stops costing money when it ends
        // and one that stops up to five minutes later.
        if (!next.onAir) {
          done = true;
          close();
        }
      };

      opened.onerror = () => {
        // `CONNECTING` is the ~50s self-close, or a blip: the browser is
        // already reconnecting and must be left to. `CLOSED` is a non-200 —
        // the 204 off air, or a 404 — which `EventSource` never retries and
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
  }, [streamUrl, initial.onAir]);

  return (
    <>
      {/* 🔴 The standings come FIRST in the DOM and sit second on the screen.
          Below `lg` they stack above the awards, because on a phone during a
          ceremony the standings are what you came for; at `lg` and up the grid
          puts them in column two and the awards in column one. Explicit
          `col-start`/`row-start` rather than `flex-row-reverse`, so the two
          orders are stated rather than emergent — and the DOM order is the one
          a screen reader and the tab key follow at every width, which is the
          reading order a member wants.

          🔴 That order is also what keeps a frame from re-announcing the page.
          Every element below is keyed and in a fixed place, so React updates
          the numbers and the posters in situ; a reader on a screen reader hears
          nothing new unless something actually changed. */}
      <div className="flex flex-col gap-10 lg:grid lg:grid-cols-[1fr_20rem] lg:items-start">
        <section className="flex flex-col gap-4 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-6">
          {view.league ? (
            <>
              <SectionHead
                as="h2"
                name
                eyebrow="Standings"
                right={String(view.league.total)}
                className="pb-0"
              >
                {view.league.name ?? 'Your league'}
              </SectionHead>
              {/* 🔴 The right-hand number is what this league has taken at
                  THIS show — `LiveLeague.total`, the sum of the seats below —
                  while the table's column is the season. Two different
                  questions, and the eyebrow says which table this is. */}
              <StandingsPanel rows={view.league.standings} />

              {/* A reader with more than one league. Never rendered for a
                  signed-out reader: `leagueOptions` is empty without a
                  session, so a pinned league is one league and not a door to
                  anybody else's. */}
              {view.leagueOptions.length > 1 ? (
                <nav aria-label="Your leagues" className="flex flex-wrap gap-3 text-sm">
                  {view.leagueOptions.map((option) => (
                    <Link
                      key={option.id}
                      href={`/live/${abbr}?year=${year}&league=${option.id}${
                        tvMode ? '&tv=1' : ''
                      }`}
                      aria-current={option.id === view.league?.id ? 'page' : undefined}
                      className={
                        option.id === view.league?.id
                          ? 'text-accent-text'
                          : 'text-text-secondary underline'
                      }
                    >
                      {option.name ?? `League ${option.id}`}
                    </Link>
                  ))}
                </nav>
              ) : null}
            </>
          ) : signedIn ? (
            <EmptyState
              title="No league yet"
              action={{ label: 'Find a league', href: '/leagues' }}
            >
              Join a league to draft a team and watch it score as this show resolves.
            </EmptyState>
          ) : (
            /* 🔴 Two empty states, not one, because the page is public
               (P17.T16, amending D40). A signed-out reader must never be
               offered "Find a league": `/leagues` is protected, so that link is
               a login page wearing a league's name. They get the same
               invitation `/` gives a stranger, in the same words, for the same
               reason (D44).

               🔴 The pitch comes from `lib/copy.ts`, the same string the
               signed-out home and `/how-it-works` render. It used to be a
               fourth hand-typed copy of the same argument, and the copy here
               had already drifted from the other three. */
            <EmptyState
              title={PITCH_HEADLINE}
              action={{ label: 'Register', href: '/auth/register' }}
            >
              {PITCH} Played before? Register with the same email and your leagues, drafts
              and points come with you.
            </EmptyState>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1">
          <SectionHead
            as="h2"
            right={`${view.resolved} of ${view.total}`}
            className="pb-0"
          >
            Categories
          </SectionHead>

          {view.total === 0 ? (
            <EmptyState title="No categories yet">
              Nothing has been entered for this show and season.
            </EmptyState>
          ) : (
            <ol className="flex flex-col gap-6">
              {view.categories.map((category) => (
                <li key={category.awardId} id={`award-${category.awardId}`}>
                  {/* 🔴 The chips this replaces are gone on purpose, not
                    overlooked. A brass chip naming the winner and a neutral one
                    counting the nominees were the whole category: the posters
                    now say both — which film took it, from the seal, and how
                    many are up, by being there. Keeping the chips would be two
                    marks for one fact, which is the rule `NomineeGrid` records
                    and the defect the source app shipped. */}
                  <LiveAward
                    name={category.name}
                    points={category.points}
                    nominees={category.nominees}
                    reveal={category.awardId === revealed}
                    onScreen={category.awardId === view.focusedAwardId}
                  />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* 🔴 The `h2` is not decoration. Measured in a production build, the
          outline without it ran h1 → h2 Categories → h3 ×6 → h3 league, so the
          league read as a seventh category to anything following the heading
          structure. It also gives the board the label it otherwise lacked:
          `LiveBoard` opens on a league's name, which does not say what it is.

          🔴 "Your seats" only when one of them IS the reader's. A pinned league
          is readable by whoever opens the link, so a stranger and a member of
          another league both land here — and telling them these are their seats
          would be the page asserting something about their identity. */}
      {view.league ? (
        <section className="flex flex-col gap-4">
          <SectionHead as="h2">
            {view.league.seats.some((seat) => seat.isViewer) ? 'Your seats' : 'Rosters'}
          </SectionHead>
          <LiveBoard league={view.league} />
        </section>
      ) : null}
    </>
  );
}

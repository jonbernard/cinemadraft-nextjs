import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LiveCountdown } from '@/components/awards/LiveCountdown';
import { LiveRoom } from '@/components/awards/LiveRoom';
import { ShowLogo } from '@/components/awards/ShowLogo';
import { TvModeLink } from '@/components/awards/TvModeLink';
import { Panel } from '@/components/ui/Panel';
import { SectionHead } from '@/components/ui/SectionHead';
import { StatusChip } from '@/components/ui/StatusChip';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import { eventRepository } from '@/lib/repositories/events';
import { canonical } from '@/lib/seo';
import { getLiveShow, pinnedLeague } from '@/lib/services/live';
import { getActiveYear } from '@/lib/services/season';

/** `?year=` or the active season, resolved the way `/award-shows/[abbr]` does. */
async function season(year: string | string[] | undefined): Promise<number> {
  const requested = Number(year);
  return Number.isSafeInteger(requested) && requested > 0
    ? requested
    : await getActiveYear();
}

/**
 * A title and a canonical, because the route is public now (P17.T16). The
 * canonical drops `?year=`, the same way `/award-shows/[abbr]` does — twelve
 * shows times ten seasons is 120 URLs for one page otherwise.
 *
 * 🔴 Deliberately NOT added to `app/sitemap.ts`: this page is a thing you open
 * during the two hours a show is on air, and the twelve URLs it would add are
 * all `/award-shows` duplicates the rest of the year. It is still indexable if
 * a crawler finds the link — the same as `/award-shows/[abbr]`, which is where
 * the link is — and that is deliberate rather than overlooked; the canonical is
 * what stops ten seasons of `?year=` becoming ten documents.
 */
export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/live/[abbr]'>): Promise<Metadata> {
  const { abbr } = await params;
  const { year } = await searchParams;
  const requested = await season(year);

  // 🔴 The event row, not `getAwardShow`. The title only needs the show's name,
  // and `getAwardShow` assembles awards, nominations, winners, points and
  // movies — which the page below is about to assemble again on the same
  // request, since nothing under `lib/services/` is wrapped in React `cache()`.
  // On the one route whose entire use is reloading during a broadcast, that is
  // five wasted round trips per reload for a string.
  const event = await eventRepository.findByAbbreviation(abbr);
  if (!event) return { title: 'Not here' };

  return {
    title: `${event.name} ${requested}, live`,
    alternates: { canonical: canonical(`/live/${abbr}`) },
  };
}

/**
 * One award show as it happens (P17.T16).
 *
 * 🔴 **Public, by the owner's ruling, which amends D40.** A stranger handed the
 * link during a ceremony has to be able to watch — that is the whole reason the
 * route exists. `proxy.ts` carries the matching entry and the reasoning; what
 * this file owes is that everything on it is right for a reader with no
 * session. The session is resolved once and the only thing it changes is which
 * invitation renders where a member's roster goes.
 *
 * 🔴 **It moves on its own now (P14.T4, D102).** The page still renders the
 * state at request time — that is the first paint, and it is the whole page for
 * a crawler and for a reader whose JavaScript never arrives — but the room
 * below the header is handed to `LiveRoom`, which replaces it from every frame
 * `/api/live/[abbr]/stream` sends. A reload is no longer what advances it.
 */
export default async function LivePage({
  params,
  searchParams,
}: {
  params: Promise<{ abbr: string }>;
  searchParams: Promise<{ year?: string; league?: string; tv?: string }>;
}) {
  const { abbr } = await params;
  const { year, league, tv } = await searchParams;
  const requested = await season(year);

  // 🔴 TV mode is chrome and nothing else (P14.T6). Everything below this line
  // is computed the same way in both modes, from the same parameters, and
  // `tvMode` reaches exactly two places: the `data-tv-mode` marker one CSS rule
  // in globals.css reads, and the label on the link that toggles it. It is
  // deliberately NOT part of `stream` below — see the note on `key` at the
  // bottom of this file, which is what keeps the connection alive across a
  // toggle.
  const tvMode = tv === '1';

  // 🔴 `getCurrentUser()`, not Clerk's `auth()`, which throws when
  // `clerkMiddleware` is absent — and under `E2E_TEST_AUTH` it is (D82/D84).
  // The same call `/films/[tmdbId]` makes, for the same reason.
  const user = await getCurrentUser();

  // 🔴 One `pinnedLeague` call, two consumers. The rule is exported from the
  // service precisely so the page and the stream cannot drift (P14.T3), and
  // calling it twice here would be the first place to.
  const pinned = pinnedLeague(league);

  let show: Awaited<ReturnType<typeof getLiveShow>>;
  try {
    show = await getLiveShow(abbr, requested, user?.id ?? null, pinned);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  // 🔴 The stream's query string mirrors this page's, resolved rather than
  // copied: `requested` is the year the page actually rendered (not the raw
  // `?year=`, which may be absent or nonsense) and `pinned` is the validated
  // pin. A stream asked for anything else is a second page disagreeing with
  // the one the reader is looking at.
  const stream = `/api/live/${encodeURIComponent(abbr)}/stream?year=${requested}${
    pinned == null ? '' : `&league=${pinned}`
  }`;

  // This page's own URL with TV mode flipped. Built from `requested` and
  // `pinned` for the same reason `stream` is: the link has to lead back to the
  // page the reader is looking at, not to whatever the raw query string said.
  const toggle = `/live/${encodeURIComponent(abbr)}?year=${requested}${
    pinned == null ? '' : `&league=${pinned}`
  }${tvMode ? '' : '&tv=1'}`;

  return (
    // 🔴 No `max-w-*`, and that is the P14 change: this page goes on a
    // television. `max-w-5xl` centred 1024px of content inside the 1664px the
    // shell leaves at 1920, so the poster rows T1 adds would have scrolled at
    // the one width the page exists for. The shell's own `p-6` is the gutter.
    // 🔴 The marker, and the whole of TV mode's effect on this tree. One
    // unlayered rule in globals.css — `body:has([data-tv-mode])
    // [data-app-chrome]` — hides the rail, the utility strip and the tab bar
    // while it is present. Nothing else on the page reads it, no client
    // component learns about it, and the React tree is otherwise identical in
    // both modes, which is what makes "it changes nothing else" a property
    // rather than a promise.
    <div className="flex flex-col gap-10" data-tv-mode={tvMode ? '' : undefined}>
      <header className="flex flex-col gap-3">
        {/* 🔴 `Panel`, not `CinemaFrame`, and the plan asked for this to be
            measured rather than assumed. `CinemaFrame` is `aspect-ratio:
            2.39/1` with `overflow-hidden`, which is right for the film page's
            backdrop — an image that fills it. This header is a 96px mark and a
            heading, and measured in a production build the box came out
            **1024 × 428 holding 53px of content at 1440px: 376px of empty
            frame** pushing the countdown and the first category below the
            fold. At 390px it is 358 × 150 holding 117px, so a show whose name
            runs to a fourth line clips inside `overflow-hidden` with no
            warning. The surface table is guidance; a 376px void and a
            clipping ceiling are not what it was guiding towards. */}
        <Panel as="div" className="flex items-start gap-4 p-4">
          <ShowLogo imageUrl={show.imageUrl} size="lg" />
          <SectionHead
            as="h1"
            name
            eyebrow={show.abbreviation}
            right={String(show.year)}
            className="pb-0"
          >
            {show.name}
          </SectionHead>
        </Panel>

        <div className="flex flex-wrap items-center gap-3">
          {/* 🔴 Carmine, not brass. What brass means is being decided in
              P17.T35 and is not free to take a new one here; carmine is
              urgency, which a broadcast in progress is.

              (The plan says brass already means "drafted" in 320 places on the
              draft board. It does not — the PROGRESS note of 2026-09-12 has
              since measured 11 source instances, none of them on the board.
              The conclusion holds for the other reason: T35 has not ruled.) */}
          {show.onAir ? <StatusChip tone="carmine">Live</StatusChip> : null}
          <LiveCountdown startsAt={show.startsAt} day={show.startsOn} />
          {/* 🔴 In the header, which TV mode keeps — not in the chrome it
              hides. A control that goes away with the thing it turned on
              leaves the reader with no way back but the address bar, and the
              reader is holding a remote. */}
          <TvModeLink href={toggle} active={tvMode} />
        </div>
      </header>

      {/* 🔴 The room is a client component and the header above it is not,
          and that split is the whole of P14.T4. What moves during a ceremony
          is the categories, the standings, the resolved counter and the league
          total — everything below — so that is what `LiveRoom` holds and
          replaces from each frame. The header is a logo, a name and a date;
          re-rendering it on every frame would buy nothing and give a screen
          reader more to re-read.

          🔴 It is still server-rendered. `LiveRoom` is rendered to HTML on
          this request like anything else here, from the same `show` — the
          stranger, the crawler and the reader whose JavaScript never arrives
          get the whole room. The `EventSource` only stops it being a snapshot.

          🔴 `key={stream}` because `?league=` is a `Link` away. A same-route
          navigation reconciles rather than remounts, so `useState(initial)`
          would keep showing the league the reader just navigated away from
          until a frame happened to arrive. Keying on the stream URL — which
          carries both parameters — makes a parameter change a fresh mount with
          the fresh server view. */}
      <LiveRoom
        key={stream}
        initial={show}
        streamUrl={stream}
        abbr={abbr}
        year={requested}
        // 🔴 The one thing below the header that has to know, and it is a link
        // target rather than behaviour: the league picker's hrefs point back at
        // this page, and without this they point at it with the television
        // turned off. Not part of `key` above, so a toggle still reconciles.
        tvMode={tvMode}
        signedIn={user != null}
      />
    </div>
  );
}

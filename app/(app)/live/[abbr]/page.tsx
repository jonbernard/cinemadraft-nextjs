import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { EmptyState } from '@/components/EmptyState';
import { LiveAward } from '@/components/LiveAward';
import { LiveBoard } from '@/components/LiveBoard';
import { LiveCountdown } from '@/components/LiveCountdown';
import { Panel } from '@/components/Panel';
import { SectionHead } from '@/components/SectionHead';
import { ShowLogo } from '@/components/ShowLogo';
import { StatusChip } from '@/components/StatusChip';
import { getCurrentUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import { eventRepository } from '@/lib/repositories/events';
import { canonical } from '@/lib/seo';
import { getLiveShow } from '@/lib/services/live';
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
 * 🔴 **No transport (D23 stays deferred).** This does not close P14.T0–T3: the
 * page renders the state at request time and a reload is what advances it.
 */
export default async function LivePage({
  params,
  searchParams,
}: {
  params: Promise<{ abbr: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { abbr } = await params;
  const { year } = await searchParams;
  const requested = await season(year);

  // 🔴 `getCurrentUser()`, not Clerk's `auth()`, which throws when
  // `clerkMiddleware` is absent — and under `E2E_TEST_AUTH` it is (D82/D84).
  // The same call `/films/[tmdbId]` makes, for the same reason.
  const user = await getCurrentUser();

  let show: Awaited<ReturnType<typeof getLiveShow>>;
  try {
    show = await getLiveShow(abbr, requested, user?.id ?? null);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    // 🔴 No `max-w-*`, and that is the P14 change: this page goes on a
    // television. `max-w-5xl` centred 1024px of content inside the 1664px the
    // shell leaves at 1920, so the poster rows T1 adds would have scrolled at
    // the one width the page exists for. The shell's own `p-6` is the gutter.
    <div className="flex flex-col gap-10">
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
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <SectionHead as="h2" right={`${show.resolved} of ${show.total}`} className="pb-0">
          Categories
        </SectionHead>

        {show.total === 0 ? (
          <EmptyState title="No categories yet">
            Nothing has been entered for this show and season.
          </EmptyState>
        ) : (
          <ol className="flex flex-col gap-6">
            {show.categories.map((category) => (
              <li key={category.awardId}>
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
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 🔴 Two empty states, not one, because the page is public (P17.T16,
          amending D40). A signed-out reader must never be offered "Find a
          league": `/leagues` is protected, so that link is a login page
          wearing a league's name. They get the same invitation `/` gives a
          stranger, in the same words, for the same reason (D44).

          🔴 `show.leagues` is `[]` for a signed-out reader **by construction**
          — the service does not query leagues when `userId` is null — so the
          first branch can never render for a stranger even if the `user ==
          null` check were removed. Two locks, the same shape as `/`'s. */}
      {show.leagues.length > 0 ? (
        // 🔴 The `h2` is not decoration. Measured in a production build, the
        // outline without it ran h1 → h2 Categories → h3 ×6 → h3 league, so the
        // league read as a seventh category to anything following the heading
        // structure. It also gives the board the label it otherwise lacked:
        // `LiveBoard` opens on a league's name, which does not say what it is.
        <section className="flex flex-col gap-4">
          <SectionHead as="h2">Your seats</SectionHead>
          <LiveBoard leagues={show.leagues} />
        </section>
      ) : user == null ? (
        <EmptyState
          title="Play the season"
          action={{ label: 'Register', href: '/auth/register' }}
        >
          Draft a team of films before awards season and score points as they pick up
          nominations and wins. Played before? Register with the same email and your
          leagues, drafts and points come with you.
        </EmptyState>
      ) : (
        <EmptyState
          title="No league yet"
          action={{ label: 'Find a league', href: '/leagues' }}
        >
          Join a league to draft a team and watch it score as this show resolves.
        </EmptyState>
      )}
    </div>
  );
}

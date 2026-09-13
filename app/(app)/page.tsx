import Link from 'next/link';
import { LiveBanner } from '@/components/awards/LiveBanner';
import { LeaderboardTable } from '@/components/leagues/LeaderboardTable';
import { RosterStrip } from '@/components/leagues/RosterStrip';
import { SeasonStepper } from '@/components/leagues/SeasonStepper';
import { StandingsPanel } from '@/components/leagues/StandingsPanel';
import { SeasonPicker } from '@/components/shell/SeasonPicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { PosterFrame } from '@/components/ui/PosterFrame';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { SectionHead } from '@/components/ui/SectionHead';
import { Shelf } from '@/components/ui/Shelf';
import { getCurrentUser } from '@/lib/auth';
import { PITCH, PITCH_HEADLINE } from '@/lib/copy';
import { recentPicks, type ShelfView, topScorers } from '@/lib/dashboard/shelves';
import { type DashboardView, getDashboard } from '@/lib/services/dashboard';
import { getLandingFacts, type LandingFacts } from '@/lib/services/how-it-works';
import { availableSeasons, getLeaderboard } from '@/lib/services/leaderboard';
import { cn } from '@/lib/utils/cn';

/**
 * Posters in the hero's wall, and the number `getLandingFacts` is asked for.
 *
 * Ten, because the wall is a 1|2|3|4 staircase — one poster in the first
 * column, four in the last. A season with fewer scoring films shortens the
 * stair; it never leaves a hole.
 */
const WALL = 10;

/**
 * The dashboard, with a public variant (D44).
 *
 * Replaces a welcome card that told members their own name with the three
 * things they actually open the site to learn: where they stand, what their
 * films have scored, and which show is next.
 *
 * Signed out, it opens on a hero — the claim, the season's own poster wall
 * and the way in (P18.T10) — and then it is the season itself, the rail of
 * award shows directly beneath. That is deliberate and matches the source app,
 * where `/` was never guarded: an awards league is worth looking at before you
 * have an account, and a login wall on the front page is the worst possible
 * first impression during awards season.
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
 * second `<main>`, or a repeat of `bg-bg-ground`, would fight the panel it is
 * sitting inside.
 */
export default async function DashboardPage({ searchParams }: PageProps<'/'>) {
  const { year: yearParam } = await searchParams;

  const [user, seasons] = await Promise.all([getCurrentUser(), availableSeasons()]);
  const year = toYear(typeof yearParam === 'string' ? yearParam : undefined, seasons);

  const [view, leaderboard, facts] = await Promise.all([
    getDashboard(user?.id ?? null),
    getLeaderboard(year),
    // 🔴 Signed in this is a plain `null`, not a query: a member has already
    // been persuaded, and the hero that needs these facts does not render for
    // them. `Promise.all` takes the value as-is, so the signed-in page issues
    // exactly the queries it issued before this task.
    user == null ? getLandingFacts(WALL) : null,
  ]);

  // `view.events` is one entry per show *phase* (D81), so the eyebrow counts
  // shows through their ids and calls a show complete once its ceremony has
  // passed — otherwise a season would report twice as many "shows" as it has.
  const shows = new Set(view.events.map((phase) => phase.eventId)).size;
  const complete = view.events.filter(
    (phase) => phase.phase === 'ceremony' && phase.complete,
  ).length;

  return (
    <div className="text-text-primary mx-auto flex max-w-6xl flex-col gap-16 my-16">
      {/* 🔴 First, above the hero and above the season, and for a signed-out
          reader as well: `/` is public (D44) and so is `/live/[abbr]`
          (P17.T16), and this was the one page in the product that said nothing
          while a ceremony was on air (P10.T3). The container's own `gap-16`
          spaces it; no margin of its own. */}
      {view.liveNow ? (
        <LiveBanner
          abbreviation={view.liveNow.abbreviation}
          name={view.liveNow.name}
          year={view.liveNow.year}
        />
      ) : null}

      {/* The hero, and only for a stranger: it is the whole pitch, above the
          season it is arguing about (P18.T10). */}
      {user == null ? <SignedOutHero facts={facts} /> : null}

      {/* 🔴 Signed in, the reader's own state comes first (P17.T29). Before
          this, a member with two leagues opened `/` to the same two screens a
          stranger sees — the season stepper, the shelf and the full season
          leaderboard — with their own league name, standing and roster fourth,
          1,499px down at 1440px. The season rail and the shelf are supporting
          material on a member's home page, not the page itself.

          Signed out the season still leads the page's own content, under the
          hero and nothing else, which is deliberate and matches the source app
          (D44). */}
      {user != null ? <YourLeagues leagues={view.leagues} /> : null}

      <section className="flex flex-col gap-4">
        <SectionHead
          // 🔴 Signed out the hero above owns the `h1`, so this is the second
          // heading and must say so — two `h1`s, or a jump to `h2` with no
          // `h1` before it, are both broken outlines and both are asserted
          // against in `e2e/dashboard.spec.ts`. Signed in there is no hero and
          // the season is still the page's own subject, unchanged (P17.T29).
          as={user == null ? 'h2' : 'h1'}
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
        <SeasonStepper phases={view.events} />
      </section>

      <NowPlayingShelf films={view.nowPlaying} />

      <section className="flex flex-col gap-4">
        <SectionHead
          as="h2"
          eyebrow="By award show"
          rightStacksOnMobile
          // 🔴 A picker, not a flat row (P17.T4). Ten seasons was ten links
          // measured at 33.6 × 20px, wrapping across this slot. The
          // `seasons.length > 1` guard moved into the component rather than
          // living in both places.
          right={<SeasonPicker year={year} seasons={seasons} />}
        >
          Season leaderboard
        </SectionHead>

        <LeaderboardTable leaderboard={leaderboard} />
      </section>

      {user != null ? <LowerFold leagues={view.leagues} /> : null}
    </div>
  );
}

/**
 * The leaderboard's own year, from `?year=` (D65).
 *
 * 🔴 `?year=abc` and `?year=-4` both arrive here, the same way `/browse`
 * validates `?page=`. Falls back to the newest season on anything that is not
 * one of the seasons `availableYearRepository` actually reports, rather than
 * merely "a positive integer" — an unknown year would otherwise render an
 * honestly-empty grid that looks like a bug rather than a bad link.
 */
function toYear(raw: string | undefined, seasons: readonly number[]): number {
  const parsed = Number(raw);
  if (Number.isSafeInteger(parsed) && seasons.includes(parsed)) return parsed;
  return seasons[0] ?? new Date().getUTCFullYear();
}

/**
 * The signed-out hero (P18.T10).
 *
 * Replaces two half-heroes: a one-line lede under the season heading, and an
 * `EmptyState` at the foot of the page repeating it 2,000px later. A stranger
 * read the same argument twice and met the season rail in between with nothing
 * to frame it.
 *
 * 🔴 **The claim is not written here.** `PITCH_HEADLINE` and `PITCH` are
 * `lib/copy.ts`'s, shared with `/how-it-works`, because two surfaces arguing
 * the same thing in two files is two things to edit and one of them will be
 * missed. The Razzie clause rides in `PITCH` for the same reason it does
 * there — it is the inversion that makes the game funny, and it belongs above
 * the fold.
 *
 * 🔴 The returning member's reassurance sits beside the action, not in a
 * footer. It is the only sentence the deleted block carried that the lede did
 * not, and it answers a question somebody asks *while deciding*, which is here.
 *
 * The season rail follows this section directly: a live season is the
 * product's own evidence (D44), and the hero is sized so it is still on the
 * fold at 1440×900.
 */
function SignedOutHero({ facts }: { facts: LandingFacts | null }) {
  return (
    <section
      data-testid="signed-out-hero"
      className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <h1 className="text-text-primary max-w-[18ch] font-sans text-display font-semibold">
          {PITCH_HEADLINE}
        </h1>
        <p className="text-text-secondary max-w-prose text-sm leading-relaxed">{PITCH}</p>

        <div className="flex flex-col items-start gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* The same two lockups the rest of the app uses for a primary act
                and a quiet one: `accent.fill` with white on it, and an
                underlined link. Not a second button pattern. */}
            <Link
              href="/auth/register"
              className="bg-accent-fill focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm px-5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Start a league
            </Link>
            <Link
              href="/how-it-works"
              className="text-text-secondary hover:text-text-primary focus-visible:outline-accent-fill flex min-h-11 items-center px-1 text-sm underline underline-offset-4 focus-visible:outline-2"
            >
              How it works
            </Link>
          </div>
          <p className="text-text-dim max-w-prose text-xs">
            Played before? Register with the same email and your leagues, drafts and
            points come with you.
          </p>
        </div>
      </div>

      {facts && facts.films.length > 0 ? (
        /* A wall of the season's real posters, not an illustration: these are
            the highest scorers of the season being shown, in order, so the
            hero is a picture of the game actually being played and every title
            in it is one somebody drafted.

            🔴 Decorative, and that is a decision rather than laziness. As links
            these are eight tab stops between the headline and "Start a league"
            — the action this page exists for.

            🔴 It is no longer `aria-hidden`: the owner asked for the names and
            the scores back, and a caption that says "One Battle After Another,
            620" is **content**, not decoration. Hiding content from assistive
            technology to keep a tab order tidy is the wrong trade — so the
            posters carry their titles and totals, and there are still no
            links in here, which is what kept the tab stops out in the first
            place.

            Ten posters as a 1|2|3|4 staircase, bottom-aligned: the shape the
            owner asked for, and it stays short enough that the season rail is
            on the fold at 1440×900. */
        <div
          data-testid="hero-films"
          className="flex h-56 w-full shrink-0 items-stretch gap-2 sm:h-72 sm:gap-3 lg:h-[26rem] lg:w-[34rem]"
        >
          {/* A cascade of artwork: one large poster, then columns holding more
              of them and growing narrower to the right.

              🔴 **The wall owns the height and the columns fill it**, which is
              what makes every top and every bottom line up. Left to their own
              sizes the columns end level only by accident — a column of `n`
              posters is `n × 1.5 × width` tall plus its gaps, so any width
              that is not exactly the lead's over `n` leaves one column poking
              out, which is what the owner saw. Fixing the height and letting
              each poster take an equal share of it removes the arithmetic
              entirely. The widths stay near 12 / 6 / 4 / 3 so the frames stay
              close to a poster's own 2:3 and `object-cover` absorbs the rest.

              🔴 **No captions at all**, by the owner's call. A title under an
              81px column truncated, and captions are also what broke the
              alignment above by adding a line to some columns and not others.
              Every film is still announced to a screen reader — drawn for
              nobody, available to anybody who needs it. */}
          {(
            [
              [0, 1, 'flex-[12]'],
              [1, 3, 'flex-[6]'],
              [3, 6, 'flex-[4]'],
              [6, 10, 'flex-[3]'],
            ] as const
          ).map(([from, to, width], column) => (
            <div key={from} className={cn('flex min-w-0 flex-col gap-2 sm:gap-3', width)}>
              {facts.films.slice(from, to).map((film, index) => (
                <figure
                  key={film.movieId}
                  className="poster-radius bg-bg-surface relative min-h-0 flex-1 overflow-hidden"
                >
                  {film.posterUrl ? (
                    <RemoteImage
                      src={film.posterUrl}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 22rem, 50vw"
                      className="object-cover"
                      // One preload, and it is the big one: the leading poster
                      // is the largest thing in the first viewport.
                      priority={column === 0 && index === 0}
                    />
                  ) : null}
                  <figcaption className="sr-only">
                    {film.title}, {film.total} points
                  </figcaption>
                </figure>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/**
 * "Films in cinemas now" (P10.T2), or nothing at all.
 *
 * Nothing rather than an empty frame: TMDB may be unconfigured in a preview
 * deploy, or the request may have failed, and `getNowPlaying` already
 * absorbed both into an empty list — the dashboard is a signed-out visitor's
 * first page, and it must not degrade into a broken panel over a missing env
 * var.
 */
function NowPlayingShelf({ films }: { films: DashboardView['nowPlaying'] }) {
  if (films.length === 0) return null;

  return (
    <Shelf heading="In cinemas now">
      {films.map((film, index) => (
        <li key={film.tmdbId} className="w-40">
          <Link
            href={`/films/${film.tmdbId}`}
            className="focus-visible:outline-accent-fill block focus-visible:outline-2"
          >
            {/* 🔴 Two, not twelve. Measured in a production build: this shelf's
                first frame is the dashboard's LCP element at all four widths in
                both schemes, and every TMDB request went out at `Low` because
                `next/image` defaults to `loading="lazy"`. But `priority` is a
                preload link per image — marking the whole shelf would put
                twelve of them in contention and make the metric worse. Two is
                what sits above the fold at 1440px before the shelf scrolls,
                and at 390px the shelf shows two as well. */}
            <PosterFrame
              title={film.title}
              posterUrl={film.posterUrl}
              priority={index < 2}
            />
          </Link>
        </li>
      ))}
    </Shelf>
  );
}

/**
 * The signed-in member's own state, at the top of their home page (P17.T29).
 *
 * 🔴 League names are `h2`, and the page's `h1` stays the season — tranche 1's
 * T1 owns the heading sizes and order on this page, so this must not introduce
 * a second `h1`. The consequence is that, signed in, the outline now opens on
 * an `h2` rather than the `h1`; the signed-out outline is untouched.
 *
 * 🔴 The "next action" is deliberately the league itself, not a state-specific
 * act. "Run the draft" here would need `draftingStatus`, which `LeagueView`
 * does not carry, and adding it means editing the dashboard service for one
 * link — while `/leagues/{id}` already carries the state-specific controls as
 * of P17.T30. The one exception is a member with no roster yet, for whom the
 * available act is the draft list, and that is derivable from `roster.length`
 * alone. That is a ceiling, not an oversight.
 */
function YourLeagues({ leagues }: { leagues: DashboardView['leagues'] }) {
  if (leagues.length === 0) {
    return (
      <EmptyState
        title="No leagues yet"
        action={{ label: 'Find a league', href: '/leagues' }}
      >
        Join a league to draft a team of films and play the season.
      </EmptyState>
    );
  }

  return (
    <>
      {leagues.map((league) => (
        <section key={league.id} className="flex flex-col gap-4">
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

          {/* The same two lockups as the league page's own actions (P17.T30):
              `accent.fill` with white for the act the state calls for, a
              ruled secondary for the rest. Links, because both navigate. */}
          <div className="flex flex-wrap items-center gap-3">
            {league.roster.length === 0 ? (
              <Link
                href="/list"
                className="bg-accent-fill focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Build your draft list
              </Link>
            ) : null}
            <Link
              href={`/leagues/${league.id}`}
              className="border-border-rule text-text-primary hover:bg-bg-surface focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm border px-4 text-sm focus-visible:outline-2"
            >
              Open the league
            </Link>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
            <div className="min-w-0 flex-1">
              {league.roster.length === 0 ? (
                <EmptyState title="Draft not started">
                  You have not drafted for this season yet. Your roster appears here once
                  the draft opens.
                </EmptyState>
              ) : (
                <RosterStrip
                  films={league.roster.map((entry) => ({
                    id: entry.movie.id,
                    title: entry.movie.title ?? 'Untitled',
                    posterUrl: entry.posterUrl,
                    round: entry.round,
                    points: entry.points,
                    share: entry.share,
                    status: entry.status,
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
    </>
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
 * Two shelves, both a different cut of the same rosters rather than a second
 * copy of them: the strips above are ordered by draft round and must stay that
 * way, so neither "what did I take most recently" nor "what is carrying my
 * team" is answered anywhere else in the product.
 *
 * "Upcoming deadlines" and "the leagues you are in" were the plan's other two
 * candidates and are deliberately absent: `SeasonStepper` at the top of this page
 * already renders every show date-sorted with a countdown on the next one, and
 * every league is rendered above in full. A shelf of either would be the same
 * content twice.
 *
 * The ranking lives in `lib/dashboard/shelves.ts` and is unit-tested there;
 * this decides only what the shelves are called and what they say.
 */
function LowerFold({ leagues }: { leagues: DashboardView['leagues'] }) {
  const recent = recentPicks(leagues);
  const best = topScorers(leagues);

  return (
    <>
      <FilmShelf
        heading="Recent picks"
        eyebrow={`${recent.held} ${recent.held === 1 ? 'film' : 'films'} drafted`}
        shelf={recent}
      />
      <FilmShelf
        heading="Top scorers"
        // Both numbers, not just the shelf's: how much of the team is working
        // is the point, and the twelve-frame cap would understate it.
        eyebrow={`${best.matching} of ${best.held} films scoring`}
        shelf={best}
      />
    </>
  );
}

/**
 * One shelf of posters, or nothing.
 *
 * Nothing is the right answer more often than it looks: `topScorers` is empty
 * until something has been awarded, and a row of zeroes on opening day is
 * worse than the space it fills.
 *
 * 🔴 The frames are 10rem wide, matching `RosterStrip`'s measured grid floor.
 * That measurement is in its docstring and it is not arbitrary: at ~130px a
 * 24-character title in a two-line clamp clips — "One Battle After Another"
 * cut off, the exact defect this redesign exists to fix. A `Shelf` scrolls, so
 * a wider frame costs scroll length and nothing else.
 */
function FilmShelf({
  heading,
  eyebrow,
  shelf,
}: {
  heading: string;
  eyebrow: string;
  shelf: ShelfView;
}) {
  if (shelf.films.length === 0) return null;

  return (
    <Shelf eyebrow={eyebrow} heading={heading}>
      {shelf.films.map((film) => (
        <li key={film.id} className="w-40">
          <PosterFrame
            title={film.title}
            posterUrl={film.posterUrl}
            points={film.points}
            share={film.share}
            status={film.status}
            // No draft round: a film held in two leagues has two of them, and
            // printing whichever survived the dedupe would be wrong half the
            // time. The strips above are where round belongs.
          />
        </li>
      ))}
    </Shelf>
  );
}

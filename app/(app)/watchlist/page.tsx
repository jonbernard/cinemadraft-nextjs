import type { Metadata } from 'next';
import Link from 'next/link';

import { setWatched } from '@/actions/watchlist/set-watched';
import { SeenMeter } from '@/components/films/SeenMeter';
import { WatchedToggle } from '@/components/films/WatchedToggle';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Panel } from '@/components/ui/Panel';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { SectionHead } from '@/components/ui/SectionHead';
import { StatusChip } from '@/components/ui/StatusChip';
import { requirePageUser } from '@/lib/auth';
import { NOINDEX } from '@/lib/seo';
import { getActiveYear } from '@/lib/services/season';
import {
  type LeagueProgress,
  loadDraftedProgress,
  loadNominatedProgress,
  loadShowProgress,
  loadWatchedFilms,
  type NominatedProgress,
  type ShowProgress,
  type SortDirection,
  type WatchedPage,
  type WatchlistFilm,
  type WatchlistSort,
} from '@/lib/services/watchlist';
import { cn } from '@/lib/utils/cn';
import { formatReleaseDate } from '@/lib/utils/format';

/**
 * The watchlist (P10.T33, T35, T36, T37).
 *
 * 🔴 **These are the films you have watched** (D64), not a queue of what you
 * mean to watch — the source's own button says "Mark as watched" and offers a
 * review next. So the three progress views are all one question asked three
 * ways: how much of the season have you actually seen.
 *
 * 🔴 **The tab is in the URL** (R11). The source held it in `useState`
 * (`src/pages/watchlist/index.js:25`), so no watchlist tab could be linked,
 * bookmarked or reached with Back. One route with `?view=` keeps the single
 * `revalidatePath('/watchlist')` that `actions/watchlist/set-watched.ts`
 * already calls; four sibling routes would each need their own.
 *
 * Private: a signed-out visitor has no watchlist to show, so it is not in
 * `proxy.ts` (D44).
 */

export const metadata: Metadata = {
  // One member's private page. Public routes are the proxy's call (D44); this
  // only keeps the page out of search results.
  robots: NOINDEX,
  title: 'Watchlist',
  description: 'The films you have seen, and how much of the season is left.',
};

const VIEWS = [
  { value: 'films', label: 'Watched' },
  { value: 'awards', label: 'By show' },
  { value: 'nominations', label: 'Most nominated' },
  { value: 'drafted', label: 'Drafted' },
] as const;

type View = (typeof VIEWS)[number]['value'];

/** An unknown tab falls back to the list rather than 404ing (R11). */
function toView(raw: string | undefined): View {
  return VIEWS.some((view) => view.value === raw) ? (raw as View) : 'films';
}

function toPage(raw: string | undefined): number {
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function toSort(raw: string | undefined): WatchlistSort {
  return raw === 'release' ? 'release' : 'marked';
}

function toDirection(raw: string | undefined, sort: WatchlistSort): SortDirection {
  if (raw === 'asc' || raw === 'desc') return raw;
  // Newest first for when you marked it; oldest first for release order, which
  // is how the source's own captured page was sorted.
  return sort === 'marked' ? 'desc' : 'asc';
}

const searchParam = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : undefined;

export default async function WatchlistPage({ searchParams }: PageProps<'/watchlist'>) {
  const params = await searchParams;
  const view = toView(searchParam(params.view));
  const sort = toSort(searchParam(params.sort));
  const direction = toDirection(searchParam(params.dir), sort);
  const page = toPage(searchParam(params.page));

  const user = await requirePageUser();
  const year = await getActiveYear();

  const watched =
    view === 'films'
      ? await loadWatchedFilms({
          userId: user.id,
          page,
          sortBy: sort,
          direction,
        })
      : null;
  const shows = view === 'awards' ? await loadShowProgress(user.id, year) : null;
  const nominated =
    view === 'nominations' ? await loadNominatedProgress(user.id, year) : null;
  const drafted = view === 'drafted' ? await loadDraftedProgress(user.id, year) : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
      <header className="flex flex-col gap-4">
        <SectionHead
          as="h1"
          eyebrow={`${year} season · films you have watched`}
          right={watched && watched.count > 0 ? String(watched.count) : undefined}
        >
          Watchlist
        </SectionHead>

        <nav aria-label="Watchlist views" className="flex flex-wrap items-center gap-2">
          {VIEWS.map((entry) => (
            <ViewLink
              key={entry.value}
              view={entry.value}
              current={view}
              label={entry.label}
            />
          ))}
        </nav>
      </header>

      {watched ? <WatchedFilms page={watched} sort={sort} direction={direction} /> : null}
      {shows ? <Shows shows={shows} year={year} /> : null}
      {nominated ? <MostNominated progress={nominated} year={year} /> : null}
      {drafted ? <Drafted leagues={drafted} year={year} /> : null}
    </div>
  );
}

function ViewLink({
  view,
  current,
  label,
}: {
  view: View;
  current: View;
  label: string;
}) {
  const isCurrent = view === current;

  return (
    <Link
      href={`/watchlist?view=${view}`}
      aria-current={isCurrent ? 'page' : undefined}
      className="rounded-pill focus-visible:outline-accent-fill group flex min-h-11 items-center focus-visible:outline-2"
    >
      <StatusChip
        tone={isCurrent ? 'carmine' : 'neutral'}
        className={cn('px-4 py-2 text-sm', !isCurrent && 'group-hover:text-text-primary')}
      >
        {label}
      </StatusChip>
    </Link>
  );
}

function WatchedFilms({
  page,
  sort,
  direction,
}: {
  page: WatchedPage;
  sort: WatchlistSort;
  direction: SortDirection;
}) {
  if (page.count === 0) {
    return (
      <EmptyState
        title="You have not marked anything yet"
        action={{ label: 'Browse films', href: '/browse' }}
      >
        Mark a film watched from browse or from its own page, and it lands here.
      </EmptyState>
    );
  }

  if (page.films.length === 0) {
    return (
      <EmptyState
        title="That page is past the end of your list"
        action={{ label: 'Back to the first page', href: '/watchlist?view=films' }}
      >
        You have {page.count} films marked, across {page.pageCount} pages.
      </EmptyState>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <nav aria-label="Sort" className="flex flex-wrap items-center gap-2">
        <SortLink sort="marked" current={sort} direction={direction} label="Marked" />
        <SortLink sort="release" current={sort} direction={direction} label="Released" />
      </nav>

      <Panel className="p-2 sm:p-4">
        <ul className="flex flex-col">
          {page.films.map((film) => (
            <li
              key={film.entryId}
              className="border-border-rule flex items-center gap-4 border-b py-3 last:border-b-0"
            >
              {film.posterUrl ? (
                <RemoteImage
                  src={film.posterUrl}
                  alt=""
                  width={44}
                  height={64}
                  className="poster-radius bg-bg-surface light:border light:border-border-rule h-16 w-11 shrink-0 object-cover"
                  loading="lazy"
                />
              ) : (
                // A src-less <img> draws the browser's broken-image glyph, which
                // reads as a failure rather than as a film with no artwork.
                <div className="poster-radius bg-bg-surface h-16 w-11 shrink-0" />
              )}

              <div className="min-w-0 flex-1">
                <FilmTitle film={film} />
                <p className="text-text-dim mt-1 text-xs">
                  {formatReleaseDate(film.releaseDate) ?? 'Release date unknown'}
                  {film.markedAt ? ` · marked ${formatReleaseDate(film.markedAt)}` : null}
                </p>
              </div>

              {film.tmdbId ? (
                <WatchedToggle
                  tmdbId={film.tmdbId}
                  title={film.title}
                  watched
                  onChange={setWatched}
                  hint="label"
                />
              ) : null}
            </li>
          ))}
        </ul>
      </Panel>

      <Pagination
        page={page.page}
        pageCount={page.pageCount}
        basePath="/watchlist"
        params={{ view: 'films', sort, dir: direction }}
        label="Watched films"
      />
    </section>
  );
}

/**
 * One sort, which flips direction when it is already the one in use.
 *
 * The direction is spelled out in the accessible name rather than left to the
 * arrow: an arrow beside "Released" tells a sighted reader which way the list
 * runs and tells a screen reader nothing.
 */
function SortLink({
  sort,
  current,
  direction,
  label,
}: {
  sort: WatchlistSort;
  current: WatchlistSort;
  direction: SortDirection;
  label: string;
}) {
  const isCurrent = sort === current;
  const next: SortDirection = isCurrent && direction === 'desc' ? 'asc' : 'desc';
  const spoken = next === 'asc' ? 'oldest first' : 'newest first';

  return (
    <Link
      href={`/watchlist?view=films&sort=${sort}&dir=${next}`}
      aria-current={isCurrent ? 'page' : undefined}
      aria-label={`${label}, ${spoken}`}
      className="text-text-secondary hover:text-text-primary focus-visible:outline-accent-fill flex min-h-11 items-center gap-2 rounded-sm px-3 text-sm focus-visible:outline-2 aria-[current]:text-text-primary aria-[current]:font-semibold"
    >
      {label}
      {isCurrent ? (
        <span aria-hidden="true" className="text-text-dim text-xs">
          {direction === 'asc' ? '↑' : '↓'}
        </span>
      ) : null}
    </Link>
  );
}

function Shows({ shows, year }: { shows: ShowProgress[]; year: number }) {
  if (shows.length === 0) {
    return (
      <EmptyState title="Nothing is nominated yet">
        Once the {year} nominations are in, this is how much of each show you have seen.
      </EmptyState>
    );
  }

  return (
    // 🔴 Two columns from `lg` up, not `sm` (D49). The container is `max-w-4xl`,
    // so `sm` would give each show ~300px and the summary — a serif show name
    // plus two meters — already wraps to three lines at that width. At `lg` the
    // column is ~430px and it wraps to two, which is what it does today.
    //
    // 🔴 `items-start`, and that is the whole answer to the height-shift
    // question. A grid row is as tall as its tallest cell and a stretched
    // `<details>` would grow its neighbour's panel to match when it opens —
    // the neighbour visibly inflating around unchanged content. `items-start`
    // lets each panel keep its own height, so opening one moves only the rows
    // below it, which is what a single column already did. `columns-2` was the
    // other candidate and is worse: CSS multi-column reflows its items between
    // columns as one grows, so opening a show makes *other* shows jump from
    // one column to the other.
    <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
      {shows.map((show) => (
        // A native <details>: it opens with a keyboard, before hydration, and
        // without a line of JavaScript. Closed by default because the summary
        // already carries the answer — twelve shows expanded is 529 nominees.
        <Panel key={show.show} as="details" className="p-4">
          <summary className="focus-visible:outline-accent-fill flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-3 focus-visible:outline-2">
            <h2 className="text-text-primary font-serif text-xl tracking-[-0.02em]">
              {show.show}
            </h2>
            <div className="flex flex-wrap items-center gap-4">
              <SeenMeter seen={show.seenFilms} total={show.films} />
              <SeenMeter
                seen={show.seenNominations}
                total={show.nominations}
                unit="nominations"
              />
            </div>
          </summary>

          <div className="mt-4 flex flex-col gap-5">
            {show.awards.map((award) => (
              <section key={award.award}>
                <SectionHead as="h3">{award.award}</SectionHead>
                <ul className="flex flex-col gap-1">
                  {award.nominees.map((nominee) => (
                    <li
                      key={nominee.nominationId}
                      className="flex items-center justify-between gap-3"
                    >
                      <FilmTitle film={nominee} />
                      <NomineeToggle film={nominee} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}

function MostNominated({
  progress,
  year,
}: {
  progress: NominatedProgress;
  year: number;
}) {
  if (progress.total === 0) {
    return (
      <EmptyState title="Nothing is nominated yet">
        The {year} nominations have not been recorded.
      </EmptyState>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <SeenMeter seen={progress.seen} total={progress.total} />

      <Panel className="p-2 sm:p-4">
        <ul className="flex flex-col">
          {progress.films.map((film) => (
            <li
              key={film.movieId}
              className="border-border-rule flex items-center gap-3 border-b py-3 last:border-b-0"
            >
              <span className="tabular text-text-dim w-8 shrink-0 font-mono text-sm">
                {film.nominations}
                <span className="sr-only"> nominations</span>
              </span>
              <span className="min-w-0 flex-1">
                <FilmTitle film={film} />
              </span>
              <NomineeToggle film={film} />
            </li>
          ))}
        </ul>
      </Panel>
    </section>
  );
}

function Drafted({ leagues, year }: { leagues: LeagueProgress[]; year: number }) {
  if (leagues.length === 0) {
    return (
      <EmptyState
        title="No league of yours has drafted this season"
        action={{ label: 'Your leagues', href: '/leagues' }}
      >
        Once a league you are in drafts its {year} films, this is how much of its board
        you have seen.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {leagues.map((league) => (
        <Panel key={league.leagueId} className="p-4">
          <SectionHead as="h2" name>
            {league.league}
          </SectionHead>
          <SeenMeter seen={league.seen} total={league.total} className="mb-3" />

          <ul className="flex flex-col gap-1">
            {league.films.map((film) => (
              <li
                key={film.movieId}
                className="flex items-center justify-between gap-3 py-1"
              >
                <FilmTitle film={film} />
                <NomineeToggle film={film} />
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}

function FilmTitle({ film }: { film: Pick<WatchlistFilm, 'title' | 'tmdbId'> }) {
  if (!film.tmdbId) {
    return <span className="text-text-primary font-serif text-base">{film.title}</span>;
  }

  return (
    <Link
      href={`/films/${film.tmdbId}`}
      className="text-text-primary hover:text-accent-text focus-visible:outline-accent-fill font-serif text-base focus-visible:outline-2"
    >
      {film.title}
    </Link>
  );
}

/**
 * The one control the three progress views were missing.
 *
 * 🔴 **It replaces `SeenChip`, which rendered *nothing* when the film was
 * unwatched** — so the row a reader most wanted to act on was the one row with
 * no affordance at all, and the only way to mark a nominee seen was to go and
 * find it on /browse. Membership of the watchlist *is* the record of having
 * seen a film (D64), so the chip and the control are the same fact and there is
 * no reason for the page to show one without the other.
 *
 * The words carry it rather than a tooltip: "Watched" is what the chip already
 * said, and 526 nominees is not a page to hang 526 MUI poppers off.
 *
 * A film nominated in four categories renders four of these, which is correct —
 * they are four separate rows a reader can act on — and they converge because
 * the action states an end state and `revalidatePath` re-renders all of them.
 * It does mean `data-testid` is not unique on this page; the e2e locators for
 * it take `.first()`.
 */
function NomineeToggle({
  film,
}: {
  film: Pick<WatchlistFilm, 'title' | 'tmdbId' | 'watched'>;
}) {
  // A nominee with no TMDB id cannot be marked — `setWatched` takes one — so it
  // keeps the read-only statement of fact rather than a button that would fail.
  if (!film.tmdbId) return film.watched ? <SeenChip /> : null;

  return (
    <WatchedToggle
      tmdbId={film.tmdbId}
      title={film.title}
      watched={film.watched}
      onChange={setWatched}
      hint="label"
    />
  );
}

/** The fallback for a row with no TMDB id: seen, and nothing to press. */
function SeenChip() {
  return (
    <StatusChip
      tone="neutral"
      icon={
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 24 24"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      }
    >
      Seen
    </StatusChip>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';

import { setWatched } from '@/actions/watchlist/set-watched';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';
import { Panel } from '@/components/Panel';
import { SectionHead } from '@/components/SectionHead';
import { SeenMeter } from '@/components/SeenMeter';
import { StatusChip } from '@/components/StatusChip';
import { WatchedToggle } from '@/components/WatchedToggle';
import { requireUser } from '@/lib/auth';
import type { SortDirection, WatchlistSortColumn } from '@/lib/repositories/watchlists';
import { getActiveYear } from '@/lib/services/season';
import {
  type LeagueProgress,
  loadDraftedProgress,
  loadNominatedProgress,
  loadShowProgress,
  loadWatchedFilms,
  type NominatedProgress,
  type ShowProgress,
  type WatchedPage,
  type WatchlistFilm,
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

/**
 * `?sort=` is the reader's word, not the column name.
 *
 * The source route took `:columnName` off the URL and handed it to Sequelize,
 * which is how `/watchlist/1/title/asc` reached Postgres as an unknown column
 * and echoed the schema back in the error. Mapping two known words onto the
 * repository's closed union means nothing off the URL is ever a column name.
 */
const SORTS = {
  marked: 'createdAt',
  release: 'releaseDate',
} as const satisfies Record<string, WatchlistSortColumn>;

type Sort = keyof typeof SORTS;

function toSort(raw: string | undefined): Sort {
  return raw === 'release' ? 'release' : 'marked';
}

function toDirection(raw: string | undefined, sort: Sort): SortDirection {
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

  const user = await requireUser();
  const year = await getActiveYear();

  const watched =
    view === 'films'
      ? await loadWatchedFilms({
          userId: user.id,
          page,
          sortBy: SORTS[sort],
          direction,
        })
      : null;
  const shows = view === 'awards' ? await loadShowProgress(user.id, year) : null;
  const nominated =
    view === 'nominations' ? await loadNominatedProgress(user.id, year) : null;
  const drafted = view === 'drafted' ? await loadDraftedProgress(user.id, year) : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
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

/** One tab, as a filter pill (D73) around a real link — the same idiom browse uses. */
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
      aria-current={isCurrent ? 'true' : undefined}
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
  sort: Sort;
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
                // biome-ignore lint/performance/noImgElement: swapped for next/image in Phase 11, which needs the remote host allowlist configured first
                <img
                  src={film.posterUrl}
                  alt=""
                  className="poster-radius bg-bg-raised light:border light:border-border-rule h-16 w-11 shrink-0 object-cover"
                  loading="lazy"
                />
              ) : (
                // A src-less <img> draws the browser's broken-image glyph, which
                // reads as a failure rather than as a film with no artwork.
                <div className="poster-radius bg-bg-raised h-16 w-11 shrink-0" />
              )}

              <div className="min-w-0 flex-1">
                <FilmTitle film={film} />
                <p className="text-text-dim mt-0.5 text-xs">
                  {formatReleaseDate(film.releaseDate) ?? 'Release date unknown'}
                  {film.markedAt
                    ? ` · marked ${formatReleaseDate(film.markedAt) ?? ''}`
                    : null}
                </p>
              </div>

              {film.tmdbId ? (
                <WatchedToggle
                  tmdbId={film.tmdbId}
                  title={film.title}
                  watched
                  onChange={setWatched}
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
  sort: Sort;
  current: Sort;
  direction: SortDirection;
  label: string;
}) {
  const isCurrent = sort === current;
  const next: SortDirection = isCurrent && direction === 'desc' ? 'asc' : 'desc';
  const spoken = next === 'asc' ? 'oldest first' : 'newest first';

  return (
    <Link
      href={`/watchlist?view=films&sort=${sort}&dir=${next}`}
      aria-current={isCurrent ? 'true' : undefined}
      aria-label={`${label}, ${spoken}`}
      className="text-text-secondary hover:text-text-primary focus-visible:outline-accent-fill flex min-h-11 items-center gap-1.5 rounded-sm px-3 text-sm focus-visible:outline-2 aria-[current]:text-text-primary aria-[current]:font-semibold"
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
    <div className="flex flex-col gap-3">
      {shows.map((show) => (
        // A native <details>: it opens with a keyboard, before hydration, and
        // without a line of JavaScript. Closed by default because the summary
        // already carries the answer — twelve shows expanded is 526 nominees.
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
                      <SeenChip watched={nominee.watched} />
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
              className="border-border-rule flex items-center gap-3 border-b py-2.5 last:border-b-0"
            >
              <span className="tabular text-text-dim w-8 shrink-0 font-mono text-sm">
                {film.nominations}
                <span className="sr-only"> nominations</span>
              </span>
              <span className="min-w-0 flex-1">
                <FilmTitle film={film} />
              </span>
              <SeenChip watched={film.watched} />
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
                <SeenChip watched={film.watched} />
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}

/** Serif, because a film has a name (D70) — and a link wherever there is a page to link to. */
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

/** A word, never colour alone (§6.7). Nothing at all for a film not yet seen. */
function SeenChip({ watched }: { watched: boolean }) {
  if (!watched) return null;

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

import { tmdbFetch } from './tmdb-client';

/**
 * The catalogue, for browsing rather than searching.
 *
 * 🔴 **"The Future" and "The Past" are two different queries, not one sort
 * flipped.** The source's control looks like a switch and reads like one
 * (`src/pages/browse/index.js:83`), but `discovery.js` sends materially
 * different parameters for each side:
 *
 * - **Past:** one calendar month at a time, `vote_average >= 4`, `vote_count >= 200`.
 *   The vote floors are what keep it to films anybody has heard
 *   of; without them, "recent releases" is a wall of unrated obscurities,
 *   because TMDB's catalogue is mostly long tail.
 * - **Future:** one calendar month at a time, **most notable first**, and no
 *   vote floor at all — an unreleased film has no votes, so keeping
 *   `vote_count >= 200` returns an empty page. That is precisely what "just
 *   flip the sort" would have shipped, and it would have looked like a broken
 *   feature rather than a wrong query.
 *
 * 🔴 **TMDB sorts by popularity inside one month, not by date** (P15.T9), which
 * is a deliberate departure from the source and from this file's first version.
 * Measured against the live API on 2026-09-12: with `primary_release_date.asc`,
 * pages 1 and 3 returned twenty films each of which **none** cleared any usable
 * quality floor — sorting by date puts *today's* long tail first, because on any
 * given day the obscure releases outnumber the ones anybody will see. That is
 * why "The future" rendered "Nothing is scheduled" while the counter claimed 71
 * pages. Sorting by popularity puts the films a reader came for at the top and
 * lets the tail fall off the end, which is also what makes the pages full.
 *
 * 🔴 The app page is the month, **not TMDB's result page**. A popularity page
 * mixes October, November and December, so appending page 2 can add more films
 * to a November section that page 1 made look finished. Each app page instead
 * bounds `release_date` to one month, exhausts TMDB's popularity pages down to
 * the floor, and defensively drops a row whose displayed date falls outside the
 * bound (a re-release can otherwise do that). Thus direct `?page=2` loads and
 * auto-appending page 2 expose the same complete adjacent month.
 *
 * Both sides pass `with_release_type=2|3` (limited *and* wide theatrical) and
 * `region=US`, because the league is scored on US theatrical seasons and awards
 * contenders routinely open in a qualifying limited run — a wide-only query
 * misses or mis-dates exactly the films this app exists to score.
 */

/** Which way the reader is looking. */
export type BrowseWhen = 'past' | 'future';

export type DiscoveredFilm = {
  tmdbId: string;
  title: string;
  posterPath: string;
  /**
   * The wide still, for the page's header band (P15.T8). Often absent, and
   * never a reason to drop the film — a shelf is made of posters.
   */
  backdropPath: string | null;
  releaseDate: Date | null;
};

export type DiscoverPage = {
  page: number;
  pageCount: number;
  films: DiscoveredFilm[];
};

type TmdbDiscoverResult = {
  id?: number;
  title?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string | null;
  popularity?: number | null;
};

type TmdbDiscoverResponse = {
  page?: number;
  total_pages?: number;
  results?: TmdbDiscoverResult[];
};

/** The source's own floors, kept as named constants. */
const VOTE_AVERAGE_FLOOR = '4';
const VOTE_COUNT_FLOOR = '200';

/**
 * 🔴 Per side, and applied here rather than by TMDB — there is no
 * `popularity.gte` parameter, which is the whole reason this one filter is
 * still client-side while the rest sit in the query.
 *
 * Looking back, votes carry the quality signal and popularity only sweeps up
 * the unrated tail, so 10 is enough.
 *
 * 🔴 Looking forward the floor is **lower**, which is the opposite of what this
 * task set out to do, and the measurement is why. TMDB's popularity numbers for
 * unreleased films are nothing like the 50–500 the plan assumed: on 2026-09-12
 * the whole upcoming slate ran 236, 42, 42, 26, 26, 20, 18, … and by rank 21 it
 * was under 8 — with *Whalefall*, *Wildwood* and *Shaun the Sheep* among the
 * films sitting there. A floor of 25 would have kept five films and cut real
 * studio releases; the sort now does the ranking, so this only has to trim the
 * 0.x noise beneath them.
 */
const POPULARITY_FLOOR = { past: 10, future: 5 } as const;

/** Shorts and catalogue filler, excluded server-side rather than by hand. */
const RUNTIME_FLOOR = '40';

/** The public cursor and TMDB's private sub-page cursor both cap at 500. */
const MAX_PAGE = 500;

/** `2026-08-17` in UTC, which is also the cache key's day bucket. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthWindow(when: BrowseWhen, page: number, day: string) {
  const now = new Date(`${day}T00:00:00Z`);
  const offset = (page - 1) * (when === 'past' ? -1 : 1);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  const monthStart = start.toISOString().slice(0, 10);
  const monthEnd = end.toISOString().slice(0, 10);

  return {
    gte: when === 'future' && page === 1 ? day : monthStart,
    lte: when === 'past' && page === 1 ? day : monthEnd,
  };
}

function toFilm(result: TmdbDiscoverResult, when: BrowseWhen): DiscoveredFilm | null {
  if (typeof result.id !== 'number' || typeof result.title !== 'string') return null;
  // 🔴 Posterless and unpopular results are dropped **here**, not in the
  // component. The source filtered popularity on the server and posters in the
  // browser, so its page counter counted rows the reader never saw — and a
  // "load more" that appeared to do nothing was the visible symptom.
  if (!result.poster_path) return null;
  if ((result.popularity ?? 0) <= POPULARITY_FLOOR[when]) return null;

  const raw = result.release_date;
  const date = raw ? new Date(raw) : null;

  return {
    tmdbId: String(result.id),
    title: result.title,
    posterPath: result.poster_path,
    backdropPath: result.backdrop_path ?? null,
    releaseDate: date && !Number.isNaN(date.getTime()) ? date : null,
  };
}

/**
 * One page of the catalogue, or an empty page.
 *
 * Empty rather than null: browse has no local fallback, and a reader who arrives
 * while TMDB is unreachable should see an empty shelf with the controls still
 * working, not a 404 on a page that exists.
 */
export async function discoverFilms(input: {
  when: BrowseWhen;
  page: number;
}): Promise<DiscoverPage> {
  const page = Math.min(MAX_PAGE, Math.max(1, Math.trunc(input.page)));
  const day = today();
  const window = monthWindow(input.when, page, day);

  const params: Record<string, string> = {
    language: 'en-US',
    region: 'US',
    with_release_type: '2|3',
    'with_runtime.gte': RUNTIME_FLOOR,
    sort_by: 'popularity.desc',
    'release_date.gte': window.gte,
    'release_date.lte': window.lte,
    ...(input.when === 'past'
      ? {
          'vote_average.gte': VOTE_AVERAGE_FLOOR,
          'vote_count.gte': VOTE_COUNT_FLOOR,
        }
      : {}),
  };

  const results: TmdbDiscoverResult[] = [];
  for (let tmdbPage = 1; tmdbPage <= MAX_PAGE; tmdbPage += 1) {
    const body = await tmdbFetch<TmdbDiscoverResponse>(
      '/discover/movie',
      { ...params, page: String(tmdbPage) },
      {
        // The day is part of the key because page 1 is a partial month. `v3`
        // separates calendar pages from the old unbounded popularity pages.
        key: `tmdb:discover:v3:${input.when}:${day}:${page}:${tmdbPage}`,
        tags: ['tmdb', 'tmdb-discover'],
        name: 'tmdb-discover',
      },
    );
    if (!body) return { page, pageCount: 0, films: [] };

    const batch = Array.isArray(body.results) ? body.results : [];
    results.push(...batch);
    const totalPages = Math.min(
      MAX_PAGE,
      typeof body.total_pages === 'number' ? body.total_pages : 0,
    );
    const lastPopularity = batch.at(-1)?.popularity ?? 0;
    if (tmdbPage >= totalPages || lastPopularity <= POPULARITY_FLOOR[input.when]) break;
  }

  return {
    page,
    pageCount: MAX_PAGE,
    films: results.flatMap((result) => {
      const film = toFilm(result, input.when);
      if (!film) return [];
      const releaseDay = film.releaseDate?.toISOString().slice(0, 10);
      if (!releaseDay || releaseDay < window.gte || releaseDay > window.lte) return [];
      return [film];
    }),
  };
}

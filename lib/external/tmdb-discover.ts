import { tmdbFetch } from './tmdb-client';

/**
 * The catalogue, for browsing rather than searching.
 *
 * 🔴 **"The Future" and "The Past" are two different queries, not one sort
 * flipped.** The source's control looks like a switch and reads like one
 * (`src/pages/browse/index.js:83`), but `discovery.js` sends materially
 * different parameters for each side:
 *
 * - **Past:** `release_date.lte` today, `vote_average >= 4`, `vote_count >= 200`,
 *   newest first. The vote floors are what keep it to films anybody has heard
 *   of; without them, "recent releases" is a wall of unrated obscurities,
 *   because TMDB's catalogue is mostly long tail.
 * - **Future:** `release_date.gte` today, soonest first, and **no vote floor at
 *   all** — an unreleased film has no votes, so keeping `vote_count >= 200`
 *   returns an empty page. That is precisely what "just flip the sort" would
 *   have shipped, and it would have looked like a broken feature rather than a
 *   wrong query.
 *
 * Both sides pass `with_release_type=3` (theatrical) and `region=US`, matching
 * the source, because the league is scored on US theatrical seasons.
 */

/** Which way the reader is looking. */
export type BrowseWhen = 'past' | 'future';

export type DiscoveredFilm = {
  tmdbId: string;
  title: string;
  posterPath: string;
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
  release_date?: string | null;
  popularity?: number | null;
};

type TmdbDiscoverResponse = {
  page?: number;
  total_pages?: number;
  results?: TmdbDiscoverResult[];
};

/**
 * The source's own floors, kept as named constants.
 *
 * `POPULARITY_FLOOR` is applied here rather than by TMDB because there is no
 * `popularity.gte` parameter — the source filtered it server-side too
 * (`discovery.js:35`).
 */
const VOTE_AVERAGE_FLOOR = '4';
const VOTE_COUNT_FLOOR = '200';
const POPULARITY_FLOOR = 10;

/** TMDB caps `page` at 500 and errors above it. */
const MAX_PAGE = 500;

/** `2026-08-17` in UTC, which is also the cache key's day bucket. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function toFilm(result: TmdbDiscoverResult): DiscoveredFilm | null {
  if (typeof result.id !== 'number' || typeof result.title !== 'string') return null;
  // 🔴 Posterless and unpopular results are dropped **here**, not in the
  // component. The source filtered popularity on the server and posters in the
  // browser, so its page counter counted rows the reader never saw — and a
  // "load more" that appeared to do nothing was the visible symptom.
  if (!result.poster_path) return null;
  if ((result.popularity ?? 0) <= POPULARITY_FLOOR) return null;

  const raw = result.release_date;
  const date = raw ? new Date(raw) : null;

  return {
    tmdbId: String(result.id),
    title: result.title,
    posterPath: result.poster_path,
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

  const params: Record<string, string> = {
    language: 'en-US',
    region: 'US',
    with_release_type: '3',
    page: String(page),
    sort_by: input.when === 'past' ? 'release_date.desc' : 'release_date.asc',
    ...(input.when === 'past'
      ? {
          'release_date.lte': day,
          'vote_average.gte': VOTE_AVERAGE_FLOOR,
          'vote_count.gte': VOTE_COUNT_FLOOR,
        }
      : { 'release_date.gte': day }),
  };

  const body = await tmdbFetch<TmdbDiscoverResponse>('/discover/movie', params, {
    // The day is part of the key. Without it, "released before today" would be
    // answered from yesterday's cache — and a key containing a timestamp rather
    // than a date would never hit at all.
    key: `tmdb:discover:${input.when}:${day}:${page}`,
    tags: ['tmdb', 'tmdb-discover'],
    name: 'tmdb-discover',
  });

  const results = Array.isArray(body?.results) ? body.results : [];

  return {
    page: typeof body?.page === 'number' ? body.page : page,
    pageCount: Math.min(
      MAX_PAGE,
      typeof body?.total_pages === 'number' ? body.total_pages : 0,
    ),
    films: results.flatMap((result) => {
      const film = toFilm(result);
      return film ? [film] : [];
    }),
  };
}

import { tmdbFetch } from './tmdb-client';
import type { DiscoveredFilm } from './tmdb-discover';

/**
 * Films in US theatrical release right now, for the dashboard's "In cinemas
 * now" shelf (P10.T2).
 *
 * Ported from `GET /movie/now-playing`
 * (`server/routes/movie/nowPlaying.js`), which proxied TMDB's `/movie/now_playing`
 * with no filtering — the source carousel is a rail, not a browse, and a
 * handful of current releases is the whole point.
 */

type TmdbNowPlayingResult = {
  id?: number;
  title?: string;
  poster_path?: string | null;
  release_date?: string | null;
};

type TmdbNowPlayingResponse = {
  results?: TmdbNowPlayingResult[];
};

/** `2026-08-17` in UTC, matching `tmdb-discover.ts`'s cache-key convention. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function toFilm(result: TmdbNowPlayingResult): DiscoveredFilm | null {
  if (typeof result.id !== 'number' || typeof result.title !== 'string') return null;
  // A poster-less film has nothing for a shelf built entirely of artwork.
  if (!result.poster_path) return null;

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
 * The first page only — a shelf, not a browse. Twenty-odd films is more than
 * a horizontal rail shows at once, and the source carousel never paged either.
 */
export async function getNowPlaying(): Promise<DiscoveredFilm[]> {
  const day = today();

  const body = await tmdbFetch<TmdbNowPlayingResponse>(
    '/movie/now_playing',
    { language: 'en-US', region: 'US', page: '1' },
    {
      // The day is part of the key so a once-a-day-fresh list expires on its
      // own, with no cron needed to keep it warm.
      key: `tmdb:now-playing:${day}`,
      tags: ['tmdb', 'tmdb-now-playing'],
      name: 'tmdb-now-playing',
    },
  );

  const results = Array.isArray(body?.results) ? body.results : [];

  return results.flatMap((result) => {
    const film = toFilm(result);
    return film ? [film] : [];
  });
}

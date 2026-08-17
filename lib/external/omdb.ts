import { omdbEnv } from '@/lib/env';
import { cached } from './cache';

/**
 * The second film source, and the one that may not be there.
 *
 * OMDb supplies four things TMDB does not: the MPAA rating, the domestic box
 * office, the Metacritic score and the Rotten Tomatoes percentage. The source
 * app fetched all four on every film page view (`server/routes/movie/movie.js`
 * and `/details`) and rendered the Metacritic chip the film screenshots show.
 *
 * 🔴 **Absence is the normal case, not an error.** OMDb's free tier is 1,000
 * requests a day and the key is one person's; the app must render a film page
 * without it. So this module returns `null` for every failure — no key, a
 * refusal, a timeout, an unparseable body, or OMDb's own `Response: "False"` —
 * and the page omits the ratings panel rather than showing empty rows.
 *
 * 🔴 **The source hard-coded a key here** (`routes/movie/details.js:15`,
 * recorded as bug 11 in `PARITY.md`). Not reused, and the variable is
 * deliberately named `OMDB_API_KEY` rather than the source's `OMDB_KEY` so a
 * stale value in a shared environment cannot be inherited by accident.
 */

const BASE = 'https://www.omdbapi.com/';

/** A day, matching TMDB's. Neither a box-office total nor a Metascore moves fast. */
const TTL_SECONDS = 86_400;

/** Same budget as TMDB: a film page must not hang on a third party. */
const TIMEOUT_MS = 3_000;

/**
 * What this app takes from OMDb, and nothing else.
 *
 * Numbers are parsed **here**, not in a component. `'91%'` and `'94/100'` are
 * OMDb's presentation of a number, and a component that receives the strings
 * ends up parsing them to decide a colour — which means the parsing rule lives
 * in the render path and gets written twice.
 *
 * `boxOffice` stays a string because it arrives pre-formatted as
 * `'$151,101,803'` and this app has no currency formatter that would improve
 * on it. `imdbRating` stays a string because `'8.0'` must render as `8.0`, and
 * a float would print `8`.
 */
export type OmdbFacts = {
  mpaaRating: string | null;
  boxOffice: string | null;
  /** 0–100. */
  metacritic: number | null;
  /** 0–100, the critics' percentage. */
  rottenTomatoes: number | null;
  imdbRating: string | null;
  imdbVotes: number | null;
};

type OmdbRating = { Source?: string; Value?: string };

type OmdbResponse = {
  Response?: string;
  Rated?: string;
  BoxOffice?: string;
  Metascore?: string;
  imdbRating?: string;
  imdbVotes?: string;
  Ratings?: OmdbRating[];
};

/**
 * OMDb's way of saying "we do not know".
 *
 * 🔴 It answers 200 with the literal string `"N/A"` rather than omitting the
 * field, so every value has to pass through here. A port that checks only for
 * undefined renders "Rated: N/A" on every older film.
 */
function text(value: string | undefined): string | null {
  if (!value || value === 'N/A') return null;
  return value;
}

/** A leading integer, or null. Never NaN — a NaN reaches the page as "NaN". */
function integer(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number.parseInt(value.replace(/[,%]/g, ''), 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function ratingValue(ratings: OmdbRating[] | undefined, source: string): string | null {
  const found = ratings?.find((rating) => rating.Source === source);
  return text(found?.Value);
}

/**
 * Everything this app wants to know about one film from OMDb.
 *
 * `imdbId` is accepted with or without its `tt` prefix, because both forms
 * exist in this codebase: OMDb requires the prefix, and `movies.imdb_id` stores
 * 1,355 rows without it (`fetchTmdbFilm` strips it, matching the source's
 * `saveFilm`). Normalising at the boundary means no caller has to remember
 * which side it is on.
 */
export async function fetchOmdb(imdbId: string): Promise<OmdbFacts | null> {
  const key = omdbEnv.apiKey;
  if (!key) return null;

  const id = imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`;

  return cached(
    `omdb:film:${id}`,
    { ttlSeconds: TTL_SECONDS, tags: ['omdb'], name: 'omdb-film' },
    async () => {
      try {
        const params = new URLSearchParams({
          i: id,
          plot: 'short',
          r: 'json',
          apikey: key,
        });
        const response = await fetch(`${BASE}?${params}`, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok) return null;

        const body: unknown = await response.json();
        if (typeof body !== 'object' || body === null) return null;

        const detail = body as OmdbResponse;
        // 🔴 OMDb reports its own failures with a 200 and Response: "False".
        // Treating that as a film with no fields would hide a wrong imdb id
        // behind a page that merely looks sparse.
        if (detail.Response === 'False') return null;

        // The Ratings array is the field OMDb documents; Metascore is a
        // convenience copy of the same number. Prefer the documented one and
        // fall back, rather than reading whichever parses.
        const metacritic =
          integer(ratingValue(detail.Ratings, 'Metacritic')) ??
          integer(text(detail.Metascore));

        return {
          mpaaRating: text(detail.Rated),
          boxOffice: text(detail.BoxOffice),
          metacritic,
          rottenTomatoes: integer(ratingValue(detail.Ratings, 'Rotten Tomatoes')),
          imdbRating: text(detail.imdbRating),
          imdbVotes: integer(text(detail.imdbVotes)),
        };
      } catch {
        return null;
      }
    },
  );
}

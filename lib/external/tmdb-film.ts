import { tmdbFetch } from './tmdb-client';

/**
 * Everything TMDB knows about one film, in one request.
 *
 * The film page is the most-visited page in the app, and the five sections it
 * needs — release dates, videos, images, credits, similar films — are five
 * separate TMDB endpoints. 🔴 `append_to_response` folds them into the single
 * request the source app made (`server/routes/movie/movie.js:22`), and that is
 * load-bearing rather than tidy: five calls per page view against a
 * rate-limited third party is the difference between a page and an outage.
 *
 * This module maps and nothing else. It resolves no local rows, computes no
 * scores and builds no URLs — image paths stay bare, because the host and size
 * belong to the renderer and TMDB has changed its image host before.
 */

type TmdbGenre = { name?: string };
type TmdbCompany = { name?: string };
type TmdbLanguage = { iso_639_1?: string; english_name?: string; name?: string };
type TmdbImage = { file_path?: string; iso_639_1?: string | null };
type TmdbVideo = {
  key?: string;
  name?: string;
  site?: string;
  type?: string;
  official?: boolean;
};
type TmdbCastMember = {
  name?: string;
  character?: string;
  profile_path?: string | null;
  order?: number | null;
};
type TmdbCrewMember = { name?: string; job?: string; department?: string };
type TmdbSimilar = { id?: number; title?: string; poster_path?: string | null };

type TmdbFilmResponse = {
  id?: number;
  imdb_id?: string | null;
  title?: string;
  tagline?: string | null;
  overview?: string | null;
  runtime?: number | null;
  budget?: number | null;
  revenue?: number | null;
  original_language?: string | null;
  release_date?: string | null;
  backdrop_path?: string | null;
  poster_path?: string | null;
  genres?: TmdbGenre[];
  production_companies?: TmdbCompany[];
  spoken_languages?: TmdbLanguage[];
  release_dates?: {
    results?: { iso_3166_1?: string; release_dates?: { release_date?: string }[] }[];
  };
  videos?: { results?: TmdbVideo[] };
  images?: { posters?: TmdbImage[] };
  credits?: { cast?: TmdbCastMember[]; crew?: TmdbCrewMember[] };
  similar?: { results?: TmdbSimilar[] };
  recommendations?: { results?: TmdbSimilar[] };
};

export type FilmTrailer = { key: string; name: string };
export type FilmCastMember = {
  name: string;
  character: string;
  profilePath: string | null;
};
export type FilmCrewGroup = {
  department: string;
  people: { name: string; job: string }[];
};
export type FilmSimilar = { tmdbId: string; title: string; posterPath: string | null };

export type TmdbFilmPage = {
  tmdbId: string;
  /** Without the `tt` prefix, as `movies.imdb_id` stores it and OMDb does not. */
  imdbId: string | null;
  title: string;
  /** From TMDB's primary release date, which is what the source's banner showed. */
  year: number | null;
  tagline: string | null;
  overview: string | null;
  /** Null rather than 0 — an unmeasured runtime is not a zero-minute film. */
  runtimeMinutes: number | null;
  /** The English name where TMDB supplies one, else the raw iso code. */
  language: string | null;
  genres: string[];
  /** The US entry, as everywhere else in this app. */
  releaseDate: Date | null;
  /** Null rather than 0: TMDB stores 0 for "unknown". */
  budget: number | null;
  revenue: number | null;
  productionCompanies: string[];
  backdropPath: string | null;
  /** English posters, in TMDB's own vote order, for the carousel. */
  posterPaths: string[];
  trailers: FilmTrailer[];
  cast: FilmCastMember[];
  crew: FilmCrewGroup[];
  similar: FilmSimilar[];
};

/** As many similar films as the source showed. */
const SIMILAR_LIMIT = 7;

/**
 * The US release date, falling back to TMDB's primary one.
 *
 * The same rule as `fetchTmdbFilm`, for the same reason: the league is scored on
 * US award seasons, and a film's international date can fall in a different
 * eligibility year. Duplicated rather than shared because the two modules
 * receive different response shapes, and the alternative — a common
 * `release_dates` type — would couple the ingest path to the page path for four
 * lines.
 */
function usReleaseDate(detail: TmdbFilmResponse): Date | null {
  const us = detail.release_dates?.results?.find((entry) => entry.iso_3166_1 === 'US');
  const raw = us?.release_dates?.[0]?.release_date ?? detail.release_date;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Zero means "we do not know" in TMDB's budget, revenue and runtime fields.
 *
 * 🔴 The source formatted them anyway, so an announced-but-unmade film showed a
 * budget of `$0` and, in the same panel, a runtime it had also hard-coded. A
 * fact that is wrong is worse than a fact that is absent — the row is omitted
 * instead.
 */
function positive(value: number | null | undefined): number | null {
  return typeof value === 'number' && value > 0 ? value : null;
}

/**
 * The language's English name, without shipping a table of every ISO code.
 *
 * The source carried a 732-line `iso.js` for this one label
 * (`src/pages/movie/iso.js`). TMDB already answers the question in the same
 * response: `spoken_languages[].english_name` keyed by the same code as
 * `original_language`. Where it does not, the raw code is a worse label than
 * "English" and a much better one than nothing.
 */
function languageName(detail: TmdbFilmResponse): string | null {
  const code = detail.original_language;
  if (!code) return null;
  const spoken = detail.spoken_languages?.find((entry) => entry.iso_639_1 === code);
  return spoken?.english_name || spoken?.name || code;
}

/**
 * Embeddable trailers, best first.
 *
 * Non-YouTube entries are dropped because the player this app embeds cannot
 * play them — keeping one would render a dead frame in the carousel. Official
 * videos sort first: 32 came back for La La Land, and opening on a fan edit is
 * a poor first impression that costs nothing to avoid.
 */
function trailersOf(detail: TmdbFilmResponse): FilmTrailer[] {
  const videos = detail.videos?.results ?? [];
  return videos
    .filter(
      (video): video is TmdbVideo & { key: string } =>
        video.site === 'YouTube' && typeof video.key === 'string' && video.key !== '',
    )
    .sort((a, b) => Number(b.official ?? false) - Number(a.official ?? false))
    .map((video) => ({ key: video.key, name: video.name ?? 'Trailer' }));
}

/**
 * English posters only.
 *
 * TMDB returns every localised one-sheet it has — 68 for La La Land, in a dozen
 * scripts. The source filtered to `iso_639_1 === 'en'` and so does this; a
 * carousel that mixes alphabets is not a gallery of the film's artwork, it is a
 * gallery of TMDB's contributors.
 */
function posterPathsOf(detail: TmdbFilmResponse): string[] {
  const posters = detail.images?.posters ?? [];
  return posters
    .filter((image) => image.iso_639_1 === 'en' && typeof image.file_path === 'string')
    .map((image) => image.file_path as string);
}

/**
 * Cast with photographs first, billing order preserved within each half.
 *
 * The grid shows six faces, and a photoless name occupying one of those slots is
 * a hole in the grid — which is why the source sorted this way
 * (`credits.js:sortList`). `sort` is stable in every runtime this ships on, so
 * billing order survives inside each group.
 */
function castOf(detail: TmdbFilmResponse): FilmCastMember[] {
  const cast = detail.credits?.cast ?? [];
  return cast
    .filter((person): person is TmdbCastMember & { name: string } => Boolean(person.name))
    .map((person) => ({
      name: person.name,
      character: person.character ?? '',
      profilePath: person.profile_path ?? null,
    }))
    .sort((a, b) => Number(a.profilePath === null) - Number(b.profilePath === null));
}

/**
 * Crew grouped by department, Directing and Writing first.
 *
 * The old Express server did this grouping server-side (`movie.js:141`), which
 * is why the captured fixture holds an object where TMDB sends a flat array.
 * It belongs here rather than in a component: the order is a judgement about
 * what a reader wants first, not a rendering detail.
 *
 * Directing and Writing lead because that is what the screenshot shows and what
 * an award league cares about. Everything else is alphabetical, so the order
 * does not silently depend on TMDB's array order.
 */
function crewOf(detail: TmdbFilmResponse): FilmCrewGroup[] {
  const crew = detail.credits?.crew ?? [];
  const byDepartment = new Map<string, { name: string; job: string }[]>();

  for (const person of crew) {
    if (!person.name) continue;
    const department = person.department ?? 'Crew';
    const entry = { name: person.name, job: person.job ?? '' };
    const existing = byDepartment.get(department);
    if (existing) existing.push(entry);
    else byDepartment.set(department, [entry]);
  }

  const lead = ['Directing', 'Writing'];
  const rest = [...byDepartment.keys()]
    .filter((department) => !lead.includes(department))
    .sort((a, b) => a.localeCompare(b));

  return [...lead, ...rest].flatMap((department) => {
    const people = byDepartment.get(department);
    return people ? [{ department, people }] : [];
  });
}

/**
 * Films worth showing next to this one.
 *
 * 🔴 **`recommendations` first, `similar` only as a fallback.** The source used
 * `/similar` (`server/routes/movie/movie.js:25`), and measured against the live
 * API on 2026-08-17 it is close to useless: for *La La Land* it returns *The
 * Tigger Movie*, *Mommie Dearest*, *Xanadu*, *A Goofy Movie* and *Sunshine Barry
 * & the Disco Worms*. `/recommendations` returns *Pretty Woman*, *Burlesque* and
 * *(500) Days of Summer*. TMDB's `similar` is built from shared keywords and
 * genres, which for a musical drags in every animated film with a song in it;
 * `recommendations` is built from what people actually watched together.
 *
 * Both arrive in the same request and have the same shape, so this costs
 * nothing. `similar` is kept as a fallback because `recommendations` is empty for
 * obscure titles, where keyword matching is all TMDB has. Recorded in
 * `PARITY.md` as a deliberate betterment.
 */
function similarOf(detail: TmdbFilmResponse): FilmSimilar[] {
  const recommended = detail.recommendations?.results ?? [];
  const results = recommended.length > 0 ? recommended : (detail.similar?.results ?? []);
  return results
    .filter(
      (film): film is TmdbSimilar & { id: number; title: string } =>
        typeof film.id === 'number' && typeof film.title === 'string',
    )
    .slice(0, SIMILAR_LIMIT)
    .map((film) => ({
      tmdbId: String(film.id),
      title: film.title,
      posterPath: film.poster_path ?? null,
    }));
}

/**
 * Fetch and map one film, or return null.
 *
 * 🔴 **Null, not an empty film.** `searchTmdb` returns `[]` when TMDB cannot
 * answer, because local results are a complete answer on their own. A film page
 * has no local half to fall back on, so an empty object here would render a page
 * about nothing — and the caller's job is to `notFound()` instead.
 */
export async function fetchTmdbFilmPage(tmdbId: string): Promise<TmdbFilmPage | null> {
  const detail = await tmdbFetch<TmdbFilmResponse>(
    `/movie/${tmdbId}`,
    {
      append_to_response: 'release_dates,videos,images,credits,similar,recommendations',
    },
    {
      key: `tmdb:film-page:${tmdbId}`,
      tags: ['tmdb', 'tmdb-film-page'],
      name: 'tmdb-film-page',
    },
  );

  if (typeof detail?.id !== 'number' || typeof detail?.title !== 'string') {
    return null;
  }

  const primaryYear = detail.release_date
    ? Number.parseInt(detail.release_date.slice(0, 4), 10)
    : Number.NaN;

  return {
    tmdbId: String(detail.id),
    imdbId: detail.imdb_id ? detail.imdb_id.replace(/^tt/, '') : null,
    title: detail.title,
    year: Number.isSafeInteger(primaryYear) ? primaryYear : null,
    tagline: detail.tagline || null,
    overview: detail.overview || null,
    runtimeMinutes: positive(detail.runtime),
    language: languageName(detail),
    genres: (detail.genres ?? []).flatMap((genre) => (genre.name ? [genre.name] : [])),
    releaseDate: usReleaseDate(detail),
    budget: positive(detail.budget),
    revenue: positive(detail.revenue),
    productionCompanies: (detail.production_companies ?? []).flatMap((company) =>
      company.name ? [company.name] : [],
    ),
    backdropPath: detail.backdrop_path ?? null,
    posterPaths: posterPathsOf(detail),
    trailers: trailersOf(detail),
    cast: castOf(detail),
    crew: crewOf(detail),
    similar: similarOf(detail),
  };
}

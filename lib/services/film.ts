import { fetchOmdb, type OmdbFacts } from '@/lib/external/omdb';
import {
  type FilmCastMember,
  type FilmCrewGroup,
  type FilmTrailer,
  fetchTmdbFilmPage,
} from '@/lib/external/tmdb-film';
import { draftPickRepository } from '@/lib/repositories/draft-picks';
import { movieRepository } from '@/lib/repositories/movies';
import { nominationRepository } from '@/lib/repositories/nominations';
import { watchlistRepository } from '@/lib/repositories/watchlists';
import { ledgerForMovies, type MovieLedger } from '@/lib/services/scoring';
import { posterUrl } from '@/lib/utils/poster';

/**
 * Everything one film page needs, from three sources that may each be silent.
 *
 * The page is keyed by **TMDB id**, as the source app's was
 * (`GET /movie/:id`, `PATH_PAGE.movie/${tmdbId}`), and it is **public** (D44).
 * Both facts matter here:
 *
 * 🔴 **This function never writes** (D63). The straight port would: the source
 * called `Movies.update` on every GET to refresh posters, and `ensureFilm` is
 * sitting right there in `film-ingest.ts` waiting to be reached for. On a public
 * route that turns a crawler into unbounded insert traffic against a free-tier
 * database, and it fills `movies` with films nobody drafted — breaking the
 * invariant the rest of the port leans on, that **a row in `movies` means
 * somebody used that film** (D56). Films are ingested when a person deliberately
 * acts: drafting, nominating, or marking one watched.
 *
 * So the local row is read if it happens to exist, purely to look up a score,
 * and everything else on the page comes from TMDB.
 */

/** How a film scored in one season. */
export type FilmSeasonScoring = {
  year: number;
  total: number;
  /** Highest-contributing award show first. */
  byEvent: { abbreviation: string; name: string; total: number }[];
  /** The award-by-award breakdown, for the disclosure beneath the totals. */
  ledger: MovieLedger;
};

export type FilmScoring = {
  /**
   * Newest first: one entry per season the film scored in, **never summed**.
   *
   * 🔴 D126. A pick counts only the nominations of its own draft's season, so a
   * film nominated in two seasons is worth a different amount in each — *Elle*
   * is 30 to a 2017 pick and 5 to a 2018 one. A single cross-season total would
   * be a number no seat ever scored.
   */
  seasons: FilmSeasonScoring[];
  /**
   * Null when nobody has drafted it.
   *
   * 🔴 Not zero. The source's `average([])` returned 0, and "average draft
   * position: 0" reads as *first overall in every league* — the exact opposite
   * of never picked.
   */
  averageDraftPosition: number | null;
};

export type FilmPage = {
  tmdbId: string;
  title: string;
  year: number | null;
  tagline: string | null;
  overview: string | null;
  runtimeMinutes: number | null;
  language: string | null;
  genres: string[];
  releaseDate: Date | null;
  budget: number | null;
  revenue: number | null;
  productionCompanies: string[];
  backdropUrl: string | null;
  posterUrls: string[];
  trailers: FilmTrailer[];
  cast: (Omit<FilmCastMember, 'profilePath'> & { photoUrl: string | null })[];
  crew: FilmCrewGroup[];
  similar: { tmdbId: string; title: string; posterUrl: string | null }[];
  /** Null when OMDb has no key, or nothing to say about this film. */
  facts: OmdbFacts | null;
  /** Null when the film has never been nominated in any season. */
  scoring: FilmScoring | null;
};

/**
 * Regroup a ledger's lines by award show.
 *
 * 🔴 **A regrouping, not a second query.** `ledger.total` is defined as the sum
 * of its lines, and these per-event subtotals are partitions of the same lines,
 * so the panel's rows always add up to the number printed above them. Loading
 * the events separately — even with the same rule — would allow the two to
 * disagree, and a breakdown that does not add up is worse than no breakdown,
 * because it makes the app look like it is guessing.
 *
 * Ordered by contribution because the question behind opening this panel is
 * almost always "where did most of it come from". The source sorted these
 * alphabetically (`server/routes/points.js:157`), which answers a different
 * question.
 */
function byEventFrom(ledger: MovieLedger): FilmSeasonScoring['byEvent'] {
  const totals = new Map<string, { abbreviation: string; name: string; total: number }>();

  for (const line of ledger.lines) {
    const existing = totals.get(line.eventAbbreviation);
    if (existing) existing.total += line.earned;
    else
      totals.set(line.eventAbbreviation, {
        abbreviation: line.eventAbbreviation,
        name: line.eventName,
        total: line.earned,
      });
  }

  return [...totals.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name),
  );
}

/**
 * How this film has scored, season by season, or null if it has never been
 * nominated for anything worth points.
 *
 * Every season the film was nominated in, newest first, each scored on its own
 * (D126). Most films have exactly one; six on the restored data have two —
 * *Elle* is 2017 and 2018, a foreign-language film recognised by different
 * bodies a year apart (D58). This used to show the latest season only, so
 * *Elle* read 5 and its 30 from 2017 was nowhere on the page. The source app
 * summed every season into one total (35) under whichever year its first row
 * carried; that sum is what no pick was ever worth, so it is not reproduced.
 *
 * A season whose nominations all lack a point tier has no ledger and is left
 * out, like a film with nothing else: a row reading 0 would call the category
 * worthless when it is only unconfigured.
 */
async function scoringFor(movieId: number): Promise<FilmScoring | null> {
  const years = await nominationRepository.findYearsByMovieId(movieId);
  if (years.length === 0) return null;

  const [perSeason, picks] = await Promise.all([
    // D41: the one scoring path. A second implementation here could disagree
    // with the league board about the same film.
    // ponytail: one ledger load per season — at most two on real data. Batch
    // across seasons in `loadScoringInputs` if a film ever carries many.
    Promise.all(
      years.map(async (year) => ({
        year,
        ledger: (await ledgerForMovies([movieId], year)).get(movieId),
      })),
    ),
    draftPickRepository.findByMovieId(movieId),
  ]);

  const seasons = perSeason.flatMap(({ year, ledger }) =>
    ledger ? [{ year, total: ledger.total, byEvent: byEventFrom(ledger), ledger }] : [],
  );
  if (seasons.length === 0) return null;

  const orders = picks.flatMap((pick) => (pick.order == null ? [] : [pick.order]));

  return {
    seasons,
    averageDraftPosition:
      orders.length === 0
        ? null
        : orders.reduce((sum, order) => sum + order, 0) / orders.length,
  };
}

/**
 * Load one film page, or null when TMDB cannot supply the film.
 *
 * Null covers "no key", "TMDB does not know this id" and "TMDB is down", because
 * the caller's job is the same in all three: `notFound()`. There is no local
 * half to fall back on — `movies` holds only films this league has used, so
 * rendering from it alone would produce a page with a title and nothing else.
 *
 * OMDb runs concurrently with the local lookups rather than after them: it is
 * the slowest of the three and nothing else depends on it.
 */
export async function loadFilmPage(tmdbId: string): Promise<FilmPage | null> {
  const film = await fetchTmdbFilmPage(tmdbId);
  if (!film) return null;

  const [facts, local] = await Promise.all([
    // OMDb is keyed on the imdb id. Asking without one is a guaranteed miss
    // against a 1,000-request daily quota shared by the whole app.
    film.imdbId ? fetchOmdb(film.imdbId) : Promise.resolve(null),
    movieRepository.findByTmdbId(tmdbId),
  ]);

  const scoring = local ? await scoringFor(local.id) : null;

  return {
    tmdbId: film.tmdbId,
    title: film.title,
    year: film.year,
    tagline: film.tagline,
    overview: film.overview,
    runtimeMinutes: film.runtimeMinutes,
    language: film.language,
    genres: film.genres,
    releaseDate: film.releaseDate,
    budget: film.budget,
    revenue: film.revenue,
    productionCompanies: film.productionCompanies,
    // The size buckets are chosen here because this is the layer that knows how
    // large each image renders: a banner is not a thumbnail.
    backdropUrl: posterUrl(film.backdropPath, 'original'),
    posterUrls: film.posterPaths.flatMap((path) => {
      const url = posterUrl(path, 'w500');
      return url ? [url] : [];
    }),
    trailers: film.trailers,
    cast: film.cast.map((person) => ({
      name: person.name,
      character: person.character,
      photoUrl: posterUrl(person.profilePath, 'w185'),
    })),
    crew: film.crew,
    similar: film.similar.map((entry) => ({
      tmdbId: entry.tmdbId,
      title: entry.title,
      posterUrl: posterUrl(entry.posterPath, 'w185'),
    })),
    facts,
    scoring,
  };
}

/**
 * Whether this reader has marked the film watched.
 *
 * Separate from `loadFilmPage` rather than a field on it, because the page is
 * public and cacheable while this answer is per-reader: folding it in would make
 * the whole payload private, and the expensive half — TMDB, OMDb, the scoring —
 * is identical for everybody.
 *
 * Costs **no queries at all** for a film nobody has used. A watchlist row points
 * at a local `movies.id`, so with no local row there is nothing that could point
 * at it, and asking would be a round trip with a foregone answer. That is the
 * common case on a public page.
 */
export async function isFilmWatched(
  tmdbId: string,
  userId: number | null,
): Promise<boolean> {
  if (userId == null) return false;

  const movie = await movieRepository.findByTmdbId(tmdbId);
  if (!movie) return false;

  const entries = await watchlistRepository.findByUserAndMovieIds(userId, [movie.id]);
  return entries.length > 0;
}

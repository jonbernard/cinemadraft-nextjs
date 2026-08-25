import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { deleteReview } from '@/actions/reviews/delete-review';
import { saveReview } from '@/actions/reviews/save-review';
import { setWatched } from '@/actions/watchlist/set-watched';
import { CinemaFrame } from '@/components/CinemaFrame';
import { CreditsPanel } from '@/components/CreditsPanel';
import { Fact, FilmFacts } from '@/components/FilmFacts';
import { FilmPointsPanel } from '@/components/FilmPointsPanel';
import { PosterCarousel } from '@/components/PosterCarousel';
import { RatingChip } from '@/components/RatingChip';
import { RemoteImage } from '@/components/RemoteImage';
import { SectionHead } from '@/components/SectionHead';
import { TrailerReel } from '@/components/TrailerReel';
import { WatchedToggle } from '@/components/WatchedToggle';
import { YourReview } from '@/components/YourReview';
import { getCurrentUser } from '@/lib/auth';
import { canonical } from '@/lib/seo';
import { type FilmPage, isFilmWatched, loadFilmPage } from '@/lib/services/film';
import { loadMyReview } from '@/lib/services/reviews';
import { formatMoney, formatReleaseDate, formatRuntime } from '@/lib/utils/format';

/**
 * One film (P10.T5, T6, T9).
 *
 * 🔴 **Keyed by TMDB id, not by our own.** That is how the source app addressed
 * it (`/movie/:id`, and `GET /points/movie/:tmdbId`), and it is the only key that
 * works: `movies` holds the 1,355 films this league has drafted or nominated, so
 * a local id exists for almost none of the catalogue. The screenshots show the
 * page working for exactly such a film.
 *
 * Public (D44), and it **never writes** (D63) — see `lib/services/film.ts` for
 * why that is a decision rather than an omission.
 */

/**
 * Validate the id before spending a TMDB request on it.
 *
 * 🔴 `/films/../..` and `/films/%00` both reach this handler. TMDB ids are
 * integers, so anything else is a 404 without a round trip — which also means a
 * crawler walking nonsense URLs cannot burn the rate limit.
 */
function toTmdbId(raw: string): string | null {
  return /^\d{1,12}$/.test(raw) ? raw : null;
}

/**
 * What a shared link unfurls to.
 *
 * This is the app's most-shared URL — a film page gets pasted into the league's
 * chat every week — so a Slack or iMessage preview reading "Cinemadraft" for all
 * of them is a real loss. The description prefers the tagline, which is written
 * to be read cold, and falls back to the synopsis.
 */
export async function generateMetadata({
  params,
}: PageProps<'/films/[tmdbId]'>): Promise<Metadata> {
  const { tmdbId } = await params;
  const id = toTmdbId(tmdbId);
  if (!id) return { title: 'Not here' };

  const film = await loadFilmPage(id);
  if (!film) return { title: 'Not here' };

  const year = film.year ? ` (${film.year})` : '';
  const description = film.tagline ?? film.overview ?? undefined;

  return {
    title: `${film.title}${year}`,
    description,
    // The app's most-shared URL, and the one most likely to be found by
    // search — so it is the one that most needs a stable canonical (P15.T6).
    alternates: { canonical: canonical(`/films/${id}`) },
    openGraph: {
      title: `${film.title}${year}`,
      description,
      // 🔴 No `images` here on purpose. An explicit list overrides the
      // `opengraph-image.tsx` beside this file, and that card carries the
      // poster, the title and the mark — a bare TMDB backdrop carries none of
      // them and is indistinguishable from any other site's share of the same
      // still (P15.T6).
    },
  };
}

export default async function FilmPageRoute({ params }: PageProps<'/films/[tmdbId]'>) {
  const { tmdbId } = await params;
  const id = toTmdbId(tmdbId);
  if (!id) notFound();

  const film = await loadFilmPage(id);
  if (!film) notFound();

  // The session decides whether the watched badge renders at all — the source
  // hid it for anonymous readers too. Resolved on the server because Clerk 7
  // removed `<SignedIn>`, and because it avoids the badge flickering in.
  const { userId } = await auth();
  const user = userId ? await getCurrentUser() : null;
  const [watched, myReview] = await Promise.all([
    isFilmWatched(id, user?.id ?? null),
    loadMyReview(id, user?.id ?? null),
  ]);

  return (
    <>
      <FilmBanner film={film} isSignedIn={userId != null} watched={watched} />

      <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-2 md:px-8">
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-4">
            <SectionHead as="h2">About</SectionHead>

            <FilmFacts>
              <Fact label="Runtime" value={formatRuntime(film.runtimeMinutes)} />
              <Fact label="Language" value={film.language} />
              <Fact label="Tagline" value={film.tagline} />
              {film.overview ? (
                <Fact label="Overview">
                  <p className="font-prose text-base leading-relaxed">{film.overview}</p>
                </Fact>
              ) : null}
              <Fact
                label="Genres"
                value={film.genres.length > 0 ? film.genres.join(', ') : null}
              />
              <Fact label="Released" value={formatReleaseDate(film.releaseDate)} />
              <Fact label="Budget" value={formatMoney(film.budget)} />
              <Fact label="Revenue" value={formatMoney(film.revenue)} />
              <Fact label="Box office" value={film.facts?.boxOffice ?? null} />
              {film.productionCompanies.length > 0 ? (
                <Fact label="Production">
                  <ul className="flex flex-col gap-0.5">
                    {film.productionCompanies.map((company) => (
                      <li key={company}>{company}</li>
                    ))}
                  </ul>
                </Fact>
              ) : null}
              <Ratings film={film} />
            </FilmFacts>
          </section>

          {user ? (
            <YourReview
              tmdbId={film.tmdbId}
              title={film.title}
              review={myReview}
              onSave={saveReview}
              onDelete={deleteReview}
            />
          ) : null}

          <CreditsPanel departments={film.crew} />
        </div>

        <div className="flex flex-col gap-8">
          {film.scoring ? (
            <FilmPointsPanel scoring={film.scoring} title={film.title} />
          ) : null}

          <TrailerReel trailers={film.trailers} />

          {film.posterUrls.length > 0 ? (
            <section className="flex flex-col gap-3">
              <SectionHead as="h2">Posters</SectionHead>
              <PosterCarousel title={film.title} posterUrls={film.posterUrls} />
            </section>
          ) : null}

          <SimilarFilms films={film.similar} />
        </div>
      </div>
    </>
  );
}

/**
 * The banner: backdrop, title, year, rating box.
 *
 * 🔴 **A scrim, not trust in the image.** This is the one place the token palette
 * cannot guarantee the 4.5:1 §6.7 requires, because the background is an
 * arbitrary photograph — a bright frame puts near-white text on near-white sky.
 * The gradient to `bg-base` makes the bottom of the banner the app's own ground
 * regardless of what the still looks like, and the text sits there.
 */
function FilmBanner({
  film,
  isSignedIn,
  watched,
}: {
  film: FilmPage;
  isSignedIn: boolean;
  watched: boolean;
}) {
  return (
    <header className="relative mb-8">
      <CinemaFrame className="bg-bg-raised">
        {film.backdropUrl ? (
          <RemoteImage
            src={film.backdropUrl}
            alt=""
            fill
            sizes="100vw"
            // The banner is the largest thing above the fold, so it is the LCP
            // element and must not be lazy.
            priority
            className="object-cover"
          />
        ) : null}
        <div className="from-bg-base absolute inset-0 bg-gradient-to-t via-transparent" />
      </CinemaFrame>

      {/* 🔴 `relative` is load-bearing, not decoration. This block is pulled up
          over the banner by `-mt-16`, and the banner above it is positioned —
          within one stacking context a positioned element paints *above* a
          static one regardless of source order, so without this the title was
          rendered behind the backdrop and simply invisible. Found in a browser;
          nothing in jsdom could have caught it. */}
      <div className="relative mx-auto -mt-16 flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 md:px-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-text-primary text-3xl font-bold tracking-[-0.02em] md:text-5xl">
            {film.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            {film.year ? (
              <span className="text-text-secondary tabular font-mono text-sm">
                {film.year}
              </span>
            ) : null}
            {/* The MPAA rating in a bordered box, as the screenshot shows — but
                as type in a rule, not one of the source's eleven trademarked
                rating glyphs (`src/pages/movie/icons`), which would have to be
                redrawn to no benefit. */}
            {film.facts?.mpaaRating ? (
              <span className="border-border-rule text-text-secondary border px-2 py-0.5 font-sans text-xs">
                {film.facts.mpaaRating}
              </span>
            ) : null}
          </div>
        </div>

        {isSignedIn ? (
          <WatchedToggle
            tmdbId={film.tmdbId}
            title={film.title}
            watched={watched}
            onChange={setWatched}
          />
        ) : null}
      </div>
    </header>
  );
}

/**
 * The critic scores, or nothing.
 *
 * Both come from OMDb, which may have no key configured at all — so the whole row
 * is omitted rather than rendered with a gap. Rotten Tomatoes is a number and a
 * name here, not the source's `/images/rt.png` tomato: that imagery is
 * Fandango's, and the chip carries the same information.
 */
function Ratings({ film }: { film: FilmPage }) {
  const metacritic = film.facts?.metacritic ?? null;
  const rottenTomatoes = film.facts?.rottenTomatoes ?? null;
  if (metacritic == null && rottenTomatoes == null) return null;

  return (
    <Fact label="Ratings">
      <div className="flex flex-col gap-3">
        {metacritic == null ? null : <RatingChip label="Metacritic" score={metacritic} />}
        {rottenTomatoes == null ? null : (
          <RatingChip label="Rotten Tomatoes" score={rottenTomatoes} />
        )}
      </div>
    </Fact>
  );
}

/** Seven films TMDB thinks are like this one (T9), out of the same request. */
function SimilarFilms({ films }: { films: FilmPage['similar'] }) {
  if (films.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <SectionHead as="h2">Similar films</SectionHead>

      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {films.map((film) => (
          <li key={film.tmdbId}>
            <Link
              href={`/films/${film.tmdbId}`}
              className="focus-visible:outline-accent-fill group flex flex-col gap-2 focus-visible:outline-2"
            >
              <span className="poster-radius bg-bg-raised light:border light:border-border-rule relative block aspect-[2/3] overflow-hidden">
                {film.posterUrl ? (
                  <RemoteImage
                    src={film.posterUrl}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 12vw, 33vw"
                    loading="lazy"
                    className="object-cover"
                  />
                ) : null}
              </span>
              <span className="text-text-secondary group-hover:text-text-primary line-clamp-2 text-xs leading-tight">
                {film.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

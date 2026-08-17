import Link from 'next/link';

import { setWatched } from '@/actions/watchlist/set-watched';
import { WatchedToggle } from '@/components/WatchedToggle';
import type { BrowseMonth as BrowseMonthData } from '@/lib/services/browse';

/**
 * One month's films: the month in a card, the posters beside it.
 *
 * The card is sticky from `md` up, as the source had it — scrolling a long month
 * keeps the label that says which month you are in, which is the one piece of
 * context the posters do not carry.
 *
 * 🔴 **Two columns at 375px, six at `lg`.** A poster is 2:3, so three across on a
 * phone leaves each about 110px wide and the titles below them wrap to four
 * lines; two is legible. Every frame declares its aspect ratio so the grid does
 * not reflow as images arrive (Core Web Vitals: CLS).
 *
 * The title sits **below** the poster and wraps freely, matching the source and
 * for the reason `PosterFrame` gives: the current app overlays it on the artwork
 * and truncates to "One Ba…", so the film becomes unidentifiable at exactly the
 * moment you are scanning for it.
 */
export function BrowseMonth({
  month,
  isSignedIn,
}: {
  month: BrowseMonthData;
  isSignedIn: boolean;
}) {
  return (
    <section className="flex flex-col gap-4 md:flex-row md:gap-6">
      <div className="md:w-40 md:shrink-0">
        <h2 className="border-border-rule bg-bg-surface font-display text-text-primary tabular border p-3 text-xl font-bold tracking-wide [font-variation-settings:'wdth'_118] md:sticky md:top-20 md:text-right md:text-2xl">
          {month.label}
        </h2>
      </div>

      <ul className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {month.films.map((film) => (
          <li key={film.tmdbId} className="flex flex-col gap-2">
            {/* The poster and the badge are siblings, not nested: a button inside
                a link is invalid HTML, and in practice the link swallows the
                press so marking a film watched would navigate instead. */}
            <div className="relative">
              <Link
                href={`/films/${film.tmdbId}`}
                className="focus-visible:outline-accent-fill group block focus-visible:outline-2"
              >
                {/* biome-ignore lint/performance/noImgElement: swapped for next/image in Phase 11, which needs the remote host allowlist configured first */}
                <img
                  src={film.posterUrl}
                  alt=""
                  className="bg-bg-raised border-border-rule aspect-[2/3] w-full border object-cover transition-opacity group-hover:opacity-90"
                  loading="lazy"
                />
              </Link>

              {isSignedIn ? (
                <WatchedToggle
                  tmdbId={film.tmdbId}
                  title={film.title}
                  watched={film.watched}
                  onChange={setWatched}
                  className="absolute bottom-0 right-0"
                />
              ) : null}
            </div>

            <Link
              href={`/films/${film.tmdbId}`}
              className="text-text-secondary hover:text-text-primary focus-visible:outline-accent-fill text-xs leading-tight focus-visible:outline-2"
            >
              {film.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

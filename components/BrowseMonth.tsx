import Link from 'next/link';

import { setWatched } from '@/actions/watchlist/set-watched';
import { RemoteImage } from '@/components/RemoteImage';
import { SectionHead } from '@/components/SectionHead';
import { WatchedToggle } from '@/components/WatchedToggle';
import type { BrowseMonth as BrowseMonthData } from '@/lib/services/browse';

/** UTC, to match the UTC month the service groups by. */
const monthName = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * `07/2026` → `July 2026`. Anything else passes through: `Undated` is a real
 * label the service emits, and it is already the words a reader should see.
 */
function monthHeading(label: string): string {
  const parts = /^(\d{2})\/(\d{4})$/.exec(label);
  if (!parts) return label;
  return monthName.format(Date.UTC(Number(parts[2]), Number(parts[1]) - 1, 1));
}

/**
 * One month's films: the month named above them, the posters filling the width.
 *
 * 🔴 **Two columns at 375px, six at `lg`.** A poster is 2:3, so three across on
 * a phone leaves each about 110px wide and the titles below them wrap to four
 * lines; two is legible. Every frame declares its aspect ratio so the grid does
 * not reflow as images arrive (Core Web Vitals: CLS).
 *
 * The title sits below the poster and wraps freely: the current app overlays it
 * on the artwork and truncates to "One Ba…", so the film becomes unidentifiable
 * at exactly the moment you are scanning for it.
 */
export function BrowseMonth({
  month,
  isSignedIn,
}: {
  month: BrowseMonthData;
  isSignedIn: boolean;
}) {
  const count = month.films.length;

  return (
    <section>
      <SectionHead as="h2" eyebrow={`${count} ${count === 1 ? 'film' : 'films'}`}>
        {monthHeading(month.label)}
      </SectionHead>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {month.films.map((film) => (
          <li key={film.tmdbId} className="flex flex-col gap-2">
            {/* The poster and the badge are siblings, not nested: a button inside
                a link is invalid HTML, and in practice the link swallows the
                press so marking a film watched would navigate instead. */}
            <div className="relative">
              <Link
                href={`/films/${film.tmdbId}`}
                className="focus-visible:outline-accent-fill group relative block aspect-[2/3] focus-visible:outline-2"
              >
                <RemoteImage
                  src={film.posterUrl}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 50vw"
                  loading="lazy"
                  className="poster-radius bg-bg-raised light:border light:border-border-rule object-cover transition-opacity group-hover:opacity-90"
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
              className="text-text-secondary hover:text-text-primary focus-visible:outline-accent-fill text-sm leading-tight focus-visible:outline-2"
            >
              {film.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import Link from 'next/link';

import { BrowseMonth } from '@/components/BrowseMonth';
import { EmptyState } from '@/components/EmptyState';
import { SectionHead } from '@/components/SectionHead';
import { StatusChip } from '@/components/StatusChip';
import { getCurrentUser } from '@/lib/auth';
import type { BrowseWhen } from '@/lib/external/tmdb-discover';
import { canonical } from '@/lib/seo';
import { loadBrowse } from '@/lib/services/browse';
import { cn } from '@/lib/utils/cn';

/**
 * Browse the catalogue (P10.T7).
 *
 * 🔴 **The state is in the URL, not in the component** (D65). The source held
 * both the past/future choice and the accumulated pages in `useState` and
 * appended pages with an intersection observer
 * (`src/pages/browse/index.js:29-70`), which cost four things: a film could not
 * be linked, the back button lost the reader's place, page 12 was unreachable
 * from a keyboard, and the sentinel re-fired on every re-render. `?when=&page=`
 * fixes all four, works before hydration, and is crawlable.
 *
 * Public (D44), like the film pages it links to.
 */

export const metadata: Metadata = {
  title: 'Browse',
  description: 'Films in and out of cinemas, month by month.',
  // Query-free on purpose: `?when=` and `?page=` are the same document from a
  // different angle, and one canonical keeps them from competing (P15.T6).
  alternates: { canonical: canonical('/browse') },
};

/**
 * Anything that is not `future` is `past`.
 *
 * The past side is the default because it is the one that always has content —
 * the future side thins out to a handful of announced titles in a quiet month.
 */
function toWhen(raw: string | undefined): BrowseWhen {
  return raw === 'future' ? 'future' : 'past';
}

/**
 * A page number, or 1.
 *
 * 🔴 `?page=abc`, `?page=-4` and `?page=1e9` all arrive here. `discoverFilms`
 * clamps as well, deliberately — this is the layer that decides what the *link*
 * says, and that one decides what TMDB is asked.
 */
function toPage(raw: string | undefined): number {
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function BrowsePage({ searchParams }: PageProps<'/browse'>) {
  const params = await searchParams;
  const when = toWhen(typeof params.when === 'string' ? params.when : undefined);
  const page = toPage(typeof params.page === 'string' ? params.page : undefined);

  // The badge renders only for a signed-in reader, and the marks are theirs.
  const { userId } = await auth();
  const user = userId ? await getCurrentUser() : null;

  const shelf = await loadBrowse({ when, page, userId: user?.id ?? null });
  const hasMore = shelf.page < shelf.pageCount;
  const films = shelf.months.reduce((total, month) => total + month.films.length, 0);

  return (
    // No ground and no padding of its own: `AppShell`'s content panel owns
    // both, and repainting `bg-bg-base` here paints its outer ground back over
    // the panel this sits inside.
    <>
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <SectionHead
            as="h1"
            eyebrow={
              films === 0 ? undefined : `${films} ${films === 1 ? 'film' : 'films'}`
            }
            right={shelf.pageCount > 0 ? `${shelf.page}/${shelf.pageCount}` : undefined}
          >
            Browse
          </SectionHead>

          {/* 🔴 Two links, not a switch. The source used a single `<Switch>`
              labelled "The Future/The Past", which does not say which side it is
              currently on — a checked toggle reading both options at once is
              ambiguous, and it was the *unchecked* state that meant "future". Two
              controls with `aria-current` state where you are, and being links
              makes each side a real URL. */}
          <nav aria-label="Which films" className="flex items-center gap-2">
            <WhenLink when="past" current={when} label="The past" />
            <WhenLink when="future" current={when} label="The future" />
          </nav>
        </header>

        {shelf.months.length === 0 ? (
          <EmptyState
            title="Nothing to show"
            action={
              when === 'future'
                ? { label: 'Look at the past', href: '/browse' }
                : undefined
            }
          >
            {when === 'future'
              ? 'Nothing is scheduled for release yet.'
              : 'The film catalogue could not be reached. Try again in a moment.'}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-10">
            {shelf.months.map((month) => (
              <BrowseMonth key={month.label} month={month} isSignedIn={userId != null} />
            ))}
          </div>
        )}

        {/* 🔴 A real link, not an intersection observer. It works before
            hydration, it can be opened in a new tab, and it is reachable with a
            keyboard — none of which was true of the source's infinite scroll. */}
        {hasMore ? (
          <nav aria-label="More films" className="flex justify-center">
            <Link
              href={`/browse?when=${when}&page=${shelf.page + 1}`}
              className="bg-bg-raised text-text-primary hover:text-accent-text focus-visible:outline-accent-fill flex min-h-11 items-center gap-2 rounded-sm px-6 text-sm transition-colors focus-visible:outline-2"
            >
              Show more
              <span className="text-text-dim tabular font-mono text-xs">
                {shelf.page + 1}/{shelf.pageCount}
              </span>
            </Link>
          </nav>
        ) : null}
      </div>
    </>
  );
}

/**
 * One side of the past/future choice, as a filter pill (D73 — a filter row is
 * one of the two places a pill is allowed).
 *
 * A `Link` around the chip rather than a `Button`: every behaviour here comes
 * from being a real URL — `aria-current`, Back, open-in-new-tab, and rendering
 * before any JavaScript arrives. The 44px minimum sits on the link so the
 * touch target is larger than the pill it draws.
 */
function WhenLink({
  when,
  current,
  label,
}: {
  when: BrowseWhen;
  current: BrowseWhen;
  label: string;
}) {
  const isCurrent = when === current;

  return (
    <Link
      // Deliberately drops `page`: switching sides resets to the first page,
      // because page 12 of the past is not page 12 of the future and landing
      // there would look like an empty result.
      href={`/browse?when=${when}`}
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

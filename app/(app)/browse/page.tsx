import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import Link from 'next/link';

import { BrowseList } from '@/components/BrowseList';
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
 * 🔴 **The past/future choice is in the URL; the pages append** (D65, amended
 * by D80). D65 replaced the source's intersection observer with `?page=` links
 * and bought four things: a linkable view, a working Back button, keyboard
 * reachability, and crawlability. The owner was shown that list and chose
 * auto-append anyway — browse is grazed by scrolling, and a button every twenty
 * films is the wrong friction on the one page whose job is grazing.
 *
 * Three of the four are genuinely traded away. The fourth is kept for nothing:
 * the `<noscript>` link below is a crawl path into pages 2..N, and `?page=`
 * still works as an entry point, so a shared link to page 3 lands on page 3 and
 * appends from there. The *side* stays in the URL either way — that part of D65
 * is untouched.
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

  return (
    // No ground and no padding of its own: `AppShell`'s content panel owns
    // both, and repainting `bg-bg-base` here paints its outer ground back over
    // the panel this sits inside.
    <>
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          {/* No film count and no page indicator here. Both were true of the
              first page only, and the list now grows underneath them — a header
              reading "20 films · 1/9" above forty films is worse than no header
              at all. Each month still counts its own. */}
          <SectionHead as="h1">Browse</SectionHead>

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
          <BrowseList when={when} initial={shelf} isSignedIn={userId != null} />
        )}

        {/* 🔴 The crawl path D80 kept. Readers never see it — it exists so the
            sitemap (P15.T6) has a way into pages 2..N, which the intersection
            sentinel does not provide to anything without JavaScript. */}
        {hasMore ? (
          <noscript>
            <a href={`/browse?when=${when}&page=${shelf.page + 1}`}>
              More films, page {shelf.page + 1} of {shelf.pageCount}
            </a>
          </noscript>
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

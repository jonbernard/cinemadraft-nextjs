'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { loadBrowsePage } from '@/actions/browse/load-page';
import { BrowseMonth } from '@/components/films/BrowseMonth';
import { Button } from '@/components/ui/Button';
import type { BrowseWhen } from '@/lib/external/tmdb-discover';
import type { BrowseMonth as BrowseMonthData, BrowsePage } from '@/lib/services/browse';

/**
 * The browse shelf, appending as the reader reaches the bottom (P15.T7, D80).
 *
 * 🔴 **This is a deliberate trade, not a regression.** D65 replaced the
 * source's intersection observer with `?page=` links and bought four things: a
 * linkable page, a working Back button, keyboard reachability, and
 * crawlability. D80 amends it — browse is grazed by scrolling, and a button
 * every twenty films is the wrong friction on the one page whose job is
 * grazing. Three of those four are genuinely given up. The fourth is kept for
 * nothing: the page still renders a `<noscript>` link to page N+1, so the
 * sitemap has a crawl path into the catalogue, and `?page=` still works as an
 * entry point.
 *
 * Two failure modes the source had, and the shapes that prevent them here:
 *
 * - **The sentinel re-firing on every re-render.** The fetch is guarded by a
 *   ref, not by state: `loading` is read and set synchronously before the first
 *   `await`, so two callbacks in the same tick cannot both get through. A state
 *   flag is set asynchronously and would let the second one in.
 * - **Appending past the end.** The sentinel is not rendered once the last page
 *   is in hand, so the observer's cleanup unobserves it — otherwise every
 *   scroll to the bottom of a finished list fires a request that returns
 *   nothing.
 */
export function BrowseList({
  when,
  initial,
  isSignedIn,
}: {
  when: BrowseWhen;
  /** The first page, rendered on the server so the shelf exists before hydration. */
  initial: BrowsePage;
  isSignedIn: boolean;
}) {
  const [months, setMonths] = useState<BrowseMonthData[]>(initial.months);
  const [page, setPage] = useState(initial.page);
  const [error, setError] = useState<string | null>(null);
  /**
   * 🔴 A page that came back with no films ends the list, whatever the page
   * count says. The future side is sorted by popularity and trimmed by a floor
   * (P15.T9), so its 71 pages hold films for about three of them — without
   * this, every further scroll fires a request that returns nothing, which is
   * precisely the failure D80 traded the "Show more" link away to avoid.
   */
  const [ended, setEnded] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  // The page in hand, in a form the observer callback can read without being
  // re-created — a stale closure here would ask for the same page forever.
  const loaded = useRef(initial.page);
  const loading = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const pageCount = initial.pageCount;
  // No sentinel while an error is showing: the retry button is the way back,
  // and an observer left in place would hammer a failing upstream instead.
  const hasMore = page < pageCount && error === null && !ended;

  const loadMore = useCallback(async () => {
    if (loading.current) return;
    const next = loaded.current + 1;
    if (next > pageCount) return;

    loading.current = true;
    setError(null);
    setAnnouncement('Loading more films');

    try {
      const result = await loadBrowsePage({ when, page: next });

      if (!result.ok) {
        setError(result.message);
        setAnnouncement('');
        return;
      }

      loaded.current = result.data.page;
      setPage(result.data.page);

      // 🔴 Amends D80 — the new D-number is assigned by P17.T26.
      //
      // D80 weighed auto-append against "a linkable page, a working Back
      // button, keyboard reachability, and crawlability" and chose append.
      // That choice is untouched: no button comes back and nothing on screen
      // changes. Only the address bar does, which buys back one of the four —
      // a shareable position, and a return from a film page that lands where
      // the reader left rather than at the top of page 1.
      //
      // 🔴 `replaceState`, never `pushState`. `pushState` would make Back walk
      // back through every appended page, which is the infinite-scroll history
      // trap and is strictly worse than what D80 accepted.
      //
      // 🔴 Native history, never `router.replace`. `router.replace` re-runs the
      // Server Component and re-mounts this list with a fresh `initial`,
      // discarding every month already appended. Next integrates the native
      // calls into the router (docs: Linking and Navigating § Native History
      // API), so `useSearchParams` stays in step either way.
      //
      // Built from props, not from `window.location`: a navigation in flight
      // could have changed the latter under us.
      window.history.replaceState(null, '', `?when=${when}&page=${result.data.page}`);
      if (result.data.months.length === 0) setEnded(true);
      setMonths((current) => merge(current, result.data.months));

      const added = result.data.months.reduce(
        (total, month) => total + month.films.length,
        0,
      );
      setAnnouncement(`${added} more ${added === 1 ? 'film' : 'films'} added`);
    } finally {
      loading.current = false;
    }
  }, [when, pageCount]);

  const retry = useCallback(() => {
    void loadMore();
  }, [loadMore]);

  useEffect(() => {
    const node = sentinel.current;
    // `hasMore` is read here as well as in the render so that the effect
    // genuinely depends on it: when the last page lands, the sentinel unmounts
    // and this cleanup unobserves it, rather than leaving an observer holding a
    // detached node until the whole list goes away.
    if (!hasMore || !node) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  return (
    <div className="flex flex-col gap-10">
      {months.map((month) => (
        <BrowseMonth key={month.label} month={month} isSignedIn={isSignedIn} />
      ))}

      {/* 🔴 The reader is told the page grew under them, which is the single
          biggest accessibility cost of infinite scroll. Polite, so it waits for
          a gap rather than interrupting whatever is being read. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {error ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-text-secondary text-sm">{error}</p>
          <Button variant="outlined" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : null}

      {hasMore ? (
        <div ref={sentinel} data-testid="browse-sentinel" aria-hidden="true" />
      ) : null}
    </div>
  );
}

/**
 * Merge a fetched page into the list, folding films into a month already shown.
 *
 * Two pages routinely carry films from the same month, and pushing a second
 * "October 2026" section is the visible bug that shape invites. `Map.set` on an
 * existing key keeps its original position, so the month order the service
 * chose survives the merge.
 */
function merge(
  current: BrowseMonthData[],
  incoming: BrowseMonthData[],
): BrowseMonthData[] {
  const byLabel = new Map(current.map((month) => [month.label, month]));
  for (const month of incoming) {
    const existing = byLabel.get(month.label);
    byLabel.set(
      month.label,
      existing ? { ...existing, films: [...existing.films, ...month.films] } : month,
    );
  }
  return [...byLabel.values()];
}

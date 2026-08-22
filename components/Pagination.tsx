import Link from 'next/link';

import { cn } from '@/lib/utils/cn';

/**
 * Paging as links, not buttons.
 *
 * Every page of a list is a URL, so it can be shared, opened in a new tab,
 * reached with Back and rendered before any JavaScript arrives — none of which
 * a click handler over component state gives you.
 *
 * The other query parameters are passed in rather than read from a hook so this
 * stays a Server Component: `useSearchParams` would make it a client bundle for
 * the sake of a string the page already holds.
 */
export function Pagination({
  page,
  pageCount,
  basePath,
  params = {},
  label = 'Pages',
  className,
}: {
  page: number;
  pageCount: number;
  basePath: string;
  /** Everything else in the query string, carried across so a sort survives paging. */
  params?: Record<string, string>;
  label?: string;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  const href = (target: number) => {
    const query = new URLSearchParams({ ...params, page: String(target) });
    return `${basePath}?${query.toString()}`;
  };

  return (
    <nav aria-label={label} className={cn('flex justify-center', className)}>
      {/* gap-2 is the 8px minimum between touch targets; each cell is 44px. */}
      <ol className="flex items-center gap-2">
        {page > 1 ? (
          <li>
            <Step href={href(page - 1)} direction="previous" />
          </li>
        ) : null}

        {pageWindow(page, pageCount).map((target, index) =>
          target === null ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: a gap has no identity of its own, and there are at most two
            <li key={`gap-${index}`} aria-hidden="true" className="text-text-dim px-1">
              …
            </li>
          ) : (
            <li key={target}>
              <Link
                href={href(target)}
                aria-current={target === page ? 'page' : undefined}
                aria-label={`Page ${target}`}
                className={cn(
                  'tabular focus-visible:outline-accent-fill flex min-h-11 min-w-11 items-center justify-center rounded-sm font-mono text-sm focus-visible:outline-2',
                  target === page
                    ? 'bg-accent-fill font-semibold text-white'
                    : 'bg-bg-raised text-text-secondary hover:text-text-primary',
                )}
              >
                {target}
              </Link>
            </li>
          ),
        )}

        {page < pageCount ? (
          <li>
            <Step href={href(page + 1)} direction="next" />
          </li>
        ) : null}
      </ol>
    </nav>
  );
}

/**
 * The pages worth drawing: the ends, the current page and its neighbours, with
 * `null` standing for a gap.
 *
 * Eleven pages fit on a phone only as five cells; the two ends stay because
 * "back to the start" and "the last page" are the two jumps a reader actually
 * makes.
 */
function pageWindow(page: number, pageCount: number): (number | null)[] {
  const targets = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  const shown = [...targets]
    .filter((n) => n >= 1 && n <= pageCount)
    .sort((a, b) => a - b);

  return shown.flatMap((target, index) => {
    const previous = shown[index - 1];
    return previous !== undefined && target - previous > 1 ? [null, target] : [target];
  });
}

function Step({ href, direction }: { href: string; direction: 'previous' | 'next' }) {
  return (
    <Link
      href={href}
      className="bg-bg-raised text-text-secondary hover:text-text-primary focus-visible:outline-accent-fill flex min-h-11 min-w-11 items-center justify-center rounded-sm focus-visible:outline-2"
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={direction === 'previous' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
      </svg>
      <span className="sr-only">
        {direction === 'previous' ? 'Previous' : 'Next'} page
      </span>
    </Link>
  );
}

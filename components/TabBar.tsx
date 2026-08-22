import Link from 'next/link';

import { PRIMARY_LINKS } from '@/lib/nav/links';
import { cn } from '@/lib/utils/cn';

/**
 * The bottom tab bar (D75).
 *
 * The phone counterpart to `NavRail`: five equal slots — the four `primary`
 * destinations plus a `More` trigger — fixed to the bottom and clearing the
 * safe area. Five is the ceiling before 44px touch targets stop fitting a
 * 390px phone, which is why the three `yours` destinations live behind
 * `MoreSheet` instead of being dropped; every destination stays reachable,
 * grouping only changes how many taps it costs.
 *
 * `onMore`/`isMoreOpen`/`moreId` are lifted to the caller rather than owned
 * here, because opening `MoreSheet`'s native `<dialog>` needs the caller's
 * ref to it (see `MoreSheet`) — the same shape `AppNav`'s trigger/drawer pair
 * already uses, which is what Task 16 ports.
 *
 * `pathname` is a prop for the same reason `NavRail` takes one: it renders in
 * Storybook without a router, and every active state is a story rather than
 * something only reachable by navigating.
 */
export function TabBar({
  pathname,
  onMore,
  isMoreOpen,
  moreId,
}: {
  pathname: string;
  onMore: () => void;
  isMoreOpen: boolean;
  moreId: string;
}) {
  const links = PRIMARY_LINKS.filter((link) => link.ready);

  return (
    <nav
      aria-label="Primary, mobile"
      className="bg-bg-surface xl:hidden fixed inset-x-0 bottom-0 z-40 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {links.map((link) => {
        const current = isCurrent(link.href, pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'focus-visible:outline-accent-fill relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[11px] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2',
              current
                ? // Two signals beyond aria-current: full-strength text and
                  // the carmine bar along the top edge.
                  'text-text-primary before:bg-accent-fill before:absolute before:inset-x-0 before:top-0 before:h-0.5'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <TabIcon path={link.path} />
            {link.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onMore}
        aria-expanded={isMoreOpen}
        aria-controls={moreId}
        className="focus-visible:outline-accent-fill text-text-secondary hover:text-text-primary flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[11px] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <MoreIcon />
        More
      </button>
    </nav>
  );
}

function isCurrent(href: string, pathname: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

function TabIcon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="h-[22px] w-[22px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="h-[22px] w-[22px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

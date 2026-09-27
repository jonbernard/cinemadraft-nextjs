import Link from 'next/link';

import { PRIMARY_LINKS } from '@/lib/nav/links';
import { cn } from '@/lib/utils/cn';

/**
 * The bottom bar (D75): the phone and tablet navigation, and nothing else.
 *
 * The `<nav>` inside is the phone counterpart to `NavRail`: five equal slots —
 * the four `primary` destinations plus a `More` trigger. Five is the ceiling
 * before 44px touch targets stop fitting a 390px phone, which is why the three
 * `yours` destinations live behind `MoreSheet` instead of being dropped; every
 * destination stays reachable, grouping only changes how many taps it costs.
 *
 * 🔴 **Destinations only, at every width (D128).** Search and the account
 * control used to sit on this row beside the `<nav>`, `hidden sm:flex`, because
 * at 390px the five slots have 78px each and "Award shows" renders 64.8px
 * wide — two 44px squares would wrap that label and grow the bar from 48.5px
 * to 65px, so below `sm` they lived in `MoreSheet` instead. The owner moved
 * both to `TopBar`, which has the room this row never did. The bar is the five
 * slots and nothing else now, and from `sm` up the 88px the squares took goes
 * back to the slots.
 *
 * 🔴 Five, not six, even with the chrome gone: a sixth slot at 390px is 65px,
 * which "Award shows" clears by 0.2px — one font-rendering difference from
 * wrapping, and D75's ceiling besides. So no destination came out of the More
 * sheet.
 *
 * 🔴 **The identity is not here either (P14.T16).** `TopBar` carries the full
 * lockup; the `markOnly` square that used to open this row is gone rather than
 * hidden.
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
    // The ground, the fixed position and the safe area live on this wrapper and
    // the landmark holds destinations only. Nothing else sits in the row since
    // D128 moved search and the account control to `TopBar`.
    <div
      className="bg-bg-panel xl:hidden fixed inset-x-0 bottom-0 z-40 flex items-stretch"
      // One of the shell's four chrome hooks; `AppShell` carries two of the
      // others and the reasoning, `TopBar` the last. The bar is already
      // `xl:hidden`, so it is
      // never on screen at the width TV mode exists for — it is marked anyway
      // so "nothing but the room" is true at every width a browser can be made
      // full-screen at, not only on a television.
      data-app-chrome
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* 🔴 Exactly five slots, and nothing else may join them. */}
      <nav aria-label="Primary, mobile" className="flex min-w-0 flex-1">
        {links.map((link) => {
          const current = isCurrent(link.href, pathname);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={current ? 'page' : undefined}
              className={cn(
                'focus-visible:outline-accent-fill relative flex min-h-11 flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2',
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
          className="focus-visible:outline-accent-fill text-text-secondary hover:text-text-primary flex min-h-11 flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
        >
          <MoreIcon />
          More
        </button>
      </nav>
    </div>
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

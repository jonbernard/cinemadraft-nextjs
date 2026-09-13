import Link from 'next/link';

import { PRIMARY_LINKS } from '@/lib/nav/links';
import { cn } from '@/lib/utils/cn';
import { AccountControl } from './AccountControl';

/**
 * The bottom bar (D75): the phone's navigation, and below `xl` the app's
 * chrome as well.
 *
 * The `<nav>` inside is the phone counterpart to `NavRail`: five equal slots —
 * the four `primary` destinations plus a `More` trigger. Five is the ceiling
 * before 44px touch targets stop fitting a 390px phone, which is why the three
 * `yours` destinations live behind `MoreSheet` instead of being dropped; every
 * destination stays reachable, grouping only changes how many taps it costs.
 *
 * 🔴 The chrome around it — search and the account control — is P17.T2's, and
 * it is outside the landmark on purpose. D75's five-item ceiling is about
 * *destinations*, the things a reader chooses between; the landmark keeps
 * exactly five children so a screen reader's list of destinations is
 * unchanged, no chrome control carries `aria-current`, and no chrome control
 * carries a visible label. That last one is the difference an eye parses before
 * it reads a word: every tab is an icon over an 11px label.
 *
 * 🔴 And that chrome is `hidden sm:flex`, which is a measurement, not a taste.
 * At 390px the five slots have 78px each and "Award shows" renders 64.8px
 * wide — the row has no slack. Subtracting two 44px chrome squares leaves
 * 60.4px a slot, the label wraps to two lines, and the bar grows 48.5px → 65px;
 * three squares leave 51.6px and do the same. The plan's pre-agreed relief
 * valve (drop the account control below `sm`) does not close it either, so the
 * whole chrome group starts at `sm`. That still closes the 1024–1280px dead
 * zone P17.T2 was about, and below `sm` the phone reaches search and its
 * account through `MoreSheet`, where D75 put them.
 *
 * 🔴 **The identity is not here any more (P14.T16).** The group used to be
 * three squares — a `markOnly` mark, search, the account control — and because
 * it was all `hidden sm:flex`, a phone below `sm` carried no wordmark anywhere
 * in the application. The owner called that out. The measurement above is why
 * un-hiding the mark here was never the fix: it is a statement about this row
 * having no slack, not about the wordmark. `TopBar` gives the phone a second
 * strip instead, carrying the full lockup at no cost to these five slots, so
 * the group here is two squares now and the mark is gone rather than hidden.
 *
 * `onMore`/`isMoreOpen`/`moreId` are lifted to the caller rather than owned
 * here, because opening `MoreSheet`'s native `<dialog>` needs the caller's
 * ref to it (see `MoreSheet`) — the same shape `AppNav`'s trigger/drawer pair
 * already uses, which is what Task 16 ports. `onSearch`/`searchId` arrive the
 * same way and for the same reason.
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
  isSignedIn,
  onSearch,
  searchId,
}: {
  pathname: string;
  onMore: () => void;
  isMoreOpen: boolean;
  moreId: string;
  isSignedIn: boolean;
  onSearch: () => void;
  searchId: string;
}) {
  const links = PRIMARY_LINKS.filter((link) => link.ready);

  return (
    // The ground, the fixed position and the safe area live here rather than on
    // the `<nav>`: the bar is the app's chrome as well as its navigation, and
    // the landmark must contain destinations only.
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

      {/* Search: the same trigger the strip carries above `xl`, so the icon is
          the same one. Icon-only on purpose — see the chrome note above. */}
      <button
        type="button"
        onClick={onSearch}
        aria-haspopup="dialog"
        aria-controls={searchId}
        className="text-text-secondary hover:text-text-primary focus-visible:outline-accent-fill hidden min-h-11 w-11 shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 sm:flex"
      >
        <SearchIcon />
        <span className="sr-only">Search</span>
      </button>

      <div className="hidden shrink-0 items-center sm:flex">
        <AccountControl isSignedIn={isSignedIn} compact />
      </div>
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

/**
 * The magnifier, shared with `AppShell`'s strip.
 *
 * It lives here rather than there because both need it and a copy is how two
 * icons drift — the bar and the strip are the same affordance at two widths and
 * must not diverge into two glyphs.
 */
export function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
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

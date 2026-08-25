import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import type { Ref } from 'react';

import { type NavLink, YOURS_LINKS } from '@/lib/nav/links';
import { cn } from '@/lib/utils/cn';
import { Eyebrow } from './Eyebrow';
import { type NotificationItem, NotificationsSection } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';

/**
 * 🔴 Still a native <dialog> opened with showModal(). The focus trap, Escape,
 * the inert background and the backdrop are four things that are easy to
 * write badly and free here — and this is deliberately the smallest possible
 * change to working, accessible code. Only the *presentation* moves from a
 * left drawer to a bottom sheet.
 *
 * The three `yours` destinations (D75) live here rather than on `TabBar`
 * itself: a phone bottom bar only has room for five slots at 44px targets,
 * and grouping the once-a-season pages behind one more tap keeps every
 * destination reachable without shrinking the tabs a member uses weekly.
 *
 * `yours` defaults to the real list and exists so the all-unready and
 * all-ready states are both testable and storyable — the same reason `NavRail`
 * takes a `yours` prop. `/list` is the first of the three to ship.
 *
 * `id`/`ref`/`pathname`/`isSignedIn` arrive from the caller: opening this
 * dialog needs a ref to it, and this is the shape Task 16 ports from
 * `AppNav`'s drawer. `ref` is a plain prop rather than `forwardRef` — React 19
 * passes it through like any other.
 */
export function MoreSheet({
  id,
  ref,
  pathname,
  isSignedIn,
  isAdmin = false,
  notifications = [],
  unreadCount = 0,
  yours = YOURS_LINKS,
  onSearch,
  searchId,
}: {
  id: string;
  ref?: Ref<HTMLDialogElement>;
  pathname: string;
  isSignedIn: boolean;
  isAdmin?: boolean;
  notifications?: NotificationItem[];
  unreadCount?: number;
  yours?: NavLink[];
  /** Opens the global search panel. Omitted in stories that render the sheet alone. */
  onSearch?: () => void;
  searchId?: string;
}) {
  // A nav entry pointing at a 404 is worse than a missing one — the same gate
  // `NavRail`'s `Group` and `TabBar` both apply. The heading and its divider
  // are gated with it below rather than left floating above an empty list.
  const visible = yours.filter((link) => link.ready);

  return (
    <dialog
      id={id}
      ref={ref}
      aria-label="More"
      className="bg-bg-surface text-text-primary mt-auto mb-0 w-full max-w-none rounded-t-lg rounded-b-none p-0 backdrop:bg-black/60 xl:hidden"
    >
      <div className="flex flex-col gap-4 p-4">
        {/* Above "Yours": the phone has no strip, so this is the only way to
            the search panel that is not a keyboard shortcut. */}
        {onSearch ? (
          <>
            <button
              type="button"
              onClick={onSearch}
              aria-haspopup="dialog"
              aria-controls={searchId}
              className="focus-visible:outline-accent-fill text-text-secondary hover:text-text-primary hover:bg-bg-raised flex min-h-11 items-center gap-3 rounded-sm px-2 text-sm transition-colors focus-visible:outline-2"
            >
              <SheetIcon path="M18 18l-3.5-3.5M4 10.5a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0" />
              Search
            </button>

            <div className="border-border-rule border-t" />
          </>
        ) : null}

        {visible.length > 0 ? (
          <>
            <Eyebrow className="px-2">Yours</Eyebrow>
            <ul className="flex flex-col gap-0.5">
              {visible.map((link) => {
                const current = isCurrent(link.href, pathname);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={current ? 'page' : undefined}
                      className={cn(
                        'focus-visible:outline-accent-fill flex min-h-11 items-center gap-3 rounded-sm px-2 text-sm transition-colors focus-visible:outline-2',
                        current
                          ? 'bg-bg-raised text-text-primary shadow-[inset_2px_0_0_0_var(--color-accent-fill)]'
                          : 'text-text-secondary hover:text-text-primary hover:bg-bg-raised',
                      )}
                    >
                      <SheetIcon path={link.path} />
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="border-border-rule border-t" />
          </>
        ) : null}

        {isSignedIn ? (
          <>
            <NotificationsSection
              initialItems={notifications}
              initialUnreadCount={unreadCount}
            />
            <div className="border-border-rule border-t" />
          </>
        ) : null}

        {isAdmin ? (
          <>
            <Link
              href="/admin"
              className="focus-visible:outline-accent-fill text-text-secondary hover:text-text-primary hover:bg-bg-raised flex min-h-11 items-center rounded-sm px-2 text-sm focus-visible:outline-2"
            >
              Admin
            </Link>
            <div className="border-border-rule border-t" />
          </>
        ) : null}

        <div className="flex items-center justify-between px-2">
          <ThemeToggle />
          <AccountControl isSignedIn={isSignedIn} />
        </div>
      </div>
    </dialog>
  );
}

function isCurrent(href: string, pathname: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

function SheetIcon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] shrink-0"
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

/** Vocabulary: log in / log out / register — never "sign in". */
function AccountControl({ isSignedIn }: { isSignedIn: boolean }) {
  if (isSignedIn) return <UserButton />;

  return (
    <Link
      href="/auth/login"
      className="border-border-rule text-text-primary hover:bg-bg-raised focus-visible:outline-accent-fill flex min-h-11 items-center border px-4 text-sm focus-visible:outline-2"
    >
      Log in
    </Link>
  );
}

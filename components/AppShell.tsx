'use client';

import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { MoreSheet } from './MoreSheet';
import { NavRail } from './NavRail';
import { Panel } from './Panel';
import { TabBar } from './TabBar';
import { ThemeToggle } from './ThemeToggle';

/**
 * The application shell (D67, D75): a floating rail plus a content panel on
 * a darker ground from `xl` up, bottom tabs and a More sheet below it.
 *
 * 🔴 The rail's breakpoint is `xl` (1280px), not Tailwind's default `lg`
 * (1024px). Spec §11.4 measured the rail's width cost at 1280px — at that
 * width the rail leaves the league board 966px where the old full-width
 * container gave it 1152px — so `xl` is where the shell has room to add a
 * fixed-width rail without squeezing the content below a usable minimum.
 * `NavRail` itself carries no responsive visibility classes on purpose;
 * showing and hiding it is this component's job, done here with a wrapper
 * rather than a prop so `NavRail` stays free of layout concerns Storybook
 * doesn't need.
 *
 * `usePathname()` is read once, here, and passed down to `NavRail`, `TabBar`
 * and `MoreSheet` — one router read for the whole shell rather than three.
 *
 * Exactly one `<main>` exists: `Panel` rendered `as="main"` is the only
 * content landmark, and the two navigations — the rail's `Main` and the tab
 * bar's `Primary, mobile` — are named apart because both exist in the DOM at
 * once (CSS decides which is visible), and identical names would make the
 * landmark list ambiguous for a screen reader.
 */
export function AppShell({
  isSignedIn,
  isAdmin = false,
  children,
}: {
  isSignedIn: boolean;
  isAdmin?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // `useId` rather than a literal: a hard-coded id is a collision waiting for
  // the second instance of a component, and `aria-controls` has to point at
  // the right one.
  const moreId = useId();
  const sheet = useRef<HTMLDialogElement>(null);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const openMore = useCallback(() => {
    sheet.current?.showModal();
    setIsMoreOpen(true);
  }, []);

  // `close` also fires for Escape and for the backdrop, so the trigger's
  // `aria-expanded` cannot drift out of step with whether the sheet is open.
  // Ported verbatim from AppNav's drawer: same event, same reasoning.
  useEffect(() => {
    const element = sheet.current;
    if (!element) return;
    const onClose = () => setIsMoreOpen(false);
    element.addEventListener('close', onClose);
    return () => element.removeEventListener('close', onClose);
  }, []);

  // A sheet left open across a navigation would cover the page it just
  // reached. Ported verbatim from AppNav's drawer-close-on-navigate effect.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger, not a value read here
  useEffect(() => {
    sheet.current?.close();
  }, [pathname]);

  return (
    <div className="bg-bg-base min-h-dvh xl:flex xl:gap-2.5 xl:p-2.5">
      <div className="hidden xl:block">
        <NavRail pathname={pathname} />
      </div>

      <div className="min-w-0 flex-1 xl:flex xl:flex-col xl:gap-2.5">
        <Strip isSignedIn={isSignedIn} isAdmin={isAdmin} />
        {/* Bottom padding below `xl` reserves room for the fixed tab bar
            (44px targets plus the safe-area inset), or the last row of every
            page would sit underneath it. At `xl` the tab bar is hidden, so
            the padding drops back to match the top/side padding. */}
        <Panel
          as="main"
          className="min-w-0 flex-1 p-4 pb-[calc(4rem+env(safe-area-inset-bottom))] xl:p-6"
        >
          {children}
        </Panel>
      </div>

      <TabBar
        pathname={pathname}
        onMore={openMore}
        isMoreOpen={isMoreOpen}
        moreId={moreId}
      />
      <MoreSheet
        id={moreId}
        ref={sheet}
        pathname={pathname}
        isSignedIn={isSignedIn}
        isAdmin={isAdmin}
      />
    </div>
  );
}

/**
 * The desktop strip: search, create, a live countdown slot, the theme
 * toggle, and the account control. 52px tall, hidden below `xl` where the
 * tab bar and More sheet carry the same jobs instead.
 *
 * No page supplies a countdown yet, so the slot renders nothing rather than
 * a placeholder — an empty box inviting content is worse than no box.
 */
function Strip({ isSignedIn, isAdmin }: { isSignedIn: boolean; isAdmin: boolean }) {
  return (
    <div className="hidden h-[52px] shrink-0 items-center gap-2 px-2 xl:flex">
      <Link
        href="/browse"
        className="text-text-secondary hover:text-text-primary focus-visible:outline-accent-fill flex min-h-11 min-w-11 items-center justify-center focus-visible:outline-2"
      >
        <SearchIcon />
        <span className="sr-only">Search</span>
      </Link>

      <Link
        href="/leagues/new"
        className="border-border-rule text-text-primary hover:bg-bg-raised focus-visible:outline-accent-fill flex min-h-11 items-center gap-2 border px-4 text-sm focus-visible:outline-2"
      >
        <PlusIcon />
        Create league
      </Link>

      {/* The live countdown slot: intentionally empty until a page supplies
          one (a draft's start time, an awards ceremony's air date). */}

      <div className="ml-auto flex items-center gap-2">
        {isAdmin ? (
          <Link
            href="/admin"
            className="text-text-secondary hover:text-text-primary focus-visible:outline-accent-fill flex min-h-11 min-w-11 items-center justify-center focus-visible:outline-2"
          >
            <GearIcon />
            <span className="sr-only">Admin</span>
          </Link>
        ) : null}
        <ThemeToggle />
        <AccountControl isSignedIn={isSignedIn} />
      </div>
    </div>
  );
}

function SearchIcon() {
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

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/**
 * Logged in: Clerk's account menu. Logged out: a way in.
 *
 * Vocabulary: log in, never sign in. Duplicated rather than shared with
 * `MoreSheet`'s own `AccountControl` — the same small component already
 * exists twice in the reviewed code this task composes, and a shared export
 * is not this task's call to make.
 */
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

function GearIcon() {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 4.6V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5.9Z" />
    </svg>
  );
}

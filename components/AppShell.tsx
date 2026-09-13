'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { AccountControl } from './AccountControl';
import { MoreSheet } from './MoreSheet';
import { NavRail } from './NavRail';
import { NotificationBell, type NotificationItem } from './NotificationBell';
import { Panel } from './Panel';
import { SearchOverlay } from './SearchOverlay';
import { SearchIcon, TabBar } from './TabBar';
import { ThemeToggle } from './ThemeToggle';

/**
 * The application shell (D67, D75): a floating rail plus a content panel on
 * a darker ground from `xl` up, bottom tabs and a More sheet below it.
 *
 * 🔴 The rail's breakpoint is `xl` (1280px) and the chrome's is not.
 *
 * `xl` is measured and correct **for the rail**: 208px of rail at 1280px
 * leaves a 10-seat board 930px and its poster cells 66–81px, and anything
 * lower puts them under the legibility floor (see `NavRail`; spec §11.4
 * measured the same cost against the old full-width container, 966px against
 * 1152px). `NavRail` itself carries no responsive visibility classes on
 * purpose; showing and hiding it is this component's job, done here with a
 * wrapper rather than a prop so `NavRail` stays free of layout concerns
 * Storybook doesn't need.
 *
 * It was never right for the *strip*, which is 52px of horizontal chrome
 * costing the content column no width at all — and because the two shared one
 * gate, 1024–1280px (iPad landscape, a small laptop, half a screen) got the
 * phone layout with no wordmark, no search and no account control anywhere but
 * two taps into the More sheet.
 *
 * The chrome now travels with the tab bar instead, from `sm` up to `xl`, which
 * closes that range without costing a phone any vertical space (decided
 * 2026-09-12; `TabBar` carries the 390px measurement that made the floor `sm`
 * rather than every width). The strip is unchanged and still `xl`-only; the two
 * never render at once.
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
  notifications = [],
  unreadCount = 0,
  children,
}: {
  isSignedIn: boolean;
  isAdmin?: boolean;
  notifications?: NotificationItem[];
  unreadCount?: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // `useId` rather than a literal: a hard-coded id is a collision waiting for
  // the second instance of a component, and `aria-controls` has to point at
  // the right one.
  const moreId = useId();
  const searchId = useId();
  const sheet = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLDialogElement>(null);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const openMore = useCallback(() => {
    sheet.current?.showModal();
    setIsMoreOpen(true);
  }, []);

  const openSearch = useCallback(() => {
    // The sheet and the panel are both modal dialogs, and two open at once
    // leaves the reader trapped behind the wrong one.
    sheet.current?.close();
    search.current?.showModal();
  }, []);

  // `/` and ⌘K, the two shortcuts every reader already tries. Ignored while a
  // field has focus, or `/` would be swallowed mid-title on every form in the app.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
      const isSlash = event.key === '/' && !typing;
      const isCommandK = event.key === 'k' && (event.metaKey || event.ctrlKey);
      if (!isSlash && !isCommandK) return;
      event.preventDefault();
      search.current?.showModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
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
    search.current?.close();
  }, [pathname]);

  return (
    <div className="bg-bg-ground min-h-dvh xl:flex xl:gap-2 xl:p-3">
      {/* 🔴 First focusable element on every page, by DOM order rather than by
          styling — a skip link that is not first is not a skip link. Visible
          only when focused: `sr-only` until `focus:not-sr-only` brings it back.
          Before this, a keyboard reader crossed up to eleven chrome controls to
          reach the content on every single navigation.

          Anchored to "first child of the shell", not to a line: P17.T2 moved the
          strip's contents into the tab bar row, and this survives that. */}
      <a
        href="#content"
        className="focus:bg-bg-surface focus:text-text-primary focus:outline-accent-fill sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:flex focus:min-h-11 focus:items-center focus:rounded-sm focus:px-4 focus:text-sm focus:outline-2"
      >
        Skip to content
      </a>

      <div className="hidden xl:block">
        <NavRail pathname={pathname} />
      </div>

      <div className="min-w-0 flex-1 xl:flex xl:flex-col xl:gap-2">
        <Strip
          isSignedIn={isSignedIn}
          isAdmin={isAdmin}
          notifications={notifications}
          unreadCount={unreadCount}
          onSearch={openSearch}
          searchId={searchId}
        />
        {/* Bottom padding below `xl` reserves room for the fixed tab bar
            (44px targets plus the safe-area inset), or the last row of every
            page would sit underneath it. At `xl` the tab bar is hidden, so
            the padding drops back to match the top/side padding. */}
        {/* biome-ignore lint/correctness/useUniqueElementIds: the skip link's target has to be a stable, well-known fragment, and `useId()` emits React 19's «r0» form — not something to put in a URL fragment or a CSS selector. The rule guards against a component rendered twice; this shell renders exactly once per page, which is the same invariant that makes `<main>` unique. */}
        <Panel
          as="main"
          id="content"
          // 🔴 Without this the fragment target is not focusable, so the browser
          // moves the *sequential focus navigation starting point* but not focus
          // itself — which means a screen reader keeps reading from the chrome.
          // -1 keeps it out of Tab; only the skip link ever lands here.
          tabIndex={-1}
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
        isSignedIn={isSignedIn}
        onSearch={openSearch}
        searchId={searchId}
      />
      <MoreSheet
        id={moreId}
        ref={sheet}
        pathname={pathname}
        isSignedIn={isSignedIn}
        isAdmin={isAdmin}
        notifications={notifications}
        unreadCount={unreadCount}
        onSearch={openSearch}
        searchId={searchId}
      />
      <SearchOverlay id={searchId} ref={search} />
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
function Strip({
  isSignedIn,
  isAdmin,
  notifications,
  unreadCount,
  onSearch,
  searchId,
}: {
  isSignedIn: boolean;
  isAdmin: boolean;
  notifications: NotificationItem[];
  unreadCount: number;
  onSearch: () => void;
  searchId: string;
}) {
  return (
    <div className="hidden h-[52px] shrink-0 items-center gap-2 px-2 xl:flex">
      {/* Was a link to `/browse` — a release calendar ordered by date, which
          cannot answer "where is *Sinners*". It opens the search panel now. */}
      <button
        type="button"
        onClick={onSearch}
        aria-haspopup="dialog"
        aria-controls={searchId}
        className="text-text-secondary hover:text-text-primary focus-visible:outline-accent-fill flex min-h-11 min-w-11 items-center justify-center focus-visible:outline-2"
      >
        <SearchIcon />
        <span className="sr-only">Search</span>
      </button>

      <Link
        // 🔴 A signed-out reader cannot start a league: `/leagues/new` is
        // protected, so this control bounced them to a login page that does
        // not say what they were trying to do. Found by P18.T9 while scoping
        // its locator around it. Registering **is** the first step of starting
        // a league, which is why the label does not change — the act is the
        // same one, and `/auth/register` carries them onward.
        href={isSignedIn ? '/leagues/new' : '/auth/register'}
        className="border-border-rule text-text-primary hover:bg-bg-surface focus-visible:outline-accent-fill flex min-h-11 items-center gap-2 border px-4 text-sm focus-visible:outline-2"
      >
        <PlusIcon />
        {/* One label for one action (P17.T32). `/leagues` and `/leagues/new`
            both say "Start a league", and so does the destination's own
            heading; "Create league" survives only as CreateLeagueForm's submit
            label, which is a different act at a different moment. */}
        Start a league
      </Link>

      {/* The live countdown slot: intentionally empty until a page supplies
          one (a draft's start time, an awards ceremony's air date). */}

      <div className="ml-auto flex items-center gap-2">
        {isSignedIn ? (
          <NotificationBell
            initialItems={notifications}
            initialUnreadCount={unreadCount}
          />
        ) : null}
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

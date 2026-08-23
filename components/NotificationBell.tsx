'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';

import { markNotificationsRead } from '@/actions/notifications/mark-as-read';
import { cn } from '@/lib/utils/cn';

/**
 * The client-safe shape of a notification (T43). Deliberately narrower than
 * `lib/repositories/notifications.ts`'s `Notification` — `createdAt` and
 * `updatedAt` cross the server/client boundary for nothing, since nothing
 * here renders a timestamp.
 */
export type NotificationItem = {
  id: number;
  message: string | null;
  icon: string | null;
  link: string | null;
  read: boolean | null;
};

type State = {
  items: NotificationItem[];
  unreadCount: number;
};

/**
 * Local notification state, one copy per place the bell renders.
 *
 * `AppShell`'s desktop strip and `MoreSheet` both exist in the DOM at once —
 * CSS decides which is visible, per the shell's breakpoint — the same
 * reason `AccountControl` is duplicated rather than shared between them. Each
 * copy of this hook keeps its own state and never needs to agree with the
 * other's.
 *
 * `unreadCount` starts from `countUnreadByUser`, which is not capped at ten
 * the way `items` is. A member with more than ten unread notifications sees
 * an accurate badge next to a list that cannot show all of them — no worse
 * than the source, whose badge was only ever a filter over the same one
 * capped fetch.
 */
function useNotificationState(
  initialItems: NotificationItem[],
  initialUnreadCount: number,
) {
  const [state, setState] = useState<State>({
    items: initialItems,
    unreadCount: initialUnreadCount,
  });
  const [pending, startTransition] = useTransition();

  const unreadVisible = state.items.filter((item) => item.read !== true);

  const markRead = useCallback(() => {
    if (unreadVisible.length === 0) return;
    const ids = unreadVisible.map((item) => item.id);
    startTransition(async () => {
      const result = await markNotificationsRead(ids);
      if (!result.ok) return;
      setState((prev) => ({
        items: prev.items.map((item) =>
          ids.includes(item.id) ? { ...item, read: true } : item,
        ),
        // The count actually updated, not `ids.length` — the two agree for
        // an honest caller, but the badge should reflect what the server
        // scoped the write to, not what was asked for.
        unreadCount: Math.max(0, prev.unreadCount - result.data),
      }));
    });
  }, [unreadVisible]);

  return {
    items: state.items,
    unreadCount: state.unreadCount,
    unreadVisibleCount: unreadVisible.length,
    pending,
    markRead,
  };
}

/**
 * The bell: unread count and the recent list, in the desktop strip (T43).
 *
 * A notification with a `link` navigates there; one without renders as plain
 * text — inventing a destination for it would be worse than having none.
 */
export function NotificationBell({
  initialItems,
  initialUnreadCount,
}: {
  initialItems: NotificationItem[];
  initialUnreadCount: number;
}) {
  const { items, unreadCount, unreadVisibleCount, pending, markRead } =
    useNotificationState(initialItems, initialUnreadCount);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="text-text-secondary hover:text-text-primary focus-visible:outline-accent-fill relative flex min-h-11 min-w-11 items-center justify-center focus-visible:outline-2"
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="bg-accent-fill absolute top-2 right-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] text-white"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
        <span className="sr-only">
          Notifications{unreadCount > 0 ? `, ${unreadCount} unread` : ''}
        </span>
      </button>

      {open ? (
        <div
          id={panelId}
          role="menu"
          className="bg-bg-surface border-border-rule absolute top-full right-0 z-10 mt-2 w-80 rounded-md border p-3 shadow-lg"
        >
          <NotificationHeader
            unreadVisibleCount={unreadVisibleCount}
            pending={pending}
            onMarkRead={markRead}
          />
          <NotificationsList items={items} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The same state and list, rendered inline for `MoreSheet` (T43) — the sheet
 * is already a modal, so this needs no popover chrome of its own.
 */
export function NotificationsSection({
  initialItems,
  initialUnreadCount,
}: {
  initialItems: NotificationItem[];
  initialUnreadCount: number;
}) {
  const { items, unreadCount, unreadVisibleCount, pending, markRead } =
    useNotificationState(initialItems, initialUnreadCount);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-2">
        <span className="text-text-primary text-sm">
          Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </span>
        {unreadVisibleCount > 0 ? (
          <MarkReadButton pending={pending} onClick={markRead} />
        ) : null}
      </div>
      <NotificationsList items={items} />
    </div>
  );
}

function NotificationHeader({
  unreadVisibleCount,
  pending,
  onMarkRead,
}: {
  unreadVisibleCount: number;
  pending: boolean;
  onMarkRead: () => void;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="text-text-primary text-sm font-medium">Notifications</span>
      {unreadVisibleCount > 0 ? (
        <MarkReadButton pending={pending} onClick={onMarkRead} />
      ) : null}
    </div>
  );
}

function MarkReadButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-accent-fill text-xs disabled:opacity-60"
    >
      Mark all as read
    </button>
  );
}

function NotificationsList({ items }: { items: NotificationItem[] }) {
  if (items.length === 0) {
    return <p className="text-text-secondary px-2 py-3 text-sm">Nothing yet.</p>;
  }

  return (
    <ul className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
      {items.map((item) => (
        <li key={item.id}>
          <NotificationRow item={item} />
        </li>
      ))}
    </ul>
  );
}

function NotificationRow({ item }: { item: NotificationItem }) {
  const isUnread = item.read !== true;
  const body = (
    <div
      className={cn(
        'flex items-start gap-3 rounded-sm px-2 py-2 text-sm',
        isUnread ? 'text-text-primary' : 'text-text-secondary',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
          isUnread ? 'bg-accent-fill' : 'bg-transparent',
        )}
      />
      <span>{item.message}</span>
    </div>
  );

  // A notification without a link is not a control — rendering it as one
  // would invent a destination the source app never had for it.
  if (!item.link) return body;

  return (
    <Link
      href={item.link}
      className="hover:bg-bg-raised focus-visible:outline-accent-fill block rounded-sm focus-visible:outline-2"
    >
      {body}
    </Link>
  );
}

function BellIcon() {
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
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

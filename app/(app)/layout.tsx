import { AppShell } from '@/components/AppShell';
import { AccountLinkError, getCurrentUser } from '@/lib/auth';
import { notificationRepository } from '@/lib/repositories/notifications';

/**
 * The application shell.
 *
 * The shell is a floating rail plus a content panel on a darker ground (D67),
 * with bottom tabs and a More sheet on a phone (D75). Auth is resolved here
 * rather than in the client component: Clerk 7 removed <SignedIn>/<SignedOut>,
 * and server resolution also avoids the strip flickering between states while
 * Clerk loads.
 *
 * The bell's data is fetched here too, alongside `isAdmin` (T43) — every page
 * under this layout is a member reaching the shell, so this is the one place
 * that sees every request without a page having to remember to ask for it.
 * Signed-out visitors get an empty list rather than a fetch against no user.
 *
 * 🔴 `getCurrentUser()` throws `AccountLinkError` for a collided account
 * (D25), and a throw from this layout is not caught by `(app)/error.tsx` —
 * that boundary only catches errors from its own children, not from the
 * layout that renders alongside it, so an uncaught throw here bubbles past
 * the shell entirely. That is exactly the member who most needs the shell
 * standing: they can still reach the public pages, and the admin gear must
 * not render for them. Caught here and treated as signed out.
 */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await getCurrentUser().catch((error) => {
    if (error instanceof AccountLinkError) return null;
    throw error;
  });

  const [notifications, unreadCount] = user
    ? await Promise.all([
        notificationRepository.findByUser(user.id),
        notificationRepository.countUnreadByUser(user.id),
      ])
    : [[], 0];

  return (
    <AppShell
      isSignedIn={user != null}
      isAdmin={user?.role === 'admin'}
      notifications={notifications.map((notification) => ({
        id: notification.id,
        message: notification.message,
        icon: notification.icon,
        link: notification.link,
        read: notification.read,
      }))}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}

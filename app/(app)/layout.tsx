import { AppShell } from '@/components/AppShell';
import { getCurrentUser } from '@/lib/auth';

/**
 * The application shell.
 *
 * The shell is a floating rail plus a content panel on a darker ground (D67),
 * with bottom tabs and a More sheet on a phone (D75). Auth is resolved here
 * rather than in the client component: Clerk 7 removed <SignedIn>/<SignedOut>,
 * and server resolution also avoids the strip flickering between states while
 * Clerk loads.
 */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await getCurrentUser();
  return (
    <AppShell isSignedIn={user != null} isAdmin={user?.role === 'admin'}>
      {children}
    </AppShell>
  );
}

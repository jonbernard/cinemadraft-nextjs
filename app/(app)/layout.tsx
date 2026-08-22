import { auth } from '@clerk/nextjs/server';

import { AppShell } from '@/components/AppShell';

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
  const { userId } = await auth();
  return <AppShell isSignedIn={userId != null}>{children}</AppShell>;
}

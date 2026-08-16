import { auth } from '@clerk/nextjs/server';

import { AppNav } from '@/components/AppNav';

/**
 * The application shell.
 *
 * 🔴 Until this existed, every page in the app was an island — reachable only
 * by typing its URL, with no way to get from a league to an award show. The
 * parity matrix could not see it, because the matrix records capabilities and
 * navigation is what makes capabilities findable.
 *
 * The phone nav is a fixed bottom bar (D49), so the page reserves space for it
 * with `pb-20`; without that, the last element of every page sits underneath
 * the bar. `md:pb-0` gives it back once the nav moves to a header.
 */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  // Resolved here rather than in the client component: Clerk 7 removed
  // <SignedIn>/<SignedOut>, and server resolution also avoids the header
  // flickering between states while Clerk loads.
  const { userId } = await auth();

  return (
    <div className="bg-bg-base min-h-dvh">
      <AppNav isSignedIn={userId != null} />
      <div className="pb-20 md:pb-0">{children}</div>
    </div>
  );
}

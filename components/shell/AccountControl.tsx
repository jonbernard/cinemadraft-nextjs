import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';

import { logOutOfTestSession } from '@/actions/auth/log-out';
import { cn } from '@/lib/utils/cn';
import { compactUserButtonAppearance } from '@/theme/clerk';

/**
 * Logged in: Clerk's account menu. Logged out: a way in.
 *
 * Vocabulary: log in, never sign in.
 *
 * 🔴 One definition, three callers. This lived as two identical copies — one
 * in `AppShell`'s strip, one in `MoreSheet` — each carrying a comment
 * apologising for the other. P17.T2 needed a third, on the tab bar (on
 * `TopBar` since D128, which also took the sheet's), and three copies of an auth control is how one of them silently stops matching the
 * key it branches on.
 *
 * 🔴 `UserButton` throws outside a `<ClerkProvider>`, and the e2e run mounts
 * none (D84) — so the same key `app/providers.tsx` branches on decides this
 * too, and the two cannot disagree. The plain control carries the same
 * accessible name Clerk's menu item does, so a spec asserting on "Log out"
 * reads either world.
 */
export function AccountControl({
  isSignedIn,
  compact = false,
}: {
  isSignedIn: boolean;
  /**
   * A 44px icon square instead of the strip's bordered button.
   *
   * `TopBar`'s chrome is icon squares (D128; it was the tab bar's, where
   * P17.T2 Step 1 measured a one-target budget), and the bordered "Log in" is
   * 71px. The name is unchanged in both shapes — the label just moves to
   * `sr-only`.
   */
  compact?: boolean;
}) {
  const box = compact
    ? 'flex min-h-11 w-11 shrink-0 items-center justify-center'
    : 'border-border-rule flex min-h-11 items-center border px-4 text-sm';
  const skin =
    'text-text-primary hover:bg-bg-surface focus-visible:outline-accent-fill focus-visible:outline-2';

  if (!isSignedIn) {
    return (
      <Link href="/auth/login" className={cn(box, skin)}>
        {compact ? (
          <>
            <PersonIcon />
            <span className="sr-only">Log in</span>
          </>
        ) : (
          'Log in'
        )}
      </Link>
    );
  }

  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <form action={logOutOfTestSession}>
        <button type="submit" className={cn(box, skin)}>
          {compact ? (
            <>
              <PersonIcon />
              <span className="sr-only">Log out</span>
            </>
          ) : (
            'Log out'
          )}
        </button>
      </form>
    );
  }

  return <UserButton appearance={compact ? compactUserButtonAppearance : undefined} />;
}

function PersonIcon() {
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
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

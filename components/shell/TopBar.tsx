import Link from 'next/link';

import { Wordmark } from '../ui/Wordmark';
import { AccountControl } from './AccountControl';

/**
 * The phone and tablet top bar: the wordmark on the left, search and the
 * account control on the right (P14.T16, D127).
 *
 * 🔴 **Why it exists.** Below `xl` the rail is hidden, and identity was a
 * 44px `markOnly` square in the bottom bar that was itself `hidden sm:flex` —
 * so on an actual phone the application carried no wordmark at all. The owner
 * called that out directly. `TabBar`'s docstring explains why the mark could
 * not simply be un-hidden there: at 390px the five tab slots have 78px each
 * and no slack, and a 44px square in the row wraps "Award shows" to two lines
 * and grows the bar from 48.5px to 65px.
 *
 * 🔴 A top bar dissolves that rather than arguing with it. The measurement was
 * never about the wordmark; it was about the bottom bar being the only
 * horizontal chrome below `xl`. There are two now, and the mark costs the tab
 * row nothing.
 *
 * 🔴 **Search and the account control live here too (D127).** D120 kept them
 * where D75 put them — the bottom bar from `sm`, `MoreSheet` below it — and the
 * owner reversed that: "on mobile, move the search button and the user auth
 * menu/profile image button from the bottom nav to the top nav, on the right
 * side, opposite the cinemadraft logo." This row has the room the bottom one
 * never did: at 390px the lockup and two 44px squares leave well over 100px
 * between them, and the phone gets search one tap away instead of two. The
 * bottom bar is back to five destinations and nothing else at every width.
 *
 * 🔴 **`sticky`, not `fixed`.** Sticky stays in normal flow, so this reserves
 * its own height and nothing below needs a compensating `padding-top` — the
 * bottom bar already owns one of those numbers
 * (`pb-[calc(4rem+env(safe-area-inset-bottom))]` on `<main>`) and one is
 * enough to keep in step.
 *
 * 🔴 **`data-app-chrome` is not decoration.** It is TV mode's only seam
 * (D112): one unlayered rule in `app/globals.css` hides everything carrying
 * it. A bar without the hook means full-screen is not "nothing but the room".
 *
 * The full lockup rather than `markOnly`: a full-width row holds the name, and
 * the name is the half the bottom bar could not carry.
 *
 * `onSearch`/`searchId` arrive from `AppShell`, which owns the search panel's
 * ref. Focus returning here when the panel closes is the platform's —
 * `<dialog>` restores focus to whatever opened it.
 *
 * No landmark. This is chrome, not navigation — `NavRail`'s `Main` and
 * `TabBar`'s `Primary, mobile` are the two navigations, and a third landmark
 * holding a link and two controls would make a screen reader's landmark list
 * worse.
 */
export function TopBar({
  isSignedIn,
  onSearch,
  searchId,
}: {
  isSignedIn: boolean;
  onSearch: () => void;
  searchId: string;
}) {
  return (
    <div
      className="bg-bg-panel xl:hidden sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6"
      data-app-chrome
    >
      <Link
        href="/"
        aria-label="Cinemadraft, home"
        className="text-text-primary focus-visible:outline-accent-fill flex min-h-11 items-center focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <Wordmark size="sm" />
      </Link>

      {/* Icon-only, like the strip's: the row is chrome, and a visible label
          would be the only one in it. The name is `sr-only`. */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={onSearch}
          aria-haspopup="dialog"
          aria-controls={searchId}
          className="text-text-secondary hover:text-text-primary hover:bg-bg-surface focus-visible:outline-accent-fill flex min-h-11 w-11 shrink-0 items-center justify-center transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
        >
          <SearchIcon />
          <span className="sr-only">Search</span>
        </button>
        <AccountControl isSignedIn={isSignedIn} compact />
      </div>
    </div>
  );
}

/**
 * The magnifier, shared with `AppShell`'s strip.
 *
 * One definition because the top bar and the strip are the same affordance at
 * two widths and must not diverge into two glyphs.
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

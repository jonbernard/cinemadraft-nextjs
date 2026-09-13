import Link from 'next/link';

import { Wordmark } from '../ui/Wordmark';

/**
 * The phone and tablet top bar: the wordmark, and nothing else (P14.T16).
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
 * Search and the account control stay where D75 put them — the bottom bar from
 * `sm`, `MoreSheet` below it. This row has room for them if that is ever
 * wanted, but moving them is a decision about D75's grouping that nobody has
 * asked for.
 *
 * No landmark. This is chrome, not navigation — `NavRail`'s `Main` and
 * `TabBar`'s `Primary, mobile` are the two navigations, and a third landmark
 * holding one link would make a screen reader's landmark list worse.
 */
export function TopBar() {
  return (
    <div
      className="bg-bg-panel xl:hidden sticky top-0 z-40 flex items-center px-4 sm:px-6"
      data-app-chrome
    >
      <Link
        href="/"
        aria-label="Cinemadraft, home"
        className="text-text-primary focus-visible:outline-accent-fill flex min-h-11 items-center focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <Wordmark size="sm" />
      </Link>
    </div>
  );
}

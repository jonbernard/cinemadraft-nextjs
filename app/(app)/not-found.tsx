import { ErrorPanel } from '@/components/ErrorPanel';

/**
 * The 404 for pages inside the app shell.
 *
 * 🔴 This exists so a missing page **keeps the navigation**. The root
 * `app/not-found.tsx` sits outside the `(app)` group and therefore renders
 * without the header — leaving someone who mistyped a league id on a page with
 * no way onward but the browser's back button.
 *
 * Both files render the same panel; the difference is entirely which layout
 * wraps it.
 *
 * 🔴 It reaches here only for a `notFound()` thrown by a page in this group.
 * A URL that matches no route at all is caught by `[...notFound]/page.tsx`,
 * which calls `notFound()` from inside the group so that this file renders.
 * Before P17.T27 those URLs — `/live`, `/members`, anything mistyped — went to
 * the root `app/not-found.tsx` and lost the whole application.
 *
 * `ErrorPanel` supplies no `<main>`: `AppShell` already renders the one
 * content landmark.
 */
export default function AppNotFound() {
  return <ErrorPanel kind="not-found" />;
}

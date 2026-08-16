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
 */
export default function AppNotFound() {
  return <ErrorPanel kind="not-found" />;
}

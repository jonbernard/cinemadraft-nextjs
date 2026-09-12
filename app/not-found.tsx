import { ErrorPanel } from '@/components/ErrorPanel';

/**
 * The last-resort 404: a URL that matched no route at all, outside the app
 * shell.
 *
 * 🔴 Since P17.T27 this is nearly unreachable for an app URL —
 * `app/(app)/[...notFound]/page.tsx` catches every unmatched path into the
 * group, so a mistyped URL keeps the rail, the tab bar and the strip. What
 * still lands here is a miss under `/auth` or `/api`, and Next's own internal
 * fallbacks.
 *
 * Several pages also call `notFound()` deliberately — a league that does not
 * exist, an award show that does not, and the draft console when the viewer is
 * not an owner. That last one answers 404 rather than 403 on purpose, so this
 * copy must not hint that anything is there. Those reach
 * `app/(app)/not-found.tsx`, which renders the same panel inside the shell.
 *
 * The `<main>` is here because `ErrorPanel` no longer renders one (P17.T27):
 * outside the shell there is nothing else to supply the content landmark.
 */
export default function NotFound() {
  return (
    <main className="bg-bg-base min-h-dvh">
      <ErrorPanel kind="not-found" />
    </main>
  );
}

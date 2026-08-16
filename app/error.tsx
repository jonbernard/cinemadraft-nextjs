'use client';

import { useEffect } from 'react';

import { type ErrorKind, ErrorPanel } from '@/components/ErrorPanel';

/**
 * The app's error boundary.
 *
 * 🔴 There was none until now: an unhandled error in any Server Component
 * showed Next's development overlay locally and a blank page in production.
 *
 * 🔴 **Recognising our own errors is the point.** `lib/errors.ts` defines
 * `isAppError` as a *structural* check rather than `instanceof`, precisely
 * because an error thrown on the server and read on the client has lost its
 * prototype chain. That is what lets a `FORBIDDEN` say "not yours to open"
 * instead of "something went wrong".
 *
 * The `digest` is Next's hash of the real error, which stays on the server.
 * Logging it here is what makes a report ("I saw an error") connectable to a
 * line in the platform log.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[error boundary]', { digest: error.digest, message: error.message });
  }, [error]);

  return <ErrorPanel kind={kindOf(error)} onRetry={reset} />;
}

/**
 * Structural, not `instanceof` — see above.
 *
 * An error that crossed the server/client boundary keeps its own fields but
 * not its class, so this reads the `code` the app puts on every `AppError`.
 */
function kindOf(error: unknown): ErrorKind {
  if (
    typeof error === 'object' &&
    error !== null &&
    'isAppError' in error &&
    (error as { isAppError?: unknown }).isAppError === true
  ) {
    const code = (error as { code?: string }).code;
    if (code === 'NOT_FOUND') return 'not-found';
    if (code === 'FORBIDDEN') return 'forbidden';
    if (code === 'CONFLICT') return 'conflict';
  }
  return 'unknown';
}

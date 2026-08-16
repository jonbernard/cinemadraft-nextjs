'use client';

import { useEffect } from 'react';

import { type ErrorKind, ErrorPanel } from '@/components/ErrorPanel';

/**
 * The error boundary for pages inside the app shell.
 *
 * Same reasoning as `(app)/not-found.tsx`: an error inside the shell should
 * still leave the navigation standing, so the reader has somewhere to go that
 * is not the back button.
 *
 * It duplicates the root boundary's logic rather than importing it, because a
 * boundary that depends on another module is a boundary that can fail for the
 * same reason as the page it is catching for.
 */
export default function AppSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app error boundary]', {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return <ErrorPanel kind={kindOf(error)} onRetry={reset} />;
}

/** Structural rather than `instanceof` — an error that crossed the RSC boundary has no prototype. */
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

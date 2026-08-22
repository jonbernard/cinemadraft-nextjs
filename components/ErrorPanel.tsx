'use client';

import Link from 'next/link';

import { Button } from '@/components/Button';
import { SectionHead } from '@/components/SectionHead';
import { cn } from '@/lib/utils/cn';

export type ErrorKind = 'not-found' | 'forbidden' | 'conflict' | 'unknown';

/**
 * What each kind of failure says, and what it offers to do next.
 *
 * 🔴 **Never the raw message.** The source app returned Postgres errors
 * verbatim — a failing query leaked the full SQL, the column list and
 * Postgres internals to the browser, which is a schema disclosure on every
 * error path (`lib/errors.ts` records this). So the copy here is written, and
 * the real error goes to the log.
 *
 * Each kind gets *different words and a different action*, because they are
 * different situations and a single "something went wrong" would be useless in
 * three of the four. An error message that does not say what to do next is
 * just an apology.
 */
const COPY: Record<
  ErrorKind,
  { title: string; body: string; action?: { label: string; href: string } }
> = {
  'not-found': {
    title: 'Not here',
    body: 'That page does not exist, or the link has changed since it was shared.',
    action: { label: 'Go to the dashboard', href: '/' },
  },
  forbidden: {
    title: 'Not yours to open',
    body: 'This belongs to someone else, or you need to be logged in to see it.',
    action: { label: 'Log in', href: '/auth/login' },
  },
  conflict: {
    title: 'That clashed with something',
    body: 'Someone changed this while you were working on it. Reload and try again.',
  },
  unknown: {
    title: 'That did not work',
    body: 'Something broke on our side. It has been logged — try again, and tell Jon if it keeps happening.',
  },
};

/**
 * The app's failure surface.
 *
 * Uses the same devices as every other page — a section heading, tokens for
 * colour, the app's own voice — because a page that suddenly looks like a
 * different application reads as "the site is broken" rather than "that
 * request failed".
 *
 * No exclamation marks and no apology-as-personality. Errors state the cause
 * and the way out.
 */
export function ErrorPanel({
  kind = 'unknown',
  onRetry,
  className,
}: {
  kind?: ErrorKind;
  /** Wired to Next's `reset()` where there is one to wire. */
  onRetry?: () => void;
  className?: string;
}) {
  const copy = COPY[kind];

  return (
    <main
      className={cn(
        'bg-bg-base text-text-primary flex min-h-[60dvh] items-center p-4 md:p-8',
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <SectionHead as="h1">{copy.title}</SectionHead>

        <p className="text-text-secondary text-sm leading-relaxed">{copy.body}</p>

        <div className="flex flex-wrap items-center gap-3">
          {onRetry ? (
            <Button onClick={onRetry} className="min-h-11">
              Try again
            </Button>
          ) : null}

          {copy.action ? (
            <Link
              href={copy.action.href}
              className="text-accent-text focus-visible:outline-accent-fill flex min-h-11 items-center text-sm underline focus-visible:outline-2"
            >
              {copy.action.label}
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}

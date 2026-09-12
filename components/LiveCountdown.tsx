'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * Fixed to UTC deliberately, and for the same reason `SeasonStepper` is: the
 * date comes off the wire as epoch milliseconds, so a formatter that follows
 * the ambient zone renders one day on a server in UTC and the previous day in
 * a browser west of it. That is a hydration mismatch on the most prominent
 * element of this page, and React discards the server HTML to fix it.
 */
const showDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** `2d 03:05:09`. Days are never padded; everything below them always is. */
function remainder(ms: number): string {
  const days = Math.floor(ms / DAY);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${days}d ${pad(Math.floor((ms % DAY) / HOUR))}:${pad(
    Math.floor((ms % HOUR) / MINUTE),
  )}:${pad(Math.floor((ms % MINUTE) / SECOND))}`;
}

/**
 * How long until a ceremony starts (P17.T16).
 *
 * 🔴 **`now` is null until mounted**, which is what makes the server render and
 * the first client render produce identical HTML: both emit the absolute date
 * and nothing else, and the relative string appears one frame later. The
 * `<time datetime>` is also the whole answer for a reader whose JavaScript
 * never arrives.
 *
 * 🔴 **There is no `prefers-reduced-motion` branch, and that is deliberate** —
 * the next reader will look for one. Nothing here pulses, glows or transitions:
 * a number that changes once a second is information, and the reduced-motion
 * contract is that the same information arrives instantly, which it does. The
 * `tabular` utility is what stops the digits shifting the line's width as they
 * tick, so even the width is still.
 *
 * 🔴 First consumer of the `beam` token (P17.T20). Consumed, never redefined.
 */
export function LiveCountdown({
  startsAt,
  className,
}: {
  /** Epoch ms of the ceremony start, or null if it is not scheduled. */
  startsAt: number | null;
  className?: string;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), SECOND);
    return () => clearInterval(timer);
  }, []);

  if (startsAt == null) {
    return <p className={cn('text-beam text-sm', className)}>Date to be announced</p>;
  }

  const left = now == null ? null : startsAt - now;

  return (
    <p
      className={cn('text-beam flex flex-wrap items-baseline gap-x-3 text-sm', className)}
    >
      <time dateTime={new Date(startsAt).toISOString()}>{showDate.format(startsAt)}</time>
      {left == null ? null : left <= 0 ? (
        <span>Under way</span>
      ) : (
        <span className="tabular font-mono">{remainder(left)}</span>
      )}
    </p>
  );
}

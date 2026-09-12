import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LiveCountdown } from './LiveCountdown';

/** The 2026 Oscars as the database holds them: a UTC midnight plus 25.5 hours. */
const DAY = Date.UTC(2026, 2, 15);
const STARTS_AT = DAY + 91_800_000;

afterEach(() => vi.useRealTimers());

describe('LiveCountdown', () => {
  it('renders the absolute date as the server-safe fallback', () => {
    // 🔴 The server has no clock the client agrees with. A relative string
    // rendered on both sides is a hydration mismatch on the most prominent
    // element of the page, and React discards the server HTML to fix it. The
    // <time> is what both sides render; the relative string arrives after mount.
    const { container } = render(
      <LiveCountdown
        startsAt={Date.UTC(2027, 2, 14, 1, 0)}
        day={Date.UTC(2027, 2, 14)}
      />,
    );
    expect(container.querySelector('time')).toHaveAttribute(
      'datetime',
      new Date(Date.UTC(2027, 2, 14, 1, 0)).toISOString(),
    );
  });

  it('counts down to a ceremony in the future', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2027, 2, 13, 1, 0)));
    render(
      <LiveCountdown
        startsAt={Date.UTC(2027, 2, 14, 4, 30)}
        day={Date.UTC(2027, 2, 14)}
      />,
    );
    // 1 day, 3 hours, 30 minutes.
    expect(screen.getByText(/1d 03:30:00/)).toBeInTheDocument();
  });

  it('🔴 says the show is under way rather than counting backwards', () => {
    // "in -12 minutes" is the kind of defect that makes a whole page look
    // untrustworthy, and a live page is the worst place to do it.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2027, 2, 14, 5, 0)));
    render(
      <LiveCountdown
        startsAt={Date.UTC(2027, 2, 14, 4, 30)}
        day={Date.UTC(2027, 2, 14)}
      />,
    );
    expect(screen.getByText(/under way/i)).toBeInTheDocument();
    expect(screen.queryByText(/-/)).not.toBeInTheDocument();
  });

  it('says so when a ceremony has no date yet', () => {
    render(<LiveCountdown startsAt={null} day={null} />);
    expect(screen.getByText(/date to be announced/i)).toBeInTheDocument();
  });

  it('🔴 ticks: the same render shows a different remainder a second later', () => {
    // The plan's three cases above all measure a single frozen frame, and a
    // component that rendered once and never started its interval would pass
    // every one of them. This is the assertion that fails if the interval is
    // missing, cleared too early, or never wired to state.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2027, 2, 13, 1, 0)));
    render(
      <LiveCountdown
        startsAt={Date.UTC(2027, 2, 14, 4, 30)}
        day={Date.UTC(2027, 2, 14)}
      />,
    );
    expect(screen.getByText(/1d 03:30:00/)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(/1d 03:29:59/)).toBeInTheDocument();
  });

  it('🔴 prints the ceremony day, not the UTC day its instant falls on', () => {
    // `events.awards_time` is milliseconds past `awards_date`'s midnight and it
    // runs to 25.5 hours for the Oscars, because the ceremony is a Sunday
    // evening in America. Formatting the instant in UTC prints the Monday —
    // a page whose one job is saying when the show starts, saying the wrong
    // day. Found in review; nothing here asserted the rendered text before.
    render(<LiveCountdown startsAt={STARTS_AT} day={DAY} />);

    expect(screen.getByText('Mar 15, 2026')).toBeInTheDocument();
    expect(screen.queryByText('Mar 16, 2026')).not.toBeInTheDocument();
    // The machine-readable half is still the true instant.
    expect(screen.getByText('Mar 15, 2026')).toHaveAttribute(
      'datetime',
      new Date(STARTS_AT).toISOString(),
    );
  });

  it('🔴 the server render and the first client render are the same HTML', () => {
    // The whole reason `now` starts null. Reading the `datetime` attribute
    // cannot pin this: RTL flushes effects inside `act`, so by the time an
    // assertion runs the client has already ticked. Mutate the component to
    // `useState(() => Date.now())` and this is the only test that goes red.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 13)));

    const server = renderToString(<LiveCountdown startsAt={STARTS_AT} day={DAY} />);

    expect(server).toContain('Mar 15, 2026');
    // No relative string on the server: it has no clock the client agrees with.
    expect(server).not.toMatch(/\dd \d\d:\d\d:\d\d/);
    expect(server).not.toContain('Under way');
  });
});

import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LiveCountdown } from './LiveCountdown';

afterEach(() => vi.useRealTimers());

describe('LiveCountdown', () => {
  it('renders the absolute date as the server-safe fallback', () => {
    // 🔴 The server has no clock the client agrees with. A relative string
    // rendered on both sides is a hydration mismatch on the most prominent
    // element of the page, and React discards the server HTML to fix it. The
    // <time> is what both sides render; the relative string arrives after mount.
    const { container } = render(
      <LiveCountdown startsAt={Date.UTC(2027, 2, 14, 1, 0)} />,
    );
    expect(container.querySelector('time')).toHaveAttribute(
      'datetime',
      new Date(Date.UTC(2027, 2, 14, 1, 0)).toISOString(),
    );
  });

  it('counts down to a ceremony in the future', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2027, 2, 13, 1, 0)));
    render(<LiveCountdown startsAt={Date.UTC(2027, 2, 14, 4, 30)} />);
    // 1 day, 3 hours, 30 minutes.
    expect(screen.getByText(/1d 03:30:00/)).toBeInTheDocument();
  });

  it('🔴 says the show is under way rather than counting backwards', () => {
    // "in -12 minutes" is the kind of defect that makes a whole page look
    // untrustworthy, and a live page is the worst place to do it.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2027, 2, 14, 5, 0)));
    render(<LiveCountdown startsAt={Date.UTC(2027, 2, 14, 4, 30)} />);
    expect(screen.getByText(/under way/i)).toBeInTheDocument();
    expect(screen.queryByText(/-/)).not.toBeInTheDocument();
  });

  it('says so when a ceremony has no date yet', () => {
    render(<LiveCountdown startsAt={null} />);
    expect(screen.getByText(/date to be announced/i)).toBeInTheDocument();
  });

  it('🔴 ticks: the same render shows a different remainder a second later', () => {
    // The plan's three cases above all measure a single frozen frame, and a
    // component that rendered once and never started its interval would pass
    // every one of them. This is the assertion that fails if the interval is
    // missing, cleared too early, or never wired to state.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2027, 2, 13, 1, 0)));
    render(<LiveCountdown startsAt={Date.UTC(2027, 2, 14, 4, 30)} />);
    expect(screen.getByText(/1d 03:30:00/)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(/1d 03:29:59/)).toBeInTheDocument();
  });
});

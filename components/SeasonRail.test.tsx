import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type SeasonEvent, SeasonRail } from './SeasonRail';

// The component reads `Date.now()`, so every assertion about "next" and about
// the countdown is only meaningful against a pinned clock. Without this the
// suite would start failing on its own as the fixture dates slide into the
// past.
const NOW = Date.UTC(2026, 0, 10, 12, 0, 0);
const DAY = 86_400_000;

function event(overrides: Partial<SeasonEvent> & { id: number }): SeasonEvent {
  return {
    name: `Show ${overrides.id}`,
    abbreviation: null,
    date: null,
    complete: false,
    ...overrides,
  };
}

/** The item the rail is pointing the league at, or null if it points at none. */
function nextItem() {
  return document.querySelector('li[aria-current="step"]');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SeasonRail', () => {
  it('renders every show, including one with no date yet', () => {
    render(
      <SeasonRail
        events={[
          event({ id: 1, name: 'Golden Globes', date: NOW - 5 * DAY, complete: true }),
          event({ id: 2, name: 'BAFTA', date: NOW + 5 * DAY }),
          // Not scheduled yet, but a real show on the season's ballot.
          event({ id: 3, name: 'Independent Spirit Awards' }),
        ]}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Golden Globes')).toBeInTheDocument();
    expect(screen.getByText('BAFTA')).toBeInTheDocument();
    expect(screen.getByText('Independent Spirit Awards')).toBeInTheDocument();
    expect(screen.getByText('Date TBA')).toBeInTheDocument();
  });

  it('marks the earliest upcoming dated show as next, with a countdown', () => {
    render(
      <SeasonRail
        events={[
          event({ id: 1, name: 'Oscars', date: NOW + 40 * DAY }),
          event({ id: 2, name: 'BAFTA', date: NOW + 6 * DAY }),
        ]}
      />,
    );

    expect(nextItem()).toHaveTextContent('BAFTA');
    expect(nextItem()).toHaveTextContent('in 6 days');
    // One next show, and it is not conveyed by colour alone.
    expect(screen.getAllByText('Next')).toHaveLength(1);
  });

  it('does not treat an already-completed show as next even when it sorts first', () => {
    render(
      <SeasonRail
        events={[
          event({ id: 1, name: 'Golden Globes', date: NOW - 5 * DAY, complete: true }),
          event({ id: 2, name: 'BAFTA', date: NOW + 6 * DAY }),
        ]}
      />,
    );

    expect(nextItem()).toHaveTextContent('BAFTA');
  });

  it('🔴 renders no countdown when the season is over', () => {
    // Every show complete: there is nothing to count down to, and a rail that
    // invents one would be counting backwards.
    render(
      <SeasonRail
        events={[
          event({ id: 1, name: 'BAFTA', date: NOW - 30 * DAY, complete: true }),
          event({ id: 2, name: 'Oscars', date: NOW - 5 * DAY, complete: true }),
        ]}
      />,
    );

    expect(nextItem()).toBeNull();
    expect(screen.queryByText(/in .* day/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Complete')).toHaveLength(2);
  });

  it('🔴 renders an empty events array without crashing', () => {
    const { container } = render(<SeasonRail events={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('🔴 never renders a negative countdown for a show whose date has passed', () => {
    // A show that happened but has not been marked complete yet — the state the
    // app is in for the hours between the ceremony and the results being
    // entered. It is still the next show; it just has nothing to count down.
    render(
      <SeasonRail events={[event({ id: 1, name: 'Oscars', date: NOW - 2 * DAY })]} />,
    );

    expect(nextItem()).toHaveTextContent('Oscars');
    expect(screen.queryByText(/in .* day/)).not.toBeInTheDocument();
    expect(screen.queryByText(/-/)).not.toBeInTheDocument();
  });

  it('never marks an undated show as next', () => {
    render(
      <SeasonRail
        events={[
          event({ id: 1, name: 'Independent Spirit Awards' }),
          event({ id: 2, name: 'Oscars', date: NOW + 20 * DAY }),
        ]}
      />,
    );

    expect(nextItem()).toHaveTextContent('Oscars');
    expect(nextItem()).not.toHaveTextContent('Independent Spirit Awards');
  });

  it('renders a rail of only undated shows without a next show', () => {
    render(<SeasonRail events={[event({ id: 1 }), event({ id: 2 })]} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(nextItem()).toBeNull();
  });

  it('marks completed shows as complete in words, not only in colour', () => {
    render(
      <SeasonRail
        events={[
          event({ id: 1, name: 'Golden Globes', date: NOW - 5 * DAY, complete: true }),
          event({ id: 2, name: 'Oscars', date: NOW + 20 * DAY }),
        ]}
      />,
    );

    expect(screen.getAllByText('Complete')).toHaveLength(1);
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('says "in 1 day" rather than "in 1 days"', () => {
    render(
      <SeasonRail
        events={[event({ id: 1, name: 'Oscars', date: NOW + 6 * 3600_000 })]}
      />,
    );

    expect(screen.getByText('in 1 day')).toBeInTheDocument();
  });

  it('orders the rail chronologically and puts undated shows last', () => {
    render(
      <SeasonRail
        events={[
          event({ id: 1, name: 'Oscars', date: NOW + 40 * DAY }),
          event({ id: 2, name: 'Unscheduled' }),
          event({ id: 3, name: 'BAFTA', date: NOW + 6 * DAY }),
        ]}
      />,
    );

    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('BAFTA'),
      expect.stringContaining('Oscars'),
      expect.stringContaining('Unscheduled'),
    ]);
  });

  it('carries a machine-readable date so a drifted relative string is checkable', () => {
    render(
      <SeasonRail
        events={[event({ id: 1, name: 'Oscars', date: Date.UTC(2026, 2, 15) })]}
      />,
    );

    expect(screen.getByText('Mar 15')).toHaveAttribute(
      'dateTime',
      '2026-03-15T00:00:00.000Z',
    );
  });

  it('falls back to the abbreviation when a show has no name', () => {
    render(<SeasonRail events={[event({ id: 1, name: null, abbreviation: 'SAG' })]} />);
    expect(screen.getByText('SAG')).toBeInTheDocument();
  });

  it('never renders a nameless show as a blank card', () => {
    render(<SeasonRail events={[event({ id: 7, name: null })]} />);
    expect(screen.getByText('Show 7')).toBeInTheDocument();
  });
});

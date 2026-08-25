import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { type SeasonPhase, SeasonStepper } from './SeasonStepper';

const DAY = 86_400_000;

function phases(count: number): SeasonPhase[] {
  const start = Date.now() - count * DAY;
  return Array.from({ length: count }, (_, index) => ({
    key: `${index}-ceremony`,
    eventId: index,
    phase: 'ceremony' as const,
    name: `Show ${index}`,
    abbreviation: `s${index}`,
    date: start + index * DAY * 2,
    complete: start + index * DAY * 2 < Date.now(),
  }));
}

describe('SeasonStepper', () => {
  it('opens anchored to the end of the season', () => {
    render(<SeasonStepper phases={phases(12)} />);

    // The last box is what a reader wants first: the next thing to happen.
    expect(screen.getByTestId('season-window')).toHaveAttribute('data-offset', '7');
  });

  it('steps three boxes at a time, and stops at the ends', async () => {
    const user = userEvent.setup();
    render(<SeasonStepper phases={phases(12)} />);

    await user.click(screen.getByRole('button', { name: /earlier/i }));
    expect(screen.getByTestId('season-window')).toHaveAttribute('data-offset', '4');

    await user.click(screen.getByRole('button', { name: /earlier/i }));
    // Clamped to 0 rather than stepping to 1 and leaving a gap at the start.
    expect(screen.getByTestId('season-window')).toHaveAttribute('data-offset', '0');
    expect(screen.getByRole('button', { name: /earlier/i })).toBeDisabled();
  });

  it('names the phase, so two boxes for one show are told apart', () => {
    render(
      <SeasonStepper
        phases={[
          {
            key: '1-nominations',
            eventId: 1,
            phase: 'nominations',
            name: 'Academy Awards',
            abbreviation: 'oscars',
            date: Date.now() + DAY,
            complete: false,
          },
          {
            key: '1-ceremony',
            eventId: 1,
            phase: 'ceremony',
            name: 'Academy Awards',
            abbreviation: 'oscars',
            date: Date.now() + 30 * DAY,
            complete: false,
          },
        ]}
      />,
    );

    expect(screen.getByText('Nominations')).toBeInTheDocument();
    expect(screen.getByText('Ceremony')).toBeInTheDocument();
  });

  it('renders every phase in the DOM, whatever the window shows', () => {
    render(<SeasonStepper phases={phases(12)} />);

    // The window is a visual affordance. A screen reader and a no-JS reader
    // still get the whole season, in order.
    expect(screen.getAllByRole('listitem')).toHaveLength(12);
  });

  it('renders nothing for a season with no shows', () => {
    const { container } = render(<SeasonStepper phases={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

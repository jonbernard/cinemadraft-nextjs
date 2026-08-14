import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type RosterFilm, RosterStrip } from './RosterStrip';

/**
 * 🔴 D34 is the point of this component: there is no roster size. The tests
 * therefore exercise counts the app has never seen alongside the ones it has.
 */
function films(count: number): RosterFilm[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    title: `Film ${index + 1}`,
    posterUrl: null,
    round: index + 1,
    points: (count - index) * 10,
    share: (count - index) / ((count * (count + 1)) / 2),
  }));
}

describe('RosterStrip', () => {
  // 7, 8 and 9 are real production seasons; 6 and 30 are what the owner said
  // must work. Asserting the exact count is the assertion — if anything ever
  // truncates to eight, exactly one of these fails.
  it.each([1, 6, 7, 8, 9, 30])('renders all %i films', (count) => {
    render(<RosterStrip films={films(count)} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(count);
    expect(screen.getByText(`Film ${count}`)).toBeInTheDocument();
  });

  it('🔴 renders a 30-film roster without dropping the last one', () => {
    render(<RosterStrip films={films(30)} />);
    const items = screen.getAllByRole('listitem');

    // Scoped to the final frame deliberately: "30" is ambiguous across the
    // whole strip, because another film happens to have scored 30 points.
    // Round 30 rendering here proves nothing capped the sequence at eight.
    const last = items[items.length - 1] as HTMLElement;
    expect(within(last).getByText('30')).toBeInTheDocument();
    expect(within(last).getByText('Film 30')).toBeInTheDocument();
  });

  it('preserves the order it is given — draft order, not points order', () => {
    // The service sorts by round. Re-sorting here would silently destroy the
    // snake order, which is real information: round 1 cost more than round 8.
    const shuffled: RosterFilm[] = [
      { id: 3, title: 'Third', posterUrl: null, round: 3, points: 500, share: 0.5 },
      { id: 1, title: 'First', posterUrl: null, round: 1, points: 10, share: 0.1 },
      { id: 2, title: 'Second', posterUrl: null, round: 2, points: 400, share: 0.4 },
    ];

    render(<RosterStrip films={shuffled} />);
    const items = screen.getAllByRole('listitem');

    expect(within(items[0] as HTMLElement).getByText('Third')).toBeInTheDocument();
    expect(within(items[1] as HTMLElement).getByText('First')).toBeInTheDocument();
  });

  it('renders an empty roster as a message, not an empty grid', () => {
    // A member who has joined but not drafted. An empty grid reads as broken.
    render(<RosterStrip films={[]} />);

    expect(screen.getByText(/no films drafted yet/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('passes winner and nominated states through to the frame', () => {
    render(
      <RosterStrip
        films={[
          { ...(films(1)[0] as RosterFilm), status: 'won' },
          {
            id: 2,
            title: 'Nominee',
            posterUrl: null,
            round: 2,
            points: 20,
            share: 0.2,
            status: 'nominated',
          },
        ]}
      />,
    );

    expect(screen.getByLabelText('Winner')).toBeInTheDocument();
  });

  it('keeps every frame the same size regardless of count', () => {
    // The reason the grid wraps instead of fitting one row: a row that divides
    // by the film count is tidy at 8 and unreadable at 30. The track rule is
    // fixed, so it cannot depend on how many films there are.
    const { container: eight } = render(<RosterStrip films={films(8)} />);
    const eightClass = eight.querySelector('ul')?.className;

    const { container: thirty } = render(<RosterStrip films={films(30)} />);
    expect(thirty.querySelector('ul')?.className).toBe(eightClass);
  });

  it('🔴 sizes columns by a minimum readable width, not a column count', () => {
    // The fix for the 1440px clipping the E2E caught: eight fixed columns left
    // each frame too narrow for a two-line title. A width floor lets the count
    // fall out of the available space instead.
    const { container } = render(<RosterStrip films={films(8)} />);
    expect(container.querySelector('ul')?.className).toContain('minmax(10rem,1fr)');
  });
});

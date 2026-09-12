import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SeasonPicker } from './SeasonPicker';

describe('SeasonPicker', () => {
  it('shows the season on screen without opening anything', () => {
    render(<SeasonPicker year={2026} seasons={[2026, 2025, 2024]} />);

    // The year the reader is looking at is stated, not hidden behind the
    // control — the flat row of links got that right and it must survive.
    expect(screen.getByRole('group')).toHaveTextContent('2026');
  });

  it('🔴 every year is a real link, so Back and open-in-new-tab keep working', () => {
    render(<SeasonPicker year={2026} seasons={[2026, 2025, 2024]} />);

    for (const year of [2026, 2025, 2024]) {
      expect(screen.getByRole('link', { name: String(year) })).toHaveAttribute(
        'href',
        `/?year=${year}`,
      );
    }
  });

  it('marks the season on screen', () => {
    render(<SeasonPicker year={2025} seasons={[2026, 2025]} />);
    expect(screen.getByRole('link', { name: '2025' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: '2026' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('renders nothing for a single season', () => {
    const { container } = render(<SeasonPicker year={2026} seasons={[2026]} />);
    // One season is not a choice, and a picker offering one option is furniture.
    expect(container).toBeEmptyDOMElement();
  });
});

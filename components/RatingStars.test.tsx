import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RatingStars } from '@/components/RatingStars';

/**
 * The figure is the fact and the stars are the treatment (§6.7), so both are
 * asserted: the text a screen reader gets, and the fill each glyph is clipped to.
 */
function fills(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-fill]')).map(
    (node) => (node as HTMLElement).style.width,
  );
}

describe('RatingStars', () => {
  it('writes the rating out to one decimal, out of five', () => {
    render(<RatingStars rating={4} />);

    expect(screen.getByText(/^4\.0$/)).toBeInTheDocument();
    expect(screen.getByText(/out of 5/)).toBeInTheDocument();
  });

  it('🔴 clips the fourth star to half for 3.5', () => {
    // The case 0.5 precision exists for. Rounding it to a whole star, or
    // spreading the value across all five, both still draw five stars.
    const { container } = render(<RatingStars rating={3.5} />);

    expect(fills(container)).toEqual(['100%', '100%', '100%', '50%', '0%']);
  });

  it('fills nothing beyond the rating and never past the last star', () => {
    const { container } = render(<RatingStars rating={5} />);

    expect(fills(container)).toEqual(['100%', '100%', '100%', '100%', '100%']);
  });

  it('fills only half of the first star at the lowest rating', () => {
    const { container } = render(<RatingStars rating={0.5} />);

    expect(fills(container)).toEqual(['50%', '0%', '0%', '0%', '0%']);
  });
});

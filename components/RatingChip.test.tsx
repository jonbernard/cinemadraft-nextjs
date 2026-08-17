import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RatingChip } from '@/components/RatingChip';

/**
 * Metacritic's three bands, and the a11y rule that made this a chip rather than
 * a coloured square.
 */
describe('the three bands, ported from the source exactly', () => {
  it.each([
    [94, 'score-high'],
    [61, 'score-high'],
    [60, 'score-mid'],
    [40, 'score-mid'],
    [39, 'score-low'],
    [0, 'score-low'],
  ])('%i is %s', (score, token) => {
    // The boundaries are Metacritic's own (`movie.js:117`): 61 and above green,
    // 40 and above yellow. Readers know them from their site, so shifting one
    // would make the same film look better here than there.
    render(<RatingChip label="Metacritic" score={score} />);

    expect(screen.getByText(String(score)).className).toContain(token);
  });
});

describe('🔴 colour is never the only signal', () => {
  it('prints the number inside the chip', () => {
    // So it reads in greyscale, in print, and to a colour-blind reader (§6.7,
    // a11y `color-not-only`). The source rendered a bare coloured square.
    render(<RatingChip label="Metacritic" score={94} />);

    expect(screen.getByText('94')).toBeTruthy();
  });

  it('names the source beside it', () => {
    // The source app showed a green box and a tomato image and expected the
    // reader to know which was which.
    render(<RatingChip label="Rotten Tomatoes" score={91} />);

    expect(screen.getByText('Rotten Tomatoes')).toBeTruthy();
  });

  it('says what the number is out of', () => {
    render(<RatingChip label="Metacritic" score={94} />);

    expect(screen.getByText('out of 100')).toBeTruthy();
  });
});

describe('the colour is a token, never a literal', () => {
  it('uses no inline style', () => {
    // `scripts/layering.sh` fails the build on a hex in a component, and this
    // asserts the same rule from the other side: the band arrives as a class.
    const { container } = render(<RatingChip label="Metacritic" score={94} />);

    expect(container.querySelector('[style]')).toBeNull();
  });
});

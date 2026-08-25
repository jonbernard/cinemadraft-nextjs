import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Wordmark } from './Wordmark';

describe('Wordmark', () => {
  it('reads as one name, not a graphic plus a word', () => {
    render(<Wordmark />);

    // The lockup is a single image as far as assistive technology is
    // concerned: one accessible name, and the visible text hidden behind it.
    expect(screen.getByRole('img', { name: 'Cinemadraft' })).toBeInTheDocument();
    expect(screen.queryAllByRole('img')).toHaveLength(1);
  });

  it('still carries the name when only the mark is drawn', () => {
    render(<Wordmark markOnly />);

    expect(screen.getByRole('img', { name: 'Cinemadraft' })).toBeInTheDocument();
    expect(screen.queryByText('Cinemadraft')).toBeNull();
  });

  it('🔴 sets the name in the wordmark face, never the serif (D83)', () => {
    // D70 gives the serif to things that have names; D83 makes the product's
    // own name the one exception, and it is asserted rather than reviewed.
    render(<Wordmark />);
    const word = screen.getByText('Cinemadraft');

    expect(word.className).toContain('font-wordmark');
    expect(word.className).not.toContain('font-serif');
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReviewCard } from '@/components/ReviewCard';

const SAVED = new Date('2026-08-14T00:00:00Z');

describe('ReviewCard', () => {
  it('🔴 keeps the writer’s paragraphs apart', () => {
    // The source rendered one <Typography> per line for the same reason.
    // Joining them would still show every word, so this counts the elements.
    render(
      <ReviewCard
        review={{
          rating: 4.5,
          review: 'The first thing.\n\nThe second thing.',
          updatedAt: SAVED,
        }}
      />,
    );

    expect(screen.getByText('The first thing.')).toBeInTheDocument();
    expect(screen.getByText('The second thing.')).toBeInTheDocument();
    // The blank line between them is not a paragraph of its own.
    expect(screen.getAllByText(/thing\.$/)).toHaveLength(2);
  });

  it('shows the rating as stars and as a figure', () => {
    render(<ReviewCard review={{ rating: 2.5, review: null, updatedAt: SAVED }} />);

    expect(screen.getByText(/^2\.5$/)).toBeInTheDocument();
    expect(screen.getByText(/out of 5/)).toBeInTheDocument();
  });

  it('🔴 shows no rating at all when there is none, rather than zero stars', () => {
    render(
      <ReviewCard review={{ rating: null, review: 'Words only.', updatedAt: SAVED }} />,
    );

    expect(screen.queryByText(/out of 5/)).not.toBeInTheDocument();
    expect(screen.getByText('Words only.')).toBeInTheDocument();
  });

  it('dates the review in words, never as digits', () => {
    render(<ReviewCard review={{ rating: 3, review: null, updatedAt: SAVED }} />);

    expect(screen.getByText('Saved August 14, 2026')).toBeInTheDocument();
  });
});

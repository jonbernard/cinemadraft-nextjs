import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SaveReview } from '@/components/ReviewForm';
import { YourReview } from '@/components/YourReview';
import type { MyReview } from '@/lib/services/reviews';

const WRITTEN: MyReview = {
  rating: 3.5,
  review: 'Better than the trailer promised.',
  updatedAt: new Date('2026-08-14T00:00:00Z'),
};

const accept: SaveReview = async (input) => ({
  ok: true,
  data: { rating: input.rating, review: input.review, updatedAt: new Date() },
});

function renderSection(review: MyReview | null) {
  render(
    <YourReview
      tmdbId="1061474"
      title="One Battle After Another"
      review={review}
      onSave={vi.fn(accept)}
      onDelete={vi.fn(async () => ({ ok: true as const, data: null }))}
    />,
  );
}

describe('YourReview', () => {
  it('🔴 reads nothing back when nothing is written', () => {
    // The card is the read-back half (T39); with no review it would otherwise be
    // an empty panel above the form.
    renderSection(null);

    expect(screen.queryByText(/^Saved /)).not.toBeInTheDocument();
  });

  it('reads the saved review back above the form', () => {
    renderSection(WRITTEN);

    // Scoped to the paragraph: the same words are also the textarea's value, so
    // an unscoped query would pass with the card deleted.
    expect(
      screen.getByText('Better than the trailer promised.', { selector: 'p' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Saved August 14, 2026')).toBeInTheDocument();
  });

  it('offers to write the first time and to edit afterwards', () => {
    renderSection(null);
    expect(screen.getByText('Write a review')).toBeInTheDocument();
    expect(screen.queryByText('Edit your review')).not.toBeInTheDocument();
  });

  it('opens the form on the saved values', () => {
    renderSection(WRITTEN);

    expect(screen.getByText('Edit your review')).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: /Your review of One Battle After Another/ }),
    ).toHaveValue('Better than the trailer promised.');
    expect(screen.getByRole('radio', { name: '3.5 stars' })).toBeChecked();
  });
});

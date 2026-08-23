import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { type DeleteReview, ReviewForm, type SaveReview } from '@/components/ReviewForm';
import type { MyReview } from '@/lib/services/reviews';

const EXISTING: MyReview = {
  rating: 3.5,
  review: 'Better than the trailer promised.',
  updatedAt: new Date('2026-08-14T00:00:00Z'),
};

const accept: SaveReview = async (input) => ({
  ok: true,
  data: { rating: input.rating, review: input.review, updatedAt: new Date() },
});

function renderForm(
  options: {
    review?: MyReview | null;
    onSave?: SaveReview;
    onDelete?: DeleteReview;
  } = {},
) {
  const onSave = options.onSave ?? vi.fn(accept);
  const onDelete =
    options.onDelete ?? vi.fn(async () => ({ ok: true as const, data: null }));
  render(
    <ReviewForm
      tmdbId="313369"
      title="La La Land"
      review={options.review ?? null}
      onSave={onSave}
      onDelete={onDelete}
    />,
  );
  return { onSave, onDelete };
}

describe('writing a review', () => {
  it('starts empty for a film the member has not written about', () => {
    renderForm();

    expect(
      screen.getByRole('textbox', { name: /Your review of La La Land/ }),
    ).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'None' })).toBeChecked();
  });

  it('🔴 sends the rating and the words together', async () => {
    const { onSave } = renderForm();

    await userEvent.click(screen.getByRole('radio', { name: '4.5 stars' }));
    await userEvent.type(
      screen.getByRole('textbox', { name: /Your review of La La Land/ }),
      'Held up.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save review' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        tmdbId: '313369',
        rating: 4.5,
        review: 'Held up.',
      }),
    );
  });

  it('confirms a save in a live region', async () => {
    renderForm();

    await userEvent.click(screen.getByRole('radio', { name: '2.0 stars' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save review' }));

    expect(await screen.findByText('Review saved')).toBeInTheDocument();
  });

  it('🔴 shows the refusal instead of claiming success', async () => {
    // The source's form enqueued "Review saved" before the request resolved, so
    // a rejected write still reported success.
    renderForm({
      onSave: async () => ({
        ok: false,
        code: 'INVALID',
        message: 'add a rating or a few words',
      }),
    });

    await userEvent.click(screen.getByRole('button', { name: 'Save review' }));

    // The refusal and the confirmation share one live region and one colour, so
    // the opening words are the only thing marking this as a failure.
    expect(
      await screen.findByText('Not saved — add a rating or a few words'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Review saved')).not.toBeInTheDocument();
  });
});

describe('editing what is already there', () => {
  it('opens with the saved rating and words', () => {
    renderForm({ review: EXISTING });

    expect(
      screen.getByRole('textbox', { name: /Your review of La La Land/ }),
    ).toHaveValue('Better than the trailer promised.');
    expect(screen.getByRole('radio', { name: '3.5 stars' })).toBeChecked();
  });

  it('🔴 offers no Remove when there is nothing to remove', () => {
    renderForm({ review: null });

    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('offers Remove once a review exists', () => {
    renderForm({ review: EXISTING });

    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('says Update rather than Save when a review already exists', () => {
    renderForm({ review: EXISTING });

    expect(screen.getByRole('button', { name: 'Update review' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save review' })).not.toBeInTheDocument();
  });

  it('🔴 empties the fields after a removal, and stops offering Remove', async () => {
    const { onDelete } = renderForm({ review: EXISTING });

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith({ tmdbId: '313369' }));
    expect(
      await screen.findByRole('button', { name: 'Save review' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: /Your review of La La Land/ }),
    ).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'None' })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });
});

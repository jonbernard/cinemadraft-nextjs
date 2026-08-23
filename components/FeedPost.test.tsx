import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FeedPost } from '@/components/FeedPost';
import type { FeedFilm, FeedItem } from '@/lib/services/profile';

const film = (movieId: number, title: string): FeedFilm => ({
  movieId,
  tmdbId: String(1000 + movieId),
  title,
  posterUrl: null,
});

const DRAFTED: FeedItem = {
  id: 90,
  message: 'Vera drafted these movies in the 2024 Racso award league.',
  link: '',
  createdAt: new Date('2023-12-02T01:24:44.169Z'),
  attachments: [
    {
      kind: 'draft',
      key: 'draft-110',
      draftId: 110,
      films: [
        film(1, 'Oppenheimer'),
        film(2, 'Poor Things'),
        film(3, 'Killers of the Flower Moon'),
        film(4, 'Anatomy of a Fall'),
        film(5, 'The Zone of Interest'),
      ],
      more: 2,
    },
  ],
};

const REVIEWED: FeedItem = {
  id: 91,
  message: 'Vera posted a review of The Brutalist.',
  link: '',
  createdAt: new Date('2026-01-18T12:00:00Z'),
  attachments: [
    {
      kind: 'review',
      key: 'review-4',
      film: film(6, 'The Brutalist'),
      rating: 4.5,
      review: 'Three and a half hours and not one of them wasted.',
      updatedAt: new Date('2026-01-18T12:00:00Z'),
    },
  ],
};

describe('a feed post', () => {
  it('renders the message and a date a person reads', () => {
    render(<FeedPost item={DRAFTED} />);

    expect(screen.getByText(DRAFTED.message as string)).toBeInTheDocument();
    expect(screen.getByText('December 2, 2023')).toBeInTheDocument();
  });

  it('links each drafted film to its own page, and says how many are not shown', () => {
    render(<FeedPost item={DRAFTED} />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(5);
    expect(links[0]).toHaveAttribute('href', '/films/1001');
    expect(screen.getByText('and 2 more films')).toBeInTheDocument();
  });

  it('renders a review attachment with its rating and its words', () => {
    render(<FeedPost item={REVIEWED} />);

    expect(screen.getByRole('link', { name: 'The Brutalist' })).toHaveAttribute(
      'href',
      '/films/1006',
    );
    expect(
      screen.getByText('Three and a half hours and not one of them wasted.'),
    ).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
  });
});

describe('the delete control', () => {
  it('🔴 is absent for a reader who is not the author', () => {
    render(<FeedPost item={DRAFTED} />);

    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });

  it('names the post it removes, and asks for that post by id', async () => {
    const onDelete = vi.fn(async () => ({ ok: true as const, data: null }));
    render(<FeedPost item={DRAFTED} onDelete={onDelete} />);

    const button = screen.getByRole('button', {
      name: 'Delete your post from December 2, 2023',
    });
    await userEvent.click(button);

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith({ id: 90 }));
  });

  it('says why nothing happened when the delete is refused', async () => {
    const onDelete = vi.fn(async () => ({
      ok: false as const,
      code: 'NOT_FOUND' as const,
      message: 'that post is not there',
    }));
    const { container } = render(<FeedPost item={DRAFTED} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));

    const live = container.querySelector('[aria-live="polite"]');
    await waitFor(() =>
      expect(
        within(live as HTMLElement).getByText('that post is not there'),
      ).toBeInTheDocument(),
    );
  });
});

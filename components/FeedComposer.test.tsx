import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FeedComposer } from '@/components/FeedComposer';

const accept = () => vi.fn(async () => ({ ok: true as const, data: null }));

describe('the feed composer', () => {
  it('will not post nothing', async () => {
    const onPost = accept();
    render(<FeedComposer onPost={onPost} />);

    expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled();

    await userEvent.type(
      screen.getByRole('textbox', { name: /Say something on your profile/ }),
      '   ',
    );

    expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled();
    expect(onPost).not.toHaveBeenCalled();
  });

  it('posts what was typed and clears the field', async () => {
    const onPost = accept();
    render(<FeedComposer onPost={onPost} />);

    const field = screen.getByRole('textbox', { name: /Say something on your profile/ });
    await userEvent.type(field, 'Finally caught up on the season.');
    await userEvent.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() =>
      expect(onPost).toHaveBeenCalledWith({
        message: 'Finally caught up on the season.',
      }),
    );
    await waitFor(() => expect(field).toHaveValue(''));
    expect(screen.getByText('Posted')).toBeInTheDocument();
  });

  it('keeps what was typed when the post is refused, and says why', async () => {
    const onPost = vi.fn(async () => ({
      ok: false as const,
      code: 'FORBIDDEN' as const,
      message: 'this account has no profile yet',
    }));
    render(<FeedComposer onPost={onPost} />);

    const field = screen.getByRole('textbox', { name: /Say something on your profile/ });
    await userEvent.type(field, 'Finally caught up on the season.');
    await userEvent.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() =>
      expect(screen.getByText('this account has no profile yet')).toBeInTheDocument(),
    );
    expect(field).toHaveValue('Finally caught up on the season.');
  });
});

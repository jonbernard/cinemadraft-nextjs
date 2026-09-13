import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders its title as a heading', () => {
    render(<EmptyState title="No leagues yet" />);
    expect(screen.getByRole('heading', { name: 'No leagues yet' })).toBeInTheDocument();
  });

  it('renders an action as a link, so it works without JavaScript', () => {
    render(
      <EmptyState
        title="No leagues yet"
        action={{ label: 'Join a league', href: '/leagues' }}
      >
        Join a league to start drafting.
      </EmptyState>,
    );

    expect(screen.getByRole('link', { name: 'Join a league' })).toHaveAttribute(
      'href',
      '/leagues',
    );
  });

  it('renders without an action, for states the member cannot act on', () => {
    // "Your draft has not opened yet" has no button, because there is nothing
    // to press. Inventing one would be worse than none.
    render(
      <EmptyState title="Draft not open">Your league drafts on 12 January.</EmptyState>,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/12 January/)).toBeInTheDocument();
  });
});

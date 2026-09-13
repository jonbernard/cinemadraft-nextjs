import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import AuthLayout from './layout';

describe('AuthLayout', () => {
  /**
   * 🔴 The lockup, not a serif word.
   *
   * This page rendered `<span className="font-serif">Cinemadraft</span>` for
   * eight phases after `Wordmark` shipped (P15.T5, D83), so the first screen a
   * migrating member saw wore a different Cinemadraft from the one in the
   * rail. `Wordmark` is the only thing that draws the name; asserting on its
   * accessible name rather than on text catches a regression to any other
   * spelling of it.
   */
  it('draws the name with the Wordmark lockup', () => {
    render(<AuthLayout>form</AuthLayout>);

    const lockup = screen.getByRole('img', { name: 'Cinemadraft' });
    expect(lockup).toBeInTheDocument();
    // The mark itself, which the serif span had no equivalent of.
    expect(lockup.querySelector('svg')).toBeInTheDocument();
  });

  it('gives a visitor a way back out to the site', () => {
    render(<AuthLayout>form</AuthLayout>);

    expect(screen.getByRole('link', { name: 'Cinemadraft, home' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  /**
   * The page's content is a panel on the ground, like every other surface in
   * the product (D67). Before this the heading and the orientation line lay
   * directly on `bg-ground` and Clerk's own card was the only raised thing on
   * the page.
   */
  it('sits its content on a panel, not on the ground', () => {
    const { container } = render(<AuthLayout>form</AuthLayout>);

    const panel = screen.getByText('form');
    expect(panel.className).toContain('bg-bg-panel');
    expect(container.querySelector('main')?.className).toContain('bg-bg-ground');
  });
});

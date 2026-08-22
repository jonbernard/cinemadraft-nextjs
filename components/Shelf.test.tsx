import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Shelf } from './Shelf';

describe('Shelf', () => {
  it('renders its heading and children', () => {
    render(
      <Shelf heading="Roster">
        <li>Dune</li>
      </Shelf>,
    );
    expect(screen.getByRole('heading', { name: /Roster/ })).toBeInTheDocument();
    expect(screen.getByText('Dune')).toBeInTheDocument();
  });

  it('links the heading when href is given', () => {
    render(
      <Shelf heading="Roster" href="/leagues/1">
        <li>Dune</li>
      </Shelf>,
    );
    expect(screen.getByRole('link', { name: /Roster/ })).toHaveAttribute(
      'href',
      '/leagues/1',
    );
  });

  it('is a list, so a screen reader announces its length', () => {
    render(
      <Shelf heading="Roster">
        <li>Dune</li>
      </Shelf>,
    );
    expect(screen.getByRole('list')).toBeInTheDocument();
  });
});

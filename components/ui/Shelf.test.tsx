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

  it('heads its section at h2, so a page of shelves has an outline', () => {
    // The defect: `/` ran h1 → h3 → h2, a skipped level and then a step back
    // up. Invisible while every heading rendered at 17px; a visible mess the
    // moment P17.T1 gave them sizes.
    render(
      <Shelf heading="In cinemas now">
        <li>x</li>
      </Shelf>,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'In cinemas now' }),
    ).toBeInTheDocument();
  });

  it('takes an h3 for a shelf nested inside a section', () => {
    // `DraftBoard` is the case: each seat's picks are a shelf under a
    // `Group N` h2, so h2 there would put a seat beside the group holding it.
    render(
      <Shelf as="h3" heading="Sarah Powers">
        <li>x</li>
      </Shelf>,
    );
    expect(
      screen.getByRole('heading', { level: 3, name: 'Sarah Powers' }),
    ).toBeInTheDocument();
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

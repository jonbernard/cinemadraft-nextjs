import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SectionHead } from './SectionHead';

describe('SectionHead', () => {
  it('renders the heading at the requested level', () => {
    render(<SectionHead as="h3">Roster</SectionHead>);
    expect(screen.getByRole('heading', { level: 3, name: 'Roster' })).toBeInTheDocument();
  });

  it('renders the eyebrow and the right slot', () => {
    render(
      <SectionHead eyebrow="Seat 01 · Rounds 1–7" right={<span>955 pts</span>}>
        Roster
      </SectionHead>,
    );
    expect(screen.getByText('Seat 01 · Rounds 1–7')).toBeInTheDocument();
    expect(screen.getByText('955 pts')).toBeInTheDocument();
  });

  // 🔴 D70 is a semantic rule, so it is asserted rather than left to review.
  it('uses the serif only when the heading is a name', () => {
    const { rerender } = render(<SectionHead>Roster</SectionHead>);
    expect(screen.getByRole('heading')).toHaveClass('font-sans');
    rerender(<SectionHead name>Sarah Powers</SectionHead>);
    expect(screen.getByRole('heading')).toHaveClass('font-serif');
  });

  it('does not uppercase the heading', () => {
    render(<SectionHead>Roster</SectionHead>);
    expect(screen.getByRole('heading')).not.toHaveClass('uppercase');
  });
});

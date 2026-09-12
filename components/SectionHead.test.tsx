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

  // 🔴 Decided 2026-09-12: 28 / 20 / 17 keyed to `as`. Asserted rather than
  // left to review, for the same reason D70's face rule is: every heading in
  // the app inherits this, and a regression here is invisible on any one page.
  // The rendered px are in `e2e/dashboard.spec.ts` — jsdom resolves no
  // Tailwind, so `text-[28px]` is a string here and a number only in a browser,
  // and the original defect was four `as` values compiling to one size.
  it.each([
    ['h1', 'text-[28px]'],
    ['h2', 'text-[20px]'],
    ['h3', 'text-[17px]'],
    ['h4', 'text-[17px]'],
  ] as const)('renders %s at its own size', (level, size) => {
    render(<SectionHead as={level}>Roster</SectionHead>);
    expect(screen.getByRole('heading')).toHaveClass(size);
  });

  // 🔴 The serif is an orthogonal axis, not the hierarchy (D70). A league name
  // is 24px serif whether it is an h2 or an h3 — and a 28px h1 therefore
  // outranks it, which is the whole reason 28 was chosen.
  it('keeps a name at 24px serif whatever its level', () => {
    const { rerender } = render(
      <SectionHead as="h2" name>
        Sarah Powers
      </SectionHead>,
    );
    expect(screen.getByRole('heading')).toHaveClass('font-serif', 'text-2xl');
    expect(screen.getByRole('heading')).not.toHaveClass('text-[20px]');

    rerender(
      <SectionHead as="h3" name>
        Sarah Powers
      </SectionHead>,
    );
    expect(screen.getByRole('heading')).toHaveClass('font-serif', 'text-2xl');
  });

  it('does not uppercase the heading', () => {
    render(<SectionHead>Roster</SectionHead>);
    expect(screen.getByRole('heading')).not.toHaveClass('uppercase');
  });
  it('stacks the right slot beneath the heading when asked', () => {
    const { container } = render(
      <SectionHead right={<span>2026</span>} rightStacksOnMobile>
        Season leaderboard
      </SectionHead>,
    );

    // Column below `sm`, row from `sm` up: the collision the owner hit at 390px
    // is the row layout applying at every width.
    expect(container.firstElementChild?.className).toContain('flex-col');
    expect(container.firstElementChild?.className).toContain('sm:flex-row');
  });
});

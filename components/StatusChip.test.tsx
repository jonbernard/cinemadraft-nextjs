import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusChip } from './StatusChip';

describe('StatusChip', () => {
  // 🔴 §6.7: one signal per fact is not enough. Colour alone is invisible to
  // a colour-blind reader and in print, so the state must also be text.
  it('states the status as text, not only as colour', () => {
    render(<StatusChip tone="brass">Winner</StatusChip>);
    expect(screen.getByText('Winner')).toBeInTheDocument();
  });

  it('uses the awards accent for awards and the urgency accent for urgency', () => {
    const { rerender, container } = render(<StatusChip tone="brass">Winner</StatusChip>);
    expect(container.firstElementChild?.className).toMatch(/brass/);
    rerender(<StatusChip tone="carmine">On the clock</StatusChip>);
    expect(container.firstElementChild?.className).toMatch(/accent/);
  });
});

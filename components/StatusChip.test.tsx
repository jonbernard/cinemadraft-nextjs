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

  it('carries a beam tone for what is scheduled and not yet (D69, P17.T20)', () => {
    render(<StatusChip tone="beam">Next · date TBA</StatusChip>);

    const chip = screen.getByText('Next · date TBA');
    // 🔴 Beam is ink here, not a fill. `theme/contrast.test.ts` proves beam
    // readable AS TEXT on the app's surfaces in both schemes; a fill would need
    // a beam-contrast token and new rows in that file, for one chip.
    expect(chip.className).toContain('text-beam');
    expect(chip.className).not.toContain('bg-beam');
  });
});

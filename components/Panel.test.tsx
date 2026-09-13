import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Panel } from './Panel';

describe('Panel', () => {
  it('renders its children', () => {
    render(<Panel>Board</Panel>);
    expect(screen.getByText('Board')).toBeInTheDocument();
  });

  // 🔴 D72. The four-sided hairline is the single largest offender in the
  // brief's diagnosis — flat + hairline + uniform grey boxes is the
  // monitoring-dashboard signature.
  it('carries no border', () => {
    const { container } = render(<Panel>Board</Panel>);
    expect(container.firstElementChild?.className).not.toMatch(/\bborder\b/);
  });

  it('renders as the requested element', () => {
    const { container } = render(<Panel as="section">Board</Panel>);
    expect(container.firstElementChild?.tagName).toBe('SECTION');
  });

  it('uses the 6px default radius, not the 10px step (D73, P17.T25)', () => {
    const { container } = render(<Panel>content</Panel>);

    // 🔴 D73 anchors the scale at 6px and Panel is the primitive every page
    // composes from — this one class was 58 of the product's rendered radii.
    expect(container.firstElementChild?.className).toContain('rounded-sm');
    expect(container.firstElementChild?.className).not.toContain('rounded-md');
  });
});

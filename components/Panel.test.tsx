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
});

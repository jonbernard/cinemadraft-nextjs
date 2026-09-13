import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SeenMeter } from './SeenMeter';

describe('SeenMeter', () => {
  it('states the fact in words, not only in the bar', () => {
    render(<SeenMeter seen={8} total={20} />);
    expect(screen.getByText(/8/).closest('p')).toHaveTextContent('8 of 20 films seen');
  });

  it('takes the unit from the caller, because nominations are not films', () => {
    render(<SeenMeter seen={2} total={26} unit="nominations" />);
    expect(screen.getByText(/nominations seen/)).toBeInTheDocument();
  });

  it('does not render an indeterminate bar when nothing is nominated yet', () => {
    const { container } = render(<SeenMeter seen={0} total={0} />);
    const bar = container.querySelector('progress');
    expect(bar).toHaveAttribute('max', '1');
    expect(bar).toHaveAttribute('aria-hidden', 'true');
  });
});

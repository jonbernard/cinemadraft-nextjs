import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TabBar } from './TabBar';

describe('TabBar', () => {
  // 🔴 D75. Five slots is the ceiling before 44px targets stop fitting on a
  // 390px phone, which is why the seventh, sixth and fifth destinations moved
  // behind More rather than being dropped.
  it('renders four destinations plus More', () => {
    render(<TabBar pathname="/" onMore={vi.fn()} isMoreOpen={false} moreId="more" />);
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('every tab carries a text label, not an icon alone', () => {
    render(<TabBar pathname="/" onMore={vi.fn()} isMoreOpen={false} moreId="more" />);
    for (const label of ['Home', 'Leagues', 'Browse', 'Award shows']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('opens the sheet and reports its state', async () => {
    const onMore = vi.fn();
    render(<TabBar pathname="/" onMore={onMore} isMoreOpen={false} moreId="more" />);
    const more = screen.getByRole('button', { name: 'More' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(more).toHaveAttribute('aria-controls', 'more');
    await userEvent.click(more);
    expect(onMore).toHaveBeenCalledOnce();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ErrorPanel } from '@/components/ErrorPanel';

/**
 * The app's failure surface.
 *
 * The property that matters most is what it does *not* say: the source app
 * returned Postgres errors verbatim, leaking SQL and column names to the
 * browser on every error path.
 */
describe('ErrorPanel', () => {
  it('🔴 says something different for each kind, not "something went wrong"', () => {
    const titles = new Set<string>();
    for (const kind of ['not-found', 'forbidden', 'conflict', 'unknown'] as const) {
      const { unmount } = render(<ErrorPanel kind={kind} />);
      titles.add(screen.getByRole('heading').textContent ?? '');
      unmount();
    }

    expect(titles.size).toBe(4);
  });

  it('🔴 offers a way out of a forbidden page', () => {
    // "You cannot see this" without "log in" is a dead end, and being logged
    // out is the most likely reason for it.
    render(<ErrorPanel kind="forbidden" />);

    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
  });

  it('offers the dashboard when a page does not exist', () => {
    render(<ErrorPanel kind="not-found" />);

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('retries when it can', async () => {
    const onRetry = vi.fn();
    render(<ErrorPanel kind="unknown" onRetry={onRetry} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalled();
  });

  it('omits the retry button where there is nothing to retry', () => {
    // `not-found` has no reset — retrying a missing page just fails again.
    render(<ErrorPanel kind="not-found" />);

    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('🔴 never renders a raw error message', () => {
    // The component takes a *kind*, not a message — the leak is impossible by
    // construction rather than by remembering to sanitise. This asserts the
    // shape stays that way.
    render(<ErrorPanel kind="unknown" />);

    const text = screen.getByRole('main').textContent ?? '';
    expect(text).not.toMatch(/select |from |column|postgres|prisma/i);
  });

  it('does not apologise or shout', () => {
    for (const kind of ['not-found', 'forbidden', 'conflict', 'unknown'] as const) {
      const { unmount } = render(<ErrorPanel kind={kind} />);
      const text = screen.getByRole('main').textContent ?? '';
      expect(text).not.toMatch(/sorry|oops|!/i);
      unmount();
    }
  });

  it('the retry control clears the 44px minimum', () => {
    render(<ErrorPanel kind="unknown" onRetry={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Try again' }).className).toMatch(
      /min-h-11/,
    );
  });
});

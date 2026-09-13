import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LiveBanner } from './LiveBanner';

describe('LiveBanner', () => {
  it('names the show and links to its live page for this season', () => {
    render(<LiveBanner abbreviation="oscars" name="Academy Awards" year={2026} />);
    const link = screen.getByRole('link', { name: /watch/i });
    expect(link).toHaveAttribute('href', '/live/oscars?year=2026');
    expect(screen.getByText(/academy awards/i)).toBeInTheDocument();
  });

  it('announces itself to a screen reader without shouting on every render', () => {
    // 🔴 `role="status"`, not `role="alert"`. The banner is present from the
    // first paint of a page a member opens deliberately; an alert interrupts,
    // and there is nothing here to interrupt for.
    render(<LiveBanner abbreviation="oscars" name="Academy Awards" year={2026} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

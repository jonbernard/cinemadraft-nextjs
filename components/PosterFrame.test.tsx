import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PosterFrame } from './PosterFrame';

const base = { title: 'Sinners', posterUrl: null, round: 1, points: 40 };

describe('PosterFrame', () => {
  it('pads the round to two digits', () => {
    render(<PosterFrame {...base} />);
    expect(screen.getByText('01')).toBeInTheDocument();
  });

  it('renders a round past nine without truncating (D34)', () => {
    // There is no roster size. A 30-film league is as valid as an 8-film one.
    render(<PosterFrame {...base} round={30} />);
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('marks a winner exactly once', () => {
    // §6.7: one signal per fact. The old app used a size change AND a green
    // check, and green reads as validation state rather than victory.
    render(<PosterFrame {...base} status="won" />);
    expect(screen.getByLabelText('Winner')).toBeInTheDocument();
  });

  it('does not mark an unwon film as a winner', () => {
    render(<PosterFrame {...base} status="nominated" />);
    expect(screen.queryByLabelText('Winner')).not.toBeInTheDocument();
  });

  it('never hides a long title behind the artwork', () => {
    // The current app overlays titles and truncates them to "Is This …".
    render(<PosterFrame {...base} title="Is This Thing On?" />);
    expect(screen.getByText('Is This Thing On?')).toBeInTheDocument();
  });

  it('clamps a share above 1 rather than overflowing the grid', () => {
    const { container } = render(<PosterFrame {...base} share={4} />);
    expect(container.querySelector('figcaption span[style]')).toHaveStyle({
      width: '100%',
    });
  });

  it('clamps a negative share to zero', () => {
    const { container } = render(<PosterFrame {...base} share={-2} />);
    expect(container.querySelector('figcaption span[style]')).toHaveStyle({
      width: '0%',
    });
  });

  it('falls back to the system accent when a film has no colour', () => {
    const { container } = render(<PosterFrame {...base} share={0.5} />);
    expect(container.querySelector('figcaption span[style]')).toHaveStyle({
      backgroundColor: 'var(--color-accent-fill)',
    });
  });

  it('gives the poster an empty alt so the visible title is not announced twice', () => {
    // 🔴 The poster is decorative: the title is beside it in the figcaption, and
    // a screen reader announcing the film twice is worse than not at all.
    render(<PosterFrame {...base} posterUrl="https://image.tmdb.org/t/p/w500/abc.jpg" />);
    // An empty-alt img is presentational and exposes no accessible role, so
    // there is nothing to query it by except the tag.
    const poster = document.querySelector('img');
    expect(poster).toHaveAttribute('alt', '');
    expect(poster).toHaveAttribute('src', expect.stringContaining('image.tmdb.org'));
  });

  it('shows an initials placeholder when there is no poster', () => {
    render(<PosterFrame {...base} title="Marty Supreme" />);
    expect(screen.getByText('MA')).toBeInTheDocument();
  });
});

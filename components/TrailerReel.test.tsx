import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TrailerReel } from '@/components/TrailerReel';

/**
 * The facade, which is the entire point of this component.
 *
 * 🔴 The source rendered an `<iframe>` per video into a slider — thirty-two
 * YouTube players for La La Land, each pulling its own script and cookies, on a
 * page nobody had asked to watch anything on. The assertions below are about
 * *how many frames exist*, because that is the defect.
 */
const TRAILERS = [
  { key: 'aaa111', name: 'Official Trailer' },
  { key: 'bbb222', name: 'Teaser' },
  { key: 'ccc333', name: 'Featurette' },
];

describe('🔴 before anybody presses play', () => {
  it('mounts no iframe at all', () => {
    const { container } = render(<TrailerReel trailers={TRAILERS} />);

    expect(container.querySelector('iframe')).toBeNull();
  });

  it('offers every trailer as a real button', () => {
    // A div with a click handler would be unreachable by keyboard and announce
    // nothing.
    render(<TrailerReel trailers={TRAILERS} />);

    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Official Trailer/ })).toBeTruthy();
  });
});

describe('pressing play', () => {
  it('mounts exactly one frame', () => {
    const { container } = render(<TrailerReel trailers={TRAILERS} />);

    fireEvent.click(screen.getByRole('button', { name: /Teaser/ }));

    expect(container.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('🔴 embeds through youtube-nocookie', () => {
    // The page is public: a logged-out reader should not pick up advertising
    // cookies from looking at a film.
    const { container } = render(<TrailerReel trailers={TRAILERS} />);

    fireEvent.click(screen.getByRole('button', { name: /Teaser/ }));

    expect(container.querySelector('iframe')?.getAttribute('src')).toContain(
      'youtube-nocookie.com/embed/bbb222',
    );
  });

  it('titles the frame, so it is not an unlabelled region', () => {
    const { container } = render(<TrailerReel trailers={TRAILERS} />);

    fireEvent.click(screen.getByRole('button', { name: /Featurette/ }));

    expect(container.querySelector('iframe')?.getAttribute('title')).toBe('Featurette');
  });

  it('🔴 replaces the frame when switching, rather than keeping both', () => {
    const { container } = render(<TrailerReel trailers={TRAILERS} />);

    fireEvent.click(screen.getByRole('button', { name: /Teaser/ }));
    fireEvent.click(screen.getByRole('button', { name: /Featurette/ }));

    const frames = container.querySelectorAll('iframe');
    expect(frames).toHaveLength(1);
    expect(frames[0]?.getAttribute('src')).toContain('ccc333');
  });

  it('marks which one is playing', () => {
    render(<TrailerReel trailers={TRAILERS} />);

    fireEvent.click(screen.getByRole('button', { name: /Teaser/ }));

    expect(
      screen.getByRole('button', { name: /Teaser/ }).getAttribute('aria-current'),
    ).toBe('true');
  });
});

describe('a film with no trailers', () => {
  it('renders nothing rather than an empty section', () => {
    const { container } = render(<TrailerReel trailers={[]} />);

    expect(container.textContent).toBe('');
  });
});

/**
 * 🔴 Thirty-two videos came back for La La Land, and listing all of them made the
 * trailer panel taller than the rest of the page put together. Seen in a browser
 * rather than predicted.
 */
describe('a film with a great many clips', () => {
  const MANY = Array.from({ length: 32 }, (_, index) => ({
    key: `k${index}`,
    name: `Clip ${index}`,
  }));

  it('shows six, and puts the rest behind a disclosure', () => {
    const { container } = render(<TrailerReel trailers={MANY} />);

    expect(container.querySelector('details')).not.toBeNull();
    expect(screen.getByText('Show 26 more clips')).toBeTruthy();
  });

  it('🔴 keeps every hidden clip in the DOM, so find-in-page reaches it', () => {
    render(<TrailerReel trailers={MANY} />);

    expect(screen.getByRole('button', { name: /Clip 31/ })).toBeTruthy();
  });

  it('plays a hidden clip without unhiding anything first', () => {
    const { container } = render(<TrailerReel trailers={MANY} />);

    fireEvent.click(screen.getByRole('button', { name: /Clip 31/ }));

    expect(container.querySelector('iframe')?.getAttribute('src')).toContain('k31');
  });

  it('has no disclosure for a film with six or fewer', () => {
    render(<TrailerReel trailers={MANY.slice(0, 6)} />);

    expect(screen.queryByText(/more clips/)).toBeNull();
  });
});

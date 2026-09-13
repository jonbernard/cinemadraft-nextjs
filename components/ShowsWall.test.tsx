import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The marks are `next/image` through `RemoteImage`; jsdom has no loader.
vi.mock('next/image', () => ({
  default: ({ src, alt }: Record<string, unknown>) => (
    // biome-ignore lint/performance/noImgElement: this is the stand-in for next/image inside the test
    <img src={src as string} alt={alt as string} data-testid="image" />
  ),
}));

import type { ShowsWallGroup } from './ShowsWall';

const { ShowsWall } = await import('./ShowsWall');

function show(eventId: number, name: string, abbreviation: string | null) {
  return { eventId, name, abbreviation, imageUrl: null };
}

const groups: ShowsWallGroup[] = [
  {
    level: 'Alphabet',
    tiers: [
      { tier: 1, points: 5 },
      { tier: 2, points: 5 },
      { tier: 3, points: 5 },
    ],
    shows: [show(1, 'Writers Guild', 'wga'), show(2, 'Directors Guild', 'dga')],
  },
  {
    level: 'Oscars',
    tiers: [
      { tier: 1, points: 20 },
      { tier: 2, points: 15 },
      { tier: 3, points: 10 },
    ],
    shows: [show(3, 'Academy Awards', 'oscars')],
  },
  {
    level: 'Razzies',
    tiers: [
      { tier: 1, points: -20 },
      { tier: 2, points: -15 },
      { tier: 3, points: -10 },
    ],
    shows: [show(4, 'Golden Raspberry Awards', 'razzies')],
  },
];

describe('ShowsWall', () => {
  it('prints every show in the group it was handed, name first', () => {
    render(<ShowsWall groups={groups} />);
    const alphabet = screen.getByTestId('shows-group-Alphabet');
    expect(within(alphabet).getByText('Writers Guild')).toBeInTheDocument();
    expect(within(alphabet).getByText('Directors Guild')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('shows-group-Oscars')).getByText('Academy Awards'),
    ).toBeInTheDocument();
  });

  it('says in words that a level whose tiers are all equal is not tiered', () => {
    // 🔴 Read off the values, not off the level's name: the nine Alphabet
    // bodies score flat and that fact must survive the rewrite.
    render(<ShowsWall groups={groups} />);
    const alphabet = screen.getByTestId('shows-group-Alphabet');
    expect(within(alphabet).getByText(/worth the same/i)).toBeInTheDocument();
    expect(within(alphabet).getByText('Flat')).toBeInTheDocument();
  });

  it('says in words that a level with differing tiers is tiered', () => {
    render(<ShowsWall groups={groups} />);
    const oscars = screen.getByTestId('shows-group-Oscars');
    expect(within(oscars).getByText('Tiered')).toBeInTheDocument();
    expect(
      within(oscars).getByText(/bigger category is worth more/i),
    ).toBeInTheDocument();
  });

  it('marks a negative level with a word and a minus sign, not with colour', () => {
    // 🔴 The one distinction on this page a reader cannot afford to miss, so it
    // is carried by text: the group has its own heading, a chip reading
    // "− Costs points", and a sentence saying what that means.
    render(<ShowsWall groups={groups} />);
    const razzies = screen.getByTestId('shows-group-Razzies');
    expect(within(razzies).getByText('− Costs points')).toBeInTheDocument();
    expect(within(razzies).getByText(/takes points off/i)).toBeInTheDocument();
  });

  it('links a show to its own page, with no season on the href', () => {
    render(<ShowsWall groups={groups} />);
    expect(screen.getByRole('link', { name: /Academy Awards/ })).toHaveAttribute(
      'href',
      '/award-shows/oscars',
    );
  });

  it('still names a show that has no abbreviation to link by', () => {
    render(
      <ShowsWall
        groups={[
          {
            level: 'Oscars',
            tiers: [{ tier: 1, points: 20 }],
            shows: [show(9, 'Newcomer', null)],
          },
        ]}
      />,
    );
    expect(screen.getByText('Newcomer')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('drops a level that has no shows rather than printing an empty heading', () => {
    render(<ShowsWall groups={[{ level: 'Oscars', tiers: [], shows: [] }, ...groups]} />);
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent),
    ).toEqual(['Alphabet', 'Oscars', 'Razzies']);
  });

  it('renders nothing when there are no shows at all', () => {
    const { container } = render(<ShowsWall groups={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

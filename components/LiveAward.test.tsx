import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LiveAward } from './LiveAward';

const nominees = [
  {
    nominationId: 1,
    title: 'Sinners',
    posterUrl: 'https://image.tmdb.org/t/p/w342/a.jpg',
    detailName: null,
    isWinner: true,
  },
  {
    nominationId: 2,
    title: 'Anora',
    posterUrl: 'https://image.tmdb.org/t/p/w342/b.jpg',
    detailName: null,
    isWinner: false,
  },
  {
    nominationId: 3,
    title: 'Nickel Boys',
    posterUrl: null,
    detailName: null,
    isWinner: false,
  },
];

describe('LiveAward', () => {
  it('renders one frame per nominee, in the order it was handed them', () => {
    render(<LiveAward name="Best Picture" points={20} nominees={nominees} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.textContent)).toEqual([
      'Sinners',
      'Anora',
      'NINickel Boys',
    ]);
  });

  it('seals the winner and nothing else', () => {
    render(<LiveAward name="Best Picture" points={20} nominees={nominees} />);
    const seals = screen.getAllByRole('img', { name: 'Winner' });
    expect(seals).toHaveLength(1);
    // The seal is on the winner's own frame, not merely somewhere on the row.
    expect(seals[0]?.closest('li')?.textContent).toBe('Sinners');
  });

  it('keeps a film with no artwork in the row, named', () => {
    // 🔴 The plan's requirement in one assertion: a category whose films have
    // no posters must not collapse. `PosterFrame` draws the initials, and the
    // title is below the frame either way.
    render(<LiveAward name="Documentary Feature" points={10} nominees={nominees} />);
    expect(screen.getByText('Nickel Boys')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('says so in words when a category has no nominations entered', () => {
    render(<LiveAward name="Casting" points={10} nominees={[]} />);
    expect(screen.getByText(/no nominees entered yet/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('list')).toHaveLength(0);
  });

  it('resolves the point value it was given, beside the category', () => {
    // The foreign-key trap (D41) lives in the service, but this is the element
    // that prints it, so a component that dropped the prop would be silent.
    render(<LiveAward name="Best Picture" points={20} nominees={nominees} />);
    expect(screen.getByText('20 pts')).toBeInTheDocument();
  });

  it('names the person where the category nominates one', () => {
    // Two nominations of the SAME film: without the name this is two identical
    // posters and no way to tell the nominees apart.
    render(
      <LiveAward
        name="Actor in a Supporting Role"
        points={14}
        nominees={[
          { ...(nominees[0] as (typeof nominees)[number]), detailName: 'Delroy Lindo' },
          {
            ...(nominees[0] as (typeof nominees)[number]),
            nominationId: 9,
            detailName: 'Miles Caton',
            isWinner: false,
          },
        ]}
      />,
    );
    expect(screen.getByText('Delroy Lindo')).toBeInTheDocument();
    expect(screen.getByText('Miles Caton')).toBeInTheDocument();
  });
});

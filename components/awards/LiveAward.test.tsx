import { render, screen, within } from '@testing-library/react';
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
      'SinnersWinner',
      'Anora',
      'NINickel Boys',
    ]);
  });

  it('seals the winner and nothing else', () => {
    const { container } = render(
      <LiveAward name="Best Picture" points={20} nominees={nominees} />,
    );

    // 🔴 The mark is `WinnerSeal` — a brass disc with a star — and it is
    // `aria-hidden`, because the word "Winner" beside it already says the
    // fact. Counted through the DOM for exactly that reason.
    const seals = container.querySelectorAll('svg[aria-hidden="true"]');
    expect(seals).toHaveLength(1);
    expect(seals[0]?.closest('li')?.textContent).toBe('SinnersWinner');
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
    // 🔴 Only while the category is open. Once it is decided the heading's
    // right-hand slot names the film that took it, which is the more useful
    // fact at that point and is one of the four signals a decided category
    // carries.
    render(
      <LiveAward
        name="Best Picture"
        points={20}
        nominees={nominees.map((nominee) => ({ ...nominee, isWinner: false }))}
      />,
    );
    expect(screen.getByText('20 pts')).toBeInTheDocument();
  });

  it('states a decided category three ways, only one of them colour', () => {
    // 🔴 One mark is not enough on a television across a room, so a decided
    // category says so three ways: the word, the mark, and every other
    // nominee receding — the last being the one that changes the whole row
    // rather than one corner of one poster.
    render(<LiveAward name="Best Picture" points={20} nominees={nominees} />);

    const won = screen.getByTestId('live-winner');

    // 1. the word, which survives monochrome and a screen reader
    expect(within(won).getByText('Winner')).toBeVisible();
    // 2. the mark: a brass star seal, drawn, decorative beside the word
    expect(won.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    // 3. the poster is the only one left at full strength — and the heading
    // keeps its point value, which an earlier version swapped for the film's
    // name until e2e caught that the figure is load-bearing (D41).
    expect(screen.getByText('20 pts')).toBeVisible();
    // and every other nominee recedes
    const others = screen.getAllByRole('listitem').filter((item) => item !== won);
    expect(others).toHaveLength(2);
    for (const item of others) {
      expect(item.className).toMatch(/opacity-45/);
    }
    expect(won.className).not.toMatch(/opacity-45/);
  });

  it('leaves every nominee at full strength while the category is open', () => {
    // Dimming means "this one lost", so nothing may be dimmed before a
    // winner exists.
    render(
      <LiveAward
        name="Best Picture"
        points={20}
        nominees={nominees.map((nominee) => ({ ...nominee, isWinner: false }))}
      />,
    );

    for (const item of screen.getAllByRole('listitem')) {
      expect(item.className).not.toMatch(/opacity-45/);
    }
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

  it('plays the reveal only when asked, and lands where it rests', () => {
    // 🔴 Off by default is the load-bearing half. Tied to render, a reload of
    // a finished ceremony would fire twenty-four reveals at once; the client
    // turns it on for the one category whose winner arrived while the page
    // was open.
    const { container, unmount } = render(
      <LiveAward name="Best Picture" points={20} nominees={nominees} />,
    );
    const settled = container.querySelector('svg[aria-hidden="true"]');
    expect(settled?.getAttribute('class')).toContain('right-1.5');
    expect(settled?.getAttribute('class')).not.toContain('animate-reveal-mark');
    expect(container.querySelector('.animate-reveal-wash')).toBeNull();
    unmount();

    const withReveal = render(
      <LiveAward name="Best Picture" points={20} nominees={nominees} reveal />,
    );
    const marks = withReveal.container.querySelector('svg[aria-hidden="true"]');
    expect(marks?.getAttribute('class')).toContain('animate-reveal-mark');
    // The wash rides under the mark, and only during a reveal.
    expect(withReveal.container.querySelector('.animate-reveal-wash')).not.toBeNull();
    // 🔴 And it must land where the settled mark lives, or the beat ends with
    // a jump: the reduced-motion classes pin the same corner the resting mark
    // uses, which is the same corner the last keyframe moves to.
    expect(marks?.getAttribute('class')).toContain('motion-reduce:right-1.5');
  });

  it('says in words when it is the one being announced', () => {
    // 🔴 Not colour alone. The page is read from three metres (the arithmetic
    // in `LiveAward`'s docstring), where a border tint subtends nothing — and
    // a word is also what survives a monochrome panel and a screen reader.
    render(<LiveAward name="Best Picture" points={10} nominees={nominees} onScreen />);
    expect(screen.getByText(/on screen now/i)).toBeInTheDocument();
  });

  it('says nothing when it is not', () => {
    render(<LiveAward name="Best Picture" points={10} nominees={nominees} />);
    expect(screen.queryByText(/on screen now/i)).not.toBeInTheDocument();
  });
});

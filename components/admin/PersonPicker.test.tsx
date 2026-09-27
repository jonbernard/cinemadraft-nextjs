import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { FilmPerson } from '@/actions/awards/film-people';
import { PersonPicker } from './PersonPicker';

const PEOPLE: FilmPerson[] = [
  {
    id: 1121,
    name: 'Benicio del Toro',
    kind: 'cast',
    character: 'Sensei Sergio St. Carlos',
    jobs: null,
  },
  {
    id: 2228,
    name: 'Sean Penn',
    kind: 'cast',
    character: 'Col. Steven J. Lockjaw',
    jobs: null,
  },
  {
    id: 1640,
    name: 'Stellan Skarsgård',
    kind: 'cast',
    character: 'Gustav Borg',
    jobs: null,
  },
  {
    id: 4762,
    name: 'Paul Thomas Anderson',
    kind: 'crew',
    character: null,
    jobs: 'Director, Screenplay',
  },
];

function rows() {
  return within(screen.getByRole('list', { name: 'Cast and crew' }))
    .getAllByRole('button')
    .map((button) => button.textContent);
}

function field() {
  return screen.getByRole('searchbox', { name: 'Person nominated' });
}

describe('PersonPicker', () => {
  it('lists everyone, with the character or the jobs under the name', () => {
    render(<PersonPicker people={PEOPLE} onSelect={vi.fn()} />);

    expect(rows()).toEqual([
      'Benicio del Toroas Sensei Sergio St. Carlos',
      'Sean Pennas Col. Steven J. Lockjaw',
      'Stellan Skarsgårdas Gustav Borg',
      'Paul Thomas AndersonDirector, Screenplay',
    ]);
  });

  it('filters on the name as it is typed', async () => {
    render(<PersonPicker people={PEOPLE} onSelect={vi.fn()} />);

    await userEvent.type(field(), 'penn');

    expect(rows()).toEqual(['Sean Pennas Col. Steven J. Lockjaw']);
  });

  it('finds a character or a job too, and every word has to match', async () => {
    render(<PersonPicker people={PEOPLE} onSelect={vi.fn()} />);

    await userEvent.type(field(), 'director');
    expect(rows()).toEqual(['Paul Thomas AndersonDirector, Screenplay']);

    await userEvent.clear(field());
    await userEvent.type(field(), 'sean borg');
    expect(screen.getByText(/Nobody in this film’s credits matches/)).toBeInTheDocument();
  });

  it('ignores accents, so "skarsgard" finds Skarsgård', async () => {
    render(<PersonPicker people={PEOPLE} onSelect={vi.fn()} />);

    await userEvent.type(field(), 'skarsgard');

    expect(rows()).toEqual(['Stellan Skarsgårdas Gustav Borg']);
  });

  it('chooses by click', async () => {
    const onSelect = vi.fn();
    render(<PersonPicker people={PEOPLE} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: /Sean Penn/ }));

    expect(onSelect).toHaveBeenCalledWith(PEOPLE[1]);
  });

  it('is keyboard-operable: arrows move, Enter chooses the highlighted row', async () => {
    const onSelect = vi.fn();
    render(<PersonPicker people={PEOPLE} onSelect={onSelect} />);

    await userEvent.type(field(), 's');
    // "s" matches all four (Sensei, Sean, Stellan, Screenplay); down twice is
    // the third.
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledWith(PEOPLE[2]);
  });

  it('goes back to the film on Escape', async () => {
    const onCancel = vi.fn();
    render(<PersonPicker people={PEOPLE} onSelect={vi.fn()} onCancel={onCancel} />);

    await userEvent.type(field(), '{Escape}');

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('names a person already nominated and will not choose them, by click or by Enter', async () => {
    const onSelect = vi.fn();
    render(
      <PersonPicker
        people={PEOPLE}
        onSelect={onSelect}
        isUnavailable={(person) => person.id === 2228}
      />,
    );

    const sean = screen.getByRole('button', { name: /Sean Penn/ });
    expect(sean).toBeDisabled();
    expect(sean).toHaveTextContent('Nominated');

    await userEvent.type(field(), 'penn{Enter}');
    expect(onSelect).not.toHaveBeenCalled();
  });
});

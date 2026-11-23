import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SeasonMoment } from '@/lib/services/season-view';
import { SeasonAgenda } from './SeasonAgenda';
import { DAY_BEFORE_OSCARS, season2026 } from './season-fixtures';

const undated = (key: string, name: string): SeasonMoment => ({
  key,
  eventId: 99,
  abbreviation: 'new',
  name,
  phase: 'nominations',
  date: null,
  order: Number.POSITIVE_INFINITY,
  state: 'upcoming',
  nominations: 0,
  winners: 0,
  categories: 1,
  highlight: null,
});

describe('SeasonAgenda', () => {
  const view = season2026(DAY_BEFORE_OSCARS);

  it('gives every dated moment a <time dateTime>, in date order', () => {
    const { container } = render(
      <SeasonAgenda months={view.months} year={2026} nextKey={view.next?.key ?? null} />,
    );
    const times = [...container.querySelectorAll('time')].map((t) =>
      t.getAttribute('dateTime'),
    );
    expect(times).toHaveLength(23);
    expect(times[0]).toBe('2025-12-04');
    expect(times.at(-1)).toBe('2026-03-15');
    expect([...times].sort()).toEqual(times);
  });

  it('shows the AFI once, with no ceremony row', () => {
    render(<SeasonAgenda months={view.months} year={2026} nextKey={null} />);
    expect(screen.getAllByRole('link', { name: /American Film Institute/ })).toHaveLength(
      1,
    );
  });

  it('says what each finished moment did, and marks the next one', () => {
    render(
      <SeasonAgenda months={view.months} year={2026} nextKey={view.next?.key ?? null} />,
    );
    const globes = screen
      .getAllByRole('link', { name: /Golden Globes/ })
      .find((link) => link.textContent?.includes('92 nominations'));
    expect(globes).toHaveAttribute('href', '/award-shows/gg?year=2026');
    expect(globes).toHaveTextContent(
      'Most nominated: One Battle After Another · 9 nominations',
    );
    const next = document.querySelector('[aria-current="step"]') as HTMLElement;
    expect(within(next).getByText('Next')).toBeInTheDocument();
    expect(next).toHaveTextContent('Academy of Motion Picture Arts and Sciences');
    expect(next).toHaveTextContent('Ceremony · 24 categories');
  });

  it('puts "Not yet scheduled" last', () => {
    const months = [
      ...view.months,
      { label: 'Not yet scheduled', moments: [undated('99-nominations', 'A new show')] },
    ];
    render(<SeasonAgenda months={months} year={2026} nextKey={null} />);
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent);
    expect(headings.at(-1)).toBe('Not yet scheduled');
    expect(screen.getByRole('link', { name: /A new show/ })).toHaveTextContent(
      'Date TBA',
    );
    expect(screen.getByRole('link', { name: /A new show/ })).toHaveTextContent(
      '1 category',
    );
  });

  it('a past season: an unentered moment reads "No results recorded", never TBA', () => {
    const months = [
      { label: 'Date not recorded', moments: [undated('99-nominations', 'A new show')] },
    ];
    render(<SeasonAgenda months={months} year={2024} nextKey={null} past />);
    const row = screen.getByRole('link', { name: /A new show/ });
    expect(row).toHaveTextContent('Nominations · No results recorded');
    expect(row).not.toHaveTextContent('Date TBA');
  });
});

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RaceChart } from './RaceChart';
import { raceFixture, raceTotals } from './race-fixtures';

const CAPTION = "This season's dates weren't recorded";

describe('RaceChart', () => {
  it('carries the chart in a table: one row per seat, the last column the totals', () => {
    const race = raceFixture();
    render(<RaceChart race={race} leagueId={1} />);
    const table = screen.getByRole('table', {
      name: 'Each seat’s running total after every scoring moment',
    });
    const rows = within(table).getAllByRole('row').slice(1);
    const totals = raceTotals();
    expect(rows).toHaveLength(totals.size);
    const read = rows.map((row) => [
      within(row).getByRole('rowheader').textContent,
      Number(within(row).getAllByRole('cell').at(-1)?.textContent),
    ]);
    expect(new Map(read as [string, number][])).toEqual(totals);
    // Standings order: the totals never rise down the table.
    const column = read.map(([, total]) => total as number);
    expect(column).toEqual([...column].sort((a, b) => b - a));
  });

  it('draws one line per seat, and hides the drawing from assistive tech', () => {
    const race = raceFixture();
    const { container } = render(<RaceChart race={race} leagueId={1} />);
    expect(container.querySelectorAll('svg path')).toHaveLength(race.lines.length);
    expect(
      container.querySelector('[data-race-plot]')?.closest('[aria-hidden="true"]'),
    ).not.toBeNull();
  });

  it('says why an undated season is evenly spaced, and only then', () => {
    const { unmount } = render(
      <RaceChart race={raceFixture({ dated: false })} leagueId={1} />,
    );
    expect(screen.getByText(new RegExp(CAPTION))).toBeInTheDocument();
    unmount();
    render(<RaceChart race={raceFixture()} leagueId={1} />);
    expect(screen.queryByText(new RegExp(CAPTION))).toBeNull();
  });

  it('says each lead change in words', () => {
    const race = raceFixture();
    expect(race.leadChanges.length).toBeGreaterThan(0);
    render(<RaceChart race={race} leagueId={1} />);
    const list = screen.getByRole('heading', { name: 'Lead changes' }).closest('section');
    expect(within(list as HTMLElement).getAllByRole('listitem')).toHaveLength(
      race.leadChanges.length,
    );
    const [change] = race.leadChanges;
    expect(list).toHaveTextContent(`${change?.to} takes the lead from ${change?.from}`);
  });
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventAdmin } from './EventAdmin';

const updateEvent = vi.hoisted(() => vi.fn());
vi.mock('@/actions/admin/update-event', () => ({ updateEvent }));

const EVENT = {
  id: 7,
  name: 'Academy Awards',
  abbreviation: 'oscars',
  image: null,
  nomDuration: null,
  awardsDuration: null,
  hasCeremony: true,
};

const SEASON = { year: 2027, dates: null };

/**
 * "Edit this show" is the show's settings — name, mark, dates — and nothing
 * that goes live. On air is the switch in Winners mode (`OnAirSwitch`).
 * `nom_active` and `live_results` are written by nothing here: the source's UI
 * never had a box for either (its selector wrote `nom_active`; nothing wrote
 * `live_results`), and nothing in the port reads either — "still needs
 * nominations" is derived from dates (`lib/services/entry-status.ts`).
 */
describe('EventAdmin', () => {
  beforeEach(() => {
    updateEvent.mockReset();
    updateEvent.mockResolvedValue({ ok: true, data: null });
  });

  it('has no live control of any kind', () => {
    render(<EventAdmin event={EVENT} season={SEASON} />);

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    // The one checkbox is a setting, not a live control (D129).
    expect(screen.getAllByRole('checkbox')).toEqual([
      screen.getByRole('checkbox', { name: 'This show has a ceremony' }),
    ]);
    expect(screen.queryByText(/Live/)).not.toBeInTheDocument();
  });

  it('saves the settings and none of the three flags', async () => {
    render(<EventAdmin event={EVENT} season={SEASON} />);

    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'The Oscars');
    await userEvent.click(screen.getByRole('button', { name: 'Save show' }));

    expect(updateEvent).toHaveBeenCalledOnce();
    const input = updateEvent.mock.calls[0]?.[0];
    expect(input).toMatchObject({ eventId: 7, name: 'The Oscars' });
    for (const flag of ['nomActive', 'awardsActive', 'liveResults']) {
      expect(input).not.toHaveProperty(flag);
    }
  });

  it('sends has_ceremony as the box reads', async () => {
    render(<EventAdmin event={EVENT} season={SEASON} />);

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'This show has a ceremony' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save show' }));

    expect(updateEvent.mock.calls[0]?.[0]).toMatchObject({ hasCeremony: false });
  });

  it('names the season it dates, and starts empty when that season has no row', () => {
    render(<EventAdmin event={EVENT} season={SEASON} />);
    expect(screen.getByRole('heading', { name: '2027 season dates' })).toBeVisible();
    for (const group of ['Nominations', 'Awards']) {
      expect(
        within(screen.getByRole('group', { name: group })).getByLabelText('Announced'),
      ).toHaveValue('');
    }
  });

  it("pre-fills the season's stored dates, and saves them for that season", async () => {
    // Midday UTC, so the day is the same in any zone the suite runs in.
    const nomDate = Date.UTC(2027, 0, 21);
    const awardsDate = Date.UTC(2027, 2, 14);
    const dates = { nomDate, nomTime: 43_200_000, awardsDate, awardsTime: 43_200_000 };
    render(<EventAdmin event={EVENT} season={{ year: 2027, dates }} />);

    const nominations = within(screen.getByRole('group', { name: 'Nominations' }));
    expect(nominations.getByLabelText('Announced')).not.toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: 'Save show' }));

    expect(updateEvent.mock.calls[0]?.[0]).toMatchObject({
      season: { year: 2027, ...dates },
    });
  });

  it('has no awards date for a show with no ceremony (D129)', async () => {
    const dates = {
      nomDate: Date.UTC(2027, 0, 21),
      nomTime: 43_200_000,
      awardsDate: Date.UTC(2027, 2, 14),
      awardsTime: 43_200_000,
    };
    render(<EventAdmin event={EVENT} season={{ year: 2027, dates }} />);
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'This show has a ceremony' }),
    );
    expect(screen.queryByRole('group', { name: 'Awards' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save show' }));

    expect(updateEvent.mock.calls[0]?.[0]).toMatchObject({
      season: { nomDate: dates.nomDate, awardsDate: null, awardsTime: null },
    });
  });
});

import { render, screen } from '@testing-library/react';
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
  nomDate: null,
  nomTime: null,
  nomDuration: null,
  awardsDate: null,
  awardsTime: null,
  awardsDuration: null,
};

/**
 * "Edit this show" is the show's settings — name, mark, dates — and nothing
 * that goes live. On air is the switch in Winners mode (`OnAirSwitch`).
 * `nom_active` and `live_results` are written by nothing here: the source's UI
 * never had a box for either (its selector wrote `nom_active`; nothing wrote
 * `live_results`), and the port's readers of `nom_active` are the index page
 * and the importer.
 */
describe('EventAdmin', () => {
  beforeEach(() => {
    updateEvent.mockReset();
    updateEvent.mockResolvedValue({ ok: true, data: null });
  });

  it('has no live control of any kind', () => {
    render(<EventAdmin event={EVENT} />);

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/Live/)).not.toBeInTheDocument();
  });

  it('saves the settings and none of the three flags', async () => {
    render(<EventAdmin event={EVENT} />);

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
});

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
  awardsActive: false,
  awardsDate: null,
  awardsTime: null,
  awardsDuration: null,
  liveResults: false,
};

/**
 * The owner: nominations are never live. So the form has one live control, a
 * switch for the ceremony, and does not write `nom_active` at all — that
 * column means "still needs nominations" to the index page and the importer,
 * and this form has no business changing it.
 */
describe('EventAdmin — going live', () => {
  beforeEach(() => {
    updateEvent.mockReset();
    updateEvent.mockResolvedValue({ ok: true, data: null });
  });

  it('has one live control — the ceremony switch — and no nominations checkbox', () => {
    render(<EventAdmin event={EVENT} />);

    expect(screen.getAllByRole('switch')).toHaveLength(1);
    expect(screen.getByRole('switch', { name: 'Live' })).not.toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Live now' })).not.toBeInTheDocument();
  });

  it('saves the ceremony on air, and leaves nom_active out of the write', async () => {
    render(<EventAdmin event={EVENT} />);

    await userEvent.click(screen.getByRole('switch', { name: 'Live' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save show' }));

    expect(updateEvent).toHaveBeenCalledOnce();
    const input = updateEvent.mock.calls[0]?.[0];
    expect(input).toMatchObject({ eventId: 7, awardsActive: true });
    expect(input).not.toHaveProperty('nomActive');
  });

  it('starts from the stored state', () => {
    render(<EventAdmin event={{ ...EVENT, awardsActive: true }} />);

    expect(screen.getByRole('switch', { name: 'Live' })).toBeChecked();
  });
});

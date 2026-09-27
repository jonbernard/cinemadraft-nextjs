import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OnAirSwitch } from './OnAirSwitch';

const updateEvent = vi.hoisted(() => vi.fn());
vi.mock('@/actions/admin/update-event', () => ({ updateEvent }));

describe('OnAirSwitch', () => {
  beforeEach(() => {
    updateEvent.mockReset();
    updateEvent.mockResolvedValue({ ok: true, data: null });
  });

  it('starts from the stored state', () => {
    render(<OnAirSwitch eventId={7} onAir />);
    expect(screen.getByRole('switch', { name: 'Live' })).toBeChecked();
  });

  it('saves as it flips — awards_active and nothing else, no Save button', async () => {
    render(<OnAirSwitch eventId={7} onAir={false} />);

    await userEvent.click(screen.getByRole('switch', { name: 'Live' }));

    expect(updateEvent).toHaveBeenCalledWith({ eventId: 7, awardsActive: true });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('takes the show off air', async () => {
    render(<OnAirSwitch eventId={7} onAir />);

    await userEvent.click(screen.getByRole('switch', { name: 'Live' }));

    expect(updateEvent).toHaveBeenCalledWith({ eventId: 7, awardsActive: false });
  });

  it('says so when the save is refused', async () => {
    updateEvent.mockResolvedValue({
      ok: false,
      code: 'FORBIDDEN',
      message: 'admin only',
    });
    render(<OnAirSwitch eventId={7} onAir={false} />);

    await userEvent.click(screen.getByRole('switch', { name: 'Live' }));

    expect(await screen.findByText('admin only')).toBeInTheDocument();
  });
});

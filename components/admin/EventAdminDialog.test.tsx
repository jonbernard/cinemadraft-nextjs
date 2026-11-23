import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventAdminDialog } from './EventAdminDialog';

vi.mock('@/actions/admin/update-event', () => ({ updateEvent: vi.fn() }));

/**
 * 🔴 `show()` and `showModal()` both open a dialog, so only the method called
 * tells them apart — the stubs are spies for that reason, as in
 * `InviteDialog.test.tsx` (D119).
 */
const showModal = vi.fn(function (this: HTMLDialogElement) {
  this.open = true;
});
const show = vi.fn(function (this: HTMLDialogElement) {
  this.open = true;
});
const close = vi.fn(function (this: HTMLDialogElement) {
  this.open = false;
});

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = showModal;
  HTMLDialogElement.prototype.show = show;
  HTMLDialogElement.prototype.close = close;
});

beforeEach(() => {
  showModal.mockClear();
  show.mockClear();
  close.mockClear();
});

const EVENT = {
  id: 1,
  name: 'Academy Awards',
  abbreviation: 'oscars',
  image: null,
  nomDuration: null,
  awardsDuration: null,
  hasCeremony: true,
};

const SEASON = { year: 2027, dates: null };

describe('EventAdminDialog', () => {
  it('is one button until it is asked for — the form is not on the page', () => {
    render(<EventAdminDialog event={EVENT} season={SEASON} />);

    expect(screen.getByRole('button', { name: 'Edit this show' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('opens the form MODALLY', async () => {
    render(<EventAdminDialog event={EVENT} season={SEASON} />);

    await userEvent.click(screen.getByRole('button', { name: 'Edit this show' }));

    expect(showModal).toHaveBeenCalledTimes(1);
    expect(show).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Edit this show' })).toBeVisible();
    expect(screen.getByLabelText('Name')).toHaveValue('Academy Awards');
  });

  it('closes on the close control, and takes the form with it', async () => {
    render(<EventAdminDialog event={EVENT} season={SEASON} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit this show' }));

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(close).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });
});

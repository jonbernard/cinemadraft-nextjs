import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { InviteDialog } from './InviteDialog';

const URL = 'https://cinemadraft.test/join/2f1c6d4e-0000-4000-8000-000000000000';

/**
 * 🔴 jsdom implements `<dialog>` but not `showModal`/`close` in every version
 * this project has run on. Stub them so the test asserts OUR behaviour — that
 * the element is opened and closed — rather than the environment's. The stubs
 * are `vi.fn`s, which is also what makes the modal-ness assertable: `show()`
 * and `showModal()` both open a dialog, so only the identity of the method
 * called tells the two apart.
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

describe('InviteDialog', () => {
  it('keeps the link off the page until it is asked for', () => {
    render(<InviteDialog url={URL} />);
    // 🔴 The uuid IS the join credential. It must not be on screen, and it
    // must not be in the accessibility tree, before somebody asks for it.
    expect(screen.queryByText(URL)).not.toBeInTheDocument();
  });

  it('opens the dialog on the trigger, showing the link and the warning', async () => {
    render(<InviteDialog url={URL} />);
    await userEvent.click(screen.getByRole('button', { name: /invite/i }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByText(URL)).toBeInTheDocument();
    expect(screen.getByText(/anyone with this link/i)).toBeInTheDocument();
  });

  it('opens it MODALLY, which is the whole reason the row stops moving', async () => {
    // 🔴 The plan predicted this assertion's absence: swapping `showModal()`
    // for `show()` leaves every other test in this file green, because both
    // open the dialog. Only the top layer keeps the action row still, and only
    // `showModal()` gives the focus trap, the Escape key and page inertness —
    // so the method itself is the behaviour, and it is asserted by name.
    render(<InviteDialog url={URL} />);
    await userEvent.click(screen.getByRole('button', { name: /invite/i }));
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(show).not.toHaveBeenCalled();
  });

  it('closes on the close control', async () => {
    render(<InviteDialog url={URL} />);
    await userEvent.click(screen.getByRole('button', { name: /invite/i }));
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.getByRole('dialog', { hidden: true })).not.toBeVisible();
  });

  it('names itself to a screen reader', () => {
    render(<InviteDialog url={URL} />);
    // The dialog carries `aria-labelledby` pointing at its own heading, so it
    // is announced as something rather than as "dialog".
    expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute(
      'aria-labelledby',
    );
  });

  it('is one control the height of a button, not a block', () => {
    // 🔴 The reported defect. The trigger carries `min-h-11` like its
    // siblings, and nothing else renders beside it in the closed state.
    render(<InviteDialog url={URL} />);
    expect(screen.getByRole('button', { name: /invite/i }).className).toContain(
      'min-h-11',
    );
  });
});

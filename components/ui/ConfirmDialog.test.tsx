import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useConfirm } from './ConfirmDialog';

/**
 * 🔴 Same stubs as `InviteDialog.test.tsx`, for the same reason: jsdom's
 * `<dialog>` has `open` but the project's setup polyfills `showModal` and
 * `show` to the *same* one-line body, so the two are indistinguishable by
 * effect. Only the identity of the method called tells modal from non-modal,
 * and modal is the whole point — the focus trap, Escape, page inertness and
 * the top layer all come from `showModal()` and none of them from `show()`.
 */
const showModal = vi.fn(function (this: HTMLDialogElement) {
  this.open = true;
});
const show = vi.fn(function (this: HTMLDialogElement) {
  this.open = true;
});
const close = vi.fn(function (this: HTMLDialogElement) {
  if (!this.open) return;
  this.open = false;
  this.dispatchEvent(new Event('close'));
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

/** A call site in miniature: the exact shape all nine real ones now have. */
// biome-ignore lint/style/useComponentExportOnlyModules: a fixture for this file only; Fast Refresh does not run tests
function Harness({ label }: { label?: string }) {
  const { confirm, dialog } = useConfirm();
  const [answer, setAnswer] = useState<string>('not asked');

  return (
    <>
      {dialog}
      <button
        type="button"
        onClick={async () => {
          setAnswer(String(await confirm('Delete the thing?', label)));
        }}
      >
        Ask
      </button>
      <p>answer: {answer}</p>
    </>
  );
}

describe('ConfirmDialog', () => {
  it('has nothing in the document until something asks', () => {
    render(<Harness />);

    expect(screen.queryByText('Delete the thing?')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(showModal).not.toHaveBeenCalled();
  });

  it('shows the message it was given, verbatim', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));

    // 🔴 Verbatim matters: the nine messages were written to interpolate a
    // count or a name and the port was not licensed to reword any of them.
    expect(screen.getByRole('dialog')).toHaveTextContent('Delete the thing?');
  });

  it('opens it MODALLY, which is where every accessibility property comes from', async () => {
    // Swap `showModal()` for `show()` and every other test in this file stays
    // green — both open the dialog — while the focus trap, Escape and the
    // inert page behind it all silently vanish. So the method is asserted by
    // name, exactly as `InviteDialog.test.tsx` does.
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));

    expect(showModal).toHaveBeenCalledTimes(1);
    expect(show).not.toHaveBeenCalled();
  });

  it('lands focus on Cancel, never on the destructive choice', async () => {
    // 🔴 All nine callers are destructive or irreversible. Enter on a dialog
    // somebody has not read must mean no.
    render(<Harness label="Delete" />);
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).not.toBe(
      screen.getByRole('button', { name: 'Delete' }),
    );
  });

  it('Cancel answers false and closes', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('answer: false')).toBeInTheDocument();
    expect(screen.queryByText('Delete the thing?')).not.toBeInTheDocument();
  });

  it('the confirm button answers true and closes', async () => {
    render(<Harness label="Delete" />);
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByText('answer: true')).toBeInTheDocument();
    expect(screen.queryByText('Delete the thing?')).not.toBeInTheDocument();
  });

  it('dismissal answers false, which is how Escape gets its meaning', async () => {
    // Escape is the browser's, not ours — it closes the dialog and fires
    // `close`. This asserts the half that is ours: that `close` settles the
    // promise as a refusal rather than leaving the caller awaiting forever.
    // Whether the key itself works is an E2E question, and is measured there.
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));

    // jsdom does not implement the Escape key on `<dialog>` at all, so
    // pressing it here would assert nothing. What is simulated instead is the
    // platform's *consequence* — the `close` event — which is the only part
    // this component owns. The key itself is measured in a real browser.
    screen.getByRole('dialog').dispatchEvent(new Event('close'));

    expect(await screen.findByText('answer: false')).toBeInTheDocument();
  });

  it('names the act on the button when the caller names one, "Confirm" otherwise', async () => {
    const { unmount } = render(<Harness label="Unlink" />);
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(screen.getByRole('button', { name: 'Unlink' })).toBeInTheDocument();
    unmount();

    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('is announced as something rather than as a bare "dialog"', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Delete the thing?');
  });
});

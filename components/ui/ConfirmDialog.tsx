'use client';

import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';

export type ConfirmRequest = {
  /** The sentence, unchanged from whatever `window.confirm` was given. */
  message: string;
  /** The act, when the message names one. "Confirm" otherwise. */
  confirmLabel: string;
};

/**
 * The one confirmation (P14).
 *
 * 🔴 **This reverses `SeasonControl`'s note, on the owner's call.** That file
 * argued for `window.confirm` on two grounds: it is the platform's modal,
 * focus-trapped and keyboard-operable for free, and the two destructive admin
 * actions must not behave differently from one another. The first ground was
 * true and is now bought a different way — `showModal()` gives the focus trap,
 * Escape, page inertness and top-layer stacking with no code, so nothing is
 * given up by leaving `window.confirm` behind. What `window.confirm` cannot do
 * is be part of the product: it is browser chrome, drawn by Chrome at the top
 * of the viewport in Chrome's type, unstyleable and unplaceable, and it says
 * "cinemadraft.com says" above whatever sentence it was handed. The owner saw
 * exactly that on `/leagues/[id]/setup` and overruled it.
 *
 * The consistency argument now points the other way, and harder. Under
 * `window.confirm` the two admin actions matched each other and matched
 * nothing else in the app; there were nine call sites across five files, each
 * free to drift. All nine now render this component, so they are identical by
 * construction rather than by everyone remembering.
 *
 * 🔴 **A native `<dialog>` with `showModal()`, not a `useState` overlay.**
 * Same reasoning as `InviteDialog` (P14.T15), which this follows including the
 * detail that the children render only while open, so nothing inside is in the
 * DOM — or the accessibility tree — when it is closed.
 *
 * 🔴 **Focus lands on Cancel.** Every one of the nine is destructive or
 * irreversible, so the keyboard default must not be the destructive choice:
 * Enter on an unread dialog cancels. That is one thing `window.confirm` got
 * right and a hand-rolled dialog is free to get wrong, so it is asserted.
 */
export function ConfirmDialog({
  request,
  onSettle,
}: {
  /** `null` is closed. */
  request: ConfirmRequest | null;
  onSettle: (confirmed: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const messageId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (request) {
      element.showModal();
      // Explicit rather than the `autofocus` attribute: the platform's own
      // rule is "first focusable descendant", which a later edit reordering
      // the buttons would silently flip onto the destructive one.
      cancel.current?.focus();
    } else if (element.open) {
      element.close();
    }
  }, [request]);

  return (
    <dialog
      ref={dialog}
      // Escape and the platform's own dismissal both land here, and both mean
      // no. The buttons call `onSettle` themselves; settling twice is a no-op.
      onClose={() => onSettle(false)}
      aria-labelledby={messageId}
      className="bg-bg-panel text-text-primary m-auto w-full max-w-md rounded-sm p-6 backdrop:bg-black/60"
    >
      {request ? (
        <div className="flex flex-col gap-4">
          <p id={messageId} className="text-text-primary text-sm">
            {request.message}
          </p>

          {/* Cancel first in the DOM as well as on screen, so the tab order
              and the focus default agree with each other. */}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              ref={cancel}
              type="button"
              onClick={() => onSettle(false)}
              className="border-border-rule text-text-primary hover:bg-bg-surface focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm border px-4 text-sm focus-visible:outline-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSettle(true)}
              className="bg-accent-fill focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm px-4 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {request.confirmLabel}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

/**
 * `confirm(message, label)` with the shape of `window.confirm`, minus the
 * synchronous return — a call site becomes `if (!(await confirm(…))) return;`
 * inside an async callback and changes nothing else.
 *
 * Returns the element too, because a hook cannot render: put `{dialog}` beside
 * whatever the trigger is.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: the hook and the element it renders are one unit — splitting them across two files so Fast Refresh can reload this one would let a call site import half of it
export function useConfirm(): {
  confirm: (message: string, confirmLabel?: string) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  // The resolver lives in a ref rather than in the state object: a state
  // updater must be pure, and React calls it twice under StrictMode.
  const resolve = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback(
    (message: string, confirmLabel = 'Confirm') =>
      new Promise<boolean>((settle) => {
        // A second ask while one is open answers the first with "no" rather
        // than dropping its promise on the floor and hanging the caller.
        resolve.current?.(false);
        resolve.current = settle;
        setRequest({ message, confirmLabel });
      }),
    [],
  );

  const onSettle = useCallback((confirmed: boolean) => {
    const settle = resolve.current;
    resolve.current = null;
    setRequest(null);
    settle?.(confirmed);
  }, []);

  return {
    confirm,
    dialog: <ConfirmDialog request={request} onSettle={onSettle} />,
  };
}

'use client';

import { useCallback, useId, useRef, useState } from 'react';

import { InviteLink } from '@/components/leagues/InviteLink';
import { cn } from '@/lib/utils/cn';

/**
 * The invite, behind a modal dialog (P14.T15, replacing P17.T30's disclosure).
 *
 * 🔴 The uuid **is** the join credential — whoever holds it can seat themselves
 * — so it is owners-only, and it stays off the page until somebody asks for it.
 * That part is unchanged and is the whole reason this is behind anything at
 * all.
 *
 * 🔴 **What changed, and why it reverses `InviteAction`'s note.** This was a
 * native `<details>`, chosen so the file could stay a server component. But a
 * disclosure expands *in flow*, and this one lives in the same row as "Run the
 * draft" and "Set up the season" — so opening it made a three-row block of a
 * 44px control and vertically re-centred both buttons beside it. The owner
 * reported exactly that. A modal is the shape that does not move the page: it
 * is in the top layer, so the row it came from is untouched. The server
 * component was the only thing the `<details>` bought, and `InviteLink` was
 * already a client island on this page, so it bought nothing.
 *
 * 🔴 **`showModal()`, not a `useState` overlay.** The native dialog gives the
 * focus trap, Escape-to-close, inertness of the page behind it, top-layer
 * stacking and a styleable `::backdrop` with no code. Every one of those
 * hand-written is a way for a dialog to end up half-accessible.
 *
 * 🔴 The state here is **not** that overlay: it gates the dialog's *children*,
 * because `<dialog>` keeps its subtree in the DOM when closed exactly as
 * `<details>` did. `InviteAction`'s test had to assert `not.toBeVisible()` for
 * that reason, which is a weaker claim than the credential deserves — a closed
 * disclosure still shipped the uuid to the page and to the accessibility tree.
 * Rendering the contents only while open makes "off the page until it is asked
 * for" literally true.
 */
export function InviteDialog({ url, className }: { url: string; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  // `useId`, not a literal: this renders once per page today, but a hardcoded
  // id is a duplicate waiting to happen and Biome refuses it.
  const titleId = useId();
  const [open, setOpen] = useState(false);

  const show = useCallback(() => {
    setOpen(true);
    dialog.current?.showModal();
  }, []);

  // Both halves, because the two ways out differ: this one is the button, and
  // `onClose` is Escape and the platform's own dismissal.
  const close = useCallback(() => {
    dialog.current?.close();
    setOpen(false);
  }, []);

  return (
    <>
      {/* 🔴 The same classes as the page's `SecondaryAction`, so it sits in the
          row at the same height as its neighbours — which is the defect this
          task exists to fix. A `<button>` rather than an anchor because it
          opens a dialog rather than navigating, which is the inverse of the
          reason `SecondaryAction` is an anchor. */}
      <button
        type="button"
        onClick={show}
        className={cn(
          'border-border-rule text-text-primary hover:bg-bg-surface focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm border px-4 text-sm focus-visible:outline-2',
          className,
        )}
      >
        Invite
      </button>

      {/* `backdrop:` is Tailwind's variant for `::backdrop`. The dialog is
          `m-auto` because the top layer centres nothing by default. */}
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-labelledby={titleId}
        className="bg-bg-panel text-text-primary m-auto w-full max-w-lg rounded-sm p-6 backdrop:bg-black/60"
      >
        {open ? (
          <div className="flex flex-col gap-4">
            <h2 id={titleId} className="text-text-primary text-base">
              Invite someone to this league
            </h2>

            {/* 🔴 Inside the dialog, not beside the trigger: this is the
                sentence a person needs at the moment they copy the link, and
                having it outside is what made the closed control three rows
                tall. */}
            <p className="text-text-secondary text-sm">
              Anyone with this link can take a seat in this league. Send it to whoever is
              playing, and nobody else.
            </p>

            <InviteLink url={url} />

            <button
              type="button"
              onClick={close}
              className="border-border-rule text-text-primary hover:bg-bg-surface focus-visible:outline-accent-fill flex min-h-11 w-fit items-center rounded-sm border px-4 text-sm focus-visible:outline-2"
            >
              Close
            </button>
          </div>
        ) : null}
      </dialog>
    </>
  );
}

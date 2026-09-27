'use client';

import { useCallback, useId, useRef, useState } from 'react';

import { type AdminEvent, EventAdmin } from '@/components/admin/EventAdmin';
import { cn } from '@/lib/utils/cn';

/**
 * "Edit this show", behind a modal dialog.
 *
 * It was a panel between the show's header and its first category, and at
 * 1440px it filled the first screen — so on a ceremony night the admin
 * scrolled past a form they open once a season to reach the categories they
 * are working in. A dialog puts it one click away and nowhere else.
 *
 * 🔴 **`showModal()`, as `InviteDialog` does (D119)** — the focus trap,
 * Escape, the inert page and the backdrop are the platform's, not written by
 * hand. And as there, the form renders only while open, which here has a
 * second reason: `EventAdmin` seeds its fields from props once, so mounting it
 * fresh on each open is what shows the values the last save wrote rather than
 * the ones the page was first rendered with.
 */
export function EventAdminDialog({
  event,
  className,
}: {
  event: AdminEvent;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);

  const show = useCallback(() => {
    setOpen(true);
    dialog.current?.showModal();
  }, []);

  const close = useCallback(() => {
    dialog.current?.close();
    setOpen(false);
  }, []);

  return (
    <>
      {/* The same neutral control as `InviteDialog`'s trigger: this opens a
          dialog and changes nothing, so it is neither carmine nor brass. */}
      <button
        type="button"
        onClick={show}
        className={cn(
          'border-border-rule text-text-primary hover:bg-bg-surface focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm border px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2',
          className,
        )}
      >
        Edit this show
      </button>

      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-labelledby={titleId}
        className="bg-bg-panel text-text-primary m-auto max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-sm p-6 backdrop:bg-black/60"
      >
        {open ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <h2 id={titleId} className="text-text-primary text-base font-semibold">
                Edit this show
              </h2>
              <button
                type="button"
                onClick={close}
                className="border-border-rule text-text-primary hover:bg-bg-surface focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm border px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Close
              </button>
            </div>

            <EventAdmin event={event} />
          </div>
        ) : null}
      </dialog>
    </>
  );
}

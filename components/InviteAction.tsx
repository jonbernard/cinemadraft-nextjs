import { InviteLink } from '@/components/InviteLink';
import { cn } from '@/lib/utils/cn';

/**
 * The invite, behind an action (P17.T30).
 *
 * 🔴 The uuid **is** the join credential — whoever holds it can seat themselves
 * — and it used to be the second element on the league page, rendered in full
 * as a `<code>` that wrapped to two mono lines at 390px directly beneath the
 * league name. That is the loudest possible treatment for the one string on the
 * page that should not be shoulder-surfed, and it stayed there long after the
 * last seat was filled.
 *
 * A native `<details>` rather than a dialog, a separate page, or a `useState`
 * disclosure: the link belongs next to the league it invites people to, the
 * open/closed state is the element's own, and it is keyboard-operable and
 * screen-reader-announced without a line being written to make it so. That also
 * keeps this a server component — `InviteLink` stays the only client island
 * here, because the clipboard is the only thing that actually needs one.
 */
export function InviteAction({ url, className }: { url: string; className?: string }) {
  return (
    <details className={cn('w-fit', className)}>
      {/* 🔴 `box-border` explicitly: `summary` computes `content-box` here even
          with Tailwind's preflight loaded, so `min-h-11` plus a 1px border came
          out 46px and sat 2px taller than the sibling controls in the same row.
          And the spacing is on the revealed children rather than a `gap` on the
          `details`, because a gap is charged even when the only visible child is
          the summary — which made the closed disclosure 54px in a row of 44s. */}
      <summary className="border-border-rule text-text-primary hover:bg-bg-raised focus-visible:outline-accent-fill box-border flex min-h-11 w-fit cursor-pointer list-none items-center rounded-sm border px-4 text-sm focus-visible:outline-2">
        Invite
      </summary>

      <p className="text-text-secondary mt-2 max-w-prose text-sm">
        Anyone with this link can take a seat in this league. Send it to whoever is
        playing, and nobody else.
      </p>

      <InviteLink url={url} className="mt-2" />
    </details>
  );
}

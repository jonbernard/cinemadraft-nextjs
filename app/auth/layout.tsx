import Link from 'next/link';
import type { ReactNode } from 'react';

import { Panel } from '@/components/ui/Panel';
import { Wordmark } from '@/components/ui/Wordmark';

/**
 * The shell for sign-in and sign-up.
 *
 * Deliberately quiet: the only thing on the page is the lockup, one line of
 * orientation, and the form. This is the first screen a returning member sees
 * after the old site goes away, and anything else here competes with the one
 * sentence that has to land (see the sign-up page).
 *
 * 🔴 **The real lockup, not a serif word.** This rendered
 * `<span className="font-serif">Cinemadraft</span>` — Instrument Serif, the
 * face D70 reserves for the *names of things in the world* (films, leagues,
 * people), which the product's own name is not. The comment said the mark was
 * "still undecided (§6.10)"; it was decided in P15.T5, and the broken reel has
 * shipped in the rail, the tab bar and every OG card since. This page was the
 * one place still showing a different Cinemadraft from the one in the rail —
 * on the screen most likely to be somebody's first.
 *
 * 🔴 **The content sits in a `Panel`, like every other surface.** The app is a
 * floating panel on a darker ground (D67); this page was prose lying directly
 * on the ground with Clerk's own bordered, drop-shadowed card as the only
 * raised thing on it — two card treatments, neither of them ours. One panel
 * now holds the heading, the orientation line and the form, and
 * `theme/clerk.ts` flattens Clerk's card into it so the seam does not show.
 *
 * The lockup links home. A visitor who arrived here from a protected link and
 * decided not to log in had no way back out of this page.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="bg-bg-ground text-text-primary grid min-h-dvh place-items-center p-4 sm:p-6">
      {/* 40px between the lockup and the panel: one section step (D91). */}
      <div className="flex w-full max-w-md flex-col gap-10">
        <Link
          href="/"
          aria-label="Cinemadraft, home"
          className="text-text-primary focus-visible:outline-accent-fill flex min-h-11 items-center justify-center rounded-sm focus-visible:outline-2"
        >
          <Wordmark />
        </Link>
        <Panel className="p-6">{children}</Panel>
      </div>
    </main>
  );
}

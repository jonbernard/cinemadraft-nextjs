import type { ReactNode } from 'react';

/**
 * The shell for sign-in and sign-up.
 *
 * Deliberately quiet: the only thing on the page is the wordmark, one line of
 * orientation, and the form. This is the first screen a returning member sees
 * after the old site goes away, and anything else here competes with the one
 * sentence that has to land (see the sign-up page).
 *
 * Wordmark only — the logo mark is still undecided (§6.10), and the MUI
 * Minimal pinwheel is not ours to ship.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="bg-bg-base text-text-primary grid min-h-dvh place-items-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <span className="font-serif text-text-primary text-xl tracking-[-0.02em]">
          Cinemadraft
        </span>
        {children}
      </div>
    </main>
  );
}

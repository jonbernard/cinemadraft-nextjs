'use client';

import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { NAV_LINKS } from '@/lib/nav/links';
import { cn } from '@/lib/utils/cn';

/**
 * The app's navigation.
 *
 * 🔴 **Seven items is why the phone gets a drawer rather than a bottom bar.**
 * A bottom bar carries five before targets fall under the 44px minimum, so
 * seven leaves a choice between shrinking the targets, hiding items behind a
 * "More" sheet, or a drawer. The drawer is also what the source app used
 * (`src/layouts/dashboard/navbar`), so it is the pattern members already know.
 *
 * The drawer is a native `<dialog>` opened with `showModal()`, which supplies
 * the focus trap, `Escape` to close, the inert background and the backdrop —
 * four things that are easy to write badly and free here.
 *
 * From `md` up it is a plain header: seven items fit on one line, and a drawer
 * on a laptop is a phone affordance stranded on a desk.
 *
 * The current page is marked three ways: `aria-current` for assistive
 * technology, a carmine rule for scanning, and full-strength text against
 * dimmed siblings. Colour alone would be invisible to a colour-blind reader
 * and in print (§6.7).
 */
export function AppNav({ isSignedIn }: { isSignedIn: boolean }) {
  const pathname = usePathname();
  // `useId` rather than a literal: a hard-coded id is a collision waiting for
  // the second instance of a component, and `aria-controls` has to point at
  // the right one.
  const drawerId = useId();
  const drawer = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const links = NAV_LINKS.filter((link) => link.ready);

  const isCurrent = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const open = useCallback(() => {
    drawer.current?.showModal();
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    drawer.current?.close();
  }, []);

  // `close` also fires for Escape and for the backdrop, so the trigger's
  // `aria-expanded` cannot drift out of step with whether the drawer is open.
  useEffect(() => {
    const element = drawer.current;
    if (!element) return;
    const onClose = () => setIsOpen(false);
    element.addEventListener('close', onClose);
    return () => element.removeEventListener('close', onClose);
  }, []);

  // A drawer left open across a navigation would cover the page it just
  // reached.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger, not a value read here
  useEffect(() => {
    drawer.current?.close();
  }, [pathname]);

  return (
    <>
      <header className="border-border-rule bg-bg-surface sticky top-0 z-40 border-b">
        <nav
          aria-label="Main"
          className="mx-auto flex max-w-6xl items-center gap-4 px-4 md:gap-6"
        >
          <button
            type="button"
            onClick={open}
            aria-expanded={isOpen}
            aria-controls={drawerId}
            className="text-text-primary focus-visible:outline-accent-fill -ml-2 flex min-h-11 min-w-11 items-center justify-center focus-visible:outline-2 md:hidden"
          >
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            <span className="sr-only">Menu</span>
          </button>

          <Link
            href="/"
            className="font-display text-text-primary focus-visible:outline-accent-fill flex min-h-11 items-center text-sm font-bold uppercase tracking-wide [font-variation-settings:'wdth'_118] focus-visible:outline-2"
          >
            Cinemadraft
          </Link>

          {/* Desktop: the destinations inline. */}
          <ul className="hidden flex-1 items-center gap-1 md:flex">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isCurrent(link.href) ? 'page' : undefined}
                  className={cn(
                    // The padding supplies the 44px target rather than a fixed
                    // height the label could overflow.
                    'focus-visible:outline-accent-fill flex min-h-11 items-center gap-2 border-b-2 px-3 py-3 text-sm transition-colors focus-visible:outline-2',
                    isCurrent(link.href)
                      ? 'border-b-accent-fill text-text-primary'
                      : 'text-text-secondary hover:text-text-primary border-b-transparent',
                  )}
                >
                  <NavIcon path={link.path} />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="ml-auto flex items-center md:ml-0">
            <AccountControl isSignedIn={isSignedIn} />
          </div>
        </nav>
      </header>

      {/* Phone: a drawer. Native <dialog>, so focus trapping, Escape and the
          backdrop are the platform's job rather than ours. */}
      <dialog
        id={drawerId}
        ref={drawer}
        aria-label="Main menu"
        className="bg-bg-surface text-text-primary m-0 h-dvh max-h-dvh w-72 max-w-[85vw] p-0 backdrop:bg-black/60 md:hidden"
      >
        <div className="border-border-rule flex items-center justify-between border-b px-4 py-2">
          <span className="font-display text-sm font-bold uppercase tracking-wide [font-variation-settings:'wdth'_118]">
            Cinemadraft
          </span>
          <button
            type="button"
            onClick={close}
            className="text-text-secondary hover:text-text-primary focus-visible:outline-accent-fill flex min-h-11 min-w-11 items-center justify-center focus-visible:outline-2"
          >
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            <span className="sr-only">Close menu</span>
          </button>
        </div>

        <ul className="flex flex-col">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={close}
                aria-current={isCurrent(link.href) ? 'page' : undefined}
                className={cn(
                  'focus-visible:outline-accent-fill flex min-h-12 items-center gap-3 border-l-2 px-4 py-3 text-sm focus-visible:-outline-offset-2 focus-visible:outline-2',
                  isCurrent(link.href)
                    ? 'border-l-accent-fill bg-bg-raised text-text-primary'
                    : 'text-text-secondary border-l-transparent',
                )}
              >
                <NavIcon path={link.path} />
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}

function NavIcon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

/**
 * Logged in: Clerk's account menu. Logged out: a way in.
 *
 * 🔴 The state arrives as a prop, resolved on the server. Clerk 7 (Core 3)
 * **removed `<SignedIn>` and `<SignedOut>`** — they are stubs that throw, which
 * is how this was found: the build failed prerendering `/`. Resolving on the
 * server is what Core 3 asks for and is better regardless, because the client
 * components rendered nothing until Clerk loaded, so the header flickered
 * between states on every cold load.
 *
 * The dashboard and league boards are public (D44), so a logged-out visitor
 * gets the whole nav — they are reading a shared link, and hiding navigation
 * from them would strand them on one page.
 */
function AccountControl({ isSignedIn }: { isSignedIn: boolean }) {
  if (isSignedIn) return <UserButton />;

  return (
    <Link
      href="/auth/login"
      className="border-border-rule text-text-primary hover:bg-bg-raised focus-visible:outline-accent-fill flex min-h-11 items-center border px-4 text-sm focus-visible:outline-2"
    >
      Log in
    </Link>
  );
}

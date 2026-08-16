'use client';

import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils/cn';

/**
 * The four destinations (§6.9).
 *
 * 🔴 Four, not the source app's seven. Browse, Watchlist and Draft List are
 * three views of one idea and live under **Films**; Rules & Scoring becomes
 * contextual help inside the ledger rather than a nav peer. Four also sits
 * inside the five-item ceiling a phone's bottom bar can carry without the
 * targets shrinking below the touch minimum.
 *
 * Icons are inline SVG rather than an icon package: four glyphs do not justify
 * a dependency, and `currentColor` makes them inherit the active state for
 * free. Each is `aria-hidden` — the label beside it is the accessible name,
 * and an icon-only nav would hurt discoverability in an app most people open
 * once a year.
 */
const LINKS = [
  {
    href: '/',
    label: 'Home',
    // A house.
    path: 'M3 10.5 12 3l9 7.5V21H3z',
  },
  {
    href: '/films',
    label: 'Films',
    // A film frame.
    path: 'M4 4h16v16H4zM4 9h16M4 15h16M9 4v16M15 4v16',
  },
  {
    href: '/award-shows',
    label: 'Award shows',
    // A rosette.
    path: 'M12 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM9 13l-2 8 5-3 5 3-2-8',
  },
  {
    href: '/leagues',
    label: 'Leagues',
    // A bracket.
    path: 'M4 5h6v14H4zM14 5h6v14h-6zM10 12h4',
  },
] as const;

/**
 * The app's navigation.
 *
 * **Mobile-first (D49).** Members read this on phones during a ceremony, so
 * under `md` it is a fixed bottom bar — thumb-reachable, and the one place a
 * phone user expects navigation to be. From `md` up it becomes a header,
 * because a bottom bar on a laptop is a phone affordance stranded on a desk.
 *
 * Both presentations render from one array, so a destination cannot exist in
 * one and not the other.
 *
 * The current page is marked three ways deliberately: `aria-current` for
 * assistive technology, a carmine rule for sighted scanning, and full-strength
 * text against the dimmed siblings. Colour alone would be invisible to a
 * colour-blind reader and in print (§6.7).
 */
export function AppNav({ isSignedIn }: { isSignedIn: boolean }) {
  const pathname = usePathname();

  const isCurrent = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      {/* Desktop: a header. */}
      <header className="border-border-rule bg-bg-surface sticky top-0 z-40 hidden border-b md:block">
        <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center gap-6 px-4">
          <Link
            href="/"
            className="font-display text-text-primary focus-visible:outline-accent-fill py-4 text-sm font-bold uppercase tracking-wide [font-variation-settings:'wdth'_118] focus-visible:outline-2"
          >
            Cinemadraft
          </Link>

          <ul className="flex flex-1 items-center gap-1">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isCurrent(link.href) ? 'page' : undefined}
                  className={cn(
                    // 44px minimum target, and the padding is what provides
                    // it — not a fixed height that the text could overflow.
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

          <AccountControl isSignedIn={isSignedIn} />
        </nav>
      </header>

      {/* Phone: a fixed bottom bar, where a thumb already is. */}
      <nav
        aria-label="Main"
        className="border-border-rule bg-bg-surface fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="flex items-stretch justify-around">
          {LINKS.map((link) => (
            <li key={link.href} className="flex-1">
              <Link
                href={link.href}
                aria-current={isCurrent(link.href) ? 'page' : undefined}
                className={cn(
                  'focus-visible:outline-accent-fill flex min-h-14 flex-col items-center justify-center gap-1 border-t-2 px-2 py-2 text-xs focus-visible:-outline-offset-2 focus-visible:outline-2',
                  isCurrent(link.href)
                    ? 'border-t-accent-fill text-text-primary'
                    : 'text-text-secondary border-t-transparent',
                )}
              >
                <NavIcon path={link.path} />
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

function NavIcon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="h-5 w-5"
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
 * server is what Core 3 asks for and is better regardless, because the
 * client-side components rendered nothing until Clerk loaded, so the header
 * flickered between states on every cold load.
 *
 * The dashboard and league boards are public (D44), so a signed-out visitor
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

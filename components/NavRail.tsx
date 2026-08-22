import Link from 'next/link';

import { type NavLink, PRIMARY_LINKS, YOURS_LINKS } from '@/lib/nav/links';
import { cn } from '@/lib/utils/cn';
import { Eyebrow } from './Eyebrow';

/**
 * The desktop rail (D67).
 *
 * 236px on `bg.surface` at `--radius-md`, inset from the ground — a floating
 * panel, not a bordered sidebar. Measured off Spotify's shell, which is why a
 * dense list UI reads there as a media player rather than an admin console.
 *
 * `pathname` is a prop rather than a `usePathname()` call so the rail renders
 * in Storybook without a router, and so every active state is a story rather
 * than something only reachable by navigating.
 *
 * `primary` and `yours` default to the real destination lists. The props
 * exist only so the grouped "Yours" state is testable and storyable while all
 * three `yours` pages are still unbuilt (every one is `ready: false` in
 * `lib/nav/links.ts` today, so `Group` renders nothing for that heading) —
 * not as speculative API. Don't delete them once Phase 10 ships a `yours`
 * page and the default data alone starts exercising the grouped state.
 */
export function NavRail({
  pathname,
  primary = PRIMARY_LINKS,
  yours = YOURS_LINKS,
}: {
  pathname: string;
  primary?: NavLink[];
  yours?: NavLink[];
}) {
  return (
    <nav
      aria-label="Main"
      className="bg-bg-surface rounded-md flex w-[236px] flex-col gap-6 p-3"
    >
      <Link
        href="/"
        className="font-serif text-text-primary focus-visible:outline-accent-fill px-2 py-1 text-xl tracking-[-0.02em] focus-visible:outline-2"
      >
        Cinemadraft
      </Link>
      <Group links={primary} pathname={pathname} />
      <Group links={yours} pathname={pathname} label="Yours" />
    </nav>
  );
}

function isCurrent(href: string, pathname: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

function Group({
  links,
  pathname,
  label,
}: {
  links: NavLink[];
  pathname: string;
  label?: string;
}) {
  const visible = links.filter((link) => link.ready);
  if (visible.length === 0) return null;
  return (
    <div>
      {label ? <Eyebrow className="px-2 pb-2">{label}</Eyebrow> : null}
      <ul className="flex flex-col gap-0.5">
        {visible.map((link) => {
          const current = isCurrent(link.href, pathname);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'focus-visible:outline-accent-fill flex min-h-11 items-center gap-3 rounded-sm px-2 text-sm transition-colors focus-visible:outline-2',
                  current
                    ? // Two signals: the surface step and the carmine edge.
                      'bg-bg-raised text-text-primary shadow-[inset_2px_0_0_0_var(--color-accent-fill)]'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-raised',
                )}
              >
                <NavIcon path={link.path} />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NavIcon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

/**
 * The app's destinations, kept out of the component module.
 *
 * Biome's `useComponentExportOnlyModules` forbids exporting a non-component
 * beside components, and it is right here for a reason beyond the lint: the
 * list is data that tests and future pages read, and pulling it out of a
 * `'use client'` module means importing it does not drag the client bundle
 * along.
 */
export type NavLink = {
  href: string;
  label: string;
  /** Inline SVG path data; `currentColor` inherits the active state. */
  path: string;
  /** False while the page is still owed by a later batch of Phase 10. */
  ready: boolean;
  /**
   * 🔴 D75. `primary` are the four a member opens weekly and they get the
   * bottom tabs on a phone and the top of the rail on desktop. `yours` are the
   * three opened once a season — a draft list before the draft, rules when a
   * score surprises them — and they live behind the More sheet on a phone.
   *
   * All seven stay reachable everywhere, which is what D62's override
   * requires; grouping only changes how many taps each costs.
   */
  group: 'primary' | 'yours';
};

/**
 * The seven destinations, as the source app has them.
 *
 * 🔴 Seven, not the four of spec §6.9 — **the owner overrode that** (D62).
 * §6.9 proposed consolidating Browse, Watchlist and Draft List into one Films
 * destination; the league knows the app by these seven names, so they stay.
 *
 * Entries appear as their pages are built, so the nav never links to a 404.
 * The full set lives here rather than being added ad hoc, which keeps what is
 * missing visible: `ready: false` is a page Phase 10 still owes, and flipping
 * the flag is the last step of the task that builds it.
 *
 * Icons are inline SVG rather than an icon package — seven glyphs do not
 * justify a dependency, and `currentColor` makes them inherit state for free.
 * Each is `aria-hidden`; the label beside it is the accessible name, because
 * icon-only navigation hurts discoverability in an app most members open once
 * a year.
 */
export const NAV_LINKS: NavLink[] = [
  {
    href: '/',
    label: 'Home',
    ready: true,
    path: 'M3 10.5 12 3l9 7.5V21H3z',
    group: 'primary',
  },
  {
    href: '/leagues',
    label: 'Leagues',
    ready: true,
    path: 'M4 5h6v14H4zM14 5h6v14h-6zM10 12h4',
    group: 'primary',
  },
  {
    href: '/browse',
    label: 'Browse',
    ready: true,
    path: 'M4 4h16v16H4zM4 9h16M4 15h16M9 4v16M15 4v16',
    group: 'primary',
  },
  {
    href: '/award-shows',
    label: 'Award shows',
    ready: true,
    path: 'M12 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM9 13l-2 8 5-3 5 3-2-8',
    group: 'primary',
  },
  {
    href: '/watchlist',
    label: 'Watchlist',
    ready: true,
    path: 'M6 3h12v18l-6-4.5L6 21z',
    group: 'yours',
  },
  {
    href: '/list',
    label: 'Draft list',
    ready: true,
    path: 'M4 6h16M4 12h16M4 18h10M18 16v5M15.5 18.5h5',
    group: 'yours',
  },
  {
    href: '/rules-and-scoring',
    label: 'Rules & scoring',
    ready: false,
    path: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 8v5M12 16h.01',
    group: 'yours',
  },
];

export const PRIMARY_LINKS = NAV_LINKS.filter((l) => l.group === 'primary');
export const YOURS_LINKS = NAV_LINKS.filter((l) => l.group === 'yours');

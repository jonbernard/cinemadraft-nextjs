import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TvModeLink } from '@/components/awards/TvModeLink';

/**
 * TV mode (P14.T6) is two halves that have to keep agreeing with each other:
 * the link below, and one unlayered rule in `app/globals.css` that hides
 * anything carrying `data-app-chrome` while the page carries `data-tv-mode`.
 *
 * 🔴 **jsdom cannot prove the second half and this file does not pretend to.**
 * No stylesheet is loaded here and `:has()` is never evaluated, so "the rail is
 * hidden" is not a thing a unit test in this project can assert — it is
 * asserted in `e2e/live.spec.ts` against a production build at 1920, by
 * computed geometry. What this file guards is the seam: that the selector and
 * the attributes it looks for still exist and still spell each other the same
 * way. Delete the attribute from `AppShell` or the rule from the stylesheet and
 * the browser test goes red minutes later at the end of a build; this goes red
 * in a second, and says which side moved.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('TvModeLink', () => {
  it('offers the way in, and says what pressing it does', () => {
    render(<TvModeLink href="/live/oscars?year=2026&tv=1" active={false} />);

    const link = screen.getByRole('link', { name: 'TV mode' });
    expect(link).toHaveAttribute('href', '/live/oscars?year=2026&tv=1');
    expect(screen.queryByRole('link', { name: 'Leave TV mode' })).toBeNull();
  });

  it('offers the way out, and it is the same control in the same place', () => {
    // A control that hides itself once the mode is on strands a reader who has
    // a remote and no address bar. Both directions, one element, one position.
    render(<TvModeLink href="/live/oscars?year=2026" active />);

    const link = screen.getByRole('link', { name: 'Leave TV mode' });
    expect(link).toHaveAttribute('href', '/live/oscars?year=2026');
    expect(link.getAttribute('href')).not.toContain('tv=1');
  });

  it('is a target a remote can hit', () => {
    // Asserted on the class, because jsdom computes no layout — the same
    // reasoning AppShell.test.tsx gives for the rail's own 44px check.
    render(<TvModeLink href="/live/oscars" active={false} />);

    expect(screen.getByRole('link', { name: 'TV mode' }).className).toMatch(/min-h-11/);
  });
});

describe('the TV mode seam', () => {
  const css = read('app/globals.css');

  it('the stylesheet hides chrome only when the page asks for it', () => {
    // Whether the rule also OUTRANKS Tailwind's `xl:flex` is not asserted
    // here: every cheap way to check it from a string (counting braces to see
    // the rule sits outside `@layer`) passes against the broken version too,
    // and a check that cannot go red is not a check. The layer question is
    // settled in the browser, in e2e/live.spec.ts, by measuring the rail.
    expect(css).toMatch(
      /body:has\(\[data-tv-mode]\) \[data-app-chrome] \{\s*display: none;/,
    );
  });

  it('every piece of shell chrome the rule targets still carries the hook', () => {
    // Four elements now, named here so that removing one is a failure rather
    // than a silently smaller TV mode: the rail wrapper and the utility strip
    // (both in AppShell), the phone and tablet top bar, and the phone tab bar.
    //
    // 🔴 P14.T16 added the fourth and the count in `AppShell.tsx` did NOT move:
    // the top bar is its own component, so its hook is in `TopBar.tsx`. The
    // plan predicted three here; a third file is what the change actually
    // needs, and bumping this to 3 would have turned the guard red against a
    // correct shell.
    const shell = read('components/shell/AppShell.tsx');
    const tabBar = read('components/shell/TabBar.tsx');
    const topBar = read('components/shell/TopBar.tsx');

    // As an attribute, not as prose: every one of these files talks about the
    // hook in a comment as well as carrying it.
    const attribute = /^\s*data-app-chrome$|data-app-chrome>/gm;
    expect(shell.match(attribute)).toHaveLength(2);
    expect(tabBar.match(attribute)).toHaveLength(1);
    expect(topBar.match(attribute)).toHaveLength(1);
  });

  it('the live page is what sets the marker, and only under ?tv=1', () => {
    const page = read('app/(app)/live/[abbr]/page.tsx');

    expect(page).toContain("data-tv-mode={tvMode ? '' : undefined}");
    expect(page).toContain("const tvMode = tv === '1';");
  });

  it('the stream URL does not carry the mode, so a toggle cannot remount the room', () => {
    // `LiveRoom` is keyed on the stream URL (P14.T4). A `tv` parameter in that
    // string would make every toggle a fresh mount — a dropped `EventSource`
    // and a reconnect in the middle of a ceremony, which is the one thing TV
    // mode must not cost. Guarded here as well as in the browser because the
    // browser test needs a production build and a database to run at all.
    const page = read('app/(app)/live/[abbr]/page.tsx');
    const at = page.indexOf('const stream = ');
    const stream = page.slice(at, page.indexOf('`;', at));

    expect(stream).not.toMatch(/tv/i);
    expect(page).toContain('key={stream}');
  });
});

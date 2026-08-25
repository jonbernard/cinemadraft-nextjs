# Phase 15 — Pre-cutover polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every defect the owner found using `next.cinemadraft.com`, and
add the release work a live site needs — a brand mark, real metadata, a sign-in
flow a returning member can get through, and end-to-end coverage of the league
lifecycle that runs in CI.

**Architecture:** Thirteen independent tasks over surfaces that already exist.
Three of them change a shared rule rather than a screen — the dashboard service
emits one entry per *show phase* instead of per show (T2), the browse discover
query filters on the primary release date instead of any release date (T9), and
`getCurrentUser` gains a test-only session branch that lets the whole app boot
with no Clerk at all (T10). The rest are contained: one component, its story,
its test.

**Tech Stack:** Next 16 App Router, React 19, TypeScript strict, Prisma,
Tailwind 4 + MUI, Vitest + Testing Library, Playwright, Storybook 10.

**Spec:** `docs/superpowers/specs/2026-08-24-phase-15-pre-cutover-polish-design.md`

**Plan of record:** `docs/PLAN.md` § Phase 15 (which runs **before** Phase 12).

---

## Global Constraints

- **Biome, not ESLint or Prettier.** `npm run lint` covers linting, formatting
  and import order; `npm run typecheck` is separate.
- **MUI for components, Tailwind for custom styling**, coexisting through CSS
  cascade layers ordered `theme, base, mui, components, utilities`. Never
  `!important`.
- **All local databases run in Docker** — `npm run db:up` before anything that
  touches the database.
- **Never regenerate `package-lock.json` on macOS.** `npm install <pkg>` to
  update `package.json`, then `npm run lock` before committing.
- **`fixtures/` is generated.** Never hand-edit it.
- **Every new surface is built from the Phase 3.5 primitives** — `SectionHead`,
  `Panel`, `Shelf`, `Button`, `StatusChip`, `Eyebrow`, `CinemaFrame`,
  `PosterFrame` — and carries a Storybook story. No hairline card border, no
  all-caps heading outside `Eyebrow`, no squared or pill button, no
  machine-formatted date. `LetterboxRule`, `font-display`, the Archivo `wdth`
  axis and `/tokens` no longer exist (D69–D78).
- **No raw hex outside the token system.** `scripts/layering.sh` greps for it in
  `components/`, `app/` and `.storybook/`.
- **The repository layer is the only code allowed to touch Prisma.**
  `components/` may not import from `lib/services/` either (D33) — types that
  cross that line are re-declared in the component file.
- **`data-testid` is the only test handle** (D66), stripped from production
  output unless `KEEP_TEST_IDS=1`. Assertions still go through roles and
  accessible names.
- **Touch targets ≥44px**, focus rings never removed, colour never the only
  carrier of state, and every animation has a `prefers-reduced-motion` path.
- **One commit per task**, message starting with the task ID (`P15.T3: ...`).
  Tick the `PROGRESS.md` box as the final step of each task.
- **`npm run verify` before pushing** — lint, typecheck, layering, both test
  suites, build.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `components/SeasonStepper.tsx` | The season rail as a windowed stepper (replaces `SeasonRail.tsx`) |
| `components/SearchOverlay.tsx` | The global film-search dialog |
| `components/GroupCeremony.tsx` | The full-screen randomisation takeover |
| `components/BrowseList.tsx` | Client list that appends browse pages on scroll |
| `lib/test-auth.ts` | The test-only session cookie: name, signing, and the two guards |
| `lib/seo.ts` | `metadataBase`, the canonical helper, the shared OG defaults |
| `app/icon.svg`, `app/apple-icon.png` | The chosen mark, as Next's icon conventions |
| `app/robots.ts`, `app/sitemap.ts` | Crawl rules and the public URL list |
| `app/(app)/films/[tmdbId]/opengraph-image.tsx` | Per-film OG card |
| `app/(app)/award-shows/[abbr]/opengraph-image.tsx` | Per-show OG card |
| `e2e/league-lifecycle.spec.ts`, `e2e/awards-lifecycle.spec.ts` | The two new journeys |
| `e2e/support/session.ts` | Playwright helper that seeds a user and sets the test cookie |

**Modified**

| File | Change |
|---|---|
| `components/LeaderboardTable.tsx` | Client component, 10 rows + reveal, two columns below `lg` |
| `components/SectionHead.tsx` | `right` drops below the heading on narrow screens |
| `components/AppShell.tsx` | Search icon opens `SearchOverlay`; account control is Clerk-free in test mode |
| `components/SeasonSetup.tsx` | Launches `GroupCeremony` with the dealt groups |
| `lib/services/dashboard.ts` | Emits one `SeasonPhase` per show phase |
| `lib/external/tmdb-discover.ts` | `primary_release_date` on the future side |
| `lib/auth.ts` | Test-session branch |
| `app/providers.tsx`, `proxy.ts` | Clerk mounts only when Clerk is configured |
| `app/layout.tsx` | `metadataBase`, title template, icons |
| `app/(app)/browse/page.tsx` | Hero band; renders `BrowseList` |
| `actions/leagues/manage-seats.ts` | `randomiseGroups` returns the assignments it made |
| `.github/workflows/ci.yml` | E2E runs with `E2E_TEST_AUTH=1` and no Clerk secret |

---

## Task 0: Renumber the plan and record the decisions

Already done in the same session that wrote this plan, and listed here so the
phase's own record is complete. `docs/PLAN.md` carries the new Phase 15 and the
old one as Phase 16; `docs/PROGRESS.md` carries the P15 checklist **above**
Phase 12, because it is read top-down for the first unchecked task;
`docs/DECISIONS.md` carries D79–D82 and D84, with D83 reserved for the mark T5
chooses.

- [ ] **Step 1: Verify the three documents agree**

```bash
grep -n "^### Phase 1[2-6]" docs/PLAN.md
grep -n "^## Phase 1[2-6]" docs/PROGRESS.md
grep -c "^| D8[0-4]" docs/DECISIONS.md
```

Expected: `PLAN.md` lists 12, 13, 14, 15, 16 in that order; `PROGRESS.md` lists
15 **before** 12; the D-row count is 5 (D80, D81, D82, D83, D84).

- [ ] **Step 2: Commit**

```bash
git add docs/PLAN.md docs/PROGRESS.md docs/DECISIONS.md docs/superpowers/plans/2026-08-25-phase-15-pre-cutover-polish.md
git commit -m "P15.T0: renumber the phases and record D79-D84"
```

---

## Task 1: The leaderboard — ten rows, and a phone that shows the total

**Files:**
- Modify: `components/LeaderboardTable.tsx`
- Modify: `components/SectionHead.tsx`
- Modify: `app/(app)/page.tsx:84-107` (the year nav in the `right` slot)
- Test: `components/LeaderboardTable.test.tsx` (create), `components/SectionHead.test.tsx`
- Story: `components/LeaderboardTable.stories.tsx` (create)

**Interfaces:**
- Consumes: `Leaderboard`, `LeaderboardRow`, `LeaderboardEvent` from
  `lib/services/leaderboard.ts` — unchanged by this task.
- Produces: `LeaderboardTable` stays `{ leaderboard, className }`, but is now a
  client component. `SectionHead` gains one optional prop:
  `rightStacksOnMobile?: boolean` (default `false`).

**Context an implementer needs.** The table currently sets
`min-w-[36rem]` and wraps itself in `overflow-x-auto`, and hides the per-show
columns below `lg` — so on a phone the reader gets a horizontally scrolling
table whose only two useful columns sit at opposite ends of the scroll. D79
reverses that half of D49: below `lg` there is no min-width and no scroll, and
the film title and total are both on screen. The per-show columns keep their
`hidden lg:table-cell`, so nothing changes at `lg` and up.

Separately, the dashboard passes the year `<nav>` into `SectionHead`'s `right`
slot. `SectionHead` is `flex items-end justify-between`, and at 390px the
heading wraps to two lines and the year links render across it (the owner's
screenshot). The fix belongs in `SectionHead`, because any long title with a
wide right slot collides the same way.

- [ ] **Step 1: Write the failing tests**

Create `components/LeaderboardTable.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { LeaderboardTable } from './LeaderboardTable';

function leaderboardOf(count: number) {
  return {
    year: 2026,
    events: [{ abbreviation: 'oscars', name: 'Academy Awards' }],
    rows: Array.from({ length: count }, (_, index) => ({
      movieId: index + 1,
      title: `Film ${index + 1}`,
      events: { oscars: count - index },
      total: count - index,
    })),
  };
}

describe('LeaderboardTable', () => {
  it('renders ten rows and hides the rest behind a reveal', () => {
    render(<LeaderboardTable leaderboard={leaderboardOf(25)} />);

    expect(screen.getAllByRole('row')).toHaveLength(11); // ten films + the header
    expect(screen.queryByText('Film 11')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show 10 more/i })).toBeInTheDocument();
  });

  it('reveals ten more per press and drops the button at the end', async () => {
    const user = userEvent.setup();
    render(<LeaderboardTable leaderboard={leaderboardOf(25)} />);

    await user.click(screen.getByRole('button', { name: /show 10 more/i }));
    expect(screen.getByText('Film 20')).toBeInTheDocument();
    expect(screen.queryByText('Film 21')).not.toBeInTheDocument();

    // Five left, so the label says five rather than lying about ten.
    await user.click(screen.getByRole('button', { name: /show 5 more/i }));
    expect(screen.getByText('Film 25')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show/i })).not.toBeInTheDocument();
  });

  it('renders no reveal at all when the season fits', () => {
    render(<LeaderboardTable leaderboard={leaderboardOf(7)} />);

    expect(screen.getAllByRole('row')).toHaveLength(8);
    expect(screen.queryByRole('button', { name: /show/i })).not.toBeInTheDocument();
  });

  it('never scrolls horizontally — no min-width on the table', () => {
    const { container } = render(<LeaderboardTable leaderboard={leaderboardOf(3)} />);
    const table = container.querySelector('table');

    expect(table?.className).not.toMatch(/min-w-/);
    expect(container.querySelector('.overflow-x-auto')).toBeNull();
  });
});
```

Add to `components/SectionHead.test.tsx`:

```tsx
  it('stacks the right slot beneath the heading when asked', () => {
    const { container } = render(
      <SectionHead right={<span>2026</span>} rightStacksOnMobile>
        Season leaderboard
      </SectionHead>,
    );

    // Column below `sm`, row from `sm` up: the collision the owner hit at 390px
    // is the row layout applying at every width.
    expect(container.firstElementChild?.className).toContain('flex-col');
    expect(container.firstElementChild?.className).toContain('sm:flex-row');
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run components/LeaderboardTable.test.tsx components/SectionHead.test.tsx`
Expected: FAIL — `LeaderboardTable` renders every row and has no button;
`SectionHead` has no `rightStacksOnMobile`.

- [ ] **Step 3: Make `SectionHead` able to stack**

In `components/SectionHead.tsx`, add the prop and branch the wrapper's classes:

```tsx
export function SectionHead({
  eyebrow,
  children,
  as: Tag = 'h2',
  name = false,
  right,
  rightStacksOnMobile = false,
  className,
}: {
  eyebrow?: ReactNode;
  children: ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'h4';
  name?: boolean;
  right?: ReactNode;
  /**
   * Drops the right slot beneath the heading below `sm`.
   *
   * The default row layout assumes the right slot is a short count. A wide one
   * — the season's year links — renders over a heading that has wrapped to two
   * lines on a phone, which is the defect D79 records. Opt-in rather than
   * automatic: a mono count on the right *is* the design at every width, and
   * stacking it would cost every section its scannable right edge.
   */
  rightStacksOnMobile?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex gap-4 pb-3',
        rightStacksOnMobile
          ? 'flex-col items-start sm:flex-row sm:items-end sm:justify-between'
          : 'items-end justify-between',
        className,
      )}
    >
```

and drop `shrink-0` from the right slot when stacking:

```tsx
      {right ? (
        <div
          className={cn(
            'text-text-dim font-mono tabular text-sm',
            rightStacksOnMobile ? 'sm:shrink-0' : 'shrink-0',
          )}
        >
          {right}
        </div>
      ) : null}
```

- [ ] **Step 4: Rewrite `LeaderboardTable`**

Replace the file with a client component. The header comment carries the D49
amendment so the next reader does not "fix" it back:

```tsx
'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils/cn';

/** One award show, as a column. Re-declared: `components/` may not import from `lib/services/` (D33). */
export type LeaderboardEventView = { abbreviation: string; name: string };

export type LeaderboardRowView = {
  movieId: number;
  title: string;
  events: Record<string, number>;
  total: number;
};

export type LeaderboardView = {
  year: number;
  events: LeaderboardEventView[];
  rows: LeaderboardRowView[];
};

/** How many rows the table opens with, and how many each press reveals. */
const PAGE = 10;

/**
 * The season leaderboard grid (P10.T4, P15.T1): one row per nominated film,
 * one column per award show, a Total column, sorted by total descending.
 *
 * 🔴 **Ten rows, then a reveal.** A full season is every film anybody was
 * nominated for — dozens of rows above the fold on the app's front page. The
 * data all arrives with the page, so the button reveals rather than fetches:
 * no endpoint, no loading state, no second query.
 *
 * 🔴 **Mobile is Film + Total, not a horizontal scroll (D79, amending D49).**
 * D49 kept every column and scrolled the table sideways. Measured on a 390px
 * phone that puts Total off screen at every width — the reader gets a list of
 * titles and has to scroll to reach the one number the section reports. The
 * per-show columns stay `hidden lg:table-cell`, so nothing changes at `lg`.
 * The columns are hidden, not removed: the markup and its `<caption>` are
 * intact, so a screen reader still reads the whole grid.
 */
export function LeaderboardTable({
  leaderboard,
  className,
}: {
  leaderboard: LeaderboardView;
  className?: string;
}) {
  const [shown, setShown] = useState(PAGE);

  if (leaderboard.rows.length === 0) {
    return (
      <p className={cn('text-text-secondary text-sm', className)}>
        No nominations for {leaderboard.year} yet.
      </p>
    );
  }

  const visible = leaderboard.rows.slice(0, shown);
  const remaining = leaderboard.rows.length - visible.length;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Season leaderboard by award show, {leaderboard.year}
        </caption>
        <thead>
          <tr className="border-border-rule border-b">
            <th scope="col" className="text-text-dim py-2 pr-3 text-left text-xs font-normal">
              Film
            </th>
            {leaderboard.events.map((event) => (
              <th
                key={event.abbreviation}
                scope="col"
                title={event.name}
                className="text-text-dim hidden py-2 px-2 text-right text-xs font-normal lg:table-cell"
              >
                {event.abbreviation.toUpperCase()}
              </th>
            ))}
            <th scope="col" className="text-text-dim py-2 pl-3 text-right text-xs font-normal">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.movieId} className="border-border-rule border-b">
              <th scope="row" className="text-text-primary py-2 pr-3 text-left font-normal">
                {row.title}
              </th>
              {leaderboard.events.map((event) => (
                <td
                  key={event.abbreviation}
                  className="text-text-secondary tabular hidden py-2 px-2 text-right font-mono lg:table-cell"
                >
                  {row.events[event.abbreviation] ?? 0}
                </td>
              ))}
              <td className="text-text-primary tabular py-2 pl-3 text-right font-mono whitespace-nowrap">
                {row.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {remaining > 0 ? (
        <button
          type="button"
          onClick={() => setShown((current) => current + PAGE)}
          className="bg-bg-raised text-text-primary hover:text-accent-text focus-visible:outline-accent-fill flex min-h-11 items-center justify-center gap-2 self-center rounded-sm px-6 text-sm transition-colors focus-visible:outline-2"
        >
          Show {Math.min(PAGE, remaining)} more
          <span className="text-text-dim tabular font-mono text-xs">{remaining} left</span>
        </button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Pass the year nav through the stacking slot**

In `app/(app)/page.tsx`, add `rightStacksOnMobile` to the "Season leaderboard"
`SectionHead` (the one whose `right` holds the year `<nav>`). Leave every other
`SectionHead` alone — their right slots are short mono counts.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run components/LeaderboardTable.test.tsx components/SectionHead.test.tsx`
Expected: PASS.

- [ ] **Step 7: Add the story**

Create `components/LeaderboardTable.stories.tsx` with three stories — `Short`
(7 rows, no button), `Long` (25 rows), and `Empty` (no rows) — built from the
same `leaderboardOf` shape as the test.

- [ ] **Step 8: Check it in a browser at 390px**

Run `npm run dev`, open `/` at 390px in both schemes. Confirm: the year links
sit beneath "Season leaderboard", the table shows Film and Total with no
sideways scroll, and pressing the button adds ten rows.

- [ ] **Step 9: Commit**

```bash
npm run lint && npm run typecheck && npx vitest run components/
git add components/LeaderboardTable.tsx components/LeaderboardTable.test.tsx components/LeaderboardTable.stories.tsx components/SectionHead.tsx components/SectionHead.test.tsx "app/(app)/page.tsx"
git commit -m "P15.T1: ten rows, and a phone that shows the total"
```

---

## Task 2: The season stepper — a box per show phase

**Files:**
- Create: `components/SeasonStepper.tsx`, `components/SeasonStepper.test.tsx`, `components/SeasonStepper.stories.tsx`
- Delete: `components/SeasonRail.tsx`, `components/SeasonRail.test.tsx`
- Modify: `lib/services/dashboard.ts:60-73` (the `SeasonEvent` type) and `:149-165` (the mapping)
- Modify: `app/(app)/page.tsx` (import and props)
- Test: `lib/services/dashboard.test.ts`

**Interfaces:**
- Produces, from `lib/services/dashboard.ts`:

```ts
export type SeasonPhase = {
  /** `${eventId}-nominations` / `${eventId}-ceremony` — unique per box, stable across renders. */
  key: string;
  eventId: number;
  phase: 'nominations' | 'ceremony';
  name: string | null;
  abbreviation: string | null;
  /** Epoch milliseconds, or null when the phase is not scheduled. */
  date: number | null;
  complete: boolean;
};
```

  `DashboardView.events` changes type from `SeasonEvent[]` to `SeasonPhase[]`.
- Produces, from `components/SeasonStepper.tsx`: `SeasonStepper({ phases, className })`,
  where `SeasonPhase` is re-declared in the component file (D33).

**Context an implementer needs.** `events` has `nom_date` and `awards_date` as
separate columns and `eventRepository` already normalizes both to epoch
milliseconds. `lib/services/dashboard.ts:154` emits `date: event.awardsDate` and
drops `nomDate` entirely — which is why the dashboard has never shown a
nominations date, though nominations are half of what scores. `complete` keeps
its existing rule, applied per phase: a date in the past. `nomActive` and
`awardsActive` are the *live broadcast window*, not "is it over", and must not
be used here.

- [ ] **Step 1: Write the failing service test**

Add to `lib/services/dashboard.test.ts`:

```ts
  it('emits one entry per show phase, in date order', async () => {
    // Two shows, four phases, deliberately out of chronological order in the
    // repository's answer so the sort is what puts them right.
    const view = await getDashboard(null);
    const oscars = view.events.filter((phase) => phase.abbreviation === 'oscars');

    expect(oscars.map((phase) => phase.phase)).toEqual(['nominations', 'ceremony']);
    expect(oscars[0]?.key).toBe(`${oscars[0]?.eventId}-nominations`);
    // Nominations always precede their own ceremony.
    expect(oscars[0]?.date ?? 0).toBeLessThan(oscars[1]?.date ?? 0);
  });

  it('drops a phase that has no date rather than dating it 1970', async () => {
    const view = await getDashboard(null);
    const undated = view.events.filter((phase) => phase.date == null);

    // Undated phases are kept and sorted last — a show with no announced
    // nominations date is a real state, and hiding it makes the season look
    // shorter than it is.
    for (const phase of undated) expect(phase.complete).toBe(false);
    expect(view.events.at(-1)?.date ?? null).toBe(undated.length > 0 ? null : expect.anything());
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/services/dashboard.test.ts`
Expected: FAIL — `phase` and `key` do not exist on the emitted objects.

- [ ] **Step 3: Emit phases from the service**

In `lib/services/dashboard.ts`, replace the `SeasonEvent` type with `SeasonPhase`
(shape above), and replace the `events:` mapping with:

```ts
    events: events
      .flatMap((event) => {
        // One box per scoring moment, not one per show. `nom_date` and
        // `awards_date` are separate columns; emitting only the second is why
        // the dashboard never showed a nominations date, though nominations
        // are half of what scores.
        //
        // `complete` is a date comparison, per phase. `nomActive` /
        // `awardsActive` mark the live broadcast window, not whether the
        // moment has passed, and using them here would light up "complete" for
        // a ceremony that is on air right now.
        const now = Date.now();
        const shared = {
          eventId: event.id,
          name: event.name,
          abbreviation: event.abbreviation,
        };
        return [
          {
            ...shared,
            key: `${event.id}-nominations`,
            phase: 'nominations' as const,
            date: event.nomDate,
            complete: event.nomDate != null && event.nomDate < now,
          },
          {
            ...shared,
            key: `${event.id}-ceremony`,
            phase: 'ceremony' as const,
            date: event.awardsDate,
            complete: event.awardsDate != null && event.awardsDate < now,
          },
        ];
      })
      .sort(
        (a, b) =>
          (a.date ?? Number.POSITIVE_INFINITY) - (b.date ?? Number.POSITIVE_INFINITY),
      ),
```

- [ ] **Step 4: Run the service test**

Run: `npx vitest run lib/services/dashboard.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing component test**

Create `components/SeasonStepper.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { type SeasonPhase, SeasonStepper } from './SeasonStepper';

const DAY = 86_400_000;

function phases(count: number): SeasonPhase[] {
  const start = Date.now() - count * DAY;
  return Array.from({ length: count }, (_, index) => ({
    key: `${index}-ceremony`,
    eventId: index,
    phase: 'ceremony' as const,
    name: `Show ${index}`,
    abbreviation: `s${index}`,
    date: start + index * DAY * 2,
    complete: start + index * DAY * 2 < Date.now(),
  }));
}

describe('SeasonStepper', () => {
  it('opens anchored to the end of the season', () => {
    render(<SeasonStepper phases={phases(12)} />);

    // The last box is what a reader wants first: the next thing to happen.
    expect(screen.getByTestId('season-window')).toHaveAttribute('data-offset', '7');
  });

  it('steps three boxes at a time, and stops at the ends', async () => {
    const user = userEvent.setup();
    render(<SeasonStepper phases={phases(12)} />);

    await user.click(screen.getByRole('button', { name: /earlier/i }));
    expect(screen.getByTestId('season-window')).toHaveAttribute('data-offset', '4');

    await user.click(screen.getByRole('button', { name: /earlier/i }));
    // Clamped to 0 rather than stepping to 1 and leaving a gap at the start.
    expect(screen.getByTestId('season-window')).toHaveAttribute('data-offset', '0');
    expect(screen.getByRole('button', { name: /earlier/i })).toBeDisabled();
  });

  it('names the phase, so two boxes for one show are told apart', () => {
    render(
      <SeasonStepper
        phases={[
          { key: '1-nominations', eventId: 1, phase: 'nominations', name: 'Academy Awards', abbreviation: 'oscars', date: Date.now() + DAY, complete: false },
          { key: '1-ceremony', eventId: 1, phase: 'ceremony', name: 'Academy Awards', abbreviation: 'oscars', date: Date.now() + 30 * DAY, complete: false },
        ]}
      />,
    );

    expect(screen.getByText('Nominations')).toBeInTheDocument();
    expect(screen.getByText('Ceremony')).toBeInTheDocument();
  });

  it('renders every phase in the DOM, whatever the window shows', () => {
    render(<SeasonStepper phases={phases(12)} />);

    // The window is a visual affordance. A screen reader and a no-JS reader
    // still get the whole season, in order.
    expect(screen.getAllByRole('listitem')).toHaveLength(12);
  });

  it('renders nothing for a season with no shows', () => {
    const { container } = render(<SeasonStepper phases={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 6: Run it and watch it fail**

Run: `npx vitest run components/SeasonStepper.test.tsx`
Expected: FAIL — the module does not exist.

- [ ] **Step 7: Write `SeasonStepper`**

Port `SeasonRail.tsx` wholesale — its `showDate` formatter, `daysUntil`,
`label`, the `StatusChip`, the `<time datetime>` and the "Date TBA" branch are
all still correct and their comments explain why. Four things change:

1. `'use client'` at the top, and `useState` for the window offset.
2. The `SeasonEvent` type becomes `SeasonPhase` (shape in **Interfaces**), and
   the box carries a `Nominations` / `Ceremony` line under the show name.
3. `forReading` is gone: the service already sorts.
4. The scroll container becomes a window plus two buttons:

```tsx
/** How many boxes a press moves. Three is a phone's worth and half a laptop's. */
const STEP = 3;

  const [offset, setOffset] = useState(() => Math.max(0, phases.length - VISIBLE));
```

  where `VISIBLE` is 5. The window is a `div` with `overflow-hidden` around an
  `ol` translated by `calc(var(--offset) * (10rem + 0.75rem))` — a transform, not
  a scroll, so it cannot fight the page's own scrolling. Give the window
  `data-testid="season-window"` and `data-offset={offset}`.

  Both buttons are ≥44px, labelled "Earlier in the season" / "Later in the
  season", and `disabled` at their end. Wrap the whole thing in a
  `<div aria-live="polite">` announcing `Showing shows N to M of TOTAL`.

  Motion: `transition-transform duration-200 ease-out`, disabled under
  `motion-reduce:transition-none`.

- [ ] **Step 8: Run the component test**

Run: `npx vitest run components/SeasonStepper.test.tsx`
Expected: PASS.

- [ ] **Step 9: Swap it in and delete the rail**

In `app/(app)/page.tsx`, import `SeasonStepper` and pass `phases={view.events}`.
Delete `components/SeasonRail.tsx` and `components/SeasonRail.test.tsx`. Create
`components/SeasonStepper.stories.tsx` with `FullSeason` (24 phases), `EarlySeason`
(4 phases, no stepping needed) and `Unscheduled` (dates all null).

- [ ] **Step 10: Check it in a browser**

`/` at 1440px and 390px, both schemes: the rail opens showing the most recent
and next boxes, `‹` steps back three, the buttons disable at the ends, and each
show contributes two boxes.

- [ ] **Step 11: Commit**

```bash
npm run lint && npm run typecheck && npx vitest run components/ lib/services/dashboard.test.ts
git add -A components lib/services/dashboard.ts lib/services/dashboard.test.ts "app/(app)/page.tsx"
git commit -m "P15.T2: a box per show phase, and a stepper to reach them"
```

---

## Task 3: The global search panel

**Files:**
- Create: `components/SearchOverlay.tsx`, `components/SearchOverlay.test.tsx`, `components/SearchOverlay.stories.tsx`
- Modify: `components/AppShell.tsx` (the `Strip` search icon, and mount the overlay)
- Modify: `components/MoreSheet.tsx` (a Search entry that opens the same overlay)

**Interfaces:**
- Consumes: `findFilms` from `actions/search/find-films.ts` —
  `findFilms({ query, context: { kind: 'browse' } })` returns
  `ActionResult<FilmResult[]>`, where `FilmResult` is
  `{ id, tmdbId, title, year, posterUrl, isTaken, isLocal }`.
  `FilmSearch` from `components/FilmSearch.tsx` —
  `{ onSearch: (query, signal) => Promise<SearchedFilm[]>, onSelect, label, placeholder, autoFocus, ... }`.
- Produces: `SearchOverlay({ id, ref })` where `ref` is a
  `Ref<HTMLDialogElement>` the shell keeps, matching `MoreSheet`'s contract.

**Context an implementer needs.** The search icon in `AppShell`'s `Strip`
(`components/AppShell.tsx:148-154`) is a `Link` to `/browse`. Browse is a
release calendar ordered by date — it cannot answer "where is *Sinners*". The
overlay is a native `<dialog>` opened with `showModal()`, exactly as `MoreSheet`
is (D75): the focus trap, `Escape`, the `inert` background and the backdrop are
the platform's job, and this is the second consumer of that pattern rather than
a second implementation of it.

`FilmSearch` already debounces, aborts in-flight requests, moves with arrows and
selects with Enter, and never drops focus. It is not modified.

Navigation target: `/films/[tmdbId]`. A result with no `tmdbId` (a local row the
app ingested before TMDB ids were captured) cannot be linked and is rendered
disabled with "Not on TMDB" rather than hidden — hiding it makes the search look
broken to the one person who knows the film is in the app.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const findFilms = vi.hoisted(() => vi.fn());
vi.mock('@/actions/search/find-films', () => ({ findFilms }));

import { SearchOverlay } from './SearchOverlay';

const RESULT = {
  ok: true as const,
  data: [
    { id: 1, tmdbId: '550', title: 'Fight Club', year: 1999, posterUrl: null, isTaken: false, isLocal: true },
  ],
};

describe('SearchOverlay', () => {
  it('searches films and navigates to the one chosen', async () => {
    findFilms.mockResolvedValue(RESULT);
    const user = userEvent.setup();
    render(<SearchOverlay id="search" open />);

    await user.type(screen.getByRole('combobox', { name: /find a film/i }), 'fight');
    await waitFor(() => expect(screen.getByText(/Fight Club/)).toBeInTheDocument());

    await user.click(screen.getByText(/Fight Club/));
    expect(push).toHaveBeenCalledWith('/films/550');
  });

  it('reports a failed search rather than rendering an empty grid', async () => {
    findFilms.mockResolvedValue({ ok: false, message: 'search is unavailable' });
    const user = userEvent.setup();
    render(<SearchOverlay id="search" open />);

    await user.type(screen.getByRole('combobox', { name: /find a film/i }), 'fight');
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/search is unavailable/i),
    );
  });

  it('offers no link for a film TMDB does not know', async () => {
    findFilms.mockResolvedValue({
      ok: true,
      data: [{ id: 7, tmdbId: null, title: 'Local Only', year: 2001, posterUrl: null, isTaken: false, isLocal: true }],
    });
    const user = userEvent.setup();
    render(<SearchOverlay id="search" open />);

    await user.type(screen.getByRole('combobox', { name: /find a film/i }), 'local');
    await waitFor(() => expect(screen.getByText('Not on TMDB')).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run components/SearchOverlay.test.tsx`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write `SearchOverlay`**

A `'use client'` component. Shape:

```tsx
export function SearchOverlay({
  id,
  ref,
  open = false,
}: {
  id: string;
  ref?: Ref<HTMLDialogElement>;
  /** Test/story only: renders the dialog open without `showModal()`, which jsdom does not implement. */
  open?: boolean;
}) {
```

- The `<dialog>` carries `aria-label="Search films"`, `backdrop:bg-black/60
  backdrop:backdrop-blur-sm`, and is top-aligned with `max-w-3xl` so the panel
  reads as a search bar dropping from the chrome, not a centred modal.
- `FilmSearch` at the top with `autoFocus`, `label="Find a film"`,
  `placeholder="Part of the title is enough"`, and
  `onSearch={(query, signal) => …}` calling `findFilms({ query, context: { kind: 'browse' } })`.
  Abort handling: return `[]` when `signal.aborted` after the await.
- Results: the first **9** as a three-column grid (one column below `sm`), each
  a `PosterFrame` beside title and year. Selecting pushes `/films/${tmdbId}` and
  closes the dialog.
- Failure renders a `role="status"` line carrying the action's message. Empty
  results after a settled search render "Nothing matched that."
- No result count, no "Search" submit button: there is no results page to go to,
  and a button that does what Enter already did is a second way to be wrong.

- [ ] **Step 4: Run the test**

Run: `npx vitest run components/SearchOverlay.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire it into the shell**

In `components/AppShell.tsx`: add `searchId = useId()` and a
`search = useRef<HTMLDialogElement>(null)`, mount `<SearchOverlay id={searchId} ref={search} />`
beside `MoreSheet`, and replace the `Strip`'s search `Link` with a `button`
carrying `aria-haspopup="dialog"`, `aria-controls={searchId}` and the same icon
and `sr-only` label. Pass an `onSearch` callback down to `Strip` and to
`MoreSheet` (add a Search row above "Yours").

Add the keyboard opener, in the same effect style as the existing close-on-navigate:

```tsx
  // `/` and ⌘K, the two shortcuts every reader already tries. Ignored while a
  // field has focus, or `/` would be swallowed mid-title on every form in the app.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
      const isSlash = event.key === '/' && !typing;
      const isCommandK = event.key === 'k' && (event.metaKey || event.ctrlKey);
      if (!isSlash && !isCommandK) return;
      event.preventDefault();
      search.current?.showModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
```

Also close the overlay on navigation, next to the sheet's existing effect.

- [ ] **Step 6: Update the shell's tests**

`components/AppShell.test.tsx` asserts the search control is a link to
`/browse`. Rewrite that assertion: the control is a button with
`aria-haspopup="dialog"`, and `/browse` is no longer its destination.

- [ ] **Step 7: Story, then a browser**

`components/SearchOverlay.stories.tsx` with `open` and a mocked `findFilms`.
Then `npm run dev`: press `/`, type three letters, confirm posters appear,
Enter opens the film, Escape closes and focus returns to the icon.

- [ ] **Step 8: Commit**

```bash
npm run lint && npm run typecheck && npx vitest run components/
git add components/SearchOverlay.tsx components/SearchOverlay.test.tsx components/SearchOverlay.stories.tsx components/AppShell.tsx components/AppShell.test.tsx components/MoreSheet.tsx
git commit -m "P15.T3: search opens a panel instead of the release calendar"
```

---

## Task 4: Clerk — an unknown email becomes an account

**Files:**
- Modify: `app/auth/login/[[...login]]/page.tsx`
- Modify: `app/providers.tsx` (one localization string)
- Create: `docs/reference/clerk-instance-settings.md`
- Test: manual, recorded in the doc

**Interfaces:** none — no exported shape changes.

**Context an implementer needs.** The owner's screenshot: a pre-migration member
enters their address on `/auth/login` and gets "Couldn't find your account", with
no route forward except noticing Clerk's own Register link in the card's footer.

**The account data is not the problem.** `lib/auth.ts` → `syncClerkIdentity`
links a new Clerk identity to the existing row by **verified email**, so
registering with the same address carries a member's leagues, drafts and points
across. Nothing about that needs changing, and this task must not touch it.

The problem is that Clerk's `<SignIn>` will not create an identity for an
address it does not know — and *every* member is unknown to Clerk until their
first login. The fix is Clerk's **combined sign-in-or-up flow**, an instance
setting that makes `<SignIn>` continue into registration for an unrecognised
address instead of erroring.

🔴 **The setting is applied by the owner, not by this code.** Write the steps
down; do not attempt to change instance configuration from the repo.

- [ ] **Step 1: Write the instance-settings reference**

Create `docs/reference/clerk-instance-settings.md` recording, for both the
Development instance (now) and Production (at P13.T1):

- Where the combined sign-in-or-up flow is enabled in the Clerk dashboard, and
  what it changes for a member who types an unknown address.
- That the email-code strategy stays the only factor (D26) — no password.
- That `Development mode` on the card is a `pk_test_` artefact and disappears
  with the P13.T1 key swap, so it is not re-reported as a defect.
- That the webhook endpoint and signing secret are per-instance and must be
  recreated for Production.

- [ ] **Step 2: Rewrite the login copy**

The current paragraph tells a returning member to "Register instead" — advice
they read *before* the error and forget by the time they hit it. With the
combined flow the advice is no longer needed at all; the page states what will
happen:

```tsx
      <p className="text-text-secondary text-sm leading-relaxed">
        We email you a code — there is no password. If this is your first time
        back since the redesign, entering your usual address is enough: your
        leagues, drafts and points are waiting on it and will follow you in.
      </p>
```

- [ ] **Step 3: Ask the owner to enable the setting, then verify**

With the setting on, run `npm run dev` and, in a private window:

1. Enter an address with **no** Clerk identity and no app account. Expected: the
   card continues to registration, not "Couldn't find your account".
2. Enter the address of a **pre-migration member** (one with a `users` row and a
   null `clerk_id`). Expected: registration completes, and the dashboard shows
   that member's leagues — proving the relink, which is the whole point.
3. Enter the address of an **already-linked** member. Expected: ordinary log in.

Record the three results in the reference doc. If (2) fails, stop: that is a
`syncClerkIdentity` defect, not a copy defect, and it is a cutover blocker.

- [ ] **Step 4: Commit**

```bash
npm run lint && npm run typecheck
git add "app/auth/login/[[...login]]/page.tsx" app/providers.tsx docs/reference/clerk-instance-settings.md
git commit -m "P15.T4: an unknown email can become an account"
```

---

## Task 5: The brand mark

**Files:**
- Create: `app/icon.svg`, `app/apple-icon.png`, `app/favicon.ico`
- Create: `components/Wordmark.tsx` (mark + wordmark lockup), `components/Wordmark.stories.tsx`
- Modify: `components/NavRail.tsx` (use the lockup)
- Modify: `docs/DECISIONS.md` (fill in D83, remove the "Logo mark" open item)

**Interfaces:**
- Produces: `Wordmark({ size, markOnly, className })` where `size` is
  `'sm' | 'md'`. Consumed by `NavRail` and by T6's OG images.

**Context an implementer needs.** `public/` is empty: no favicon, no icon, no OG
image. `DECISIONS.md` records the mark as still open — three directions were
tried during the design-system phase (frame + pick seal, letterbox bars,
sprocket strip) and all three rendered poorly. The MUI template's pinwheel is
not ours and must not carry over.

Constraints for the three options: built from what already exists — Instrument
Serif, the carmine accent, the panel/rule geometry — legible at 16px, works on
an unknown browser-chrome ground in both schemes, and is a single flat SVG path
set with no gradients or raster.

- [ ] **Step 1: Draw three options and publish them**

Build one HTML page showing each mark at 16px, 32px, 180px and beside the
wordmark, in both schemes, on light and dark grounds. Publish it as an artifact
and give the owner the link. **Stop here until the owner picks one.**

- [ ] **Step 2: Add the chosen mark as Next's icon conventions**

`app/icon.svg` (the mark alone, square, `viewBox="0 0 32 32"`),
`app/apple-icon.png` (180×180, exported from the same SVG, on the app's dark
ground because iOS does not composite transparency), and `app/favicon.ico`
(16/32/48). Next serves all three from the route conventions — no `<link>` tags
and no `public/` entries.

- [ ] **Step 3: Build the lockup and put it in the rail**

`components/Wordmark.tsx` renders the inline SVG mark beside "Cinemadraft" in
Instrument Serif, with `role="img"` and `aria-label="Cinemadraft"` on the group
so a screen reader reads the name once rather than the letters plus an unnamed
graphic. Replace the rail's current text-only wordmark with it.

- [ ] **Step 4: Record D83**

Fill in the reserved D83 row with the chosen direction and why, and delete the
"Logo mark" entry from **Still open**.

- [ ] **Step 5: Verify the icons actually resolve**

```bash
npm run build && npm run start
curl -sI http://localhost:3000/icon.svg | head -1
curl -sI http://localhost:3000/apple-icon.png | head -1
curl -sI http://localhost:3000/favicon.ico | head -1
```

Expected: three `HTTP/1.1 200 OK`. Then open the site and confirm the tab icon
renders in both light and dark browser chrome.

- [ ] **Step 6: Commit**

```bash
npm run lint && npm run typecheck && npx vitest run components/
git add app/icon.svg app/apple-icon.png app/favicon.ico components/Wordmark.tsx components/Wordmark.stories.tsx components/NavRail.tsx docs/DECISIONS.md
git commit -m "P15.T5: the app has a mark"
```

---

## Task 6: SEO and metadata

**Files:**
- Create: `lib/seo.ts`, `lib/seo.test.ts`
- Create: `app/robots.ts`, `app/sitemap.ts`, `app/sitemap.test.ts`
- Create: `app/(app)/films/[tmdbId]/opengraph-image.tsx`
- Create: `app/(app)/award-shows/[abbr]/opengraph-image.tsx`
- Create: `app/opengraph-image.tsx` (the sitewide fallback)
- Modify: `app/layout.tsx`, `app/(app)/browse/page.tsx`, `app/(app)/page.tsx`,
  `app/(app)/films/[tmdbId]/page.tsx`, `app/(app)/award-shows/[abbr]/page.tsx`,
  `app/(app)/leagues/[id]/page.tsx`, `app/auth/*/page.tsx`

**Interfaces:**
- Produces, from `lib/seo.ts`:

```ts
/** The origin every canonical and OG URL is resolved against. */
export const SITE_URL: URL;
/** `Sinners (2025) · Cinemadraft` — the template Next applies to page titles. */
export const TITLE_TEMPLATE: string;
/** Absolute canonical for a path, e.g. canonical('/films/550'). */
export function canonical(path: string): string;
/** `robots: { index: false, follow: false }`, for session-scoped pages. */
export const NOINDEX: Metadata['robots'];
```

**Context an implementer needs.** Today the root layout exports two lines of
metadata, two routes have `generateMetadata`, and there is no canonical, robots
file, sitemap or OG image anywhere. The public routes are already settled by
D44 and enumerated in `proxy.ts`'s `isPublic` — that list is the source of truth
for what may appear in the sitemap, and nothing outside it may.

`SITE_URL` reads `NEXT_PUBLIC_SITE_URL`, falling back to
`https://cinemadraft.com`. It must not read `VERCEL_URL`: preview deployments
would then publish canonicals pointing at themselves.

- [ ] **Step 1: Write the failing tests**

`lib/seo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { canonical, SITE_URL } from './seo';

describe('canonical', () => {
  it('resolves a path against the site origin', () => {
    expect(canonical('/films/550')).toBe(`${SITE_URL.origin}/films/550`);
  });

  it('drops query strings, so ?year= and ?page= do not compete with the page', () => {
    expect(canonical('/browse?when=future&page=3')).toBe(`${SITE_URL.origin}/browse`);
  });

  it('never returns a preview origin', () => {
    // VERCEL_URL is per-deployment; a canonical pointing at it would tell a
    // crawler the preview is the real page.
    expect(canonical('/')).not.toContain('vercel.app');
  });
});
```

`app/sitemap.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import sitemap from './sitemap';

describe('sitemap', () => {
  it('lists only routes that are public by D44', async () => {
    const entries = await sitemap();
    const paths = entries.map((entry) => new URL(entry.url).pathname);

    expect(paths).toContain('/');
    expect(paths).toContain('/browse');
    expect(paths).toContain('/award-shows');
    // Session-scoped pages must never appear: /leagues (the index), /list,
    // /watchlist, /admin, /members/*.
    expect(paths.some((path) => path.startsWith('/admin'))).toBe(false);
    expect(paths).not.toContain('/leagues');
    expect(paths).not.toContain('/watchlist');
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run lib/seo.test.ts app/sitemap.test.ts`
Expected: FAIL — neither module exists.

- [ ] **Step 3: Write `lib/seo.ts`**

```ts
import type { Metadata } from 'next';

/**
 * 🔴 Not `VERCEL_URL`. That variable is per-deployment, so every preview would
 * publish canonicals and OG URLs pointing at itself — which tells a crawler the
 * preview is the real page, and puts preview URLs in shared link previews.
 */
export const SITE_URL = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cinemadraft.com',
);

export const TITLE_TEMPLATE = '%s · Cinemadraft';

/**
 * The absolute canonical for a path.
 *
 * Query strings are dropped deliberately: `?year=` and `?page=` are the same
 * document seen from a different angle, and letting each variant claim its own
 * canonical splits the page's standing across dozens of near-duplicates.
 */
export function canonical(path: string): string {
  return new URL(path.split('?')[0] ?? '/', SITE_URL).toString();
}

/** For anything a stranger should not be shown in a search result. */
export const NOINDEX: Metadata['robots'] = { index: false, follow: false };
```

- [ ] **Step 4: Root layout metadata**

```ts
export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: { default: 'Cinemadraft', template: TITLE_TEMPLATE },
  description:
    'Draft a team of films before awards season and score points as they pick up nominations and wins.',
  alternates: { canonical: canonical('/') },
  openGraph: {
    siteName: 'Cinemadraft',
    type: 'website',
    locale: 'en_US',
  },
  twitter: { card: 'summary_large_image' },
};
```

- [ ] **Step 5: `robots.ts` and `sitemap.ts`**

`robots.ts` allows everything except the session-scoped segments, and names the
sitemap:

```ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Not a security boundary — the proxy is (D44). This keeps crawl budget
      // off pages that answer a redirect to sign-in anyway.
      disallow: ['/admin', '/leagues', '/list', '/watchlist', '/members', '/auth'],
    },
    sitemap: canonical('/sitemap.xml'),
  };
}
```

`sitemap.ts` lists `/`, `/browse`, `/rules-and-scoring`, `/award-shows`, every
show's `/award-shows/[abbr]`, and the films the app actually holds locally
(`movieRepository`, capped at 5000 and ordered by id) — not every TMDB id, which
would be an invented catalogue.

- [ ] **Step 6: Per-route metadata**

- `/films/[tmdbId]` — already has `generateMetadata`; add
  `alternates: { canonical: canonical(`/films/${id}`) }`.
- `/award-shows/[abbr]` — add `generateMetadata` returning the show's name,
  a description naming the season, and its canonical.
- `/leagues/[id]` — the league's name as title, plus `robots: NOINDEX`: it is
  public by D44/D45 so a shared link opens, but it should not be *indexed*.
- `/browse` — keep its title, add the canonical (query-free, per Step 3).
- `/auth/login`, `/auth/register`, `/watchlist`, `/list`, `/admin`, `/members/[uuid]`
  — `robots: NOINDEX`.

- [ ] **Step 7: OG images**

Three `opengraph-image.tsx` files using `next/og`'s `ImageResponse` at
1200×630, on the app's own ground, carrying the mark from T5:

- Film: poster on the left, title and year in Instrument Serif on the right.
- Award show: the show's Blob-hosted logo, its name, and the season year.
- Sitewide fallback: mark, wordmark, and the app's one-line description.

Each exports `size`, `contentType`, and `alt`. Fonts are fetched from the local
`theme/fonts` files at build time — `ImageResponse` cannot use CSS variables.

- [ ] **Step 8: Run the tests and prove the routes serve**

```bash
npx vitest run lib/seo.test.ts app/sitemap.test.ts
npm run build && npm run start
curl -s http://localhost:3000/robots.txt
curl -s http://localhost:3000/sitemap.xml | head -20
curl -sI "http://localhost:3000/films/550/opengraph-image" | head -1
```

Expected: tests PASS; `robots.txt` names the sitemap; the sitemap lists only
public paths; the OG route answers 200 with `content-type: image/png`.

- [ ] **Step 9: Commit**

```bash
npm run lint && npm run typecheck
git add lib/seo.ts lib/seo.test.ts app/robots.ts app/sitemap.ts app/sitemap.test.ts app/layout.tsx "app/(app)" app/auth app/opengraph-image.tsx
git commit -m "P15.T6: metadata, canonicals, robots, sitemap and OG cards"
```

---

## Task 7: `/browse` appends as you scroll

**Files:**
- Create: `actions/browse/load-page.ts`, `actions/browse/load-page.test.ts`
- Create: `components/BrowseList.tsx`, `components/BrowseList.test.tsx`, `components/BrowseList.stories.tsx`
- Modify: `app/(app)/browse/page.tsx` (render `BrowseList`, drop the "Show more" link)
- Modify: `e2e/browse.spec.ts` (its assertions name the link)

**Interfaces:**
- Produces, from `actions/browse/load-page.ts`:

```ts
export async function loadBrowsePage(input: {
  when: 'past' | 'future';
  page: number;
}): Promise<ActionResult<{ page: number; pageCount: number; months: BrowseMonth[] }>>;
```

  It resolves the viewer's own id itself — the watched marks are per reader and
  must not be a parameter, or one reader could ask for another's.
- Produces, from `components/BrowseList.tsx`:
  `BrowseList({ when, initial, isSignedIn })` where `initial` is the first
  page's `{ page, pageCount, months }`.

**Context an implementer needs.** D80 amends D65. D65 replaced the source's
intersection observer with `?page=` links and bought four properties: a linkable
page, a working Back button, keyboard reachability, and crawlability. The owner
was shown that list and chose auto-append anyway — browse is grazed by
scrolling, and a button every twenty films is the wrong friction on the one page
whose job is grazing. Three of the four are genuinely traded away.

**The fourth is kept for nothing:** a `<noscript>` link to the next page, so
T6's sitemap still has a crawl path into the catalogue. Do not drop it.

Two failure modes the source had and this must not repeat:

- **The sentinel re-firing on every re-render.** Observe the sentinel once, in
  an effect keyed on nothing, and guard the fetch with a ref, not with state.
- **Appending past the end.** Stop at `pageCount`, and unobserve the sentinel
  when there is no next page — otherwise every scroll to the bottom fires a
  request that returns nothing.

- [ ] **Step 1: Write the failing action test**

`actions/browse/load-page.test.ts`, following the shape of the other action
tests (mock `lib/services/browse` and `lib/auth`):

```ts
  it('returns the requested page', async () => {
    loadBrowse.mockResolvedValue({ when: 'past', page: 2, pageCount: 9, months: [] });
    const result = await loadBrowsePage({ when: 'past', page: 2 });

    expect(result.ok).toBe(true);
    expect(result.ok && result.data.page).toBe(2);
  });

  it('resolves the reader itself rather than taking a user id', async () => {
    // A userId parameter would let any caller ask for another reader's
    // watched marks. The action reads the session and nothing else.
    currentUser.mockResolvedValue({ id: 42 });
    await loadBrowsePage({ when: 'past', page: 2 });

    expect(loadBrowse).toHaveBeenCalledWith({ when: 'past', page: 2, userId: 42 });
  });

  it('rejects a page number that is not a positive integer', async () => {
    const result = await loadBrowsePage({ when: 'past', page: -3 });
    expect(result.ok).toBe(false);
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run actions/browse/load-page.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the action**

`'use server'`, a zod input of `{ when: z.enum(['past','future']), page: z.int().positive().max(500) }`,
`getCurrentUser()` for the id, `loadBrowse(...)`, wrapped in the same
`ok`/`toActionResult` pattern as `actions/search/find-films.ts`. Ungated like
that one, and for the same reason: browse is public (D44).

- [ ] **Step 4: Write the failing list test**

```tsx
  it('appends the next page when the sentinel is seen', async () => {
    loadBrowsePage.mockResolvedValue({ ok: true, data: { page: 2, pageCount: 3, months: [monthOf('09/2026', 'Second')] } });
    render(<BrowseList when="past" initial={{ page: 1, pageCount: 3, months: [monthOf('10/2026', 'First')] }} isSignedIn={false} />);

    intersect(); // the test's IntersectionObserver stub fires the callback
    await waitFor(() => expect(screen.getByText('Second')).toBeInTheDocument());
    expect(screen.getByText('First')).toBeInTheDocument();
  });

  it('never asks twice for the same page', async () => {
    loadBrowsePage.mockResolvedValue({ ok: true, data: { page: 2, pageCount: 3, months: [] } });
    render(<BrowseList when="past" initial={{ page: 1, pageCount: 3, months: [] }} isSignedIn={false} />);

    intersect();
    intersect();
    await waitFor(() => expect(loadBrowsePage).toHaveBeenCalledTimes(1));
  });

  it('stops at the last page', async () => {
    render(<BrowseList when="past" initial={{ page: 3, pageCount: 3, months: [] }} isSignedIn={false} />);

    intersect();
    expect(loadBrowsePage).not.toHaveBeenCalled();
    expect(screen.queryByTestId('browse-sentinel')).toBeNull();
  });

  it('offers a retry when a page fails, rather than silently ending the list', async () => {
    loadBrowsePage.mockResolvedValue({ ok: false, message: 'the catalogue could not be reached' });
    render(<BrowseList when="past" initial={{ page: 1, pageCount: 3, months: [] }} isSignedIn={false} />);

    intersect();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument(),
    );
  });
```

- [ ] **Step 5: Write `BrowseList`**

`'use client'`. State: `months`, `page`, `pageCount`, `error`. A `loading` ref
guards concurrency. One effect observes the sentinel; the sentinel renders only
while `page < pageCount`. On success, append the new months **merged by label**
— two pages routinely carry films from the same month, and pushing a second
"October 2026" section is the visible bug that shape invites.

```tsx
/** Merge a fetched page into the list, folding films into a month already shown. */
function merge(current: BrowseMonthData[], incoming: BrowseMonthData[]): BrowseMonthData[] {
  const byLabel = new Map(current.map((month) => [month.label, month]));
  for (const month of incoming) {
    const existing = byLabel.get(month.label);
    if (existing) existing.films = [...existing.films, ...month.films];
    else byLabel.set(month.label, month);
  }
  return [...byLabel.values()];
}
```

An `aria-live="polite"` line announces "Loading more films" / "N more films
added", so a screen-reader reader is told the page grew under them — the single
biggest a11y cost of infinite scroll.

- [ ] **Step 6: Rewrite the page**

`app/(app)/browse/page.tsx` keeps its server-side first page and its
past/future nav, renders `<BrowseList when={when} initial={shelf} isSignedIn={…} />`,
and replaces the "Show more" nav with:

```tsx
        {/* 🔴 The crawl path D80 kept. Readers never see it — it exists so the
            sitemap in P15.T6 has a way into pages 2..N, which the intersection
            sentinel does not provide to anything without JavaScript. */}
        {hasMore ? (
          <noscript>
            <a href={`/browse?when=${when}&page=${shelf.page + 1}`}>
              More films, page {shelf.page + 1} of {shelf.pageCount}
            </a>
          </noscript>
        ) : null}
```

Keep `?page=` working as an entry point: a crawler or a shared link landing on
page 3 gets page 3 first and appends 4, 5, … from there.

- [ ] **Step 7: Update the e2e spec**

`e2e/browse.spec.ts` asserts on the "Show more" link. Replace with: scroll to
the bottom, wait for the film count to grow, and assert no duplicate month
heading appears.

- [ ] **Step 8: Run everything and check the browser**

```bash
npx vitest run actions/browse components/BrowseList.test.tsx
npm run dev  # scroll /browse to the bottom, twice
```

- [ ] **Step 9: Commit**

```bash
npm run lint && npm run typecheck
git add actions/browse components/BrowseList.tsx components/BrowseList.test.tsx components/BrowseList.stories.tsx "app/(app)/browse/page.tsx" e2e/browse.spec.ts
git commit -m "P15.T7: browse appends as you scroll"
```

---

## Task 8: `/browse` gets a header photo

**Files:**
- Modify: `app/(app)/browse/page.tsx`
- Modify: `lib/services/browse.ts` (expose a backdrop for the page)
- Modify: `lib/external/tmdb-discover.ts` (`backdrop_path` on the DTO)
- Test: `lib/services/browse.test.ts`

**Interfaces:**
- `DiscoveredFilm` gains `backdropPath: string | null`.
- `BrowsePage` gains `hero: { backdropUrl: string; title: string } | null`.

**Context an implementer needs.** `/browse` is a heading over a grid and reads
as an unfinished page. The backdrop is already in the discover response — it is
dropped in `toFilm` today — so this is a field, not a new request.

The hero is `null` when the first page has no film with a backdrop, and the page
renders its plain heading in that case. Reserve the aspect ratio so the band
cannot shift the grid as the image arrives (CLS).

- [ ] **Step 1: Write the failing service test**

```ts
  it('offers the first backdrop it finds as the hero', async () => {
    const shelf = await loadBrowse({ when: 'past', page: 1, userId: null });
    expect(shelf.hero?.backdropUrl).toContain('/w1280/');
  });

  it('has no hero on later pages', async () => {
    // The band belongs at the top of the page, and page 3 is the middle of a
    // scroll — a second hero appearing mid-list is the bug this prevents.
    const shelf = await loadBrowse({ when: 'past', page: 3, userId: null });
    expect(shelf.hero).toBeNull();
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/services/browse.test.ts`
Expected: FAIL — `hero` is not on the returned shape.

- [ ] **Step 3: Carry the backdrop through**

In `tmdb-discover.ts`, add `backdrop_path?: string | null` to
`TmdbDiscoverResult` and `backdropPath: string | null` to `DiscoveredFilm`,
populated in `toFilm`. Do **not** make a missing backdrop a reason to drop a
film — posterlessness is; a missing backdrop is not.

In `browse.ts`, when `input.page === 1`, take the first film with a
`backdropPath` and build `hero` with `posterUrl(path, 'w1280')`; otherwise
`null`.

- [ ] **Step 4: Render the band**

Above the `SectionHead` in `app/(app)/browse/page.tsx`:

```tsx
        {shelf.hero ? (
          <div className="relative -mx-4 aspect-[21/9] overflow-hidden sm:aspect-[3/1] xl:-mx-6">
            <RemoteImage
              src={shelf.hero.backdropUrl}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            {/* The scrim is what makes the heading legible over an unknown
                image — the backdrop changes daily, so no fixed text colour can
                be trusted against it. */}
            <div className="from-bg-surface absolute inset-0 bg-gradient-to-t via-transparent" />
          </div>
        ) : null}
```

`alt=""` is deliberate: the band is decoration, the heading beneath it is the
content, and describing "a still from whichever film TMDB ranked first today"
tells a screen-reader reader nothing.

- [ ] **Step 5: Run the tests, check both schemes at 390px and 1440px**

- [ ] **Step 6: Commit**

```bash
npm run lint && npm run typecheck && npx vitest run lib/
git add lib/external/tmdb-discover.ts lib/services/browse.ts lib/services/browse.test.ts "app/(app)/browse/page.tsx"
git commit -m "P15.T8: browse gets a header photo"
```

---

## Task 9: "The future" stops returning films from 2006 — and stops returning junk

**Files:**
- Modify: `lib/external/tmdb-discover.ts`
- Test: `lib/external/tmdb-discover.test.ts`
- Create: `fixtures/tmdb/discover-future-rerelease.json` — **generated, not
  hand-written**: capture a real response into `.local/` and run
  `node scripts/scrub-fixtures.mjs`

**Interfaces:** none — `discoverFilms`'s signature is unchanged.

**Context an implementer needs.** `https://next.cinemadraft.com/browse?when=future&page=3`
shows a 2006 film. The future query sends `release_date.gte=today` alongside
`with_release_type=3`, and TMDB matches **any** theatrical release of a film,
including a re-release. A 2006 title with a 2026 re-issue therefore passes the
filter, while the `release_date` field the card renders is its *primary* release
— 2006. The sort has the same fault: `sort_by=release_date.asc` orders by a
different date than the one displayed.

Fix both together, and add a defensive drop: TMDB's date semantics have moved
before, and a film dated in the past has no business on a page titled "The
future" whatever the API says.

Do not touch the past side's `release_date.lte`. It is correct, and its vote
floors are load-bearing (see the file's own comment).

**The same task tunes the query's quality floors**, because it is already
rewriting this function and adding a fixture test for it. The owner's report:
"The future" surfaces micro-budget titles with no chance of a release anybody
will see. Measured against the current query, four things are wrong and one
tempting fix is a trap.

1. **The future side has no quality floor at all.** That is deliberate for
   *votes* — an unreleased film has none, and `vote_count.gte` would return an
   empty page — but `POPULARITY_FLOOR = 10` is doing all the work alone and it
   is very low. A micro-budget title nobody will distribute sits around 5–15; a
   real upcoming theatrical release runs 50–500. The floor becomes **per side**:
   10 looking back, 25 looking forward.
2. **`with_runtime.gte=40`**, both sides. Server-side, costs nothing, and
   removes shorts and catalogue filler outright — a real slice of the long tail.
3. **Filters belong in the query, not in `toFilm`.** 🔴 This is the one the
   owner tried before and could not place. Today the posterless and unpopular
   drops happen *after* TMDB has paginated, so a page of 20 can render six films
   while the counter still says `3/500` — and with T7's auto-append, a page that
   yields six films makes the sentinel fire again immediately, so the reader
   scrolls through mostly-empty pages. TMDB has **no `popularity.gte`**, which
   is why that one drop has to stay client-side; runtime and the vote floors are
   server-side and move up. Every filter moved up makes pages fuller and the
   count honest.
4. **`with_release_type=2|3`** (limited *and* wide theatrical) rather than `3`
   alone. This *widens* rather than filters, and it is the awards-relevant fix:
   contenders routinely open in a qualifying limited run, and a type-3-only
   query misses or mis-dates them.

🔴 **Do not add `with_original_language=en`.** It would end the tiny-obscure-film
problem in one line and also end *Parasite*, *Drive My Car* and *All Quiet on
the Western Front* — on an awards product that is the wrong trade. Same
objection, weaker, to `without_genres=99`: documentaries get nominated.

**Left as a watch item, not done here:** raising the past side's
`vote_count.gte` from 200 to ~400. It would sharpen "films anybody has heard of"
and would also thin out genuinely good foreign-language releases. Record it
under **Open questions carried forward** rather than guessing.

- [ ] **Step 1: Write the failing test**

```ts
  it('asks TMDB for primary release dates on the future side', async () => {
    await discoverFilms({ when: 'future', page: 1 });
    const params = tmdbFetch.mock.calls[0]?.[1];

    expect(params).toMatchObject({
      'primary_release_date.gte': expect.any(String),
      sort_by: 'primary_release_date.asc',
    });
    // The old parameters matched re-releases of old films — the 2006 film on
    // page 3 of "The future".
    expect(params).not.toHaveProperty('release_date.gte');
    expect(params.sort_by).not.toBe('release_date.asc');
  });

  it('drops a film whose primary release is in the past, whatever TMDB says', async () => {
    tmdbFetch.mockResolvedValue(rereleaseFixture); // holds one 2006 title and one 2026 title
    const page = await discoverFilms({ when: 'future', page: 1 });

    expect(page.films.map((film) => film.releaseDate?.getUTCFullYear())).toEqual([2026]);
  });

  it("leaves the past side's date window and vote floors alone", async () => {
    await discoverFilms({ when: 'past', page: 1 });
    const params = tmdbFetch.mock.calls[0]?.[1];

    expect(params).toMatchObject({
      'release_date.lte': expect.any(String),
      'vote_count.gte': '200',
      sort_by: 'release_date.desc',
    });
  });

  it('asks TMDB to exclude shorts, on both sides', async () => {
    for (const when of ['past', 'future'] as const) {
      tmdbFetch.mockClear();
      await discoverFilms({ when, page: 1 });
      expect(tmdbFetch.mock.calls[0]?.[1]).toMatchObject({ 'with_runtime.gte': '40' });
    }
  });

  it('includes limited theatrical releases, not only wide ones', async () => {
    // Awards contenders routinely open in a qualifying limited run. `3` alone
    // misses or mis-dates them.
    await discoverFilms({ when: 'future', page: 1 });
    expect(tmdbFetch.mock.calls[0]?.[1]).toMatchObject({ with_release_type: '2|3' });
  });

  it('holds unreleased films to a higher popularity floor than released ones', async () => {
    // 25 forward, 10 back. An unreleased film cannot have votes, so popularity
    // is the only quality signal the future side has — and TMDB offers no
    // `popularity.gte`, which is why this one filter stays client-side.
    tmdbFetch.mockResolvedValue(pageOf([{ popularity: 18, release_date: '2027-01-01' }]));
    const future = await discoverFilms({ when: 'future', page: 1 });
    expect(future.films).toHaveLength(0);

    tmdbFetch.mockResolvedValue(pageOf([{ popularity: 18, release_date: '2001-01-01' }]));
    const past = await discoverFilms({ when: 'past', page: 1 });
    expect(past.films).toHaveLength(1);
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/external/tmdb-discover.test.ts`
Expected: FAIL — the future branch still sends `release_date.gte`.

- [ ] **Step 3: Fix the query and add the guard**

```ts
    sort_by: input.when === 'past' ? 'release_date.desc' : 'primary_release_date.asc',
    ...(input.when === 'past'
      ? {
          'release_date.lte': day,
          'vote_average.gte': VOTE_AVERAGE_FLOOR,
          'vote_count.gte': VOTE_COUNT_FLOOR,
        }
      : {
          // 🔴 `primary_release_date`, not `release_date`. With
          // `with_release_type=3`, `release_date.gte` matches *any* theatrical
          // release — including a re-release — so a 2006 film with a 2026
          // re-issue landed on "The future" while the card rendered its 2006
          // primary date. The sort had the same fault: it ordered by a
          // different date than the one displayed.
          'primary_release_date.gte': day,
        }),
```

and, in the mapping, after `toFilm`:

```ts
    films: results.flatMap((result) => {
      const film = toFilm(result);
      if (!film) return [];
      // Defensive, and cheap. TMDB's date semantics have moved before, and a
      // film dated in the past has no business on a page titled "The future"
      // whatever the API returns. Undated films are kept: an announced title
      // with no date is exactly what that page is for.
      if (
        input.when === 'future' &&
        film.releaseDate != null &&
        film.releaseDate.toISOString().slice(0, 10) < day
      ) {
        return [];
      }
      return [film];
    }),
```

- [ ] **Step 3b: Move the floors into the query, and split the popularity floor**

Replace the two constants with a per-side pair, and add the two server-side
filters to the shared `params`:

```ts
const VOTE_AVERAGE_FLOOR = '4';
const VOTE_COUNT_FLOOR = '200';

/**
 * 🔴 Per side, and applied here rather than by TMDB — there is no
 * `popularity.gte` parameter, which is the whole reason this one filter is
 * still client-side while the rest moved into the query.
 *
 * Looking back, votes carry the quality signal and popularity only sweeps up
 * the unrated tail, so 10 is enough. Looking forward there are no votes at all
 * and this is the only signal there is: a micro-budget title nobody will
 * distribute sits around 5–15, a real upcoming theatrical release runs 50–500,
 * so the floor has to sit above the first band.
 */
const POPULARITY_FLOOR = { past: 10, future: 25 } as const;

/** Shorts and catalogue filler, excluded server-side rather than by hand. */
const RUNTIME_FLOOR = '40';
```

```ts
  const params: Record<string, string> = {
    language: 'en-US',
    region: 'US',
    // 🔴 `2|3`, not `3`. Limited *and* wide theatrical: awards contenders open
    // in a qualifying limited run, and a wide-only query misses or mis-dates
    // exactly the films this app exists to score.
    with_release_type: '2|3',
    'with_runtime.gte': RUNTIME_FLOOR,
    page: String(page),
    …
```

`toFilm` takes the side so it can apply the right floor:

```ts
function toFilm(result: TmdbDiscoverResult, when: BrowseWhen): DiscoveredFilm | null {
  …
  if ((result.popularity ?? 0) <= POPULARITY_FLOOR[when]) return null;
```

Update the cache key to include the new shape (`tmdb:discover:v2:…`), or the
first deploy answers every query from a cache built by the old one.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/external/tmdb-discover.test.ts`
Expected: PASS, all seven.

- [ ] **Step 5: Verify against the live API**

```bash
npm run dev
# then, in a browser: /browse?when=future&page=3
```

Expected: every film dated today or later, on pages 1, 3 and 8 — and no shorts,
no micro-budget titles nobody has heard of. Compare a page's rendered film count
against the `N/500` counter: it should now be close to 20, where before the
client-side drops routinely left six. Record the past-side `vote_count.gte`
question under **Open questions carried forward** in `docs/PROGRESS.md`.

- [ ] **Step 6: Commit**

```bash
npm run lint && npm run typecheck && npx vitest run lib/external
git add lib/external/tmdb-discover.ts lib/external/tmdb-discover.test.ts fixtures/
git commit -m "P15.T9: the future stops returning re-releases, shorts and unknowns"
```

---

## Task 10: 🔴 Test-only auth, and an app that boots without Clerk

> **This is the phase's one security-bearing task.** It ends with a reviewer
> pass before anything else in Phase 15 is merged on top of it.

**Files:**
- Create: `lib/test-auth.ts`, `lib/test-auth.test.ts`
- Create: `e2e/support/session.ts`
- Modify: `lib/auth.ts` (the test branch), `app/providers.tsx`, `proxy.ts`,
  `components/AppShell.tsx`, `components/MoreSheet.tsx` (the account control)
- Modify: `app/(app)/browse/page.tsx`, `app/(app)/films/[tmdbId]/page.tsx`,
  `app/(app)/join/[uuid]/page.tsx` (three direct `auth()` calls)
- Modify: `.github/workflows/ci.yml`, `playwright.config.mts`, `docs/DECISIONS.md`

**Interfaces:**
- Produces, from `lib/test-auth.ts`:

```ts
/** True only when the test session is both requested and permitted. */
export function isTestAuthEnabled(): boolean;
/** `42.1756089600000.<hmac>` — what the Playwright helper writes into the cookie. */
export function signTestSession(userId: number, now?: number): string;
/** The user id carried by the request's test cookie, or null. */
export function testSessionUserId(): Promise<number | null>;
export const TEST_SESSION_COOKIE = '__cinemadraft_test_session';
```

**Context an implementer needs.** D43 kept Playwright a local gate: the owner
declined to store Clerk keys in GitHub, and the app cannot render without them —
`ClerkProvider` needs a publishable key and the proxy needs a secret key. D82 and
D84 remove that premise. Under the test flag the app boots with **no Clerk at
all**, so CI needs no secret and the owner's objection is satisfied rather than
overruled.

🔴 **The guard cannot be `NODE_ENV`.** Playwright's `webServer` runs
`npm run build && npm run start` — a *production* build, deliberately, because
the cascade-layer assertions are about compiled output. So `NODE_ENV` is
`'production'` in exactly the environment where the test session must work, and
a `NODE_ENV !== 'production'` guard would either break the suite or, worse,
tempt someone to weaken it. The guard is **deployment**, not build mode: the
test session is permitted only when the process is not running on Vercel.

Four properties the implementation must hold, each with a test:

1. Disabled unless `E2E_TEST_AUTH=1`.
2. **Impossible** on Vercel: if `E2E_TEST_AUTH=1` and any `VERCEL_ENV` is set,
   the module throws at import — a hard boot failure, not a silent fallback.
3. A cookie that is unsigned, wrongly signed, or expired is not a session.
4. With the flag unset, `getCurrentUser` behaves exactly as it does today.

- [ ] **Step 1: Write the failing tests**

`lib/test-auth.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const cookies = vi.hoisted(() => vi.fn());
vi.mock('next/headers', () => ({ cookies }));

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
  vi.resetModules();
});

describe('isTestAuthEnabled', () => {
  it('is off when the flag is absent', async () => {
    process.env.E2E_TEST_AUTH = undefined;
    const { isTestAuthEnabled } = await import('./test-auth');
    expect(isTestAuthEnabled()).toBe(false);
  });

  it('is on for a local production build, which is what Playwright runs', async () => {
    process.env.E2E_TEST_AUTH = '1';
    process.env.E2E_TEST_AUTH_SECRET = 'x'.repeat(32);
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = undefined;
    const { isTestAuthEnabled } = await import('./test-auth');
    expect(isTestAuthEnabled()).toBe(true);
  });

  it('throws at import if the flag is ever set on Vercel', async () => {
    process.env.E2E_TEST_AUTH = '1';
    process.env.E2E_TEST_AUTH_SECRET = 'x'.repeat(32);
    process.env.VERCEL_ENV = 'preview';
    await expect(import('./test-auth')).rejects.toThrow(/never be enabled on Vercel/i);
  });

  it('throws if the flag is set without a long enough secret', async () => {
    process.env.E2E_TEST_AUTH = '1';
    process.env.E2E_TEST_AUTH_SECRET = 'short';
    await expect(import('./test-auth')).rejects.toThrow(/secret/i);
  });
});

describe('testSessionUserId', () => {
  async function withCookie(value: string | undefined) {
    process.env.E2E_TEST_AUTH = '1';
    process.env.E2E_TEST_AUTH_SECRET = 'x'.repeat(32);
    cookies.mockResolvedValue({ get: () => (value ? { value } : undefined) });
    return import('./test-auth');
  }

  it('reads the id from a correctly signed cookie', async () => {
    const module = await withCookie(undefined);
    const signed = module.signTestSession(42);
    const again = await withCookie(signed);
    await expect(again.testSessionUserId()).resolves.toBe(42);
  });

  it('rejects a forged cookie', async () => {
    const module = await withCookie('42.1756089600000.deadbeef');
    await expect(module.testSessionUserId()).resolves.toBeNull();
  });

  it('rejects a cookie whose payload was edited under a stolen signature', async () => {
    const module = await withCookie(undefined);
    const signed = module.signTestSession(42);
    const tampered = signed.replace(/^42\./, '43.');
    const again = await withCookie(tampered);
    await expect(again.testSessionUserId()).resolves.toBeNull();
  });

  it('rejects a cookie older than its lifetime', async () => {
    const module = await withCookie(undefined);
    const stale = module.signTestSession(42, Date.now() - 25 * 60 * 60 * 1000);
    const again = await withCookie(stale);
    await expect(again.testSessionUserId()).resolves.toBeNull();
  });

  it('is null when the flag is unset, whatever the cookie says', async () => {
    process.env.E2E_TEST_AUTH = undefined;
    cookies.mockResolvedValue({ get: () => ({ value: 'anything' }) });
    const { testSessionUserId } = await import('./test-auth');
    await expect(testSessionUserId()).resolves.toBeNull();
  });
});
```

Add to `lib/auth.test.ts`:

```ts
  it('does not consult the test session when the flag is unset', async () => {
    // The regression this guards: a refactor that reads the cookie first and
    // only then checks the flag. Every existing auth test must still pass
    // unchanged, which is the other half of this assertion.
    process.env.E2E_TEST_AUTH = undefined;
    currentUser.mockResolvedValue(null);
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(findByIdSpy).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run lib/test-auth.test.ts lib/auth.test.ts`
Expected: FAIL — `lib/test-auth.ts` does not exist.

- [ ] **Step 3: Write `lib/test-auth.ts`**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const TEST_SESSION_COOKIE = '__cinemadraft_test_session';

/** A test run is hours, not days. Shorter than any real session on purpose. */
const LIFETIME_MS = 24 * 60 * 60 * 1000;
const MIN_SECRET_LENGTH = 32;

const requested = process.env.E2E_TEST_AUTH === '1';

/**
 * 🔴 Two hard failures at import time, not two `if`s at call time.
 *
 * The guard is **deployment**, not build mode. Playwright runs a production
 * build on purpose (`playwright.config.mts` — the cascade-layer assertions are
 * about compiled output), so `NODE_ENV` is `'production'` in exactly the
 * environment where this must work, and a NODE_ENV guard would be wrong in the
 * dangerous direction the first time somebody "fixed" it.
 *
 * On Vercel the flag must not merely be ignored — it must stop the process.
 * A silently-ignored flag is a setting somebody can toggle and believe took
 * effect; a boot failure is one nobody can misread. `VERCEL_ENV` is set by the
 * platform in every environment (production, preview and development), so this
 * covers preview deployments too.
 */
if (requested && process.env.VERCEL_ENV) {
  throw new Error(
    'E2E_TEST_AUTH must never be enabled on Vercel — unset it in this environment',
  );
}

if (requested && (process.env.E2E_TEST_AUTH_SECRET ?? '').length < MIN_SECRET_LENGTH) {
  throw new Error(
    `E2E_TEST_AUTH requires E2E_TEST_AUTH_SECRET of at least ${MIN_SECRET_LENGTH} characters`,
  );
}

export function isTestAuthEnabled(): boolean {
  return requested;
}

function sign(payload: string): string {
  return createHmac('sha256', process.env.E2E_TEST_AUTH_SECRET ?? '')
    .update(payload)
    .digest('hex');
}

export function signTestSession(userId: number, now: number = Date.now()): string {
  const payload = `${userId}.${now}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * The user id the request's test cookie carries, or null.
 *
 * Compares with `timingSafeEqual` — this is a MAC check, and a byte-by-byte
 * early return leaks the signature one character at a time to anything that can
 * time it. Cheap to do correctly, so there is no reason to do it the other way
 * even in test-only code.
 */
export async function testSessionUserId(): Promise<number | null> {
  if (!requested) return null;

  const raw = (await cookies()).get(TEST_SESSION_COOKIE)?.value;
  if (!raw) return null;

  const [id, issued, mac] = raw.split('.');
  if (!id || !issued || !mac) return null;

  const expected = sign(`${id}.${issued}`);
  const a = Buffer.from(mac, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const issuedAt = Number(issued);
  if (!Number.isSafeInteger(issuedAt) || Date.now() - issuedAt > LIFETIME_MS) return null;

  const userId = Number(id);
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
}
```

- [ ] **Step 4: Branch `getCurrentUser`**

At the very top of `getCurrentUser` in `lib/auth.ts`, before `currentUser()`:

```ts
  // Test-only (D82). `isTestAuthEnabled()` is false in every deployed
  // environment and the module refuses to load at all on Vercel, so this
  // branch does not exist in production — see lib/test-auth.ts.
  if (isTestAuthEnabled()) {
    const testUserId = await testSessionUserId();
    if (testUserId != null) return userRepository.findById(testUserId);
  }
```

Do the same for whatever helper resolves the *Clerk id* for the three pages that
call `auth()` directly — introduce `lib/session.ts`'s `sessionUserId()` if it is
cleaner, but do not scatter the flag check across pages.

- [ ] **Step 5: Let the app boot with no Clerk**

- `app/providers.tsx`: mount `ClerkProvider` only when
  `process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is present; otherwise render
  the children inside the MUI providers alone. Comment why.
- `proxy.ts`: export a plain pass-through proxy when the publishable key is
  absent, keeping the same `config.matcher`. The route protection that
  `auth.protect()` provided is not needed in a test run — every spec drives a
  seeded session — and no deployed environment can reach this branch.
- `components/AppShell.tsx` / `components/MoreSheet.tsx`: `AccountControl`
  renders `UserButton` when Clerk is configured, and otherwise a plain "Log out"
  button that clears the test cookie through a server action. Do not invent a
  `/auth/logout` route — none exists, and the specs assert on the accessible
  name, which is "Log out" either way.

- [ ] **Step 6: The Playwright helper**

`e2e/support/session.ts`:

```ts
/**
 * Seed a user and put a signed test session in the browser's cookie jar.
 *
 * No Clerk, no email round trip, no test-user churn (D82/D84). The user row is
 * created directly, because the app's own creation path is Clerk's webhook and
 * this run has no Clerk.
 */
export async function signInAs(
  page: Page,
  user: { email: string; firstName?: string; lastName?: string },
): Promise<number>;
```

It inserts (or reuses) the `users` row over `pg`, the way the existing specs
already talk to the database, then `page.context().addCookies([...])` with
`signTestSession(id)`, `httpOnly: true`, `sameSite: 'Lax'`, `path: '/'`.

- [ ] **Step 7: Wire the flag into Playwright and CI**

`playwright.config.mts` — add to `webServer`:

```ts
    env: {
      E2E_TEST_AUTH: '1',
      E2E_TEST_AUTH_SECRET: process.env.E2E_TEST_AUTH_SECRET ?? 'local-e2e-secret-at-least-32-chars',
    },
```

`.github/workflows/ci.yml` — remove the `if: env.CLERK_SECRET_KEY != ''` guards
from the Playwright steps and give them `E2E_TEST_AUTH: '1'` plus a generated
`E2E_TEST_AUTH_SECRET` (`openssl rand -hex 32` in a prior step, exported through
`$GITHUB_ENV`). Rewrite the long D43 comment above them to point at D84.

- [ ] **Step 8: Prove the four properties**

```bash
npx vitest run lib/test-auth.test.ts lib/auth.test.ts   # 1, 2, 3, 4 in unit form
E2E_TEST_AUTH=1 VERCEL_ENV=preview npm run build        # must FAIL to build
npm run build                                            # must SUCCEED with the flag unset
grep -rn "E2E_TEST_AUTH" .vercel 2>/dev/null || true     # must find nothing
npx vercel env ls | grep -i E2E_TEST_AUTH || echo "absent from every Vercel environment"
```

Expected: the flagged build fails with the module's own error; the ordinary
build succeeds; the flag is absent from every Vercel environment.

- [ ] **Step 9: Commit, then request a security review**

```bash
npm run verify
git add lib/test-auth.ts lib/test-auth.test.ts lib/auth.ts lib/auth.test.ts app/providers.tsx proxy.ts components/AppShell.tsx components/MoreSheet.tsx e2e/support/session.ts playwright.config.mts .github/workflows/ci.yml docs/DECISIONS.md
git commit -m "P15.T10: a test-only session, and an app that boots without Clerk"
```

Then use `superpowers:requesting-code-review` for a security-focused review of
this commit alone. The review's charge is the four properties above — the
branch is unreachable in every deployed environment, an unsigned or edited
cookie is not a session, the flag cannot be set on Vercel, and nothing about
the existing auth path changed when the flag is unset. **Do not start Task 11
until that review passes.**

---

## Task 11: End-to-end, the whole league lifecycle

**Files:**
- Create: `e2e/league-lifecycle.spec.ts`, `e2e/awards-lifecycle.spec.ts`
- Modify: `e2e/season-setup.spec.ts`, `e2e/draft.spec.ts`, `e2e/leagues.spec.ts`,
  `e2e/dashboard.spec.ts`, `e2e/scoring.spec.ts` (drop `clerkSetup` for `signInAs`)
- Keep unchanged: `e2e/auth.spec.ts` — it tests Clerk, so it stays Clerk-driven
  and stays local-only, skipped visibly in CI

**Interfaces:**
- Consumes `signInAs` from `e2e/support/session.ts` (Task 10).

**Context an implementer needs.** Every new spec writes real rows, so all of
them work on a scratch league whose name starts with a per-spec tag and clean up
after themselves — `e2e/season-setup.spec.ts` already shows the pattern
(`TAG`, `withDb`, `cleanup`), and league 1 is sixty people's real history and is
never touched.

The owner's decision: the viewer is the league admin, so no spec needs to model
a permission it is not testing. Permission *denial* is already covered by
`season-setup.spec.ts` and must keep its own coverage.

- [ ] **Step 1: `e2e/league-lifecycle.spec.ts`, written as one journey with checkpoints**

```ts
test('an owner takes a league from empty to a finished draft', async ({ page }) => {
  const owner = await signInAs(page, { email: `${TAG}_owner@example.test`, firstName: 'Owner' });

  // 1. Create
  await page.goto('/leagues/new');
  await page.getByLabel('League name').fill(`${TAG} the lifecycle`);
  await page.getByRole('button', { name: 'Create league' }).click();
  await expect(page.getByRole('heading', { name: `${TAG} the lifecycle` })).toBeVisible();

  // 2. Seats: three dummies, so the draft has somebody to snake between
  for (const name of ['Ada', 'Grace', 'Katherine']) {
    await page.getByLabel('Add someone without an account').fill(name);
    await page.getByRole('button', { name: 'Add seat' }).click();
    await expect(page.getByText(`${name} seated`)).toBeVisible();
  }

  // 3. Groups
  await page.getByLabel('How many groups').fill('2');
  await page.getByRole('button', { name: /deal|randomi/i }).click();
  await expect(page.getByText('Everyone dealt into groups')).toBeVisible();

  // 4. Start the draft
  await page.getByRole('button', { name: 'Start draft' }).click();
  await expect(page.getByRole('heading', { name: /draft/i })).toBeVisible();

  // 5. Pick, by searching — the draft-day path that matters most
  await page.getByLabel('Find a film').fill('godfather');
  await page.getByRole('option', { name: /The Godfather/ }).first().click();
  await expect(page.getByRole('cell', { name: /The Godfather/ })).toBeVisible();

  // 6. Snake order: round 1 runs Ada → Grace → Katherine, round 2 reverses.
  //    Asserted from the board's own "on the clock" seat rather than from the
  //    order the spec typed the picks in, which would prove only that the spec
  //    can count.
  await expect(page.getByTestId('on-the-clock')).toHaveText('Grace');
  // ... four more picks, asserting the seat each time ...
  await expect(page.getByTestId('on-the-clock')).toHaveText('Katherine'); // round 2 starts where round 1 ended

  // 7. Finalize
  await page.getByRole('button', { name: /finali[sz]e/i }).click();
  await expect(page.getByText(/draft complete/i)).toBeVisible();
});
```

Fill in the five elided picks. Where a locator here does not match the real
markup, fix the *spec* to the markup — except for `data-testid="on-the-clock"`,
which may be added to `DraftBoard` if it does not exist, since the snake order
is otherwise only assertable by counting rows.

- [ ] **Step 2: `e2e/awards-lifecycle.spec.ts`**

Same shape, from the admin side: create a scratch event and category, search for
a film and attach it as a nominee, mark a winner, then assert the points land —
on the film's own page, on the league board, and in the season leaderboard's
Total column. Scoring is `nomination = P`, `win = 2P` total (see `DECISIONS.md`);
assert the *relationship* (a win is worth twice a nomination for the same
category) rather than a hard-coded number, so a points-table edit does not turn
this red for the wrong reason.

- [ ] **Step 3: Convert the existing specs off Clerk**

Replace `clerkSetup`/`setupClerkTestingToken` with `signInAs` in the five specs
listed above. `e2e/auth.spec.ts` keeps Clerk and keeps its visible skip.

- [ ] **Step 4: Run the suite locally, twice**

```bash
npm run db:up
npm run test:e2e
npm run test:e2e   # the second run proves cleanup, not luck
```

Expected: green both times, and `select count(*) from leagues where name like 'e2e%'`
returns 0 afterwards.

- [ ] **Step 5: Prove the specs can fail**

Break one thing at a time and confirm the matching spec goes red: comment out
the snake reversal in the draft order helper; make `set-winner` a no-op. Restore
both. A suite that cannot fail is a suite that proves nothing — this step is not
optional.

- [ ] **Step 6: Commit**

```bash
git add e2e/
git commit -m "P15.T11: end-to-end coverage of the league and awards lifecycles"
```

---

## Task 12: The group randomisation ceremony

**Files:**
- Create: `components/GroupCeremony.tsx`, `components/GroupCeremony.test.tsx`, `components/GroupCeremony.stories.tsx`
- Modify: `actions/leagues/manage-seats.ts` (`randomiseGroups` returns its assignments)
- Modify: `actions/leagues/season-actions.test.ts`
- Modify: `components/SeasonSetup.tsx:117-122` (the `deal` callback)

**Interfaces:**
- `randomiseGroups` returns
  `ActionResult<{ assigned: number; assignments: { draftId: number; group: number; order: number }[] }>`
  — the extra field is additive, so existing callers keep compiling.
- `GroupCeremony({ groups, onDone, reducedMotion })` where
  `groups: { group: number; names: string[] }[]`.

**Context an implementer needs.** `randomiseGroups` returns `{ assigned }` and
the page re-renders with the groups already in place — the moment the league has
been waiting for reads as a page refresh.

🔴 **The result is decided by the server before the animation starts.** The
action runs first and the ceremony animates data it already holds. Nothing is
invented on the client, nothing is re-rolled, and a viewer who reloads
mid-animation sees the same groups. Any implementation that shuffles on the
client and then persists is wrong.

- [ ] **Step 1: Write the failing action test**

Add to `actions/leagues/season-actions.test.ts`:

```ts
    it('returns the assignments it made, so the ceremony can show them', async () => {
      const result = await randomiseGroups({ leagueId: fixture.league.id, year: YEAR, groupCount: 2 });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.assignments).toHaveLength(result.data.assigned);
      // Every seat lands in exactly one group, and the groups are 1..n.
      const groups = new Set(result.data.assignments.map((entry) => entry.group));
      expect([...groups].sort()).toEqual([1, 2]);
    });
```

- [ ] **Step 2: Run it, watch it fail, then return the assignments**

Run: `npx vitest run actions/leagues/season-actions.test.ts`
Expected: FAIL — `assignments` is not on the result. Then change the action's
last line to `return ok({ assigned: assignments.length, assignments });`.

- [ ] **Step 3: Write the failing ceremony test**

```tsx
  it('ends on the real groups', async () => {
    render(<GroupCeremony groups={[{ group: 1, names: ['Ada'] }, { group: 2, names: ['Grace'] }]} onDone={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Ada')).toBeInTheDocument());
    expect(screen.getByText('Grace')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /group 1/i })).toBeInTheDocument();
  });

  it('shows the groups immediately when motion is reduced', () => {
    // No reel, no confetti, no wait: the same information, delivered at once.
    render(<GroupCeremony groups={[{ group: 1, names: ['Ada'] }]} onDone={vi.fn()} reducedMotion />);

    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.queryByTestId('shuffle-reel')).toBeNull();
  });

  it('can be skipped, and skipping changes nothing about the result', async () => {
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<GroupCeremony groups={[{ group: 1, names: ['Ada'] }]} onDone={onDone} />);

    await user.click(screen.getByRole('button', { name: /skip/i }));
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 4: Write `GroupCeremony`**

A `'use client'` full-screen `<dialog>` (the third consumer of the pattern —
focus trap and `Escape` again come free). Phases, driven by one state machine
rather than nested timeouts:

| Phase | Duration | What it shows |
|---|---|---|
| `reel` | 1600ms | Every name cycling at ~80ms, `aria-hidden` — it is noise, not content |
| `revealing` | 500ms per group | Groups appear one at a time, rows staggered 40ms |
| `settled` | — | Headline, the full listing, and a Done button |

- `prefers-reduced-motion` (read with `matchMedia`, and overridable by the
  `reducedMotion` prop for tests and stories) jumps straight to `settled`.
- Confetti: a small canvas burst on entering `settled`, drawn inline — no new
  dependency for one animation. Skipped entirely under reduced motion.
- `Escape` and the Skip button both jump to `settled`; neither changes the
  groups.
- The settled listing is the real content: an `<ol>` of groups, each an `<h3>`
  and a list of names, which is what a screen reader reads. `aria-live="polite"`
  announces "Groups are set" once, at `settled` — not per group, which would
  read the whole league aloud three times.

- [ ] **Step 5: Launch it from `SeasonSetup`**

```tsx
  const deal = useCallback(() => {
    setMessage(null);
    startTransition(async () => {
      const result = await randomiseGroups({ leagueId, year, groupCount });
      if (!result.ok) {
        setMessage(result.message ?? 'That did not work');
        return;
      }
      // The groups are already saved. The ceremony animates what the server
      // decided — it never decides anything itself.
      setCeremony(
        toGroups(result.data.assignments, seats), // draftId → seat name
      );
    });
  }, [leagueId, year, groupCount, seats]);
```

`onDone` clears `setCeremony(null)` and sets the existing
"Everyone dealt into groups" message, so the page beneath is already correct
when the takeover lifts.

- [ ] **Step 6: Run the tests, then watch it once**

```bash
npx vitest run components/GroupCeremony.test.tsx actions/leagues/season-actions.test.ts
npm run dev   # deal a scratch league into groups, twice, then again with reduced motion on
```

- [ ] **Step 7: Commit**

```bash
npm run lint && npm run typecheck
git add components/GroupCeremony.tsx components/GroupCeremony.test.tsx components/GroupCeremony.stories.tsx components/SeasonSetup.tsx actions/leagues/manage-seats.ts actions/leagues/season-actions.test.ts
git commit -m "P15.T12: dealing into groups becomes a moment"
```

---

## Phase gate

Before Phase 15 is called done:

```bash
npm run verify        # lint, typecheck, layering, both test suites, build
npm run build-storybook
npm run test:e2e
```

Then a browser pass at 1440px and 390px, in both schemes, over `/`, `/browse`,
a film page, an award show, and a scratch league's setup page — confirming each
of the owner's original reports is closed. Tick the last `PROGRESS.md` box and
record anything found-but-not-fixed under **Open questions carried forward**.

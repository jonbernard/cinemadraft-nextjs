import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type CeremonyGroup, GroupCeremony } from './GroupCeremony';

/**
 * The group draw, as a reader experiences it.
 *
 * 🔴 These tests are about one property above all: **the groups on screen at
 * the end are the groups that were passed in.** The ceremony is a presentation
 * of a decision the server already made and saved (`randomiseGroups` returns
 * its own assignments, P15.T12), so every path through it — watched to the
 * end, skipped, Escaped, or never animated at all because the reader asked for
 * less motion — has to arrive at the same listing. A ceremony that could
 * *change* the answer would be a second, competing randomiser.
 *
 * Fake timers rather than `waitFor`: the real sequence is 1600ms of reel plus
 * 500ms per group, which is longer than Testing Library's default timeout and
 * is dead time in a suite of 143 files. Advancing the clock tests the same
 * state machine and takes no wall time.
 */
const TWO_GROUPS: CeremonyGroup[] = [
  { group: 1, names: ['Ada', 'Katherine'] },
  { group: 2, names: ['Grace', 'Margaret'] },
];

/**
 * 🔴 The shape league 1 has actually used every season since 2018.
 *
 * The component was built and watched with two groups, and two is the one count
 * whose layout could not go wrong. Four is the everyday case (four groups of
 * four, 16 seats), five has happened, and `SeasonSetup` offers 1–20.
 */
const FOUR_GROUPS: CeremonyGroup[] = [
  { group: 1, names: ['Ada', 'Katherine', 'Grace', 'Margaret'] },
  { group: 2, names: ['Dorothy', 'Mary', 'Annie', 'Evelyn'] },
  { group: 3, names: ['Hedy', 'Jean', 'Frances', 'Betty'] },
  { group: 4, names: ['Ruth', 'Marlyn', 'Kathleen', 'Adele'] },
];

const REEL_MS = 1600;
const REVEAL_MS = 500;

afterEach(() => {
  vi.useRealTimers();
});

/** Run the clock forward inside `act`, so React commits what the timers cause. */
async function runClock(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

/**
 * Watch the whole thing.
 *
 * 🔴 One advance per step, not one big jump. The state machine schedules the
 * *next* timer from the effect that runs after the current step commits, which
 * is after `advanceTimersByTime` has already returned — so a single 3200ms jump
 * fires the reel's timer and nothing else, and the ceremony appears to stall on
 * group 1. This mirrors how the clock actually runs.
 */
async function watchToTheEnd(groupCount: number) {
  await runClock(REEL_MS + 50);
  for (let landed = 0; landed < groupCount; landed += 1) {
    await runClock(REVEAL_MS + 50);
  }
}

describe('GroupCeremony', () => {
  it('ends on the real groups', async () => {
    vi.useFakeTimers();
    render(<GroupCeremony groups={TWO_GROUPS} onDone={vi.fn()} />);

    await watchToTheEnd(TWO_GROUPS.length);

    expect(screen.getByRole('heading', { name: /group 1/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /group 2/i })).toBeInTheDocument();
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('Katherine')).toBeInTheDocument();
    expect(screen.getByText('Grace')).toBeInTheDocument();
    expect(screen.getByText('Margaret')).toBeInTheDocument();
    expect(screen.queryByTestId('shuffle-reel')).toBeNull();
  });

  it('deals the groups one at a time rather than all at once', async () => {
    vi.useFakeTimers();
    render(<GroupCeremony groups={TWO_GROUPS} onDone={vi.fn()} />);

    // The reel first: names cycling, hidden from assistive tech, no listing yet.
    expect(screen.getByTestId('shuffle-reel')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /group 1/i })).toBeNull();

    // Group 1 lands when the reel stops; group 2 is still to come.
    await runClock(REEL_MS + 50);
    expect(screen.getByRole('heading', { name: /group 1/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /group 2/i })).toBeNull();

    await runClock(REVEAL_MS + 50);
    expect(screen.getByRole('heading', { name: /group 2/i })).toBeInTheDocument();
  });

  it('announces that the groups are set once, at the end', async () => {
    vi.useFakeTimers();
    render(<GroupCeremony groups={TWO_GROUPS} onDone={vi.fn()} />);

    // 🔴 One live region, whose text changes exactly once. Announcing per group
    // would read the whole league aloud once per group.
    const live = screen.getByRole('heading', { level: 2 });
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent('Dealing');

    await watchToTheEnd(TWO_GROUPS.length);
    expect(live).toHaveTextContent('Groups are set');
  });

  it('shows the groups immediately when motion is reduced', () => {
    // No reel, no confetti, no wait: the same information, delivered at once.
    render(
      <GroupCeremony
        groups={[{ group: 1, names: ['Ada'] }]}
        onDone={vi.fn()}
        reducedMotion
      />,
    );

    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /group 1/i })).toBeInTheDocument();
    expect(screen.queryByTestId('shuffle-reel')).toBeNull();
    // The Skip button only exists while there is something to skip.
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /skip/i })).toBeNull();
  });

  it('can be skipped, and skipping changes nothing about the result', async () => {
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<GroupCeremony groups={TWO_GROUPS} onDone={onDone} />);

    await user.click(screen.getByRole('button', { name: /skip/i }));

    // 🔴 Every group, every name, in the order the server gave them. Skipping
    // shortcuts the animation, not the draw.
    expect(screen.queryByTestId('shuffle-reel')).toBeNull();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Group 1', 'Group 2']);
    for (const name of ['Ada', 'Katherine', 'Grace', 'Margaret']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }

    // Skipping settles the ceremony; it does not dismiss it. Done does that.
    expect(onDone).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /done/i }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('deals four groups — the real-world shape — into a grid, not one stretched card', async () => {
    vi.useFakeTimers();
    render(<GroupCeremony groups={FOUR_GROUPS} onDone={vi.fn()} />);

    await watchToTheEnd(FOUR_GROUPS.length);

    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Group 1', 'Group 2', 'Group 3', 'Group 4']);
    for (const name of FOUR_GROUPS.flatMap((entry) => entry.names)) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }

    /**
     * 🔴 Two columns, so four groups read 2×2.
     *
     * The first build laid the groups out as `min-w-56 flex-1` cards wrapping
     * inside `max-w-4xl`: three 224px cards fit that row, so the fourth wrapped
     * alone and `flex-1` stretched it to the full 896px — one banner under three
     * cards. The column count is the thing that decides that, so it is the thing
     * this pins; a layout that goes back to letting the last card stretch has no
     * column count at all and fails here.
     */
    const ol = screen.getByTestId('group-listing');
    expect(ol.style.getPropertyValue('--cols')).toBe('2');
    expect(ol.style.getPropertyValue('--cols-sm')).toBe('2');
  });

  it.each([
    [1, '1', '1'],
    [3, '2', '2'],
    [5, '3', '2'],
    [20, '5', '2'],
  ])(
    'lays %i groups out as columns that keep the last row full',
    (count, columns, phoneColumns) => {
      // 🔴 Never one card stretched across a row of its own, at any count the
      // setup form offers. Phone width stays at two whatever the count — three
      // cards across 390px are 98px wide, which does not hold a name.
      render(
        <GroupCeremony
          groups={Array.from({ length: count }, (_, index) => ({
            group: index + 1,
            names: ['Ada'],
          }))}
          onDone={vi.fn()}
          reducedMotion
        />,
      );

      const ol = screen.getByTestId('group-listing');
      expect(ol.style.getPropertyValue('--cols')).toBe(columns);
      expect(ol.style.getPropertyValue('--cols-sm')).toBe(phoneColumns);
    },
  );

  it('settles rather than closing when Escape interrupts the animation', async () => {
    const onDone = vi.fn();
    render(<GroupCeremony groups={TWO_GROUPS} onDone={onDone} />);

    // 🔴 Escape during the reel means "stop showing me this", not "hide the
    // answer" — the reader pressed it because they want the groups now.
    await act(async () => {
      screen
        .getByRole('dialog', { hidden: true })
        .dispatchEvent(new Event('cancel', { cancelable: true }));
    });

    expect(screen.getByRole('heading', { name: /group 1/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /group 2/i })).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});

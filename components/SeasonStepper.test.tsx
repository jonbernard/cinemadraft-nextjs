import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type SeasonPhase, SeasonStepper } from './SeasonStepper';

const DAY = 86_400_000;

/**
 * The window's content box at the two widths this rail is checked at, measured
 * in Chromium against a production build rather than derived: 366px of clip on
 * a 390px phone and 1160px inside the dashboard's `max-w-6xl` at 1440px, each
 * less the 8px of `px-1` that exists to keep a focus ring off the edge.
 */
const PHONE_WINDOW = 358;
const DESKTOP_WINDOW = 1152;

/**
 * What fits, at 160px a box with a 12px gap: two boxes need 332px and three
 * need 504, six need 1020 and seven need 1204.
 */
const PHONE_BOXES = 2;
const DESKTOP_BOXES = 6;

/** The component's pre-measurement box count, for the unmeasured tests. */
const VISIBLE_FALLBACK = 5;

/**
 * 🔴 jsdom has no layout, so a width is something a test states rather than
 * something the DOM produces — and a component test that cannot state one can
 * only ever check the wide case, which is the case that was never broken.
 *
 * `getBoundingClientRect` is the seam: `vitest.setup.ts` stubs
 * `ResizeObserver` to report it, so stubbing it here is the whole of "render
 * this at a phone's width" and the component's own measuring code runs for
 * real. Prototype-wide because the element to stub does not exist until
 * `render`, and harmless because nothing else in this file measures anything.
 */
function atWidth(width: number): void {
  // A literal, not a spread `DOMRect`: its dimensions are prototype getters,
  // so spreading one yields `{}` and a silently unmeasured render.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

/** The range the rail currently claims to be showing, from its `aria-live` line. */
function announced(): [first: number, last: number, total: number] {
  const text = screen.getByText(/Showing shows/).textContent ?? '';
  const match = /Showing shows (\d+) to (\d+) of (\d+)/.exec(text);
  if (!match) throw new Error(`unreadable announcement: ${text}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Press ‹ to the start of the season and › back to the end, collecting every
 * box the rail says it is showing along the way.
 *
 * The announcement is the source rather than the DOM because it is the claim
 * under test: it is what a screen-reader reader is told is on screen, and a
 * box that no announcement ever names is a box nobody can reach.
 *
 * Bounded rather than `while (!disabled)`: a regression that stops the buttons
 * moving should fail this test, not hang the suite.
 */
async function walkTheRail(
  user: ReturnType<typeof userEvent.setup>,
): Promise<{ seen: Set<number>; widths: Set<number> }> {
  const seen = new Set<number>();
  const widths = new Set<number>();

  const record = () => {
    const [first, last] = announced();
    widths.add(last - first + 1);
    for (let box = first; box <= last; box += 1) seen.add(box);
  };

  record();
  for (const name of [/earlier/i, /later/i]) {
    const button = screen.getByRole('button', { name }) as HTMLButtonElement;
    for (let press = 0; press < 50 && !button.disabled; press += 1) {
      await user.click(button);
      record();
    }
  }

  return { seen, widths };
}

/**
 * Where the rail opens for `season`, in a window of `boxes` (P17.T3).
 *
 * 🔴 Computed from the fixture rather than written out. The anchor is no
 * longer `maxOffset` — it is the next show, clamped to the last whole window —
 * and `phases(n)` puts that show in the middle of the array, with the
 * complete/incomplete boundary landing on `Date.now()` to the millisecond. A
 * literal would be off by one whenever the clock ticked mid-fixture.
 */
function anchorOf(season: SeasonPhase[], boxes: number): number {
  const next = season.findIndex((phase) => !phase.complete && phase.date != null);
  const maxOffset = Math.max(0, season.length - boxes);
  return next < 0 ? maxOffset : Math.min(next, maxOffset);
}

/** `1 … count`, the box numbers the announcement counts in. */
function everyBox(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index + 1);
}

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
  it('opens anchored to the next show', () => {
    // 🔴 Was "anchored to the end of the season" and asserted `7`, the end of
    // the array. P17.T3 moved the anchor to the show the league is waiting
    // for — which for this fixture is in the middle — because a season whose
    // last shows are already finished opened on two completed boxes. D81's
    // intent (open on the next thing to happen) is what is preserved; its
    // mechanism (the end) is what changed.
    const season = phases(12);
    render(<SeasonStepper phases={season} />);

    expect(screen.getByTestId('season-window')).toHaveAttribute(
      'data-offset',
      String(anchorOf(season, VISIBLE_FALLBACK)),
    );
  });

  it('steps one whole window at a time, and stops at the ends', async () => {
    const user = userEvent.setup();
    const season = phases(12);
    render(<SeasonStepper phases={season} />);

    // Unmeasured, so five boxes: a press moves five and the last hop is short.
    const opened = anchorOf(season, VISIBLE_FALLBACK);
    await user.click(screen.getByRole('button', { name: /earlier/i }));
    expect(screen.getByTestId('season-window')).toHaveAttribute(
      'data-offset',
      String(Math.max(0, opened - VISIBLE_FALLBACK)),
    );

    await user.click(screen.getByRole('button', { name: /earlier/i }));
    expect(screen.getByTestId('season-window')).toHaveAttribute('data-offset', '0');
    expect(screen.getByRole('button', { name: /earlier/i })).toBeDisabled();
  });

  /**
   * 🔴 The property the old tests could not see: that the rail can actually
   * reach its own boxes.
   *
   * Five of twenty-four were unreachable at 390px — including the last three
   * shows of the season, which is what the end-anchor exists to put on screen
   * — while every test here passed, because a fixed five-box window stepping
   * three is self-consistent in a DOM with no layout. So this states the width
   * and walks the whole rail, at a phone's and at a laptop's.
   */
  it.each([
    ['a phone', PHONE_WINDOW, PHONE_BOXES],
    ['a laptop', DESKTOP_WINDOW, DESKTOP_BOXES],
  ])('reaches every box of the season on %s', async (_name, width, boxes) => {
    atWidth(width);
    const user = userEvent.setup();
    const season = phases(24);
    render(<SeasonStepper phases={season} />);

    // The opening window, as measured — a window whose width came from the
    // real container rather than from a five-box guess that only fits on a
    // wider screen. 🔴 Anchored to the next show since P17.T3, not to the end
    // of the array; the reachability walk below is untouched and is what this
    // test is actually for.
    const anchor = anchorOf(season, boxes);
    expect(announced()).toEqual([anchor + 1, anchor + boxes, 24]);

    const { seen, widths } = await walkTheRail(user);

    expect([...seen].sort((a, b) => a - b)).toEqual(everyBox(24));
    // And every announcement named exactly the boxes that fit: naming five on
    // a window that holds two is a lie told to the one reader who cannot
    // check it.
    expect([...widths]).toEqual([boxes]);
  });

  it('names the phase, so two boxes for one show are told apart', () => {
    render(
      <SeasonStepper
        phases={[
          {
            key: '1-nominations',
            eventId: 1,
            phase: 'nominations',
            name: 'Academy Awards',
            abbreviation: 'oscars',
            date: Date.now() + DAY,
            complete: false,
          },
          {
            key: '1-ceremony',
            eventId: 1,
            phase: 'ceremony',
            name: 'Academy Awards',
            abbreviation: 'oscars',
            date: Date.now() + 30 * DAY,
            complete: false,
          },
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

  /**
   * 🔴 The live-data state, which none of the existing tests construct: every
   * phase is either finished or not yet scheduled. The rail highlighted
   * nothing at all on the real dashboard while every test here was green,
   * because `phases(n)` gives every box a date.
   */
  function unscheduledSeason(): SeasonPhase[] {
    return [
      {
        key: '1-nominations',
        eventId: 1,
        phase: 'nominations',
        name: 'Golden Globes',
        abbreviation: 'gg',
        date: Date.now() - 40 * DAY,
        complete: true,
      },
      {
        key: '1-ceremony',
        eventId: 1,
        phase: 'ceremony',
        name: 'Golden Globes',
        abbreviation: 'gg',
        date: Date.now() - 10 * DAY,
        complete: true,
      },
      {
        key: '2-nominations',
        eventId: 2,
        phase: 'nominations',
        name: 'Academy Awards',
        abbreviation: 'oscars',
        date: null,
        complete: false,
      },
      {
        key: '2-ceremony',
        eventId: 2,
        phase: 'ceremony',
        name: 'Academy Awards',
        abbreviation: 'oscars',
        date: null,
        complete: false,
      },
    ];
  }

  it('highlights the last incomplete show when nothing left is scheduled', () => {
    render(<SeasonStepper phases={unscheduledSeason()} />);

    // Something is current. Before this task, nothing was — `next` required a
    // date, and a real season's remaining phases have none.
    const current = screen.getByRole('listitem', { current: 'step' });
    expect(within(current).getByText('Academy Awards')).toBeInTheDocument();
    expect(within(current).getByText('Ceremony')).toBeInTheDocument();
  });

  it('says the date is unknown in the chip, once', () => {
    render(<SeasonStepper phases={unscheduledSeason()} />);

    const current = screen.getByRole('listitem', { current: 'step' });
    expect(within(current).getByText('Next · date TBA')).toBeInTheDocument();
    // And not twice: the standalone "Date TBA" line would say the same thing
    // an inch lower.
    expect(within(current).queryByText('Date TBA')).toBeNull();
    // An undated box that is *not* next still carries the plain line.
    const others = screen.getAllByRole('listitem').filter((li) => li !== current);
    expect(others.some((li) => within(li).queryByText('Date TBA') != null)).toBe(true);
  });

  /** A dated incomplete phase alongside an undated one — the dated one is next. */
  function datedNextSeason(): SeasonPhase[] {
    return [
      {
        key: '1-ceremony',
        eventId: 1,
        phase: 'ceremony',
        name: 'BAFTA',
        abbreviation: 'bafta',
        date: Date.now() + 5 * DAY,
        complete: false,
      },
      {
        key: '2-ceremony',
        eventId: 2,
        phase: 'ceremony',
        name: 'Academy Awards',
        abbreviation: 'oscars',
        date: null,
        complete: false,
      },
    ];
  }

  it('a dated incomplete phase still wins over an undated one', () => {
    render(<SeasonStepper phases={datedNextSeason()} />);

    const current = screen.getByRole('listitem', { current: 'step' });
    expect(within(current).getByText('BAFTA')).toBeInTheDocument();
    expect(within(current).getByText('in 5 days')).toBeInTheDocument();
  });

  it('paints the next chip beam, dated or not (P17.T20)', () => {
    // One state, one colour: "next" does not become a different thing because
    // the ceremony calendar has not been published. Both shapes, because a
    // `date == null`-only spend would pass the undated half of this on its own.
    for (const season of [unscheduledSeason(), datedNextSeason()]) {
      const { unmount } = render(<SeasonStepper phases={season} />);
      const chip = within(screen.getByRole('listitem', { current: 'step' })).getByText(
        /^Next/,
      );
      // Ink, not a fill: `theme/contrast.test.ts` proves beam readable as text
      // on `panel`, and proves nothing about white or black on top of beam.
      expect(chip.className).toContain('text-beam');
      expect(chip.className).not.toContain('bg-beam');
      expect(chip.className).not.toMatch(/accent/);
      unmount();
    }
  });

  it('opens on the next show rather than on the end of the array', () => {
    atWidth(PHONE_WINDOW); // two boxes
    const twelve = phases(12);
    // Box 4 is the only incomplete one; 5..12 are finished. The end-anchor
    // would open on 11–12 and the reader would never see the one thing the
    // rail exists to point at.
    const doctored = twelve.map((phase, index) => ({
      ...phase,
      complete: index !== 3,
      date: index === 3 ? null : phase.date,
    }));

    render(<SeasonStepper phases={doctored} />);

    const [first, last] = announced();
    expect(first).toBeLessThanOrEqual(4);
    expect(last).toBeGreaterThanOrEqual(4);
  });

  it('anchors to the end when the season is genuinely over', () => {
    atWidth(PHONE_WINDOW);
    render(<SeasonStepper phases={phases(12).map((p) => ({ ...p, complete: true }))} />);

    // Nothing is next, so there is nothing to anchor to and D81's end-anchor
    // is still the right answer.
    expect(announced()).toEqual([11, 12, 12]);
  });

  it('renders nothing for a season with no shows', () => {
    const { container } = render(<SeasonStepper phases={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

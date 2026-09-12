import { render, screen } from '@testing-library/react';
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
  it('opens anchored to the end of the season', () => {
    render(<SeasonStepper phases={phases(12)} />);

    // The last box is what a reader wants first: the next thing to happen.
    expect(screen.getByTestId('season-window')).toHaveAttribute('data-offset', '7');
  });

  it('steps one whole window at a time, and stops at the ends', async () => {
    const user = userEvent.setup();
    render(<SeasonStepper phases={phases(12)} />);

    // Unmeasured, so five boxes: a press moves five and the last hop is short.
    await user.click(screen.getByRole('button', { name: /earlier/i }));
    expect(screen.getByTestId('season-window')).toHaveAttribute('data-offset', '2');

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
    render(<SeasonStepper phases={phases(24)} />);

    // The end of the season, as measured — not the end of a window that only
    // fits on a wider screen, which is three boxes short of the last show.
    expect(announced()).toEqual([24 - boxes + 1, 24, 24]);

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

  it('renders nothing for a season with no shows', () => {
    const { container } = render(<SeasonStepper phases={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

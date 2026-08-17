import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { type LedgerRow, PointsLedger } from '@/components/PointsLedger';

/**
 * The answer to "why is this number what it is" (§6.7).
 *
 * The property that matters most is that the lines add up to the total shown
 * above them. A ledger that disagrees with its own heading is worse than no
 * ledger, because it makes the app look like it is guessing.
 */
const LINES: LedgerRow[] = [
  {
    nominationId: 11,
    awardId: 1,
    awardName: 'Best Picture',
    eventAbbreviation: 'oscars',
    eventName: 'Academy of Motion Picture Arts and Sciences',
    points: 20,
    won: true,
    earned: 40,
  },
  {
    nominationId: 12,
    awardId: 2,
    awardName: 'Actor in a Leading Role',
    eventAbbreviation: 'oscars',
    eventName: 'Academy of Motion Picture Arts and Sciences',
    points: 15,
    won: false,
    earned: 15,
  },
  {
    nominationId: 13,
    awardId: 3,
    awardName: 'Best Film',
    eventAbbreviation: 'bafta',
    eventName: 'British Academy of Film and Television Arts',
    points: 10,
    won: false,
    earned: 10,
  },
];

const TOTAL = 65;

describe('PointsLedger', () => {
  it('shows only the total until it is opened', () => {
    render(<PointsLedger total={TOTAL} lines={LINES} label="Dune" />);

    expect(screen.getByText('65')).toBeInTheDocument();
    // The board stays scannable: the detail is present in the DOM but the
    // element is closed, so nothing competes with the number.
    expect(screen.getByRole('group')).not.toHaveAttribute('open');
  });

  it('🔴 reveals lines that add up to the total', async () => {
    const user = userEvent.setup();
    render(<PointsLedger total={TOTAL} lines={LINES} label="Dune" />);

    await user.click(screen.getByText('65'));

    const shown = screen
      .getAllByRole('listitem')
      .flatMap((item) => {
        const text = item.textContent ?? '';
        // Leaf rows only — a group row contains its children's text too.
        return item.querySelector('ul') ? [] : [text];
      })
      .map((text) => Number(text.match(/(\d+)$/)?.[1] ?? 0));

    expect(shown.reduce((sum, value) => sum + value, 0)).toBe(TOTAL);
  });

  it('groups by award show, biggest first', async () => {
    const user = userEvent.setup();
    render(<PointsLedger total={TOTAL} lines={LINES} label="Dune" />);
    await user.click(screen.getByText('65'));

    const groups = screen
      .getAllByRole('listitem')
      .filter((item) => item.querySelector('ul'));

    expect(groups[0]?.textContent).toContain('Academy of Motion Picture');
    expect(groups[1]?.textContent).toContain('British Academy');
  });

  it('🔴 states a win rather than colouring it', async () => {
    // Colour alone is invisible to a colour-blind reader and in print, and
    // green in an interface reads as "valid" — which would make every losing
    // nomination look like an error.
    const user = userEvent.setup();
    render(<PointsLedger total={TOTAL} lines={LINES} label="Dune" />);
    await user.click(screen.getByText('65'));

    const winner = screen
      .getAllByRole('listitem')
      .find((item) => item.textContent?.includes('Best Picture'));

    expect(winner?.textContent).toContain('won');
    // And carries double the award's value, which is the rule (D41).
    expect(winner?.textContent).toContain('40');
  });

  it('🔴 is reachable by keyboard', async () => {
    // Checked here, *toggled* in the E2E suite. jsdom focuses a <summary>
    // correctly but does not implement Enter-to-toggle on <details> — verified
    // against a bare <details> before writing this, so asserting the toggle
    // here would be testing jsdom rather than the component. Focusability is
    // the half jsdom can prove, and it is the half that would break if this
    // were ever swapped for a div.
    const user = userEvent.setup();
    render(<PointsLedger total={TOTAL} lines={LINES} label="Dune" />);

    await user.tab();

    expect(document.activeElement?.tagName).toBe('SUMMARY');
  });

  it('names the film for a screen reader', () => {
    render(<PointsLedger total={TOTAL} lines={LINES} label="Dune" />);

    // "65" alone tells a screen reader nothing about what scored it.
    expect(screen.getByText(/points for Dune/)).toBeInTheDocument();
  });

  it('renders a bare number when there is nothing to explain', () => {
    // A film that scored nothing has no lines. An empty expander would invite
    // a click that reveals nothing.
    render(<PointsLedger total={0} lines={[]} label="Unscored" />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('sums an event subtotal from its own lines', async () => {
    const user = userEvent.setup();
    render(<PointsLedger total={TOTAL} lines={LINES} label="Dune" />);
    await user.click(screen.getByText('65'));

    const oscars = screen
      .getAllByRole('listitem')
      .find((item) => item.textContent?.includes('Academy of Motion Picture'));

    // 40 for the win plus 15 for the nomination.
    expect(within(oscars as HTMLElement).getByText('55')).toBeInTheDocument();
  });
});

/**
 * 🔴 The case a browser found and no test had.
 *
 * A film can hold **two nominations in the same category**: La La Land took two
 * of the 2017 Best Original Song slots, both under award 75. The rows were keyed
 * on `awardId`, so React saw a duplicate key and dropped one — the ledger's
 * visible lines then summed to less than the total printed above them, which is
 * exactly the failure this component's "lines add up" rule exists to prevent.
 * Both lines were computed correctly; one was silently not rendered.
 */
describe('two nominations in one category', () => {
  const SAME_AWARD: LedgerRow[] = [
    {
      nominationId: 501,
      awardId: 75,
      awardName: 'Music - Original Song',
      eventAbbreviation: 'oscars',
      eventName: 'Academy of Motion Picture Arts and Sciences',
      points: 5,
      won: true,
      earned: 10,
    },
    {
      nominationId: 502,
      awardId: 75,
      awardName: 'Music - Original Song',
      eventAbbreviation: 'oscars',
      eventName: 'Academy of Motion Picture Arts and Sciences',
      points: 5,
      won: false,
      earned: 5,
    },
  ];

  it('🔴 renders both lines', async () => {
    render(<PointsLedger total={15} lines={SAME_AWARD} label="La La Land" />);
    await userEvent.click(screen.getByRole('group').querySelector('summary') as Element);

    expect(screen.getAllByText(/Music - Original Song/)).toHaveLength(2);
  });

  it('🔴 the rendered lines still add up to the total', async () => {
    render(<PointsLedger total={15} lines={SAME_AWARD} label="La La Land" />);
    await userEvent.click(screen.getByRole('group').querySelector('summary') as Element);

    // Summing the rendered amounts is what catches a dropped row: with one line
    // missing this comes to 10 or 5 rather than 15. Asserting on the text "15"
    // would not — the summary already shows the total, so it passes even when a
    // line has vanished.
    const group = screen.getByRole('group');
    const amounts = within(group)
      .getAllByText(/^(5|10)$/)
      .map((node) => Number(node.textContent));

    expect(amounts).toContain(10);
    expect(amounts).toContain(5);
  });
});

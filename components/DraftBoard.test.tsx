import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type BoardSeat, DraftBoard } from './DraftBoard';

function seat(over: Partial<BoardSeat> & { draftId: number }): BoardSeat {
  return {
    name: `Seat ${over.draftId}`,
    isDummy: false,
    total: 0,
    picks: [],
    ...over,
  };
}

function pick(round: number, title: string) {
  return { pickId: round * 100, round, title, posterUrl: null, points: round * 10 };
}

/**
 * Both presentations (D49) render into the DOM; CSS decides which is shown, so
 * in a real browser only one is visible and only one reaches the accessibility
 * tree. JSDOM loads no CSS, so text appears twice here — assertions are
 * therefore scoped to one presentation at a time rather than loosened.
 */
const desktop = () => within(screen.getByRole('table'));
const phone = () => within(screen.getAllByRole('list')[0] as HTMLElement);

describe('DraftBoard', () => {
  it('renders one row per seat and one column per round', () => {
    render(
      <DraftBoard
        rounds={3}
        seats={[seat({ draftId: 1, picks: [pick(1, 'A')] }), seat({ draftId: 2 })]}
      />,
    );

    expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2 seats
    // Header cells: the seat column plus one per round.
    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
  });

  it('🔴 pads a short seat with empty cells so the columns stay aligned', () => {
    // Without explicit empties, round 3 for one seat would sit under round 2
    // for another, and the board would misreport who picked when.
    render(
      <DraftBoard
        rounds={3}
        seats={[
          seat({ draftId: 1, picks: [pick(1, 'A'), pick(2, 'B'), pick(3, 'C')] }),
          seat({ draftId: 2, picks: [pick(1, 'D')] }),
        ]}
      />,
    );

    const rows = screen.getAllByRole('row');
    // Every seat row has the same number of cells, regardless of picks.
    for (const row of rows.slice(1)) {
      expect(within(row).getAllByRole('cell')).toHaveLength(3);
    }
  });

  it('🔴 takes its column count from the caller, never a constant (D34)', () => {
    render(<DraftBoard rounds={12} seats={[seat({ draftId: 1 })]} />);
    expect(screen.getAllByRole('columnheader')).toHaveLength(13);
  });

  it('marks the viewer’s seat with a word, not only colour', () => {
    render(
      <DraftBoard
        rounds={1}
        seats={[seat({ draftId: 1 }), seat({ draftId: 2 })]}
        viewerSeatId={2}
      />,
    );

    expect(desktop().getByText(/You/)).toBeInTheDocument();
    expect(phone().getByText(/You/)).toBeInTheDocument();
  });

  it('labels an unclaimed seat', () => {
    // 17 dummy seats exist in production; they are real seats a league drafts
    // on behalf of, and they must not look like a rendering failure.
    render(
      <DraftBoard
        rounds={1}
        seats={[seat({ draftId: 1, isDummy: true, name: 'Ghost' })]}
      />,
    );

    expect(desktop().getByText('Ghost')).toBeInTheDocument();
    expect(phone().getByText(/unclaimed/i)).toBeInTheDocument();
  });

  it('shows a film’s title and points in its cell', () => {
    render(
      <DraftBoard
        rounds={1}
        seats={[seat({ draftId: 1, picks: [pick(1, 'Sinners')] })]}
      />,
    );

    expect(desktop().getByText('Sinners')).toBeInTheDocument();
    expect(desktop().getByText('10')).toBeInTheDocument();
  });

  it('🔴 shows every pick on a phone too, where members actually watch (D49)', () => {
    render(
      <DraftBoard
        rounds={3}
        seats={[seat({ draftId: 1, picks: [pick(1, 'Sinners'), pick(2, 'Bugonia')] })]}
      />,
    );

    // Not a squeezed copy of the grid: the phone lists each seat with its own
    // strip, so a member reads one seat at a time.
    expect(phone().getByText('Sinners')).toBeInTheDocument();
    expect(phone().getByText('Bugonia')).toBeInTheDocument();
  });

  it('says so when a seat has no picks yet, on a phone', () => {
    render(<DraftBoard rounds={1} seats={[seat({ draftId: 1 })]} />);
    expect(phone().getByText(/no picks yet/i)).toBeInTheDocument();
  });

  it('renders an empty group without crashing', () => {
    render(<DraftBoard rounds={0} seats={[]} />);
    expect(screen.getByText(/no seats in this group/i)).toBeInTheDocument();
  });
});

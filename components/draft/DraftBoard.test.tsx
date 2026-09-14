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

  it('pads a short seat with empty cells so the columns stay aligned', () => {
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

  it('takes its column count from the caller, never a constant (D34)', () => {
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

  it('shows every pick on a phone too, where members actually watch (D49)', () => {
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

  it('labels a phone seat with its position, exactly "Seat NN · Rounds 1–N"', () => {
    // The one string the brief names verbatim. Zero-padded to two digits
    // regardless of how many seats are in the group (D34: no roster size).
    render(
      <DraftBoard rounds={7} seats={[seat({ draftId: 1, order: 1, name: 'Ada' })]} />,
    );

    expect(phone().getByText('Seat 01 · Rounds 1–7')).toBeInTheDocument();
  });

  it('links a seat name to that member’s page, in both layouts', () => {
    // The league page is the member index. Before this the board printed
    // names as plain text, so an active or complete season had no route from
    // a league to a member at all.
    render(
      <DraftBoard
        rounds={1}
        seats={[seat({ draftId: 1, name: 'Ada', uuid: 'u-ada' })]}
      />,
    );

    for (const layout of [desktop(), phone()]) {
      expect(layout.getByRole('link', { name: 'Ada' })).toHaveAttribute(
        'href',
        '/members/u-ada',
      );
    }
  });

  it('leaves a placeholder seat as plain text — it has no member page', () => {
    render(
      <DraftBoard
        rounds={1}
        seats={[seat({ draftId: 1, name: 'Ghost', isDummy: true, uuid: null })]}
      />,
    );

    expect(screen.getAllByText('Ghost')).toHaveLength(2);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('drops the seat number from the eyebrow when the caller has none to give', () => {
    // `order` is optional: a caller that has not threaded it through still
    // gets a sensible eyebrow rather than "Seat undefined".
    render(<DraftBoard rounds={7} seats={[seat({ draftId: 1, name: 'Ada' })]} />);

    expect(phone().getByText('Rounds 1–7')).toBeInTheDocument();
    expect(phone().queryByText(/Seat/)).not.toBeInTheDocument();
  });

  it('gives every round column the same fixed width in ordinary mode', () => {
    // The current behaviour, pinned so the TV branch below is provably a
    // change rather than the default renamed.
    render(<DraftBoard rounds={3} seats={[seat({ draftId: 1 })]} />);

    const columns = screen.getAllByRole('columnheader').slice(1);
    expect(columns).toHaveLength(3);
    for (const column of columns) expect(column.className).toMatch(/\bw-24\b/);

    const grid = screen.getByRole('table').parentElement as HTMLElement;
    expect(grid.className).toMatch(/overflow-x-auto/);
    expect(grid.style.maxWidth).toBe('');
  });

  it('sizes the board to the viewport in tv mode, with no horizontal scroll container', () => {
    // 🔴 The defect being fixed: the desktop grid lives in `overflow-x-auto`
    // with 96px round columns, and a television cannot scroll — anything past
    // the right edge is simply not on the board. In tv mode the wrapper is not
    // a scroll container, the columns are proportional, and the whole board is
    // capped at a width derived from the height that is left over.
    render(
      <DraftBoard tv rounds={7} seats={[seat({ draftId: 1 }), seat({ draftId: 2 })]} />,
    );

    const columns = screen.getAllByRole('columnheader').slice(1);
    for (const column of columns) expect(column.className).not.toMatch(/\bw-24\b/);

    const table = screen.getByRole('table');
    expect(table.className).toMatch(/table-fixed/);

    const grid = table.parentElement as HTMLElement;
    expect(grid.className).not.toMatch(/overflow-x-auto/);
    // Height in, width out: the cap is derived from the viewport's height,
    // not from a fixed column count. Asserted on the parts rather than on the
    // whole string, because jsdom folds the arithmetic in `calc()` and the
    // folded form is its business, not this component's.
    expect(grid.style.maxWidth).toContain('100vh');

    // 🔴 And the seat count is really in it. Without this, a cap that ignored
    // how many rows have to fit down the screen — the entire binding
    // constraint — would pass the line above.
    const { container } = render(
      <DraftBoard
        tv
        rounds={7}
        seats={[1, 2, 3, 4].map((draftId) => seat({ draftId }))}
      />,
    );
    const four = container.querySelector('table')?.parentElement as HTMLElement;
    expect(four.style.maxWidth).not.toBe(grid.style.maxWidth);
  });

  it('squats the poster on a television, and leaves it alone everywhere else', () => {
    // 🔴 The binding constraint on this board is HEIGHT — four seats down 1080
    // — so the poster's height is settled by arithmetic no matter what ratio
    // it is drawn at, and the only thing the ratio buys is width. `3/4` buys
    // 12.5% of it for an 11% centre crop under `object-cover`, which is the
    // trade the owner asked for in as many words: "if you need to scale things
    // down vertically, scale down the posters."
    //
    // This is also the test that catches `tv` not being handed to `PickCell`
    // at all: the board would size its columns from a 3:4 poster and then draw
    // a 2:3 one, and every row would overflow the screen it was fitted to.
    const art = (container: HTMLElement) =>
      container.querySelector('tbody td div') as HTMLElement;

    const tv = render(
      <DraftBoard tv rounds={1} seats={[seat({ draftId: 1, picks: [pick(1, 'A')] })]} />,
    );
    expect(art(tv.container).className).toMatch(/aspect-\[3\/4\]/);
    expect(art(tv.container).className).not.toMatch(/aspect-\[2\/3\]/);

    const ordinary = render(
      <DraftBoard rounds={1} seats={[seat({ draftId: 1, picks: [pick(1, 'A')] })]} />,
    );
    expect(art(ordinary.container).className).toMatch(/aspect-\[2\/3\]/);
  });

  it('drops the points disclosure on a television, keeping the number', () => {
    // 🔴 `PointsLedger` opens a `<details>` panel in flow. Every row of this
    // board is sized to the pixel from the viewport's height, so one opened
    // disclosure blows the layout apart — and a reader on a television has a
    // remote, no pointer and no obvious way to shut it again. The total still
    // prints, which is the whole of what anyone reads from across a room.
    const scored = {
      ...pick(1, 'A'),
      ledger: [
        {
          nominationId: 1,
          awardId: 2,
          awardName: 'Best Picture',
          eventAbbreviation: 'AMPAS',
          eventName: 'Academy Awards',
          points: 10,
          won: false,
          earned: 10,
        },
      ],
    };

    const tv = render(
      <DraftBoard tv rounds={1} seats={[seat({ draftId: 1, picks: [scored] })]} />,
    );
    expect(tv.container.querySelector('tbody details')).toBeNull();
    expect(
      within(tv.container.querySelector('tbody') as HTMLElement).getAllByText('10')
        .length,
    ).toBeGreaterThan(0);

    // And off a television it is still there, so the line above is a change
    // rather than a description of what `PickCell` always did.
    const ordinary = render(
      <DraftBoard rounds={1} seats={[seat({ draftId: 1, picks: [scored] })]} />,
    );
    expect(ordinary.container.querySelector('tbody details')).not.toBeNull();
  });

  it('still renders every seat and every round in tv mode', () => {
    // 4 seats × 10 rounds is the measured production ceiling. "Fits" must
    // never be bought by dropping content — the owner's requirement is that
    // every pick is visible AT ONCE.
    render(
      <DraftBoard
        tv
        rounds={10}
        seats={[1, 2, 3, 4].map((draftId) =>
          seat({ draftId, picks: [pick(1, `Film ${draftId}`)] }),
        )}
      />,
    );

    const rows = desktop().getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(within(row).getAllByRole('cell')).toHaveLength(10);
    expect(desktop().getAllByRole('cell')).toHaveLength(40);
  });
});

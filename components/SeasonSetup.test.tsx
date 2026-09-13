import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const assignSeats = vi.hoisted(() => vi.fn(async () => ({ ok: true, data: null })));
const addDummySeat = vi.hoisted(() =>
  vi.fn(async () => ({ ok: true, data: { draftId: 9 } })),
);
/**
 * 🔴 The mock stands in for the server's decision, so it must have the shape of
 * one: the action writes these assignments and hands back the rows it wrote
 * (P15.T12). Ada into group 2, Grace and Guest into group 1 — deliberately not
 * the order the seats are listed in, so a component that quietly re-derived the
 * groups from `seats` instead of using the result would show something else.
 */
const randomiseGroups = vi.hoisted(() =>
  vi.fn(async () => ({
    ok: true,
    data: {
      assigned: 3,
      assignments: [
        { draftId: 2, group: 1, order: 1 },
        { draftId: 3, group: 1, order: 2 },
        { draftId: 1, group: 2, order: 1 },
      ],
    },
  })),
);
const removeSeat = vi.hoisted(() => vi.fn(async () => ({ ok: true, data: null })));
const startDraft = vi.hoisted(() => vi.fn(async () => ({ ok: true, data: null })));
const completeDraft = vi.hoisted(() => vi.fn(async () => ({ ok: true, data: null })));

vi.mock('@/actions/leagues/manage-seats', () => ({
  assignSeats,
  addDummySeat,
  randomiseGroups,
  removeSeat,
}));
vi.mock('@/actions/leagues/manage-league', () => ({ startDraft, completeDraft }));

import { SeasonSetup, type SetupSeatView } from '@/components/SeasonSetup';

/**
 * The console the owner uses once a year, before a draft.
 *
 * The properties that matter are the ones that are hard to undo: a seat with
 * picks cannot be removed, destructive actions confirm, and groups are frozen
 * once the draft opens.
 */
const SEATS: SetupSeatView[] = [
  { draftId: 1, name: 'Ada', isDummy: false, group: 1, order: 1, hasPicks: false },
  {
    draftId: 2,
    name: 'Grace',
    isDummy: false,
    group: null,
    order: null,
    hasPicks: false,
  },
  { draftId: 3, name: 'Guest', isDummy: true, group: 2, order: 1, hasPicks: true },
];

function setup(over: Partial<React.ComponentProps<typeof SeasonSetup>> = {}) {
  render(
    <SeasonSetup
      leagueId={7}
      year={2026}
      seats={SEATS}
      groups={[1, 2]}
      suggestedGroupCount={2}
      status="pending"
      {...over}
    />,
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SeasonSetup', () => {
  it('lists everyone, marking placeholders', () => {
    setup();

    expect(screen.getByText(/Guest/)).toHaveTextContent('placeholder');
  });

  it('assigns a group with a select, so it works without a mouse', async () => {
    // The source dragged, which is unusable by keyboard (a11y
    // gesture-alternative). A select is operable by keyboard, screen reader
    // and touch with no library.
    const user = setup();

    const row = screen.getByText(/Grace/).closest('li') as HTMLElement;
    await user.selectOptions(within(row).getByRole('combobox'), '2');

    await waitFor(() =>
      expect(assignSeats).toHaveBeenCalledWith({
        leagueId: 7,
        assignments: [{ draftId: 2, group: 2, order: 2 }],
      }),
    );
  });

  it('can unassign someone again', async () => {
    const user = setup();

    const row = screen.getByText(/^Ada/).closest('li') as HTMLElement;
    await user.selectOptions(within(row).getByRole('combobox'), '');

    await waitFor(() =>
      expect(assignSeats).toHaveBeenCalledWith({
        leagueId: 7,
        assignments: [{ draftId: 1, group: null, order: null }],
      }),
    );
  });

  it('offers a group beyond those in use, so a new one needs no separate step', () => {
    setup();

    const row = screen.getByText(/Grace/).closest('li') as HTMLElement;
    const options = within(row)
      .getAllByRole('option')
      .map((option) => option.textContent);

    expect(options).toContain('3');
  });

  it('does not offer to remove a seat that has picks', async () => {
    // Removing it would orphan them — `draft_picks` has no foreign key. A
    // button that always refuses reads as a broken app.
    setup();

    const row = screen.getByText(/Guest/).closest('li') as HTMLElement;
    expect(within(row).queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(row.textContent).toContain('has picks');
  });

  it('confirms before removing someone', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = setup();

    const row = screen.getByText(/Grace/).closest('li') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Remove' }));

    expect(confirm).toHaveBeenCalled();
    expect(removeSeat).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('removes once confirmed', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = setup();

    const row = screen.getByText(/Grace/).closest('li') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Remove' }));

    await waitFor(() =>
      expect(removeSeat).toHaveBeenCalledWith({ leagueId: 7, draftId: 2 }),
    );
    confirm.mockRestore();
  });

  it('seats a placeholder', async () => {
    const user = setup();

    await user.type(screen.getByLabelText(/without an account/i), 'Celebrity');
    await user.click(screen.getByRole('button', { name: 'Add seat' }));

    await waitFor(() =>
      expect(addDummySeat).toHaveBeenCalledWith({
        leagueId: 7,
        year: 2026,
        dummyName: 'Celebrity',
      }),
    );
  });

  it('deals everyone at random', async () => {
    const user = setup();

    await user.click(screen.getByRole('button', { name: 'Deal at random' }));

    await waitFor(() =>
      expect(randomiseGroups).toHaveBeenCalledWith({
        leagueId: 7,
        year: 2026,
        groupCount: 2,
      }),
    );
  });

  it('celebrates the groups the server returned, not a second shuffle', async () => {
    /**
     * The load-bearing assertion of the whole ceremony. The action has already
     * written these rows; the takeover animates them. If the client rolled its
     * own groups, the listing here would not match the mock's assignments — and
     * a viewer who reloaded mid-animation would see the other answer.
     */
    const user = setup();

    await user.click(screen.getByRole('button', { name: 'Deal at random' }));

    const ceremony = await screen.findByRole('dialog', { hidden: true });
    await user.click(within(ceremony).getByRole('button', { name: /skip/i }));

    expect(
      within(ceremony)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Group 1', 'Group 2']);
    // Group 1 is Grace then Guest, in the order the server chose; Ada is alone
    // in group 2. Reading the rendered rows back is what pins that.
    const namesIn = (group: string) =>
      within(
        within(ceremony)
          .getByRole('heading', { name: group })
          .closest('li') as HTMLElement,
      )
        .getAllByRole('listitem')
        .map((row) => row.textContent);

    expect(namesIn('Group 1')).toEqual(['Grace', 'Guest']);
    expect(namesIn('Group 2')).toEqual(['Ada']);

    // Dismissing the takeover leaves the page saying what happened.
    await user.click(within(ceremony).getByRole('button', { name: /done/i }));
    await waitFor(() =>
      expect(screen.getByText('Everyone dealt into groups')).toBeInTheDocument(),
    );
  });

  it('confirms before starting the draft', async () => {
    // Groups are fixed from that moment.
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = setup();

    await user.click(screen.getByRole('button', { name: 'Start the draft' }));

    expect(confirm).toHaveBeenCalled();
    expect(startDraft).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('hides every arrangement control once the draft is open', async () => {
    // Reshuffling mid-draft would move people away from picks they have made,
    // and the action refuses — so the console must not offer it.
    setup({ status: 'active' });

    expect(screen.queryByRole('button', { name: 'Deal at random' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start the draft' })).toBeNull();
    expect(screen.queryByLabelText(/without an account/i)).toBeNull();
    for (const select of screen.getAllByRole('combobox')) {
      expect(select).toBeDisabled();
    }
  });

  it('says what state the draft is in when it is not pending', () => {
    setup({ status: 'complete' });

    expect(screen.getByText(/This draft is complete/)).toBeInTheDocument();
  });

  it('offers a way to end the draft once it is running', async () => {
    // The defect this closes: `completeDraft` has existed since P10.T17 and
    // nothing called it, so an owner on the one page that manages the season
    // had no way to say the draft was over. A draft with no end state is why
    // journey 1 could not finish.
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = setup({ status: 'active' });

    await user.click(screen.getByRole('button', { name: 'Finish the draft' }));

    expect(completeDraft).toHaveBeenCalledWith({ leagueId: 7, year: 2026 });
    await waitFor(() =>
      expect(screen.getByText('The draft is finished')).toBeInTheDocument(),
    );
    confirm.mockRestore();
  });

  it('confirms before finishing, and a refusal writes nothing', async () => {
    // Same reasoning as starting: the league is told the draft is over, and
    // people stop watching. A mis-click must not be the thing that says so.
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = setup({ status: 'active' });

    await user.click(screen.getByRole('button', { name: 'Finish the draft' }));

    expect(confirm).toHaveBeenCalled();
    expect(completeDraft).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('offers nothing to finish before it has started, or after it has ended', () => {
    setup({ status: 'pending' });
    expect(screen.queryByRole('button', { name: 'Finish the draft' })).toBeNull();

    cleanup();
    setup({ status: 'complete' });
    expect(screen.queryByRole('button', { name: 'Finish the draft' })).toBeNull();
  });

  it('reports a refusal rather than pretending it worked', async () => {
    assignSeats.mockResolvedValueOnce({
      ok: false,
      code: 'CONFLICT',
      message: 'groups can only be arranged before the draft starts',
    } as never);
    const user = setup();

    const row = screen.getByText(/Grace/).closest('li') as HTMLElement;
    await user.selectOptions(within(row).getByRole('combobox'), '1');

    expect(
      await screen.findByText('groups can only be arranged before the draft starts'),
    ).toBeInTheDocument();
  });
});

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const assignSeats = vi.hoisted(() => vi.fn(async () => ({ ok: true, data: null })));
const addDummySeat = vi.hoisted(() =>
  vi.fn(async () => ({ ok: true, data: { draftId: 9 } })),
);
const randomiseGroups = vi.hoisted(() =>
  vi.fn(async () => ({ ok: true, data: { assigned: 4 } })),
);
const removeSeat = vi.hoisted(() => vi.fn(async () => ({ ok: true, data: null })));
const startDraft = vi.hoisted(() => vi.fn(async () => ({ ok: true, data: null })));

vi.mock('@/actions/leagues/manage-seats', () => ({
  assignSeats,
  addDummySeat,
  randomiseGroups,
  removeSeat,
}));
vi.mock('@/actions/leagues/manage-league', () => ({ startDraft }));

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

  it('🔴 assigns a group with a select, so it works without a mouse', async () => {
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

  it('🔴 does not offer to remove a seat that has picks', async () => {
    // Removing it would orphan them — `draft_picks` has no foreign key. A
    // button that always refuses reads as a broken app.
    setup();

    const row = screen.getByText(/Guest/).closest('li') as HTMLElement;
    expect(within(row).queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(row.textContent).toContain('has picks');
  });

  it('🔴 confirms before removing someone', async () => {
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

  it('🔴 confirms before starting the draft', async () => {
    // Groups are fixed from that moment.
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = setup();

    await user.click(screen.getByRole('button', { name: 'Start the draft' }));

    expect(confirm).toHaveBeenCalled();
    expect(startDraft).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('🔴 hides every arrangement control once the draft is open', async () => {
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

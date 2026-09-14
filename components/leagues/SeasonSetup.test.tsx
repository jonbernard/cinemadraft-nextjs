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

import { SeasonSetup, type SetupSeatView } from '@/components/leagues/SeasonSetup';
import { CHARACTERS } from '@/lib/leagues/characters';

/**
 * The console the owner uses once a year, before a draft.
 *
 * The properties that matter are the ones that are hard to undo: a seat with
 * picks cannot be removed, destructive actions confirm, and groups are frozen
 * once the draft opens.
 */
/**
 * 🔴 The confirmations used to be `window.confirm`, stubbed here with a spy
 * (P14). A stub like that keeps passing after the confirmation is deleted —
 * `mockReturnValue(true)` and "no dialog at all" look identical from outside —
 * so these drive the real `ConfirmDialog` instead: find it, answer it, and let
 * its absence be the failure.
 */
const confirmation = () => screen.getByRole('dialog');
const answer = (user: ReturnType<typeof userEvent.setup>, name: RegExp | string) =>
  user.click(within(confirmation()).getByRole('button', { name }));

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
  it('lists everyone, saying which seats have nobody behind them', () => {
    // 🔴 "Guest" is a name the owner typed in, so it is a real person who has
    // not registered — not a placeholder. That word was the owner's complaint
    // (P14.T18) and it must not come back.
    setup();

    const guest = screen.getByText(/Guest/);
    expect(guest).toHaveTextContent('not registered yet');
    expect(guest).not.toHaveTextContent('placeholder');
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

  it('confirms before removing someone, in the app rather than in browser chrome', async () => {
    const native = vi.spyOn(window, 'confirm');
    const user = setup();

    const row = screen.getByText(/Grace/).closest('li') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Remove' }));

    // The defect P14 fixes: this used to be a browser dialog the product could
    // neither style nor place.
    expect(native).not.toHaveBeenCalled();
    expect(confirmation()).toHaveTextContent('Remove Grace from this league?');
    // Destructive, so the keyboard default is the harmless one.
    expect(document.activeElement).toBe(
      within(confirmation()).getByRole('button', { name: 'Cancel' }),
    );

    await answer(user, 'Cancel');
    expect(removeSeat).not.toHaveBeenCalled();
    native.mockRestore();
  });

  it('removes once confirmed', async () => {
    const user = setup();

    const row = screen.getByText(/Grace/).closest('li') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Remove' }));
    await answer(user, 'Remove');

    await waitFor(() =>
      expect(removeSeat).toHaveBeenCalledWith({ leagueId: 7, draftId: 2 }),
    );
  });

  it('seats a player who has not registered', async () => {
    const user = setup();

    await user.type(screen.getByLabelText(/hasn’t registered/i), 'Celebrity');
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

    // 🔴 Named, not "the only dialog": the confirmations are `<dialog>`s too
    // (P14), and a closed one still matches `{ hidden: true }`.
    const ceremony = await screen.findByRole('dialog', {
      hidden: true,
      name: /dealing/i,
    });
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
    const user = setup();

    await user.click(screen.getByRole('button', { name: 'Start the draft' }));

    expect(confirmation()).toHaveTextContent(
      'Start the draft? Groups cannot be changed afterwards.',
    );
    await answer(user, 'Cancel');
    expect(startDraft).not.toHaveBeenCalled();
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
    const user = setup({ status: 'active' });

    await user.click(screen.getByRole('button', { name: 'Finish the draft' }));
    await answer(user, 'Finish the draft');

    expect(completeDraft).toHaveBeenCalledWith({ leagueId: 7, year: 2026 });
    await waitFor(() =>
      expect(screen.getByText('The draft is finished')).toBeInTheDocument(),
    );
  });

  it('confirms before finishing, and a refusal writes nothing', async () => {
    // Same reasoning as starting: the league is told the draft is over, and
    // people stop watching. A mis-click must not be the thing that says so.
    const user = setup({ status: 'active' });

    await user.click(screen.getByRole('button', { name: 'Finish the draft' }));

    expect(confirmation()).toHaveTextContent(
      'Finish the draft? The league will be told it is over.',
    );
    await answer(user, 'Cancel');
    expect(completeDraft).not.toHaveBeenCalled();
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

/** `count` real people, so the arithmetic beside the groups input has a subject. */
function players(count: number): SetupSeatView[] {
  return Array.from({ length: count }, (_, index) => ({
    draftId: index + 1,
    name: `Player ${index + 1}`,
    isDummy: false,
    group: null,
    order: null,
    hasPicks: false,
  }));
}

/** The sentence beside the groups input, without the heading above it. */
function tally(): string {
  const line = screen.getByText(/player/i, { selector: 'p' });
  return line.textContent ?? '';
}

describe('SeasonSetup, rounding out the groups', () => {
  it('says how many players there are and what even groups would need', () => {
    setup({ seats: players(14), suggestedGroupCount: 4 });

    expect(tally()).toBe('14 players · add 2 characters for even groups');
  });

  it('says the groups are even rather than asking for zero', () => {
    // 🔴 "add 0 characters" reads as a target you have failed to hit.
    setup({ seats: players(16), suggestedGroupCount: 4 });

    expect(tally()).toBe('16 players · groups are even');
  });

  it('recomputes when the owner changes the group count', async () => {
    // 🔴 The one that catches a value cached at mount.
    const user = setup({ seats: players(14), suggestedGroupCount: 4 });
    expect(tally()).toBe('14 players · add 2 characters for even groups');

    const input = screen.getByLabelText(/how many groups/i);
    await user.clear(input);
    await user.type(input, '3');

    expect(tally()).toBe('14 players · add 1 character for even groups');
  });

  it('seats one character per press, never the whole gap', async () => {
    // 🔴 The owner's explicit instruction: "I don't want you to do it for us."
    // Fourteen seats and four groups wants two more, and one press gives one.
    const user = setup({ seats: players(14), suggestedGroupCount: 4 });

    await user.click(screen.getByRole('button', { name: 'Add a character' }));

    await waitFor(() => expect(addDummySeat).toHaveBeenCalledTimes(1));
    const [call] = addDummySeat.mock.calls as unknown as [[{ dummyName: string }]];
    expect(CHARACTERS as readonly string[]).toContain(call[0].dummyName);
  });

  it('never offers a character already seated', async () => {
    // The whole pool bar one is taken, so the only name left is the last.
    const taken: SetupSeatView[] = CHARACTERS.slice(0, 48).map((name, index) => ({
      draftId: index + 1,
      name,
      isDummy: true,
      group: null,
      order: null,
      hasPicks: false,
    }));
    const user = setup({ seats: taken, suggestedGroupCount: 12 });

    await user.click(screen.getByRole('button', { name: 'Add a character' }));

    await waitFor(() =>
      expect(addDummySeat).toHaveBeenCalledWith({
        leagueId: 7,
        year: 2026,
        dummyName: 'Annie Hall',
      }),
    );
  });

  it('refuses rather than repeating when every character is seated', () => {
    const taken: SetupSeatView[] = CHARACTERS.map((name, index) => ({
      draftId: index + 1,
      name,
      isDummy: true,
      group: null,
      order: null,
      hasPicks: false,
    }));
    setup({ seats: taken, suggestedGroupCount: 13 });

    expect(screen.getByRole('button', { name: 'No characters left' })).toBeDisabled();
  });

  it('calls a typed-in name a player, not a placeholder', async () => {
    // 🔴 The owner's actual complaint. Both seats below are `isDummy` — one
    // mechanism, two different things — and only the character is a placeholder.
    setup({
      seats: [
        {
          draftId: 1,
          name: 'Neo',
          isDummy: true,
          group: null,
          order: null,
          hasPicks: false,
        },
        {
          draftId: 2,
          name: 'Aunt Sally',
          isDummy: true,
          group: null,
          order: null,
          hasPicks: false,
        },
      ],
    });

    expect(screen.getByText(/Aunt Sally/)).toHaveTextContent('not registered yet');
    expect(screen.getByText(/Aunt Sally/)).not.toHaveTextContent('character');
    expect(screen.getByText(/^Neo/)).toHaveTextContent('character');
  });

  it('shows the running order the deal chose, and orders the list by it', () => {
    // 🔴 The defect the owner reported as "we're not setting the order when
    // we're randomizing into groups". The order WAS being set —
    // `dealIntoGroups` assigns `order: position + 1` and `assignSeats` writes
    // it — but this list rendered seats in creation order and showed no order
    // at all, so a deal changed nothing visible and looked like a no-op.
    setup({
      seats: [
        {
          draftId: 3,
          name: 'Carol',
          isDummy: false,
          group: 2,
          order: 1,
          hasPicks: false,
        },
        {
          draftId: 1,
          name: 'Alice',
          isDummy: false,
          group: 1,
          order: 2,
          hasPicks: false,
        },
        { draftId: 2, name: 'Bob', isDummy: false, group: 1, order: 1, hasPicks: false },
      ],
    });

    const rows = screen.getAllByRole('listitem');
    // Group 1 before group 2, and within group 1 the dealt order, NOT the
    // creation order — which would have put Alice first.
    expect(rows[0]).toHaveTextContent('Bob');
    expect(rows[1]).toHaveTextContent('Alice');
    expect(rows[2]).toHaveTextContent('Carol');
    expect(rows[0]).toHaveTextContent('01');
    expect(rows[1]).toHaveTextContent('02');
  });

  it('says a seat has no running order yet rather than showing a zero', () => {
    // Before a deal every seat is group null / order null. A "00" reads as a
    // position; no position is a different fact.
    setup({
      seats: [
        {
          draftId: 1,
          name: 'Alice',
          isDummy: false,
          group: null,
          order: null,
          hasPicks: false,
        },
      ],
    });
    expect(screen.getByText('No running order yet')).toBeInTheDocument();
  });
});

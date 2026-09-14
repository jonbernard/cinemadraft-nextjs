'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { completeDraft, startDraft } from '@/actions/leagues/manage-league';
import {
  addDummySeat,
  assignSeats,
  randomiseGroups,
  removeSeat,
} from '@/actions/leagues/manage-seats';
import { isCharacter, nextCharacter } from '@/lib/leagues/characters';
// 🔴 A *value* import from `lib/services/`, which every other component here
// takes as a type only. It is safe because `group-assignment.ts` imports
// nothing at all — no repository, no `lib/db`, so no Prisma can reach this
// client bundle through it. Keep it that way: the day that module grows an
// import, this line has to move rather than the module.
import { type Assignment, seatsToEvenGroups } from '@/lib/services/group-assignment';
import { cn } from '@/lib/utils/cn';
import { Button } from '../ui/Button';
import { useConfirm } from '../ui/ConfirmDialog';
import { type CeremonyGroup, GroupCeremony } from './GroupCeremony';

export type SetupSeatView = {
  draftId: number;
  name: string;
  isDummy: boolean;
  group: number | null;
  order: number | null;
  hasPicks: boolean;
};

/**
 * Arranging a season before the draft (P10.T14–T17).
 *
 * **Desktop-first (D49)**, the stated exception: this is done once a year from
 * a laptop, in the hour before a video call.
 *
 * 🔴 **Group assignment is a `<select>` per seat, not drag-and-drop.** The
 * source used dragging, and dragging alone is unusable without a mouse
 * (a11y `gesture-alternative`) — `PickList` gets away with it only because
 * `@hello-pangea/dnd` ships a keyboard path. A select is operable by keyboard,
 * by screen reader and by touch with no library at all, and for "put this
 * person in group 3" it is also *faster* than dragging across a wide board.
 *
 * Every change saves immediately. There is no Save button because there is no
 * moment when a half-arranged league is worth keeping in a draft state — and a
 * form that batches changes invites the owner to close the tab having lost
 * them.
 */
export function SeasonSetup({
  leagueId,
  year,
  seats,
  groups,
  suggestedGroupCount,
  status,
  className,
}: {
  leagueId: number;
  year: number;
  seats: readonly SetupSeatView[];
  groups: readonly number[];
  suggestedGroupCount: number;
  status: string | null;
  className?: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [dummyName, setDummyName] = useState('');
  const [groupCount, setGroupCount] = useState(suggestedGroupCount);
  const [ceremony, setCeremony] = useState<CeremonyGroup[] | null>(null);
  const [pending, startTransition] = useTransition();

  const isPending = status === 'pending';

  // One group more than exists, so there is always somewhere new to put
  // someone without adding a group first.
  const options = [...new Set([...groups, groups.length + 1, 1])].sort((a, b) => a - b);

  // 🔴 Resolved per render from the seats on screen, so pressing the button
  // twice cannot seat the same character twice — and so the label can say the
  // pool is empty rather than the button failing when pressed.
  const character = nextCharacter(seats.map((seat) => seat.name));

  // 🔴 Per render, never cached: `groupCount` is a control the owner types
  // into and `seats` changes the moment one is added, and this line is the
  // only thing that tells them the button and the groups input are one
  // feature. A value computed at mount would go stale on the first keystroke.
  const shortfall = seatsToEvenGroups(seats.length, groupCount);

  const run = useCallback(
    (work: () => Promise<{ ok: boolean; message?: string }>, success?: string) => {
      setMessage(null);
      startTransition(async () => {
        const result = await work();
        setMessage(
          result.ok ? (success ?? null) : (result.message ?? 'That did not work'),
        );
      });
    },
    [],
  );

  const setGroup = useCallback(
    (draftId: number, group: number | null) => {
      const inGroup = seats.filter(
        (seat) => seat.group === group && seat.draftId !== draftId,
      );
      run(() =>
        assignSeats({
          leagueId,
          assignments: [
            { draftId, group, order: group == null ? null : inGroup.length + 1 },
          ],
        }),
      );
    },
    [leagueId, seats, run],
  );

  /**
   * The seats in the running order the board will use, not the order they were
   * created in.
   *
   * 🔴 **The list used to render `seats` straight through, and showed no
   * `order` at all** — so after dealing, the page looked exactly as it had
   * before, and the owner reasonably concluded the randomiser was not setting
   * an order. It was: `dealIntoGroups` assigns `order: position + 1` within
   * each group and `assignSeats` writes it. Only the evidence was missing.
   *
   * Unassigned seats sort last: before a deal every seat is `group: null`, and
   * putting them first would open the page on a list of blanks.
   */
  const ordered = useMemo(
    () =>
      [...seats].sort((a, b) => {
        const byGroup =
          (a.group ?? Number.MAX_SAFE_INTEGER) - (b.group ?? Number.MAX_SAFE_INTEGER);
        if (byGroup !== 0) return byGroup;
        return (
          (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
        );
      }),
    [seats],
  );

  const onDummyNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setDummyName(event.target.value);
  }, []);

  const onGroupCountChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setGroupCount(Number(event.target.value));
  }, []);

  const addSeat = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const name = dummyName.trim();
      if (name === '') return;
      run(() => addDummySeat({ leagueId, year, dummyName: name }), `${name} seated`);
      setDummyName('');
    },
    [dummyName, leagueId, year, run],
  );

  const deal = useCallback(() => {
    setMessage(null);
    startTransition(async () => {
      const result = await randomiseGroups({ leagueId, year, groupCount });
      if (!result.ok) {
        setMessage(result.message ?? 'That did not work');
        return;
      }

      /**
       * 🔴 The groups are already saved by the time this line runs.
       *
       * The ceremony animates what the server decided; it never decides
       * anything itself. That is why the assignments come back from the action
       * rather than being re-derived here — a client-side shuffle would give
       * two people watching the same league two different draws, and the one
       * they saw would not be the one in the database.
       */
      const dealt = toCeremonyGroups(result.data.assignments, seats);
      // A league with nobody in it has nothing to show; say so and stop.
      if (dealt.length === 0) {
        setMessage('Everyone dealt into groups');
        return;
      }
      setCeremony(dealt);
    });
  }, [leagueId, year, groupCount, seats]);

  // The takeover lifts onto a page that is already right: `revalidatePath` in
  // the action refreshed the rows beneath while the reel was still spinning.
  const endCeremony = useCallback(() => {
    setCeremony(null);
    setMessage('Everyone dealt into groups');
  }, []);

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      <section className="flex flex-col gap-4">
        <h2 className="text-text-dim text-xs font-normal">Who is playing</h2>

        <ul className="flex flex-col">
          {ordered.map((seat) => (
            <SeatRow
              key={seat.draftId}
              seat={seat}
              leagueId={leagueId}
              options={options}
              disabled={pending}
              editable={isPending}
              onSetGroup={setGroup}
              onDone={setMessage}
            />
          ))}
        </ul>

        {isPending ? (
          <form className="flex flex-wrap items-end gap-3" onSubmit={addSeat}>
            <label className="flex flex-col gap-1">
              {/* 🔴 Not "someone without an account", which is what the
                  characters below are. A name typed here is a real person who
                  has not registered yet, and the old label called them a
                  placeholder — the owner's complaint. */}
              <span className="text-text-dim text-xs">
                Add a player who hasn’t registered
              </span>
              <input
                type="text"
                value={dummyName}
                onChange={onDummyNameChange}
                placeholder="Their name"
                className="border-border-rule bg-bg-surface text-text-primary focus-visible:outline-accent-fill min-h-11 border px-3 text-sm focus-visible:outline-2"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="border-border-rule text-text-primary hover:bg-bg-surface focus-visible:outline-accent-fill min-h-11 border px-4 text-sm disabled:opacity-60 focus-visible:outline-2"
            >
              Add seat
            </button>

            {/* 🔴 ONE press seats ONE character, and there is deliberately no
                "fill the gap" button beside it. The owner's words: "I don't
                want you to do it for us." The count in the Groups section says
                how many are wanted; choosing to add each one stays theirs.

                A second control, not a second form — it acts rather than
                submits, so `type="button"` inside the form above. */}
            <button
              type="button"
              disabled={pending || character === null}
              onClick={() => {
                if (character === null) return;
                run(
                  () => addDummySeat({ leagueId, year, dummyName: character }),
                  `${character} seated`,
                );
              }}
              className="border-border-rule text-text-primary hover:bg-bg-surface focus-visible:outline-accent-fill min-h-11 border px-4 text-sm disabled:opacity-60 focus-visible:outline-2"
            >
              {character === null ? 'No characters left' : 'Add a character'}
            </button>
          </form>
        ) : null}
      </section>

      {isPending ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-text-dim text-xs font-normal">Groups</h2>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-text-dim text-xs">How many groups</span>
              <input
                type="number"
                min={1}
                max={20}
                value={groupCount}
                onChange={onGroupCountChange}
                className="border-border-rule bg-bg-surface text-text-primary focus-visible:outline-accent-fill min-h-11 w-24 border px-3 text-sm focus-visible:outline-2"
              />
            </label>

            {/* 🔴 Outside the `<label>`, deliberately: inside it this sentence
                joins the input's accessible name, so a screen reader would
                announce "How many groups 14 players add 2 characters for even
                groups" on focus. It is a reading beside the control, not a
                label for it.

                🔴 Zero is said in words. "add 0 characters for even groups"
                reads as a target you have failed to hit; "groups are even" is
                the same fact and is the answer. */}
            <p className="text-text-secondary text-sm">
              <span className="tabular font-mono">{seats.length}</span>{' '}
              {seats.length === 1 ? 'player' : 'players'}
              {shortfall === 0
                ? ' · groups are even'
                : ` · add ${shortfall} ${
                    shortfall === 1 ? 'character' : 'characters'
                  } for even groups`}
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={deal}
              className="border-border-rule text-text-primary hover:bg-bg-surface focus-visible:outline-accent-fill min-h-11 border px-4 text-sm disabled:opacity-60 focus-visible:outline-2"
            >
              Deal at random
            </button>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-text-dim text-xs font-normal">The draft</h2>

        {isPending ? (
          <StartDraftButton
            leagueId={leagueId}
            year={year}
            disabled={pending}
            onDone={setMessage}
          />
        ) : (
          <>
            <p className="text-text-secondary text-sm">
              This draft is {status}. Groups are fixed once it starts.
            </p>
            {/* Only while it is running: a finished draft has nothing more to
                offer here, and a pending one has not begun. */}
            {status === 'active' ? (
              <FinishDraftButton
                leagueId={leagueId}
                year={year}
                disabled={pending}
                onDone={setMessage}
              />
            ) : null}
          </>
        )}
      </section>

      <p aria-live="polite" className="text-text-secondary min-h-5 text-sm">
        {pending ? 'Saving…' : (message ?? '')}
      </p>

      {ceremony ? <GroupCeremony groups={ceremony} onDone={endCeremony} /> : null}
    </div>
  );
}

/**
 * The saved assignments, as the ceremony wants to show them.
 *
 * Purely a reshape — draft ids become names and the flat list becomes groups.
 * Nothing is reordered beyond the `order` the server already chose, because the
 * order it chose is the one the board will use.
 */
function toCeremonyGroups(
  assignments: readonly Assignment[],
  seats: readonly SetupSeatView[],
): CeremonyGroup[] {
  const nameOf = new Map(seats.map((seat) => [seat.draftId, seat.name]));
  const byGroup = new Map<number, { order: number; name: string }[]>();

  for (const entry of assignments) {
    if (entry.group == null) continue;
    const members = byGroup.get(entry.group) ?? [];
    members.push({ order: entry.order ?? 0, name: nameOf.get(entry.draftId) ?? 'Seat' });
    byGroup.set(entry.group, members);
  }

  return [...byGroup.entries()]
    .sort(([a], [b]) => a - b)
    .map(([group, members]) => ({
      group,
      names: members.sort((a, b) => a.order - b.order).map((member) => member.name),
    }));
}

/**
 * One person's row.
 *
 * Its own component so the select's handler memoises against the seat rather
 * than being rebuilt for every row on every keystroke elsewhere on the page.
 */
function SeatRow({
  seat,
  leagueId,
  options,
  disabled,
  editable,
  onSetGroup,
  onDone,
}: {
  seat: SetupSeatView;
  leagueId: number;
  options: readonly number[];
  disabled: boolean;
  editable: boolean;
  onSetGroup: (draftId: number, group: number | null) => void;
  onDone: (message: string | null) => void;
}) {
  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      onSetGroup(
        seat.draftId,
        event.target.value === '' ? null : Number(event.target.value),
      );
    },
    [onSetGroup, seat.draftId],
  );

  return (
    <li className="border-border-rule flex flex-wrap items-center gap-3 border-b py-3">
      {/* 🔴 The running order, in the same two-digit monospace the board's own
          pending list uses, so the number here and the number there are
          recognisably the same fact. An em dash before a deal rather than a
          zero: no order yet is a different thing from an order of nothing. */}
      <span className="text-text-secondary tabular w-6 shrink-0 font-mono text-xs">
        {/* 🔴 The digits are for the eye and the sentence is for the ear.
            `aria-label` on a bare span is not supported — a span has no role
            to carry it — and "01" read aloud on its own says nothing about
            what it numbers. */}
        <span aria-hidden="true">
          {seat.order == null ? '—' : String(seat.order).padStart(2, '0')}
        </span>
        <span className="sr-only">
          {seat.order == null ? 'No running order yet' : `Position ${seat.order}`}
        </span>
      </span>
      <span className="text-text-primary min-w-40 flex-1 text-sm">
        {seat.name}
        {/* 🔴 Two different things share one database mechanism — both are a
            seat with `dummy: true` and a `dummy_name` — and only one of them
            is a placeholder. A name the owner typed in is a real person who
            has not registered; calling them a placeholder was the complaint
            P14.T18 fixes. Membership of `CHARACTERS` is what tells them apart,
            with the known cost that a member genuinely named "Neo" reads as a
            character; see that module for why it is not a column. */}
        {seat.isDummy ? (
          <span className="text-text-dim">
            {isCharacter(seat.name) ? ' · character' : ' · not registered yet'}
          </span>
        ) : null}
      </span>

      <label className="flex items-center gap-2 text-xs">
        <span className="text-text-dim">Group</span>
        <select
          value={seat.group ?? ''}
          disabled={disabled || !editable}
          onChange={onChange}
          className="border-border-rule bg-bg-surface text-text-primary focus-visible:outline-accent-fill min-h-11 border px-2 text-sm focus-visible:outline-2"
        >
          <option value="">Unassigned</option>
          {options.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
      </label>

      {/* 🔴 A seat that has drafted cannot be removed — the picks have no
          foreign key and would be orphaned. Saying so beats a button that
          always refuses. */}
      {seat.hasPicks ? (
        <span className="text-text-dim text-xs">has picks</span>
      ) : (
        <RemoveSeatButton
          leagueId={leagueId}
          draftId={seat.draftId}
          name={seat.name}
          disabled={disabled}
          onDone={onDone}
        />
      )}
    </li>
  );
}

/**
 * 🔴 Removing a seat confirms first.
 *
 * Mid-season it is hard to undo: the person has to be re-invited or re-added,
 * and if they were mid-draft their picks are gone with them. `confirm` rather
 * than a custom dialog because it is unmissable, cannot be mis-styled, and the
 * only thing worse than an ugly confirmation is one someone clicks through.
 */
function RemoveSeatButton({
  leagueId,
  draftId,
  name,
  disabled,
  onDone,
}: {
  leagueId: number;
  draftId: number;
  name: string;
  disabled: boolean;
  onDone: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  const remove = useCallback(async () => {
    if (!(await confirm(`Remove ${name} from this league?`, 'Remove'))) return;
    startTransition(async () => {
      const result = await removeSeat({ leagueId, draftId });
      onDone(result.ok ? `${name} removed` : result.message);
    });
  }, [leagueId, draftId, name, onDone, confirm]);

  return (
    <>
      {dialog}
      <button
        type="button"
        disabled={disabled || pending}
        onClick={remove}
        className="text-text-dim hover:text-text-primary focus-visible:outline-accent-fill min-h-11 text-xs underline focus-visible:outline-2"
      >
        Remove
      </button>
    </>
  );
}

/** 🔴 Starting the draft confirms too: groups are fixed from that moment. */
function StartDraftButton({
  leagueId,
  year,
  disabled,
  onDone,
}: {
  leagueId: number;
  year: number;
  disabled: boolean;
  onDone: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();
  const router = useRouter();

  const start = useCallback(async () => {
    if (
      !(await confirm(
        'Start the draft? Groups cannot be changed afterwards.',
        'Start the draft',
      ))
    ) {
      return;
    }
    startTransition(async () => {
      const result = await startDraft({ leagueId, year });
      if (!result.ok) {
        onDone(result.message);
        return;
      }
      // 🔴 Straight to the console. Starting the draft is the moment the
      // owner stops arranging and starts running it — on a call, with the
      // league watching — and the only thing they can do next is enter picks.
      // Leaving them on the setup page meant reading a success message and
      // then going looking for the way in, which is the least convenient
      // possible half-second.
      //
      // It is also now the ONLY way in: the league page stopped offering "Run
      // the draft" on a pending league, because picks are refused before the
      // start (`actions/draft/guard.ts`) and that button led to a console that
      // would refuse every one of them.
      onDone('The draft is open');
      router.push(`/leagues/${leagueId}/draft?year=${year}`);
    });
  }, [leagueId, year, onDone, confirm, router]);

  return (
    <>
      {dialog}
      <button
        type="button"
        disabled={disabled || pending}
        onClick={start}
        className="bg-accent-fill focus-visible:outline-accent-fill min-h-11 w-fit px-4 text-sm text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Start the draft
      </button>
    </>
  );
}

/**
 * 🔴 The draft's end state, which the app has never had.
 *
 * `completeDraft` shipped in P10.T17 and no UI called it, so an owner could
 * open a draft and never close one: the league board said `active` forever and
 * the one page that manages a season offered nothing but a sentence. Found by
 * the tranche-3 planner; built here because the missing half was always the
 * button, never the rule — the action is gated, validated and revalidating
 * already.
 *
 * Confirms, like starting does. The league stops watching when this is
 * pressed, which is not something a mis-click should be able to say. It is
 * reversible — `startDraft` sets `active` from any status — but "reversible"
 * is not the same as "harmless in front of twelve people on a call".
 *
 * The `Button` primitive in its default carmine (D69): carmine is submit and
 * destructive, brass is awards, and ending a draft is neither an award nor
 * something to dress as one.
 */
function FinishDraftButton({
  leagueId,
  year,
  disabled,
  onDone,
}: {
  leagueId: number;
  year: number;
  disabled: boolean;
  onDone: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  const finish = useCallback(async () => {
    if (
      !(await confirm(
        'Finish the draft? The league will be told it is over.',
        'Finish the draft',
      ))
    ) {
      return;
    }
    startTransition(async () => {
      const result = await completeDraft({ leagueId, year });
      onDone(result.ok ? 'The draft is finished' : result.message);
    });
  }, [leagueId, year, onDone, confirm]);

  return (
    <>
      {dialog}
      <Button
        type="button"
        disabled={disabled || pending}
        onClick={finish}
        sx={{ width: 'fit-content', minHeight: 44 }}
      >
        Finish the draft
      </Button>
    </>
  );
}
